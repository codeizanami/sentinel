// commands/admin/ticketsetup.js
const { SlashCommandBuilder, ChannelType, PermissionsBitField, ActionRowBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticketsetup')
        .setDescription('Configura el sistema de tickets para este servidor.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction, client) {
        const guild = interaction.guild;

        await interaction.deferReply({ ephemeral: true });

        if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels) ||
            !guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles) ||
            !guild.members.me.permissions.has(PermissionsBitField.Flags.SendMessages) ||
            !guild.members.me.permissions.has(PermissionsBitField.Flags.EmbedLinks)) {
            return interaction.editReply({
                content: '❌ Necesito los permisos de "Gestionar Canales", "Gestionar Roles", "Enviar Mensajes" y "Insertar Enlaces" para configurar el sistema de tickets.',
                ephemeral: true
            });
        }

        // ESTA ES LA LÍNEA CRÍTICA
        client.setOngoingTicketSetup(interaction.user.id, {
            guildId: guild.id,
            step: 1,
            data: {}
        });

        const categorySelect = new ChannelSelectMenuBuilder()
            .setCustomId('ticket_setup_category')
            .setPlaceholder('Selecciona la categoría para los tickets')
            .addChannelTypes(ChannelType.GuildCategory);

        const row = new ActionRowBuilder().addComponents(categorySelect);

        await interaction.editReply({
            content: '⚙️ **Configuración del Sistema de Tickets:**\n\n**Paso 1/4:** Por favor, selecciona la categoría donde se crearán los canales de ticket.',
            components: [row],
            ephemeral: true
        });
    },
};