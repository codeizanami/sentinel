const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const { logModerationAction } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Establece o quita el modo lento en un canal.')
        .addIntegerOption(option =>
            option.setName('tiempo_segundos')
                .setDescription('Tiempo del modo lento en segundos (0 para desactivar, máx 21600 segundos/6 horas).')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(21600)) // Discord permite hasta 6 horas (21600 segundos)
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('El canal donde aplicar el modo lento (por defecto el actual).')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false))
        .addStringOption(option =>
            option.setName('razon')
                .setDescription('La razón para aplicar/quitar el modo lento.')
                .setRequired(false)),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.reply({ content: '❌ No tienes permiso para gestionar el modo lento.', ephemeral: true });
        }

        const timeInSeconds = interaction.options.getInteger('tiempo_segundos');
        const channelToSet = interaction.options.getChannel('canal') || interaction.channel;
        const reason = interaction.options.getString('razon') || 'No se especificó una razón.';

        if (channelToSet.type !== ChannelType.GuildText) {
            return interaction.reply({ content: '❌ Solo puedes aplicar el modo lento a canales de texto.', ephemeral: true });
        }

        try {
            await channelToSet.setRateLimitPerUser(timeInSeconds, reason);

            let replyMessage;
            if (timeInSeconds === 0) {
                replyMessage = `✅ El modo lento ha sido **desactivado** en ${channelToSet}. Razón: \`${reason}\``;
            } else {
                replyMessage = `✅ El modo lento ha sido establecido a **${timeInSeconds} segundos** en ${channelToSet}. Razón: \`${reason}\``;
            }

            await interaction.reply({ content: replyMessage });

            logModerationAction(
                interaction.guild,
                'SLOWMODE',
                null,
                interaction.user,
                reason,
                `Canal: #${channelToSet.name} (${channelToSet.id}), Tiempo: ${timeInSeconds}s`
            );

        } catch (error) {
            console.error(`Error al establecer el modo lento en ${channelToSet.name}:`, error);
            await interaction.reply({ content: '❌ Hubo un error al intentar establecer el modo lento. Asegúrate de que el bot tenga el permiso "Gestionar Canales".', ephemeral: true });
        }
    },
};