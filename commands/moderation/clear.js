const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { logModerationAction } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Borra un número específico de mensajes en el canal.')
        .addIntegerOption(option =>
            option.setName('cantidad')
                .setDescription('Número de mensajes a borrar (entre 1 y 99).')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(99)) // Discord solo permite borrar hasta 100 mensajes a la vez, excluyendo el comando
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Borra mensajes solo de este usuario (opcional).')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('razon')
                .setDescription('La razón para borrar los mensajes.')
                .setRequired(false)),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return interaction.reply({ content: '❌ No tienes permiso para borrar mensajes.', ephemeral: true });
        }

        const amount = interaction.options.getInteger('cantidad');
        const targetUser = interaction.options.getUser('usuario');
        const reason = interaction.options.getString('razon') || 'No se especificó una razón.';

        if (amount < 1 || amount > 99) {
            return interaction.reply({ content: '❌ Debes especificar un número entre 1 y 99 para borrar mensajes.', ephemeral: true });
        }

        try {
            await interaction.deferReply({ ephemeral: true }); // Deferir la respuesta ya que fetch y bulkDelete pueden tardar

            let messages;
            if (targetUser) {
                // Obtener mensajes del canal, filtrar por usuario y limitar la cantidad
                messages = await interaction.channel.messages.fetch({ limit: 100 }); // Buscar hasta 100 mensajes para encontrar los del usuario
                const userMessages = messages.filter(msg => msg.author.id === targetUser.id).first(amount);

                if (userMessages.length === 0) {
                    return interaction.editReply({ content: `❌ No se encontraron mensajes de **${targetUser.tag}** para borrar.` });
                }
                // Borrar solo los mensajes del usuario
                await interaction.channel.bulkDelete(userMessages, true); // 'true' para no arrojar error si un mensaje tiene más de 14 días
                await interaction.editReply({ content: `✅ Se borraron ${userMessages.length} mensaje(s) de **${targetUser.tag}**. Razón: \`${reason}\`` });
                
                logModerationAction(
                    interaction.guild,
                    'CLEAR_MESSAGES_USER',
                    targetUser,
                    interaction.user,
                    reason,
                    `Cantidad: ${userMessages.length}, Canal: #${interaction.channel.name}`
                );

            } else {
                // Borrar mensajes sin filtrar por usuario
                // El +1 es para borrar también el mensaje del comando de Discord.js, aunque aquí estamos borrando la cantidad exacta.
                // Si borras 5, quieres que borre los 5, no el comando + 4.
                // Sin embargo, bulkDelete no borrará mensajes de más de 14 días.
                await interaction.channel.bulkDelete(amount, true); // 'true' para no arrojar error si un mensaje tiene más de 14 días
                await interaction.editReply({ content: `✅ Se borraron ${amount} mensaje(s). Razón: \`${reason}\`` });

                logModerationAction(
                    interaction.guild,
                    'CLEAR_MESSAGES',
                    null,
                    interaction.user,
                    reason,
                    `Cantidad: ${amount}, Canal: #${interaction.channel.name}`
                );
            }

            // Opcional: Eliminar el mensaje de respuesta efímero después de un tiempo si quieres que no se quede.
            // setTimeout(() => interaction.deleteReply().catch(console.error), 5000);

        } catch (error) {
            console.error('Error al borrar mensajes:', error);
            let errorMessage = '❌ Hubo un error al intentar borrar mensajes. Asegúrate de que el bot tenga el permiso "Gestionar Mensajes".';
            if (error.code === 50035) { // Invalid Form Body - ocurre si los mensajes son demasiado viejos
                errorMessage += '\nLos mensajes de más de 14 días no pueden ser borrados con este comando.';
            }
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },
};