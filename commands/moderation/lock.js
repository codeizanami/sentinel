const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const { logModerationAction } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Bloquea un canal para que nadie pueda enviar mensajes (excepto moderadores).')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('El canal a bloquear (por defecto el canal actual).')
                .addChannelTypes(ChannelType.GuildText) // Solo canales de texto
                .setRequired(false))
        .addStringOption(option =>
            option.setName('razon')
                .setDescription('La razón para bloquear el canal.')
                .setRequired(false)),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.reply({ content: '❌ No tienes permiso para bloquear canales.', ephemeral: true });
        }

        const channelToLock = interaction.options.getChannel('canal') || interaction.channel;
        const reason = interaction.options.getString('razon') || 'No se especificó una razón.';

        if (channelToLock.type !== ChannelType.GuildText) {
            return interaction.reply({ content: '❌ Solo puedes bloquear canales de texto.', ephemeral: true });
        }

        const everyoneRole = interaction.guild.roles.everyone;

        try {
            // Verifica el estado actual del permiso para evitar intentos redundantes
            const currentPermissions = channelToLock.permissionOverwrites.cache.get(everyoneRole.id);
            if (currentPermissions && currentPermissions.deny.has(PermissionsBitField.Flags.SendMessages)) {
                return interaction.reply({ content: `❌ El canal ${channelToLock} ya está bloqueado.`, ephemeral: true });
            }

            await channelToLock.permissionOverwrites.edit(everyoneRole, {
                SendMessages: false, // Deniega el permiso de enviar mensajes
            }, { reason: reason });

            await interaction.reply({ content: `✅ El canal ${channelToLock} ha sido bloqueado. Razón: \`${reason}\`` });

            logModerationAction(
                interaction.guild,
                'LOCK_CHANNEL',
                null, // No hay usuario específico afectado directamente
                interaction.user,
                reason,
                `Canal: #${channelToLock.name} (${channelToLock.id})`
            );

        } catch (error) {
            console.error(`Error al bloquear el canal ${channelToLock.name}:`, error);
            await interaction.reply({ content: '❌ Hubo un error al intentar bloquear este canal. Asegúrate de que el bot tenga el permiso "Gestionar Canales".', ephemeral: true });
        }
    },
};