// commands/admin/ticketsetup.js
const { SlashCommandBuilder, ChannelType, PermissionsBitField, ActionRowBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticketsetup')
        .setDescription('Configura el sistema de tickets para este servidor.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator), // Solo administradores pueden usarlo
    async execute(interaction, client) {
        const guild = interaction.guild;

        // Asegúrate de que el bot tiene los permisos necesarios para crear/gestionar canales y roles
        if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels) ||
            !guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles) ||
            !guild.members.me.permissions.has(PermissionsBitField.Flags.SendMessages) ||
            !guild.members.me.permissions.has(PermissionsBitField.Flags.EmbedLinks)) { // Necesario para enviar embeds
            return interaction.reply({
                content: '❌ Necesito los permisos de "Gestionar Canales", "Gestionar Roles", "Enviar Mensajes" y "Insertar Enlaces" para configurar el sistema de tickets.',
                ephemeral: true
            });
        }

        // Inicializar o restablecer el estado para este usuario
        client.ticketSetupState.set(interaction.user.id, {
            guildId: guild.id,
            step: 1,
            data: {} // Aquí guardaremos los IDs seleccionados temporalmente
        });

        // Paso 1: Seleccionar Categoría
        const categorySelect = new ChannelSelectMenuBuilder()
            .setCustomId('ticket_setup_category')
            .setPlaceholder('Selecciona la categoría para los tickets')
            .addChannelTypes(ChannelType.GuildCategory); // Solo mostrar categorías

        const row = new ActionRowBuilder().addComponents(categorySelect);

        await interaction.reply({
            content: '⚙️ **Configuración del Sistema de Tickets:**\n\n**Paso 1/4:** Por favor, selecciona la categoría donde se crearán los canales de ticket.',
            components: [row],
            ephemeral: true
        });
    },
};