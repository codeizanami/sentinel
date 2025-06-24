const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    // Define los datos del comando de barra inclinada
    data: new SlashCommandBuilder()
        .setName('ping') // El nombre del comando (lo que escribes después de '/')
        .setDescription('Responde con Pong!'), // La descripción que aparece en Discord

    // La función que se ejecuta cuando el comando es llamado
    async execute(interaction) {
        // Responde a la interacción con "Pong!"
        // Por defecto, esta respuesta es visible para todos en el canal.
        await interaction.reply('Pong!');
    },
};