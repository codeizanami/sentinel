const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('massban')
        .setDescription('Banea a múltiples usuarios del servidor por ID. ¡Usar con extrema precaución!')
        .addStringOption(option =>
            option.setName('ids')
                .setDescription('IDs de los usuarios a banear, separados por espacios.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('razon')
                .setDescription('Razón del baneo.')
                .setRequired(false)),
    async execute(interaction) {
        // Verificar si el usuario tiene permisos de administrador
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
                content: '❌ No tienes permisos para usar este comando. Necesitas el permiso de Administrador.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        // Verificar que el bot tiene permisos para banear
        if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return interaction.reply({
                content: '❌ No tengo los permisos necesarios para banear miembros. Necesito el permiso "Banear miembros".',
                flags: [MessageFlags.Ephemeral]
            });
        }

        const idsString = interaction.options.getString('ids');
        const reason = interaction.options.getString('razon') || 'No se proporcionó una razón.';
        const userIds = idsString.split(' ').map(id => id.trim()).filter(id => id.length > 0);

        if (userIds.length === 0) {
            return interaction.reply({
                content: '❌ Por favor, proporciona al menos un ID de usuario válido para banear.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const bannedUsers = [];
        const failedBans = [];

        for (const userId of userIds) {
            try {
                // Obtener el usuario de Discord (puede no estar en la caché del gremio si no está presente)
                const user = await interaction.client.users.fetch(userId);
                
                // Intentar banear al usuario
                await interaction.guild.members.ban(user.id, { reason: reason });
                bannedUsers.push(user.tag);
            } catch (error) {
                console.error(`Error al banear a ${userId}:`, error);
                failedBans.push(userId);
            }
        }

        let replyMessage = `✅ Proceso de baneo masivo completado.\n`;
        if (bannedUsers.length > 0) {
            replyMessage += `Bananeados con éxito: ${bannedUsers.join(', ')}\n`;
        }
        if (failedBans.length > 0) {
            replyMessage += `❌ Fallaron los baneos para: ${failedBans.join(', ')} (verifica los IDs y mis permisos).\n`;
        }

        await interaction.editReply({
            content: replyMessage,
            flags: [MessageFlags.Ephemeral]
        });
    },
};