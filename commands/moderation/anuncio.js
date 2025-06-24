const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ChannelType, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('anuncio')
        .setDescription('Envía un mensaje de anuncio en un canal específico.')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('El canal donde se enviará el anuncio.')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)) // Solo canales de texto o anuncios
        .addStringOption(option =>
            option.setName('mensaje')
                .setDescription('El contenido del anuncio.')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels) // Requiere permiso de "Gestionar Canales"
        .setDMPermission(false), // Este comando no se puede usar en mensajes directos

    async execute(interaction) {
        const targetChannel = interaction.options.getChannel('canal');
        const messageContent = interaction.options.getString('mensaje');

        // Deferir la respuesta para que el bot tenga tiempo de procesar
        await interaction.deferReply({ ephemeral: true });

        // 1. Verificar permisos del usuario que ejecuta el comando (ya manejado por setDefaultMemberPermissions)
        // Pero aquí, puedes añadir una comprobación adicional si quieres un rol específico o más permisos.
        // Por ahora, el setDefaultMemberPermissions es suficiente.

        // 2. Verificar permisos del bot en el canal de destino
        const botPermissionsInChannel = targetChannel.permissionsFor(interaction.client.user);

        if (!botPermissionsInChannel.has(PermissionsBitField.Flags.ViewChannel)) {
            return interaction.editReply({ content: `❌ No tengo permiso para ver el canal ${targetChannel.name}.` });
        }
        if (!botPermissionsInChannel.has(PermissionsBitField.Flags.SendMessages)) {
            return interaction.editReply({ content: `❌ No tengo permiso para enviar mensajes en el canal ${targetChannel.name}.` });
        }
        if (!botPermissionsInChannel.has(PermissionsBitField.Flags.EmbedLinks)) {
            return interaction.editReply({ content: `❌ No tengo permiso para enviar embeds en el canal ${targetChannel.name}. Asegúrate de darme el permiso "Insertar Enlaces".` });
        }

        const announcementEmbed = new EmbedBuilder()
            .setColor(0xFFA500) // Naranja
            .setTitle('📢 Anuncio Importante')
            .setDescription(messageContent)
            .setTimestamp()
            .setFooter({ text: `Anuncio de ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });

        try {
            await targetChannel.send({ embeds: [announcementEmbed] });
            await interaction.editReply({ content: `✅ Anuncio enviado exitosamente en ${targetChannel}.` });
        } catch (error) {
            console.error(`Error al enviar anuncio en ${targetChannel.name}:`, error);
            await interaction.editReply({ content: '❌ Hubo un error al intentar enviar el anuncio. Verifica los permisos del bot y el canal.' });
        }
    },
};