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
 * Obtiene la configuración para un Gremio (Guild) específico.
 * Fusiona las configuraciones predeterminadas con las del Gremio si existen.
 * @param {string} guildId El ID del Gremio.
 * @returns {object} La configuración del Gremio.
 */
function getGuildConfig(guildId) {
    // Asegura que las disabledCommands estén inicializadas para el gremio si no existen
    if (!config.guildSettings[guildId]) {
        config.guildSettings[guildId] = {};
    }
    if (!config.guildSettings[guildId].disabledCommands) {
        config.guildSettings[guildId].disabledCommands = [];
    }
    // Asegura que las ticketSettings estén inicializadas para el gremio si no existen
    // (Ahora se inicializan en defaultSettings al cargar el config principal,
    // pero mantenemos esto por si acaso una configuración existente no las tiene)
    if (!config.guildSettings[guildId].ticketCategoryId) config.guildSettings[guildId].ticketCategoryId = null;
    if (!config.guildSettings[guildId].supportRoleIds) config.guildSettings[guildId].supportRoleIds = [];
    if (!config.guildSettings[guildId].ticketLogChannelId) config.guildSettings[guildId].ticketLogChannelId = null;
    if (!config.guildSettings[guildId].ticketCounter) config.guildSettings[guildId].ticketCounter = 0;
    if (!config.guildSettings[guildId].ticketPanelChannelId) config.guildSettings[guildId].ticketPanelChannelId = null;
    if (!config.guildSettings[guildId].ticketPanelMessageId) config.guildSettings[guildId].ticketPanelMessageId = null;


    const guildSpecificSettings = config.guildSettings[guildId] || {};
    // Combina default con específicos, priorizando los específicos del gremio
    return { ...config.defaultSettings, ...guildSpecificSettings };
}

/**
 * Establece una configuración específica para un Gremio.
 * @param {string} guildId El ID del Gremio.
 * @param {object} settings Un objeto con las configuraciones a establecer (ej. { logChannelId: 'ID_DEL_CANAL' }).
 */
function setGuildConfig(guildId, settings) {
    if (!config.guildSettings[guildId]) {
        config.guildSettings[guildId] = {};
    }
    Object.assign(config.guildSettings[guildId], settings);
    saveConfig();
}

/**
 * Obtiene el valor de una configuración específica de ticket para un Gremio.
 * @param {string} guildId El ID del Gremio.
 * @param {string} key La clave de la configuración (ej. 'ticketCategoryId').
 * @returns {*} El valor de la configuración.
 */
function getTicketSettings(guildId, key) {
    const guildSettings = getGuildConfig(guildId); // Obtiene la configuración completa del gremio
    return guildSettings[key]; // Accede directamente a la clave de ticket, ya que getGuildConfig las fusiona
}

/**
 * Establece un valor para una configuración específica de ticket para un Gremio.
 * @param {string} guildId El ID del Gremio.
 * @param {string} key La clave de la configuración (ej. 'ticketCategoryId').
 * @param {*} value El valor a establecer.
 */
function setTicketSetting(guildId, key, value) {
    if (!config.guildSettings[guildId]) {
        config.guildSettings[guildId] = {};
    }
    // Asigna el valor directamente a la configuración del gremio
    config.guildSettings[guildId][key] = value;
    saveConfig();
}

/**
 * Incrementa el contador de tickets para un Gremio específico.
 * @param {string} guildId El ID del Gremio.
 * @returns {number} El nuevo valor del contador de tickets.
 */
function incrementTicketCounter(guildId) {
    const currentCounter = getTicketSettings(guildId, 'ticketCounter') || 0;
    const newCounter = currentCounter + 1;
    setTicketSetting(guildId, 'ticketCounter', newCounter);
    return newCounter;
}

/**
 * Obtiene todas las encuestas activas.
 * @returns {object} Un objeto con las encuestas activas.
 */
function getActivePolls() {
    return config.activePolls;
}

/**
 * Añade o actualiza una encuesta activa.
 * @param {string} pollMessageId El ID del mensaje de la encuesta (como clave).
 * @param {object} pollData Los datos de la encuesta.
 */
function addOrUpdateActivePoll(pollMessageId, pollData) {
    config.activePolls[pollMessageId] = pollData;
    saveConfig();
}

/**
 * Elimina una encuesta de las encuestas activas.
 * @param {string} pollMessageId El ID del mensaje de la encuesta.
 */
function removeActivePoll(pollMessageId) {
    delete config.activePolls[pollMessageId];
    saveConfig();
}

/**
 * Obtiene el estado de habilitación de un comando para un Gremio.
 * @param {string} guildId El ID del Gremio.
 * @param {string} commandName El nombre del comando.
 * @returns {boolean} True si el comando está habilitado, false si está deshabilitado.
 */
function getCommandEnabledStatus(guildId, commandName) {
    const guildSettings = getGuildConfig(guildId); // Esto ya incluye disabledCommands
    return !guildSettings.disabledCommands.includes(commandName);
}

/**
 * Habilita o deshabilita un comando para un Gremio.
 * @param {string} guildId El ID del Gremio.
 * @param {string} commandName El nombre del comando.
 * @param {boolean} enable True para habilitar, false para deshabilitar.
 */
function toggleCommandStatus(guildId, commandName, enable) {
    const guildSettings = getGuildConfig(guildId);
    const disabledCommands = new Set(guildSettings.disabledCommands);

    if (enable) {
        disabledCommands.delete(commandName); // Elimina de la lista de deshabilitados
    } else {
        disabledCommands.add(commandName); // Añade a la lista de deshabilitados
    }

    // Asegurarse de que el objeto guildSettings en config.guildSettings[guildId] se actualice
    // No solo la copia local devuelta por getGuildConfig
    if (!config.guildSettings[guildId]) {
        config.guildSettings[guildId] = {};
    }
    config.guildSettings[guildId].disabledCommands = Array.from(disabledCommands);
    saveConfig();
}

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
    getCommandEnabledStatus,
    toggleCommandStatus,
    clearGuildConfig, // ¡Añadido el comando clearGuildConfig aquí!
};