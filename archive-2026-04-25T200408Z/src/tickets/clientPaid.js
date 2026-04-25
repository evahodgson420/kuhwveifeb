/**
 * clientPaid.js
 * Handles the "I've Paid" button flow inside a deal ticket.
 *
 * Flow:
 *  1. Client (buyer) clicks "I've Paid" → marks ticket as PAID, pings exchanger
 *  2. Exchanger clicks "Payment Received" → triggers normal release flow
 *  3. Exchanger clicks "Payment Not Received" → reverts to CLAIMED, notifies buyer
 */

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const db = require('../core/database');
const appConfig = require('../config/appConfig');
const { makeTicketContainer } = require('../core/ticketVisuals');
const emojis = require('../config/emojis');
const logger = require('../core/logger');

module.exports = {
    customId: 'clientpaid_',

    async execute(interaction) {
        const id = interaction.customId;

        if (id.startsWith('clientpaid_')) {
            return this.handleClientPaid(interaction);
        }
        if (id.startsWith('clientpaidaccept_')) {
            return this.handleExchangerAccept(interaction);
        }
        if (id.startsWith('clientpaiddecline_')) {
            return this.handleExchangerDecline(interaction);
        }
    },

    // ──────────────────────────────────────────────
    // Step 1: Buyer clicks "I've Paid"
    // ──────────────────────────────────────────────
    async handleClientPaid(interaction) {
        const ticketId = interaction.customId.replace('clientpaid_', '');

        try {
            const [tickets] = await db.query(
                'SELECT * FROM tickets WHERE ticket_id = ?',
                [ticketId]
            );
            if (!tickets.length) {
                return interaction.reply({ content: 'Ticket not found.', flags: MessageFlags.Ephemeral });
            }
            const ticket = tickets[0];

            // Only the buyer can click this
            const [buyerRows] = await db.query(
                'SELECT discord_id FROM users WHERE id = ?',
                [ticket.buyer_id]
            );
            const buyerDiscordId = buyerRows[0]?.discord_id;
            if (interaction.user.id !== buyerDiscordId) {
                return interaction.reply({
                    content: 'Only the buyer of this ticket can mark it as paid.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (ticket.status !== 'CLAIMED') {
                return interaction.reply({
                    content: `This ticket cannot be marked as paid (current status: ${ticket.status}).`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // Update ticket status → PAID
            await db.query(
                'UPDATE tickets SET status = "PAID", paid_at = NOW() WHERE ticket_id = ? AND status = "CLAIMED"',
                [ticketId]
            );

            // Get exchanger discord id
            const [sellerRows] = await db.query(
                'SELECT discord_id FROM users WHERE id = ?',
                [ticket.seller_id]
            );
            const exchangerDiscordId = sellerRows[0]?.discord_id;

            const acceptRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`clientpaidaccept_${ticketId}`)
                    .setLabel('Payment Received ✓')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`clientpaiddecline_${ticketId}`)
                    .setLabel('Payment NOT Received ✗')
                    .setStyle(ButtonStyle.Danger)
            );

            await interaction.update({
                components: [
                    makeTicketContainer(
                        'Payment Sent',
                        [
                            `> Buyer <@${buyerDiscordId}> has marked this ticket as **paid**.`,
                            `> Exchanger <@${exchangerDiscordId || 'Unknown'}>: please confirm whether you have received the payment.`,
                            '> Once you confirm receipt, the LTC will be released to the buyer.'
                        ],
                        [acceptRow]
                    )
                ],
                flags: MessageFlags.IsComponentsV2
            }).catch(() => {});

            // Ping exchanger in thread
            const thread = interaction.channel;
            if (thread && exchangerDiscordId) {
                const ping = await thread.send({
                    content: `<@${exchangerDiscordId}> — the buyer has marked this deal as paid. Please confirm above.`
                }).catch(() => null);
                if (ping) setTimeout(() => ping.delete().catch(() => {}), 5000);
            }

            await logger.logTransaction(interaction.client, {
                title: 'Ticket Marked Paid',
                summary: `Buyer marked ticket as paid.`,
                fields: [
                    { name: 'Ticket', value: ticketId, inline: true },
                    { name: 'Buyer', value: `<@${buyerDiscordId}>`, inline: true }
                ]
            });
        } catch (error) {
            console.error('clientPaid handleClientPaid error:', error);
            await interaction.reply({
                content: 'Failed to mark as paid.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    },

    // ──────────────────────────────────────────────
    // Step 2: Exchanger confirms payment received → triggers release
    // ──────────────────────────────────────────────
    async handleExchangerAccept(interaction) {
        const ticketId = interaction.customId.replace('clientpaidaccept_', '');

        try {
            const [tickets] = await db.query('SELECT * FROM tickets WHERE ticket_id = ?', [ticketId]);
            if (!tickets.length) {
                return interaction.reply({ content: 'Ticket not found.', flags: MessageFlags.Ephemeral });
            }
            const ticket = tickets[0];

            const [sellerRows] = await db.query('SELECT discord_id FROM users WHERE id = ?', [ticket.seller_id]);
            const exchangerDiscordId = sellerRows[0]?.discord_id;

            if (interaction.user.id !== exchangerDiscordId) {
                return interaction.reply({
                    content: 'Only the assigned exchanger can confirm payment.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (ticket.status !== 'PAID') {
                return interaction.reply({
                    content: `Ticket is not in PAID state (status: ${ticket.status}).`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // Disable the accept/decline buttons
            await interaction.update({
                components: [
                    makeTicketContainer(
                        'Payment Confirmed',
                        [
                            `> Exchanger <@${exchangerDiscordId}> confirmed receipt of payment.`,
                            '> Processing release — please use `/release` to complete the deal.'
                        ]
                    )
                ],
                flags: MessageFlags.IsComponentsV2
            }).catch(() => {});

            // Remind exchanger to use /release
            const thread = interaction.channel;
            if (thread) {
                await thread.send({
                    content: `<@${exchangerDiscordId}> — payment confirmed! Use \`/release\` with ticket ID \`${ticketId}\` to release the LTC to the buyer.`
                }).catch(() => {});
            }

            await logger.logTransaction(interaction.client, {
                title: 'Payment Confirmed by Exchanger',
                summary: 'Exchanger confirmed they received client payment.',
                fields: [
                    { name: 'Ticket', value: ticketId, inline: true },
                    { name: 'Exchanger', value: `<@${exchangerDiscordId}>`, inline: true }
                ]
            });
        } catch (error) {
            console.error('clientPaid handleExchangerAccept error:', error);
            await interaction.reply({
                content: 'Failed to confirm payment.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    },

    // ──────────────────────────────────────────────
    // Step 3: Exchanger says payment NOT received → revert to CLAIMED
    // ──────────────────────────────────────────────
    async handleExchangerDecline(interaction) {
        const ticketId = interaction.customId.replace('clientpaiddecline_', '');

        try {
            const [tickets] = await db.query('SELECT * FROM tickets WHERE ticket_id = ?', [ticketId]);
            if (!tickets.length) {
                return interaction.reply({ content: 'Ticket not found.', flags: MessageFlags.Ephemeral });
            }
            const ticket = tickets[0];

            const [sellerRows] = await db.query('SELECT discord_id FROM users WHERE id = ?', [ticket.seller_id]);
            const exchangerDiscordId = sellerRows[0]?.discord_id;

            if (interaction.user.id !== exchangerDiscordId) {
                return interaction.reply({
                    content: 'Only the assigned exchanger can decline this.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (ticket.status !== 'PAID') {
                return interaction.reply({
                    content: `Ticket is not in PAID state (status: ${ticket.status}).`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // Revert to CLAIMED
            await db.query(
                'UPDATE tickets SET status = "CLAIMED", paid_at = NULL WHERE ticket_id = ? AND status = "PAID"',
                [ticketId]
            );

            const [buyerRows] = await db.query('SELECT discord_id FROM users WHERE id = ?', [ticket.buyer_id]);
            const buyerDiscordId = buyerRows[0]?.discord_id;

            // Rebuild "I've Paid" button so buyer can try again
            const paidRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`clientpaid_${ticketId}`)
                    .setLabel("I've Paid")
                    .setEmoji(emojis.getComponent('cash'))
                    .setStyle(ButtonStyle.Primary)
            );

            await interaction.update({
                components: [
                    makeTicketContainer(
                        'Payment Not Received',
                        [
                            `> Exchanger <@${exchangerDiscordId}> has stated payment was **not received**.`,
                            `> Buyer <@${buyerDiscordId || 'Unknown'}>: please check your payment and try again, or contact support.`
                        ],
                        [paidRow]
                    )
                ],
                flags: MessageFlags.IsComponentsV2
            }).catch(() => {});

            await logger.logTransaction(interaction.client, {
                title: 'Payment Declined by Exchanger',
                summary: 'Exchanger states payment was not received.',
                fields: [
                    { name: 'Ticket', value: ticketId, inline: true },
                    { name: 'Exchanger', value: `<@${exchangerDiscordId}>`, inline: true },
                    { name: 'Buyer', value: buyerDiscordId ? `<@${buyerDiscordId}>` : 'Unknown', inline: true }
                ]
            });
        } catch (error) {
            console.error('clientPaid handleExchangerDecline error:', error);
            await interaction.reply({
                content: 'Failed to process decline.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    }
};
