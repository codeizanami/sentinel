const { Events } = require('discord.js');
const { logModerationAction } = require('../utils/logger');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage, client) { // Recibe el objeto client aquí
        if (oldMessage.partial || newMessage.partial) return; // Ignorar si los mensajes son parciales.
        if (oldMessage.author.bot) return; // Ignorar mensajes de bots.
        if (oldMessage.content === newMessage.content) return; // Ignorar si el contenido no ha cambiado (ej. solo embeds se cargaron).

        // Almacena el mensaje editado en la colección global de snipedMessages.
        // Usamos el ID del canal como clave.
        client.snipedMessages.set(newMessage.channel.id, {
            content: newMessage.content, // En este caso, 'content' del objeto snipe es el nuevo contenido
            author: {
                tag: oldMessage.author.tag,
                id: oldMessage.author.id,
                avatarURL: oldMessage.author.displayAvatarURL({ dynamic: true, size: 64 })
            },
            timestamp: Date.now(),
            type: 'edited',
            oldContent: oldMessage.content, // Contenido original del mensaje
            newContent: newMessage.content, // Nuevo contenido del mensaje
            // Si el mensaje original tenía imágenes adjuntas, guardamos la URL de la primera.
            imageUrl: oldMessage.attachments.size > 0 ? oldMessage.attachments.first().url : null
        });

        // Opcional: Loggear la acción de edición de mensaje en el canal de logs
        logModerationAction(
            newMessage.guild,
            'MESSAGE_EDIT',
            newMessage.author, // Usuario que editó el mensaje
            client.user,        // Bot como "moderador" del log
            'Mensaje editado',
            `**Original:** \`\`\`${oldMessage.content ? oldMessage.content.substring(0, 500) : '[Sin contenido de texto]'}\`\`\`\n**Nuevo:** \`\`\`${newMessage.content ? newMessage.content.substring(0, 500) : '[Sin contenido de texto]'}\`\`\`\nCanal: #${newMessage.channel.name}`
        );

        console.log(`[SNIPE] Mensaje de ${oldMessage.author.tag} editado en #${newMessage.channel.name}. Guardado para snipe.`);
    },
};