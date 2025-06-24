const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { logModerationAction } = require('../../utils/logger'); // Importa la función de log

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Desbanea a un usuario del servidor.')
        .addStringOption(option => // Se usa StringOption para el ID, ya que el usuario puede no estar en el servidor
            option.setName('userid')
                .setDescription('El ID del usuario a desbanear.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('razon')
                .setDescription('La razón del desbaneo.')
                .setRequired(false)),
    async execute(interaction) {
        // Verifica si el usuario que ejecuta el comando tiene el permiso 'BanMembers'
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', ephemeral: true });
        }

        const userId = interaction.options.getString('userid');
        const reason = interaction.options.getString('razon') || 'No se especificó una razón.';

        try {
            // Obtener la lista de baneos del servidor para encontrar el usuario por ID
            const bannedUsers = await interaction.guild.bans.fetch();
            const userToUnban = bannedUsers.find(ban => ban.user.id === userId);

            if (!userToUnban) {
                return interaction.reply({ content: `❌ El usuario con ID \`${userId}\` no está baneado en este servidor.`, ephemeral: true });
            }

            // Elimina el baneo del usuario
            await interaction.guild.bans.remove(userId, reason);

            // Intenta obtener el objeto User para el log (puede que no esté en la caché si no es miembro)
            const user = interaction.client.users.cache.get(userId) || await interaction.client.users.fetch(userId).catch(() => null);

            await interaction.reply({ content: `✅ **${user ? user.tag : userId}** ha sido desbaneado por: \`${reason}\`` });

            logModerationAction(
                interaction.guild,
                'UNBAN',
                user, // Pasa el objeto User si lo tenemos, si no, null
                interaction.user,
                reason,
                `ID: ${userId}` // Información adicional para el log
            );

        } catch (error) {
            console.error('Error al desbanear:', error);
            await interaction.reply({ content: '❌ Hubo un error al intentar desbanear a este usuario. Asegúrate de que el ID sea correcto.', ephemeral: true });
        }
    },
};