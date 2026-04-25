const {
    SlashCommandBuilder,
    EmbedBuilder,
    InteractionContextType,
    MessageFlags
} = require('discord.js');
const db = require('../../core/database');
const env = require('../../config/env');
const { exchOnly } = require('../../config/permissions');
const { formatFiat } = require('../../core/currency');
const { getPrice } = require('../../core/priceCache');
const appConfig = require('../../config/appConfig');
const demoStore = require('../../core/demoStore');

const CURRENCY_CHOICES = [
    { name: 'USD ($)', value: 'usd' },
    { name: 'EUR (€)', value: 'eur' },
    { name: 'GBP (£)', value: 'gbp' },
    { name: 'INR (₹)', value: 'inr' }
];

module.exports = {
    dmCapable: true,
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your Orbit Wallet balance')
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        )
        .setDMPermission(true)
        .addStringOption((option) =>
            option
                .setName('currency')
                .setDescription('Currency to display your balance in')
                .setRequired(true)
                .addChoices(...CURRENCY_CHOICES)
        ),

    execute: exchOnly(async (interaction) => {
        const currency = interaction.options.getString('currency').toUpperCase();

        try {
            await interaction.deferReply();

            let rows;
            if (env.DB_ENABLED) {
                [rows] = await db.query(
                    `SELECT id, balance_available, balance_escrow, ltc_deposit_address
                     FROM users
                     WHERE discord_id = ?`,
                    [interaction.user.id]
                );
            } else {
                const demoUser = demoStore.ensureUser(interaction.user.id, interaction.user.username);
                rows = demoUser ? [demoUser] : [];
            }

            if (!rows.length) {
                return interaction.editReply({
                    content: 'No wallet found. Use `/cwallet` to create one.'
                });
            }

            const user = rows[0];
            const availableLtc = parseFloat(user.balance_available || 0);
            const escrowLtc = parseFloat(user.balance_escrow || 0);
            const totalLtc = availableLtc + escrowLtc;

            const price = getPrice(currency.toLowerCase());
            const availableFiat = availableLtc * price;
            const escrowFiat = escrowLtc * price;
            const totalFiat = totalLtc * price;

            const embed = new EmbedBuilder()
                .setColor(appConfig.brand.color)
                .setTitle('Orbit Trade | Wallet Balance')
                .setDescription(
                    `> **Total:** \`${totalLtc.toFixed(8)}\` LTC  ·  **${formatFiat(totalFiat, currency)}**\n` +
                    `> **Available:** \`${availableLtc.toFixed(8)}\` LTC  ·  **${formatFiat(availableFiat, currency)}**\n` +
                    `> **In Escrow:** \`${escrowLtc.toFixed(8)}\` LTC  ·  **${formatFiat(escrowFiat, currency)}**`
                )
                .addFields(
                    {
                        name: 'LTC Price',
                        value: `${formatFiat(price, currency)}/LTC`,
                        inline: true
                    },
                    {
                        name: 'Deposit Address',
                        value: `\`${user.ltc_deposit_address || 'Not generated'}\``,
                        inline: false
                    }
                )
                .setFooter({
                    text: `${env.DB_ENABLED ? 'Orbit Trade' : 'Orbit Demo'} | Prices cached, updated every 60s`,
                    iconURL: interaction.client.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Balance error:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: 'Error fetching balance.', embeds: [] }).catch(() => {});
                return;
            }
            await interaction.reply({ content: 'Error fetching balance.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    }, { allowDm: true, allowExternal: true })
};