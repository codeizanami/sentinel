const { Events } = require('discord.js');
const { logModerationAction } = require('../utils/logger');

module.exports = {
    name: Events.MessageDelete,
    async execute(message, client) { // Recibe el objeto client aquí
        if (message.partial) return; // Si el mensaje es parcial (no tenemos todos los datos), lo ignoramos.
        if (message.author.bot) return; // Ignoramos mensajes de bots para evitar spam o bucles.

        // Almacena el mensaje borrado en la colección global de snipedMessages.
        // Usamos el ID del canal como clave.
        client.snipedMessages.set(message.channel.id, {
            content: message.content,
            author: {
                tag: message.author.tag,
                id: message.author.id,
                avatarURL: message.author.displayAvatarURL({ dynamic: true, size: 64 })
            },
            timestamp: Date.now(),
            type: 'deleted',
            // Si el mensaje tenía imágenes adjuntas, guardamos la URL de la primera.
            imageUrl: message.attachments.size > 0 ? message.attachments.first().url : null
        });

        // Opcional: Loggear la acción de borrado de mensaje en el canal de logs
        logModerationAction(
            message.guild,
            'MESSAGE_DELETE',
            message.author, // Usuario que envió el mensaje borrado
            client.user,    // Bot como "moderador" del log
            'Mensaje eliminado',
            `Contenido: \`\`\`${message.content ? message.content.substring(0, 1000) : '[Sin contenido de texto]'}\`\`\`\nCanal: #${message.channel.name}`
        );

        console.log(`[SNIPE] Mensaje de ${message.author.tag} borrado en #${message.channel.name}. Guardado para snipe.`);
    },
};