const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags
} = require('discord.js');
const db = require('../../core/database');
const appConfig = require('../../config/appConfig');
const { formatFiat } = require('../../core/currency');
const emojis = require('../../config/emojis');

module.exports = {
    guildOnly: true,
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View overall Orbit Trade exchange statistics'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const [dealRows] = await db.query(
                `SELECT
                    COUNT(*) AS total_deals,
                    COALESCE(SUM(CASE WHEN source_currency = 'USD' THEN amount_from ELSE 0 END), 0) AS total_usd,
                    COALESCE(SUM(CASE WHEN source_currency = 'EUR' THEN amount_from ELSE 0 END), 0) AS total_eur,
                    COALESCE(SUM(CASE WHEN source_currency = 'GBP' THEN amount_from ELSE 0 END), 0) AS total_gbp,
                    COALESCE(SUM(CASE WHEN source_currency = 'INR' THEN amount_from ELSE 0 END), 0) AS total_inr,
                    COALESCE(SUM(amount_ltc), 0) AS total_ltc
                 FROM tickets
                 WHERE status = 'RELEASED'`
            );

            const [activeRows] = await db.query(
                `SELECT
                    COUNT(*) AS open_count,
                    SUM(CASE WHEN status = 'CLAIMED' THEN 1 ELSE 0 END) AS claimed_count,
                    SUM(CASE WHEN status = 'PAID'    THEN 1 ELSE 0 END) AS paid_count
                 FROM tickets
                 WHERE status IN ('OPEN', 'CLAIMED', 'PAID')`
            );

            const [exchangerRows] = await db.query(
                `SELECT COUNT(DISTINCT seller_id) AS exchanger_count
                 FROM tickets WHERE status = 'RELEASED' AND seller_id IS NOT NULL`
            );

            const [buyerRows] = await db.query(
                `SELECT COUNT(DISTINCT buyer_id) AS buyer_count
                 FROM tickets WHERE status = 'RELEASED'`
            );

            const deals = dealRows[0];
            const active = activeRows[0];
            const totalDeals = Number(deals.total_deals || 0);
            const totalLtc = parseFloat(deals.total_ltc || 0);

            const volumeLines = [];
            if (parseFloat(deals.total_usd) > 0) volumeLines.push(`> USD: **${formatFiat(deals.total_usd, 'USD')}**`);
            if (parseFloat(deals.total_eur) > 0) volumeLines.push(`> EUR: **${formatFiat(deals.total_eur, 'EUR')}**`);
            if (parseFloat(deals.total_gbp) > 0) volumeLines.push(`> GBP: **${formatFiat(deals.total_gbp, 'GBP')}**`);
            if (parseFloat(deals.total_inr) > 0) volumeLines.push(`> INR: **${formatFiat(deals.total_inr, 'INR')}**`);
            volumeLines.push(`> LTC: **${totalLtc.toFixed(8)} Ł**`);

            const embed = new EmbedBuilder()
                .setColor(appConfig.brand.color)
                .setTitle(emojis.withEmoji('unlock', 'Orbit Trade | Platform Statistics'))
                .addFields(
                    {
                        name: emojis.withEmoji('ticket', 'Completed Deals'),
                        value: `**${totalDeals.toLocaleString()}** deals released`,
                        inline: true
                    },
                    {
                        name: emojis.withEmoji('support', 'Participants'),
                        value: `${Number(exchangerRows[0]?.exchanger_count || 0)} exchangers\n${Number(buyerRows[0]?.buyer_count || 0)} clients`,
                        inline: true
                    },
                    {
                        name: emojis.withEmoji('arrow1', 'Active Now'),
                        value: [
                            `Open: **${Number(active.open_count || 0)}**`,
                            `Claimed: **${Number(active.claimed_count || 0)}**`,
                            `Paid: **${Number(active.paid_count || 0)}**`
                        ].join('\n'),
                        inline: true
                    },
                    {
                        name: emojis.withEmoji('cash', 'Total Volume Released'),
                        value: volumeLines.length > 1 ? volumeLines.join('\n') : '_No completed deals yet._',
                        inline: false
                    }
                )
                .setFooter({ text: 'Orbit Trade', iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('stats command failed:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: 'Failed to load statistics.' }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Failed to load statistics.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};