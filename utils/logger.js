const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('./configManager'); // ¡NUEVO: Importa getGuildConfig desde configManager!

/**
 * Envía un mensaje de log detallado a un canal de logs de moderación.
 * @param {Guild} guild El objeto Guild donde ocurrió la acción.
 * @param {string} actionType El tipo de acción de moderación (ej. 'KICK', 'BAN', 'MUTE', 'WARN', 'UNBAN', 'UNMUTE', 'WARN_REMOVE_ONE', 'WARN_REMOVE_ALL', 'LOCK_CHANNEL', 'UNLOCK_CHANNEL', 'SLOWMODE', 'NUKE_CHANNEL', 'CLEAR_MESSAGES', 'CLEAR_MESSAGES_USER', 'VERIFY_SETUP', 'USER_VERIFIED', 'UNMUTE_AUTO', 'ASSIGN_UNVERIFIED_ROLE', 'MESSAGE_DELETE', 'MESSAGE_EDIT').
 * @param {User|null} targetUser El objeto User del usuario afectado. Puede ser null si la acción no afecta a un usuario directamente (ej. bloqueo de canal).
 * @param {User} moderatorUser El objeto User del moderador que realizó la acción.
 * @param {string} reason La razón de la acción.
 * @param {string} [additionalInfo=''] Información adicional para el log (opcional).
 */
async function logModerationAction(guild, actionType, targetUser, moderatorUser, reason, additionalInfo = '') {
    // --- ¡CAMBIO CLAVE AQUÍ! Obtiene la configuración del gremio
    const guildConfig = getGuildConfig(guild.id);
    const logChannelId = guildConfig.logChannelId; // Obtiene el ID del canal de logs de la configuración

    // Si no hay un ID de canal de logs configurado, advierte y sale
    if (!logChannelId) {
        console.warn(`[WARN] No hay un canal de logs configurado para el servidor '${guild.name}'. Un administrador debe usar /setrole log_canal.`);
        return;
    }

    // Busca el canal de logs por su ID
    const logChannel = guild.channels.cache.get(logChannelId);

    // Si el canal no se encuentra (ej. fue borrado después de ser configurado), advierte y sale
    if (!logChannel) {
        console.warn(`[WARN] El canal de logs con ID '${logChannelId}' no se encontró en el servidor '${guild.name}'.`);
        return;
    }

    let color;
    // Asigna un color al embed basado en el tipo de acción
    switch (actionType) {
        case 'KICK':
        case 'BAN':
        case 'NUKE_CHANNEL':
        case 'MESSAGE_DELETE':
            color = 0xFF0000; // Rojo para acciones severas o destructivas
            break;
        case 'MUTE':
        case 'WARN':
        case 'MESSAGE_EDIT':
            color = 0xFFA500; // Naranja para acciones de advertencia o temporales
            break;
        case 'UNBAN':
        case 'UNMUTE':
        case 'UNMUTE_AUTO':
        case 'WARN_REMOVE_ONE':
        case 'WARN_REMOVE_ALL':
        case 'UNLOCK_CHANNEL':
        case 'USER_VERIFIED':
            color = 0x00FF00; // Verde para reversiones o acciones positivas
            break;
        case 'SLOWMODE':
        case 'CLEAR_MESSAGES':
        case 'CLEAR_MESSAGES_USER':
        case 'LOCK_CHANNEL':
        case 'VERIFY_SETUP':
        case 'ASSIGN_UNVERIFIED_ROLE':
            color = 0x0099FF; // Azul para acciones de configuración o limpieza no destructivas
            break;
        default:
            color = 0x0099FF; // Azul por defecto para otros tipos de acción
    }

    // Construye el embed (mensaje enriquecido) para el log
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`Acción de Moderación: ${actionType}`)
        .addFields(
            { name: 'Usuario Afectado', value: `${targetUser ? targetUser.tag : 'N/A'} (ID: ${targetUser ? targetUser.id : 'N/A'})`, inline: true },
            { name: 'Moderador', value: `${moderatorUser.tag} (ID: ${moderatorUser.id})`, inline: true },
            { name: 'Razón', value: reason }
        )
        .setTimestamp()
        .setFooter({ text: `Acción realizada por Sentinel` });

    if (additionalInfo) {
        embed.addFields({ name: 'Información Adicional', value: additionalInfo });
    }

    try {
        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error(`Error al enviar log al canal ${logChannel.name} (ID: ${logChannel.id}):`, error);
    }
}

module.exports = {
    logModerationAction
};