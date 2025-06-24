const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { logModerationAction } = require('../../utils/logger'); // Importa la función de log

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Expulsa a un usuario del servidor.')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario a expulsar.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('razon')
                .setDescription('La razón de la expulsión.')
                .setRequired(false)),
    async execute(interaction) {
        // Verifica si el usuario que ejecuta el comando tiene el permiso 'KickMembers'
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', ephemeral: true });
        }

        const userToKick = interaction.options.getUser('usuario');
        const memberToKick = interaction.guild.members.cache.get(userToKick.id);
        const reason = interaction.options.getString('razon') || 'No se especificó una razón.';

        // Comprobaciones de seguridad
        if (!memberToKick) {
            return interaction.reply({ content: '❌ No se encontró al usuario en este servidor.', ephemeral: true });
        }
        if (memberToKick.id === interaction.client.user.id) {
            return interaction.reply({ content: '❌ No me puedo expulsar a mí mismo.', ephemeral: true });
        }
        if (memberToKick.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '❌ No puedo expulsar a un administrador.', ephemeral: true });
        }
        // Comprueba la jerarquía de roles
        if (memberToKick.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: '❌ No puedes expulsar a alguien con un rol igual o superior al tuyo.', ephemeral: true });
        }

        try {
            // Intenta enviar un mensaje privado al usuario antes de expulsarlo
            await userToKick.send(`Has sido expulsado del servidor **${interaction.guild.name}** por: ${reason}`).catch(() => console.log(`No se pudo enviar DM a ${userToKick.tag}.`));
            
            // Expulsa al miembro del servidor
            await memberToKick.kick(reason);

            await interaction.reply({ content: `✅ **${userToKick.tag}** ha sido expulsado por: \`${reason}\`` });

            // Registra la acción en el canal de logs
            logModerationAction(
                interaction.guild,
                'KICK',
                userToKick,
                interaction.user,
                reason
            );

        } catch (error) {
            console.error('Error al expulsar:', error);
            await interaction.reply({ content: '❌ Hubo un error al intentar expulsar a este usuario.', ephemeral: true });
        }
    },
};