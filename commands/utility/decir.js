const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('decir')
        .setDescription('Hace que el bot diga lo que escribas.')
        .addStringOption(option =>
            option.setName('mensaje')
                .setDescription('El mensaje que el bot debe decir.')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages) // Requiere permiso de "Gestionar Mensajes"
        .setDMPermission(false), // Este comando no se puede usar en mensajes directos

    async execute(interaction) {
        const messageToSay = interaction.options.getString('mensaje');

        // Verifica si el bot tiene permiso para enviar mensajes en el canal actual
        if (!interaction.channel.permissionsFor(interaction.client.user).has(PermissionsBitField.Flags.SendMessages)) {
            return interaction.reply({ 
                content: '❌ No tengo permiso para enviar mensajes en este canal.', 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        try {
            // Elimina la interacción del comando para que el mensaje del bot sea más limpio
            await interaction.deferReply({ ephemeral: true }); // Responde de forma efímera primero
            await interaction.deleteReply(); // Luego borra la respuesta efímera

            // Envía el mensaje en el canal donde se ejecutó el comando
            await interaction.channel.send(messageToSay);
        } catch (error) {
            console.error('Error al ejecutar el comando /decir:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Hubo un error al intentar enviar el mensaje.', flags: [MessageFlags.Ephemeral] });
            } else {
                await interaction.followUp({ content: '❌ Hubo un error al intentar enviar el mensaje.', flags: [MessageFlags.Ephemeral] });
            }
        }
    },
};