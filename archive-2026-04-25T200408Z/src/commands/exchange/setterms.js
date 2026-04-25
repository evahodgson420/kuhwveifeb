const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../core/database');
const { exchOnly } = require('../../config/permissions');
const logger = require('../../core/logger');

const TERM_METHODS = [
    { name: 'Default (all methods)', value: 'default' },
    { name: 'PayPal', value: 'paypal' },
    { name: 'CashApp', value: 'cashapp' },
    { name: 'Zelle', value: 'zelle' },
    { name: 'Wise', value: 'wise' },
    { name: 'Revolut', value: 'revolut' },
    { name: 'Bank Transfer', value: 'bank' },
    { name: 'PaysafeCard', value: 'paysafecard' },
    { name: 'Crypto (general)', value: 'crypto' },
    { name: 'LTC', value: 'ltc' },
    { name: 'USDT', value: 'usdt' },
    { name: 'BTC', value: 'btc' },
    { name: 'ETH', value: 'eth' },
    { name: 'SOL', value: 'sol' }
];

module.exports = {
    guildOnly: true,
    data: new SlashCommandBuilder()
        .setName('setterms')
        .setDescription('Set the terms text shown to buyers when you claim a ticket')
        .addStringOption((option) =>
            option
                .setName('text')
                .setDescription('Your terms text (10-1500 characters)')
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('method')
                .setDescription('Apply to a specific payment method, or leave blank for default')
                .setRequired(false)
                .addChoices(...TERM_METHODS)
        ),

    execute: exchOnly(async (interaction) => {
        const method = interaction.options.getString('method') || 'default';
        const text = interaction.options.getString('text').trim();

        if (text.length < 10 || text.length > 1500) {
            return interaction.reply({
                content: 'Terms must be between 10 and 1500 characters.',
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            const [users] = await db.query('SELECT id FROM users WHERE discord_id = ?', [interaction.user.id]);
            if (!users.length) {
                return interaction.reply({
                    content: 'No wallet found. Use `/register` first.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const userId = users[0].id;
            const methodLabel = TERM_METHODS.find(m => m.value === method)?.name || method;

            if (method === 'default') {
                await db.query('UPDATE users SET exchanger_terms = ? WHERE id = ?', [text, userId]);
            } else {
                await db.query(
                    `INSERT INTO exchanger_payment_terms (user_id, method_key, terms_text)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE terms_text = VALUES(terms_text), updated_at = NOW()`,
                    [userId, method, text]
                );
            }

            await interaction.reply({
                content: `**${methodLabel}** terms saved. Use \`/terms\` to preview them.`,
                flags: MessageFlags.Ephemeral
            });

            await logger.logPaymentConfig(
                interaction.client,
                `<@${interaction.user.id}> updated exchanger terms for **${methodLabel}**`
            );
        } catch (error) {
            console.error('setterms failed:', error);
            await logger.logError(interaction.client, `setterms failed: \`${error.message}\``);
            await interaction.reply({
                content: 'Failed to save terms. Please try again.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    })
};