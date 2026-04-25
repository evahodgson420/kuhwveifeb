const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../core/database');
const { exchOnly } = require('../../config/permissions');
const appConfig = require('../../config/appConfig');

module.exports = {
    guildOnly: true,
    data: new SlashCommandBuilder()
        .setName('terms')
        .setDescription('View all of your configured exchanger terms'),

    execute: exchOnly(async (interaction) => {
        try {
            const [users] = await db.query(
                'SELECT id, exchanger_terms FROM users WHERE discord_id = ?',
                [interaction.user.id]
            );

            if (!users.length) {
                return interaction.reply({
                    content: 'No wallet found. Use `/register` first.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const userId = users[0].id;
            const defaultTerms = users[0].exchanger_terms;

            const [methodTerms] = await db.query(
                'SELECT method_key, terms_text FROM exchanger_payment_terms WHERE user_id = ? ORDER BY method_key ASC',
                [userId]
            );

            const embed = new EmbedBuilder()
                .setColor(appConfig.brand.color)
                .setTitle('Orbit Trade | Your Exchanger Terms')
                .setFooter({ text: 'Use /setterms to add or update terms' })
                .setTimestamp();

            if (!defaultTerms && !methodTerms.length) {
                embed.setDescription('You have no terms configured.\nUse `/setterms` to set your default terms.');
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const fields = [];

            fields.push({
                name: 'Default (all methods)',
                value: defaultTerms
                    ? (defaultTerms.length > 1024 ? `${defaultTerms.slice(0, 1020)}...` : defaultTerms)
                    : '_Not set_',
                inline: false
            });

            for (const row of methodTerms) {
                const preview = row.terms_text.length > 512
                    ? `${row.terms_text.slice(0, 508)}...`
                    : row.terms_text;
                fields.push({
                    name: row.method_key.toUpperCase(),
                    value: preview,
                    inline: false
                });
            }

            embed.addFields(fields);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } catch (error) {
            console.error('terms command failed:', error);
            return interaction.reply({
                content: 'Failed to fetch your terms.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    })
};