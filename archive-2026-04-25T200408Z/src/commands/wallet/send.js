const {
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    InteractionContextType,
    MessageFlags
} = require('discord.js');
const db = require('../../core/database');
const { exchOnly } = require('../../config/permissions');
const { sendLtc } = require('../../core/walletOps');
const { reserveWithdrawal, completeWithdrawal, failWithdrawal } = require('../../core/payoutSafety');
const { formatFiat } = require('../../core/currency');
const { getPrice } = require('../../core/priceCache');
const appConfig = require('../../config/appConfig');
const logger = require('../../core/logger');
const env = require('../../config/env');
const emojis = require('../../config/emojis');

const MAX_WITHDRAWAL = env.MAX_WITHDRAWAL;
const DAILY_LIMIT = env.DAILY_LIMIT;
const UNKNOWN_INTERACTION_CODE = 10062;

const DISPLAY_CURRENCIES = [
    { name: 'LTC (Ł)', value: 'ltc' },
    { name: 'USD ($)', value: 'usd' },
    { name: 'EUR (€)', value: 'eur' },
    { name: 'GBP (£)', value: 'gbp' },
    { name: 'INR (₹)', value: 'inr' }
];

function isUnknownInteractionError(error) {
    return Number(error?.code) === UNKNOWN_INTERACTION_CODE;
}

/**
 * Convert a fiat amount to LTC using cached price.
 * Returns null if currency is 'ltc' (already in LTC).
 */
function fiatToLtc(amount, currency) {
    if (currency === 'ltc') return amount;
    const price = getPrice(currency);
    if (!price || price <= 0) return null;
    return amount / price;
}

module.exports = {
    dmCapable: true,
    data: new SlashCommandBuilder()
        .setName('send')
        .setDescription('Send LTC from your available balance to an external address')
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        )
        .setDMPermission(true)
        .addStringOption((option) =>
            option.setName('address').setDescription('External LTC address').setRequired(true)
        )
        .addNumberOption((option) =>
            option
                .setName('amount')
                .setDescription('Amount to send')
                .setRequired(true)
                .setMinValue(0.0001)
        )
        .addStringOption((option) =>
            option
                .setName('currency')
                .setDescription('Currency for the amount (default: LTC)')
                .setRequired(false)
                .addChoices(...DISPLAY_CURRENCIES)
        ),

    execute: exchOnly(async (interaction) => {
        const discordId = interaction.user.id;
        const targetAddress = interaction.options.getString('address').trim();
        const rawAmount = interaction.options.getNumber('amount');
        const currency = (interaction.options.getString('currency') || 'ltc').toLowerCase();
        const ltcRegex = /^(L|M|3|ltc1)[a-zA-Z0-9]{26,62}$/;

        if (!ltcRegex.test(targetAddress)) {
            return interaction.reply({ content: 'Invalid LTC address format.', flags: MessageFlags.Ephemeral });
        }

        // Convert fiat → LTC if needed
        let amountLtc;
        if (currency === 'ltc') {
            amountLtc = rawAmount;
        } else {
            amountLtc = fiatToLtc(rawAmount, currency);
            if (!amountLtc || amountLtc <= 0) {
                return interaction.reply({
                    content: `Could not convert ${currency.toUpperCase()} to LTC. Price data unavailable.`,
                    flags: MessageFlags.Ephemeral
                });
            }
            amountLtc = parseFloat(amountLtc.toFixed(8));
        }

        if (amountLtc > MAX_WITHDRAWAL) {
            return interaction.reply({
                content: `Maximum single withdrawal is ${MAX_WITHDRAWAL} LTC.`,
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            const [rows] = await db.query(
                'SELECT id, balance_available, ltc_deposit_address FROM users WHERE discord_id = ?',
                [discordId]
            );
            if (!rows.length) {
                return interaction.reply({
                    content: 'You do not have a wallet yet. Use `/register` first.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const user = rows[0];
            if (targetAddress === user.ltc_deposit_address) {
                return interaction.reply({
                    content: 'You cannot send to your own deposit address.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const [dailyRows] = await db.query(
                `SELECT COALESCE(SUM(amount), 0) as daily_total
                 FROM wallet_ledger
                 WHERE user_id = ?
                 AND action_type = 'WITHDRAWAL'
                 AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
                [user.id]
            );
            const dailyTotal = parseFloat(dailyRows[0].daily_total || 0);
            if (dailyTotal + amountLtc > DAILY_LIMIT) {
                return interaction.reply({
                    content: `Daily limit exceeded. Used ${dailyTotal.toFixed(8)} / ${DAILY_LIMIT} LTC today.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const fee = 0.0001;
            const balanceAvailable = parseFloat(user.balance_available);

            // If requested amount exceeds available balance, clamp to the max sendable
            // (available minus fee) rather than erroring.
            if (amountLtc + fee > balanceAvailable) {
                const maxSendable = parseFloat((balanceAvailable - fee).toFixed(8));
                if (maxSendable <= 0) {
                    return interaction.reply({
                        content: `Insufficient funds to cover the network fee. Available: \`${balanceAvailable.toFixed(8)}\` LTC.`,
                        flags: MessageFlags.Ephemeral
                    });
                }
                amountLtc = maxSendable;
            }

            const totalNeeded = parseFloat((amountLtc + fee).toFixed(8));

            // Show fiat line only if user entered a fiat amount AND it wasn't clamped
            const requestedLtc = currency === 'ltc' ? rawAmount : parseFloat((rawAmount / getPrice(currency)).toFixed(8));
            const wasClamped = amountLtc < requestedLtc - 0.000001;
            const fiatLine = (!wasClamped && currency !== 'ltc')
                ? `\n> ${currency.toUpperCase()} Value: \`${formatFiat(rawAmount, currency.toUpperCase())}\``
                : '';
            const clampedNote = wasClamped
                ? `\n> ⚠ Amount adjusted to your max sendable balance.`
                : '';

            const previewEmbed = new EmbedBuilder()
                .setTitle(emojis.withEmoji('withdrawPreview', 'Orbit Trade | Send Preview'))
                .setColor(appConfig.brand.color)
                .setDescription(
                    `> Amount (LTC): \`${amountLtc.toFixed(8)}\` Ł${fiatLine}${clampedNote}\n` +
                    `> Network Fee: \`${fee.toFixed(8)}\` Ł\n` +
                    `> Total Debit: \`${totalNeeded.toFixed(8)}\` Ł\n` +
                    `> Destination: \`${targetAddress}\``
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_withdraw_${interaction.id}`)
                    .setLabel('Confirm Send')
                    .setEmoji(emojis.getComponent('confirmAction'))
                    .setStyle(appConfig.brand.buttonStyle),
                new ButtonBuilder()
                    .setCustomId(`cancel_withdraw_${interaction.id}`)
                    .setLabel('Cancel')
                    .setEmoji(emojis.getComponent('cancelAction'))
                    .setStyle(ButtonStyle.Danger)
            );

            await interaction.reply({ embeds: [previewEmbed], components: [row], flags: MessageFlags.Ephemeral });
            const response = await interaction.fetchReply();

            const collector = response.createMessageComponentCollector({
                filter: (i) => i.user.id === interaction.user.id,
                time: 60000
            });

            collector.on('collect', async (i) => {
                try {
                    if (i.customId === `cancel_withdraw_${interaction.id}`) {
                        collector.stop('cancelled');
                        await i.update({ content: 'Send cancelled.', embeds: [], components: [] });
                        return;
                    }
                    if (i.customId !== `confirm_withdraw_${interaction.id}`) return;

                    await i.deferUpdate();

                    let reservation;
                    try {
                        reservation = await reserveWithdrawal({
                            userId: user.id,
                            amountLtc,
                            feeLtc: fee,
                            toAddress: targetAddress,
                            processedBy: interaction.user.id,
                            requestKey: `send:${interaction.id}`
                        });

                        const { txid } = await sendLtc({ destination: targetAddress, amount: amountLtc });

                        await completeWithdrawal({
                            reservationId: reservation.reservationId,
                            txid,
                            actionType: 'WITHDRAWAL'
                        });

                        const success = new EmbedBuilder()
                            .setTitle(emojis.withEmoji('withdrawBroadcast', 'Orbit Trade | Send Broadcast'))
                            .setColor(appConfig.brand.color)
                            .setDescription(
                                `> Sent: \`${amountLtc.toFixed(8)}\` Ł\n` +
                                `> TXID: \`${txid}\``
                            );

                        await i.editReply({ embeds: [success], components: [] });
                        collector.stop('done');

                        await logger.logWithdraw(interaction.client, {
                            title: 'Send Broadcast',
                            summary: 'A user send was broadcast successfully.',
                            fields: [
                                { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
                                { name: 'Amount', value: `${amountLtc.toFixed(8)} LTC`, inline: true },
                                { name: 'Fee', value: `${fee.toFixed(8)} LTC`, inline: true },
                                { name: 'Destination', value: targetAddress, inline: false },
                                { name: 'TXID', value: txid, inline: false }
                            ]
                        });
                        await logger.logTransaction(interaction.client, {
                            title: 'Wallet Send',
                            summary: 'Funds sent from exchanger wallet.',
                            fields: [
                                { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
                                { name: 'Amount', value: `${amountLtc.toFixed(8)} LTC`, inline: true },
                                { name: 'TXID', value: txid, inline: true }
                            ]
                        });

                        await interaction.user.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle(emojis.withEmoji('withdrawSent', 'Orbit Trade | Send Confirmed'))
                                    .setColor(appConfig.brand.color)
                                    .setDescription(
                                        `> Amount: \`${amountLtc.toFixed(8)}\` Ł\n` +
                                        `> Destination: \`${targetAddress}\`\n` +
                                        `> TXID: \`${txid}\``
                                    )
                                    .setTimestamp()
                            ]
                        }).catch(() => {});
                    } catch (error) {
                        if (reservation?.reservationId) {
                            await failWithdrawal({ reservationId: reservation.reservationId }).catch(() => {});
                        }
                        console.error('Send execution error:', error);
                        await i.editReply({ content: `Send failed: ${error.message}`, embeds: [], components: [] }).catch(() => {});
                        collector.stop('error');
                    }
                } catch (error) {
                    if (isUnknownInteractionError(error)) {
                        collector.stop('stale_interaction');
                        return;
                    }
                    console.error('Send interaction error:', error);
                    collector.stop('error');
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    await interaction.editReply({
                        content: 'Send request expired.',
                        embeds: [],
                        components: []
                    }).catch(() => {});
                }
            });
        } catch (error) {
            console.error('Send command failed:', error);
            await logger.logError(interaction.client, {
                title: 'Send Failed',
                summary: 'The send command failed.',
                fields: [
                    { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Context', value: interaction.inGuild() ? 'Guild' : 'DM', inline: true },
                    { name: 'Error', value: error.message, inline: false }
                ]
            });
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Send failed.' }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Send failed.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }, { allowDm: true, allowExternal: true })
};