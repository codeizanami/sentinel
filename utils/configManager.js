// utils/configManager.js
const fs = require('node:fs');
const path = require('node:path');

const configPath = path.join(__dirname, '../config.json'); // Ruta al archivo config.json
let config = {}; // Variable para almacenar la configuración en memoria

/**
 * Carga la configuración desde el archivo config.json.
 */
function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            const configFile = fs.readFileSync(configPath, 'utf8');
            config = JSON.parse(configFile);
            // Asegurarse de que las secciones necesarias existan si el archivo ya existía pero no las tenía
            if (!config.defaultSettings) config.defaultSettings = {
                "logChannelId": null,
                "unverifiedRoleId": null,
                "verifiedRoleId": null,
                // NUEVO: Valores predeterminados para tickets
                "ticketCategoryId": null,
                "supportRoleIds": [], // CAMBIO: Ahora es un array para múltiples roles
                "ticketLogChannelId": null,
                "ticketCounter": 0, // Contador de tickets global o por defecto
                "ticketPanelChannelId": null, // NUEVO: Canal donde se envía el panel de tickets
                "ticketPanelMessageId": null // NUEVO: ID del mensaje del panel de tickets
            };
            if (!config.guildSettings) config.guildSettings = {};
            if (!config.activePolls) config.activePolls = {};
            // NOTA: La sección de warnings no se inicializa aquí porque ya la tienes implementada.
            console.log('[CONFIG] Configuración cargada exitosamente.');
        } else {
            // Si el archivo no existe, crea uno con la estructura predeterminada
            config = {
                "defaultSettings": {
                    "logChannelId": null,
                    "unverifiedRoleId": null,
                    "verifiedRoleId": null,
                    // NUEVO: Valores predeterminados para tickets
                    "ticketCategoryId": null,
                    "supportRoleIds": [], // CAMBIO: Ahora es un array
                    "ticketLogChannelId": null,
                    "ticketCounter": 0,
                    "ticketPanelChannelId": null, // NUEVO
                    "ticketPanelMessageId": null // NUEVO
                },
                "guildSettings": {},
                "activePolls": {}
                // NOTA: La sección de warnings no se inicializa aquí.
            };
            saveConfig(); // Guarda el archivo recién creado
            console.log('[CONFIG] config.json no encontrado. Se creó uno nuevo con configuración predeterminada.');
        }
    } catch (error) {
        console.error('[CONFIG ERROR] Error al cargar o parsear config.json:', error);
        // En caso de error, inicializa una configuración vacía para evitar fallos
        config = {
            "defaultSettings": {
                "logChannelId": null,
                "unverifiedRoleId": null,
                "verifiedRoleId": null,
                // NUEVO: Valores predeterminados para tickets
                "ticketCategoryId": null,
                "supportRoleIds": [], // CAMBIO: Ahora es un array
                "ticketLogChannelId": null,
                "ticketCounter": 0,
                "ticketPanelChannelId": null, // NUEVO
                "ticketPanelMessageId": null // NUEVO
            },
            "guildSettings": {},
            "activePolls": {}
            // NOTA: La sección de warnings no se inicializa aquí.
        };
    }
}

/**
 * Guarda la configuración actual en el archivo config.json.
 */
function saveConfig() {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');
        console.log('[CONFIG] Configuración guardada exitosamente.');
    } catch (error) {
        console.error('[CONFIG ERROR] Error al guardar config.json:', error);
    }
}

/**
 * Obtiene la configuración específica de un gremio, o los valores predeterminados si no hay una configuración específica.
 * @param {string} guildId El ID del Gremio.
 * @returns {object} La configuración del gremio.
 */
function getGuildConfig(guildId) {
    const guildSpecificConfig = config.guildSettings[guildId] || {};
    return { ...config.defaultSettings, ...guildSpecificConfig };
}

/**
 * Establece o actualiza la configuración específica de un gremio.
 * @param {string} guildId El ID del Gremio.
 * @param {object} settings Un objeto con las propiedades de configuración a establecer o actualizar.
 */
function setGuildConfig(guildId, settings) {
    if (!config.guildSettings[guildId]) {
        config.guildSettings[guildId] = {};
    }
    Object.assign(config.guildSettings[guildId], settings);
    saveConfig();
}

// Funciones para gestionar la configuración de tickets (ya existentes)
function getTicketSettings(guildId) {
    const guildConfig = getGuildConfig(guildId);
    return {
        ticketCategoryId: guildConfig.ticketCategoryId,
        supportRoleIds: guildConfig.supportRoleIds,
        ticketLogChannelId: guildConfig.ticketLogChannelId,
        ticketCounter: guildConfig.ticketCounter,
        ticketPanelChannelId: guildConfig.ticketPanelChannelId,
        ticketPanelMessageId: guildConfig.ticketPanelMessageId
    };
}

function setTicketSetting(guildId, key, value) {
    const guildConfig = getGuildConfig(guildId);
    guildConfig[key] = value;
    setGuildConfig(guildId, { [key]: value });
}

function incrementTicketCounter(guildId) {
    const guildConfig = getGuildConfig(guildId);
    const newCounter = (guildConfig.ticketCounter || 0) + 1;
    setTicketSetting(guildId, 'ticketCounter', newCounter);
    return newCounter;
}

// Funciones para gestionar encuestas activas (ya existentes)
function getActivePolls() {
    return config.activePolls;
}

function addOrUpdateActivePoll(messageId, pollData) {
    config.activePolls[messageId] = pollData;
    saveConfig();
}

function removeActivePoll(messageId) {
    delete config.activePolls[messageId];
    saveConfig();
}

// Las funciones getCommandEnabledStatus y toggleCommandStatus han sido eliminadas.

/**
 * Elimina toda la configuración específica de un Gremio, volviendo a los valores predeterminados.
 * @param {string} guildId El ID del Gremio.
 */
function clearGuildConfig(guildId) {
    if (config.guildSettings[guildId]) {
        delete config.guildSettings[guildId];
        saveConfig();
        console.log(`[CONFIG] Configuración del gremio ${guildId} eliminada. Ahora usa la configuración predeterminada.`);
    } else {
        console.log(`[CONFIG] No hay configuración específica para el gremio ${guildId}.`);
    }
}


// Carga la configuración al iniciar el módulo
loadConfig();

module.exports = {
    loadConfig,
    saveConfig,
    getGuildConfig,
    setGuildConfig,
    getTicketSettings,
    setTicketSetting,
    incrementTicketCounter,
    getActivePolls,
    addOrUpdateActivePoll,
    removeActivePoll,
    clearGuildConfig,
};