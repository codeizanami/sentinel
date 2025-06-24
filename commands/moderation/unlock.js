const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const { logModerationAction } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Desbloquea un canal para que todos puedan enviar mensajes.')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('El canal a desbloquear (por defecto el canal actual).')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false))
        .addStringOption(option =>
            option.setName('razon')
                .setDescription('La razón para desbloquear el canal.')
                .setRequired(false)),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.reply({ content: '❌ No tienes permiso para desbloquear canales.', ephemeral: true });
        }

        const channelToUnlock = interaction.options.getChannel('canal') || interaction.channel;
        const reason = interaction.options.getString('razon') || 'No se especificó una razón.';

        if (channelToUnlock.type !== ChannelType.GuildText) {
            return interaction.reply({ content: '❌ Solo puedes desbloquear canales de texto.', ephemeral: true });
        }

        const everyoneRole = interaction.guild.roles.everyone;

        try {
            // Verifica el estado actual del permiso
            const currentPermissions = channelToUnlock.permissionOverwrites.cache.get(everyoneRole.id);
            if (!currentPermissions || !currentPermissions.deny.has(PermissionsBitField.Flags.SendMessages)) {
                return interaction.reply({ content: `❌ El canal ${channelToUnlock} no parece estar bloqueado.`, ephemeral: true });
            }

            await channelToUnlock.permissionOverwrites.edit(everyoneRole, {
                SendMessages: null, // Restablece el permiso a su estado predeterminado
            }, { reason: reason });

            await interaction.reply({ content: `✅ El canal ${channelToUnlock} ha sido desbloqueado. Razón: \`${reason}\`` });

            logModerationAction(
                interaction.guild,
                'UNLOCK_CHANNEL',
                null,
                interaction.user,
                reason,
                `Canal: #${channelToUnlock.name} (${channelToUnlock.id})`
            );

        } catch (error) {
            console.error(`Error al desbloquear el canal ${channelToUnlock.name}:`, error);
            await interaction.reply({ content: '❌ Hubo un error al intentar desbloquear este canal. Asegúrate de que el bot tenga el permiso "Gestionar Canales".', ephemeral: true });
        }
    },
};