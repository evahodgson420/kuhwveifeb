const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../core/database');
const { sendLtc } = require('../../core/walletOps');
const logger = require('../../core/logger');
const env = require('../../config/env');

const COMMISSIONS_OWNER_ID = env.COMMISSIONS_OWNER_ID || '';

module.exports = {
    guildOnly: true,
    data: new SlashCommandBuilder()
        .setName('withdrawcommissions')
        .setDescription('Withdraw all pending owner LTC commissions to an address')
        .setDefaultMemberPermissions('0')
        .addStringOption((option) =>
            option.setName('address').setDescription('Destination LTC address').setRequired(true)
        ),

    execute: async (interaction) => {
        if (!COMMISSIONS_OWNER_ID || interaction.user.id !== COMMISSIONS_OWNER_ID) {
            return interaction.reply({
                content: 'You are not authorised to withdraw commissions.',
                flags: MessageFlags.Ephemeral
            });
        }

        const address = interaction.options.getString('address').trim();
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const [pendingRows] = await db.query(
                `SELECT id, user_id, owner_commission_amount
                 FROM owner_commission_ledger
                 WHERE status = 'PENDING' AND currency_code = 'LTC'
                 ORDER BY created_at ASC`
            );

            if (!pendingRows.length) {
                return interaction.editReply('No pending LTC commissions available to withdraw.');
            }

            const total = pendingRows
                .reduce((sum, row) => sum + parseFloat(row.owner_commission_amount || 0), 0)
                .toFixed(8);

            const { txid } = await sendLtc({ destination: address, amount: total });

            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();

                const balanceByUser = new Map();
                for (const row of pendingRows) {
                    const current = balanceByUser.get(row.user_id) || 0;
                    balanceByUser.set(row.user_id, current + parseFloat(row.owner_commission_amount || 0));
                }

                for (const [userId, amount] of balanceByUser.entries()) {
                    await connection.query(
                        `UPDATE exchanger_owner_balances
                         SET hidden_owner_balance = GREATEST(hidden_owner_balance - ?, 0),
                             last_withdrawn_at = NOW(),
                             updated_at = NOW()
                         WHERE user_id = ? AND currency_code = 'LTC'`,
                        [amount.toFixed(8), userId]
                    );
                }

                await connection.query(
                    `UPDATE owner_commission_ledger
                     SET status = 'TRANSFERRED', transferred_at = NOW()
                     WHERE status = 'PENDING' AND currency_code = 'LTC'`
                );

                await connection.commit();
            } catch (dbError) {
                await connection.rollback();
                throw new Error(`Broadcast succeeded (txid: ${txid}) but DB sync failed: ${dbError.message}`);
            } finally {
                connection.release();
            }

            await interaction.editReply(`Commission withdrawn: \`${total}\` LTC\n> TXID: \`${txid}\``);
            await logger.logTransaction(
                interaction.client,
                `OWNER_COMMISSION_WITHDRAWAL | <@${interaction.user.id}> | ${total} LTC | tx \`${txid}\``
            );
        } catch (error) {
            console.error('withdrawcommissions failed:', error);
            await logger.logError(interaction.client, `withdrawcommissions failed: \`${error.message}\``);
            await interaction.editReply(`Withdrawal failed: ${error.message}`);
        }
    }
};