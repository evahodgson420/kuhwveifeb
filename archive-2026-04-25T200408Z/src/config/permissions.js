const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const appConfig = require('./appConfig');

const hasAdmin = (member) => Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator));
const hasRole = (member, roleId) => Boolean(roleId && member?.roles?.cache?.has(roleId));

const isStaffMember = (member) => {
    const isAdmin = hasAdmin(member);
    const isExchanger = hasRole(member, appConfig.roles.exchanger);
    const isSupport = hasRole(member, appConfig.roles.support);
    return isAdmin || isExchanger || isSupport;
};

/**
 * Check if a Discord user ID has a registered wallet in the DB.
 * Used as the auth fallback for commands that work outside the main server.
 */
async function isRegisteredInDb(discordId) {
    try {
        const db = require('../core/database');
        const [rows] = await db.query(
            'SELECT id FROM users WHERE discord_id = ? LIMIT 1',
            [discordId]
        );
        return rows.length > 0;
    } catch {
        return false;
    }
}

/**
 * exchOnly — restricts to Exchanger role or Admin.
 *
 * Options:
 *   allowDm: true       — command registers for DM context (Discord API flag only).
 *                         Still requires the Exchanger role check inside DMs.
 *   allowExternal: true — command works in DMs AND any server, falling back to a DB
 *                         registration check. Only use for /addy, /balance, /send, /profile.
 */
const exchOnly = (execute, options = {}) => {
    const { allowDm = false, allowExternal = false } = options;

    return async (interaction) => {
        const inGuild = interaction.inGuild() && interaction.member;

        // ── Outside the main guild (DMs or a different server) ──────────────
        if (!inGuild) {
            if (!allowDm && !allowExternal) {
                return interaction.reply({
                    content: 'This action can only be used inside the server.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (allowExternal) {
                // DB registration check as the auth gate
                const registered = await isRegisteredInDb(interaction.user.id);
                if (!registered) {
                    return interaction.reply({
                        content: 'You need a registered wallet to use this command. Use `/register` in the main server first.',
                        flags: MessageFlags.Ephemeral
                    });
                }
                return execute(interaction);
            }

            // allowDm only (no allowExternal) — block outside main guild
            return interaction.reply({
                content: 'This command can only be used inside the main server.',
                flags: MessageFlags.Ephemeral
            });
        }

        // ── Inside a guild ───────────────────────────────────────────────────
        const isAdmin = hasAdmin(interaction.member);
        const isExchanger = hasRole(interaction.member, appConfig.roles.exchanger);

        if (isAdmin || isExchanger) {
            return execute(interaction);
        }

        // In a different server with no role: only allowExternal commands get the DB fallback
        if (allowExternal) {
            const registered = await isRegisteredInDb(interaction.user.id);
            if (registered) {
                return execute(interaction);
            }
        }

        return interaction.reply({
            content: 'Restricted: You need the **Exchanger** role to use this.',
            flags: MessageFlags.Ephemeral
        });
    };
};

/**
 * adminOnly — restricts to server Administrators.
 * allowDm: true lets the command run in DMs (command-level ID checks must handle auth).
 */
const adminOnly = (execute, options = {}) => {
    const { allowDm = false } = options;

    return async (interaction) => {
        if (!interaction.inGuild() || !interaction.member) {
            if (!allowDm) {
                return interaction.reply({
                    content: 'This action can only be used inside the server.',
                    flags: MessageFlags.Ephemeral
                });
            }
            return execute(interaction);
        }

        if (!hasAdmin(interaction.member)) {
            return interaction.reply({
                content: 'This action is restricted to Administrators only.',
                flags: MessageFlags.Ephemeral
            });
        }

        return execute(interaction);
    };
};

const staffOnly = (execute) => {
    return async (interaction) => {
        if (!interaction.inGuild() || !interaction.member) {
            return interaction.reply({
                content: 'This action can only be used inside the server.',
                flags: MessageFlags.Ephemeral
            });
        }

        if (isStaffMember(interaction.member)) {
            return execute(interaction);
        }

        return interaction.reply({
            content: 'Restricted: You need Staff access (Admin, Exchanger, or Support).',
            flags: MessageFlags.Ephemeral
        });
    };
};

module.exports = {
    adminOnly,
    exchOnly,
    staffOnly,
    isStaffMember,
    hasAdmin,
    hasRole
};