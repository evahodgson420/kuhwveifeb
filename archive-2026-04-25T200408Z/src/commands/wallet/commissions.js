const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../core/database');
const { adminOnly } = require('../../config/permissions');
const appConfig = require('../../config/appConfig');
const { formatFiat } = require('../../core/currency');

module.exports = {
    guildOnly: true,
    data: new SlashCommandBuilder()
        .setName('commissions')
        .setDescription('Admin: view total commissions earned and available to cash out')
        .setDefaultMemberPermissions('0'),

    execute: adminOnly(async (interaction) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const [totalRows] = await db.query(
                `SELECT
                    currency_code,
                    COALESCE(SUM(owner_commission_amount), 0) AS total_earned
                 FROM owner_commission_ledger
                 GROUP BY currency_code`
            );

            const [pendingRows] = await db.query(
                `SELECT
                    currency_code,
                    COALESCE(SUM(owner_commission_amount), 0) AS available
                 FROM owner_commission_ledger
                 WHERE status = 'PENDING'
                 GROUP BY currency_code`
            );

            const [statsRows] = await db.query(
                `SELECT
                    COUNT(*) AS total_tickets,
                    SUM(CASE WHEN status = 'RELEASED' THEN 1 ELSE 0 END) AS completed_tickets
                 FROM tickets`
            );

            const totalMap = {};
            for (const row of totalRows) totalMap[row.currency_code] = parseFloat(row.total_earned || 0);

            const pendingMap = {};
            for (const row of pendingRows) pendingMap[row.currency_code] = parseFloat(row.available || 0);

            const stats = statsRows[0] || {};
            const currencies = [...new Set([...Object.keys(totalMap), ...Object.keys(pendingMap), 'LTC'])];

            const earnedLines = currencies.map(c => {
                const total = (totalMap[c] || 0).toFixed(8);
                const avail = (pendingMap[c] || 0).toFixed(8);
                return `**${c}:** ${total} total · ${avail} cashable`;
            });

            const embed = new EmbedBuilder()
                .setColor(appConfig.brand.color)
                .setTitle('Orbit Trade | Commission Dashboard')
                .setDescription(earnedLines.join('\n') || 'No commission data yet.')
                .addFields(
                    {
                        name: 'Ticket Stats',
                        value: `Total: **${stats.total_tickets || 0}** · Completed: **${stats.completed_tickets || 0}**`,
                        inline: false
                    },
                    {
                        name: 'Cash Out',
                        value: 'Use `/withdrawcommissions` to send all pending LTC commissions to your address.',
                        inline: false
                    }
                )
                .setFooter({ text: 'Admin only · Orbit Trade' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('commissions command failed:', error);
            await interaction.editReply({ content: 'Failed to load commission data.' });
        }
    })
};