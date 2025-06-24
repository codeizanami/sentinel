const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { logModerationAction } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Desilencia a un usuario en el servidor.')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario a desilenciar.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('razon')
                .setDescription('La razón del desilencio.')
                .setRequired(false)),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.MuteMembers)) {
            return interaction.reply({ content: '❌ No tienes permiso para desilenciar miembros.', ephemeral: true });
        }

        const userToUnmute = interaction.options.getUser('usuario');
        const memberToUnmute = interaction.guild.members.cache.get(userToUnmute.id);
        const reason = interaction.options.getString('razon') || 'No se especificó una razón.';

        if (!memberToUnmute) {
            return interaction.reply({ content: '❌ No se encontró al usuario en este servidor.', ephemeral: true });
        }

        const mutedRole = interaction.guild.roles.cache.find(role => role.name === 'Muted' || role.name === 'Silenciado');
        if (!mutedRole) {
            return interaction.reply({ content: '❌ No se encontró un rol llamado "Muted" o "Silenciado". No se puede desilenciar si el rol no existe.', ephemeral: true });
        }

        if (!memberToUnmute.roles.cache.has(mutedRole.id)) {
            return interaction.reply({ content: `❌ **${userToUnmute.tag}** no está silenciado.`, ephemeral: true });
        }

        try {
            await memberToUnmute.roles.remove(mutedRole, reason);

            await userToUnmute.send(`Has sido desilenciado en el servidor **${interaction.guild.name}**. Razón: \`${reason}\``).catch(() => console.log(`No se pudo enviar DM a ${userToUnmute.tag}.`));

            await interaction.reply({ content: `✅ **${userToUnmute.tag}** ha sido desilenciado por: \`${reason}\`` });

            logModerationAction(
                interaction.guild,
                'UNMUTE',
                userToUnmute,
                interaction.user,
                reason
            );

        } catch (error) {
            console.error('Error al desilenciar:', error);
            await interaction.reply({ content: '❌ Hubo un error al intentar desilenciar a este usuario.', ephemeral: true });
        }
    },
};