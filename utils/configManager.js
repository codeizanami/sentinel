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
                "ticketCategoryId": null,
                "supportRoleIds": [],
                "ticketLogChannelId": null,
                "ticketCounter": 0,
                "ticketPanelChannelId": null,
                "ticketPanelMessageId": null,
                "activeTickets": {} // Asegura que activeTickets exista
            };
            if (!config.guildSettings) config.guildSettings = {};
            if (!config.activePolls) config.activePolls = {};
            if (!config.ongoingTicketSetups) config.ongoingTicketSetups = {};

            // IMPORTANTE: Asegúrate de que cada guildSettings tenga todas las propiedades predeterminadas
            // Esto manejará la adición de nuevos campos como los de verificación a configuraciones existentes.
            for (const guildId in config.guildSettings) {
                for (const key in config.defaultSettings) {
                    // Si la clave no existe en la configuración del gremio o es undefined
                    if (config.guildSettings[guildId][key] === undefined) {
                        // Si la clave es un objeto no nulo y no un array (como activeTickets)
                        if (typeof config.defaultSettings[key] === 'object' && config.defaultSettings[key] !== null && !Array.isArray(config.defaultSettings[key])) {
                            config.guildSettings[guildId][key] = {}; // Inicializa como un objeto vacío
                        } else if (Array.isArray(config.defaultSettings[key])) {
                            // Si es un array (como supportRoleIds)
                            config.guildSettings[guildId][key] = []; // Inicializa como un array vacío
                        } else {
                            // Para otros tipos de valores (null, string, number, boolean)
                            config.guildSettings[guildId][key] = config.defaultSettings[key];
                        }
                    }
                }
            }
            console.log('[CONFIG] Configuración cargada del disco.');
        } else {
            // Si el archivo no existe, crea una configuración predeterminada
            config = {
                defaultSettings: {
                    logChannelId: null,
                    unverifiedRoleId: null,
                    verifiedRoleId: null,
                    ticketCategoryId: null,
                    supportRoleIds: [],
                    ticketLogChannelId: null,
                    ticketCounter: 0,
                    ticketPanelChannelId: null,
                    ticketPanelMessageId: null,
                    activeTickets: {}
                },
                guildSettings: {},
                activePolls: {},
                ongoingTicketSetups: {},
            };
            saveConfig();
            console.log('[CONFIG] config.json no encontrado, se ha creado uno nuevo.');
        }
    } catch (error) {
        console.error('Error al cargar la configuración:', error);
        // En caso de error de parseo o archivo corrupto, se recomienda resetear a la configuración predeterminada
        // para evitar que el bot falle en bucle. Esto creará un nuevo config.json con los valores predeterminados.
        config = {
            defaultSettings: {
                logChannelId: null,
                unverifiedRoleId: null,
                verifiedRoleId: null,
                ticketCategoryId: null,
                supportRoleIds: [],
                ticketLogChannelId: null,
                ticketCounter: 0,
                ticketPanelChannelId: null,
                ticketPanelMessageId: null,
                activeTickets: {}
            },
            guildSettings: {},
            activePolls: {},
            ongoingTicketSetups: {},
        };
        saveConfig();
        console.log('[CONFIG] Error al cargar config.json, se ha restablecido la configuración a los valores predeterminados.');
    }
}

/**
 * Guarda la configuración actual en el archivo config.json.
 */
function saveConfig() {
    try {
        console.log('[SAVE CONFIG] Estado de ongoingTicketSetups ANTES de guardar:', JSON.stringify(config.ongoingTicketSetups, null, 2));
        const data = JSON.stringify(config, null, 4);
        fs.writeFileSync(configPath, data, 'utf8');
        console.log('[CONFIG] Configuración guardada correctamente.');
    } catch (error) {
        console.error('[CONFIG ERROR] Error al guardar la configuración en config.json:', error);
        if (error.code === 'EACCES') {
            console.error('[CONFIG ERROR] Permiso denegado al escribir en config.json. Verifica los permisos del archivo/carpeta.');
        }
    }
}

/**
 * Obtiene la configuración de un gremio específico o la predeterminada.
 * @param {string} guildId El ID del gremio.
 * @returns {object} La configuración del gremio.
 */
function getGuildConfig(guildId) {
    // Si no existe la configuración para el gremio, inicialízala fusionando con defaultSettings
    if (!config.guildSettings[guildId]) {
        config.guildSettings[guildId] = {
            ...config.defaultSettings, // Copia las configuraciones predeterminadas
            disabledCommands: [], // Inicializa como un array vacío si no existe
            // activeTickets ya está en defaultSettings, por lo que se copiará desde allí
        };
        saveConfig(); // Guarda la nueva configuración del gremio
    }
    return config.guildSettings[guildId];
}

/**
 * Establece o actualiza la configuración de un gremio.
 * @param {string} guildId El ID del gremio.
 * @param {object} newSettings Un objeto con las nuevas configuraciones a aplicar.
 */
function setGuildConfig(guildId, newSettings) {
    const guildConfig = getGuildConfig(guildId); // Asegura que el gremio exista en la config y esté inicializado
    Object.assign(guildConfig, newSettings); // Fusiona las nuevas configuraciones
    saveConfig();
}

/**
 * Obtiene la configuración de tickets de un gremio.
 * NOTA: Este getter devuelve el objeto completo de configuración del gremio, no solo una subsección de tickets.
 * @param {string} guildId El ID del gremio.
 * @returns {object} La configuración del gremio (incluyendo ticket settings).
 */
function getTicketSettings(guildId) {
    return getGuildConfig(guildId); // Retorna directamente la configuración del gremio
}

/**
 * Establece una configuración específica de tickets para un gremio.
 * @param {string} guildId El ID del gremio.
 * @param {string} key La clave de la configuración de ticket (ej. 'ticketCategoryId').
 * @param {*} value El valor a establecer.
 */
function setTicketSetting(guildId, key, value) {
    const guildConfig = getGuildConfig(guildId);
    guildConfig[key] = value; // Directamente en el objeto guildConfig
    saveConfig();
}

/**
 * Incrementa el contador de tickets para un gremio.
 * @param {string} guildId El ID del gremio.
 * @returns {number} El nuevo valor del contador de tickets.
 */
function incrementTicketCounter(guildId) {
    const guildConfig = getGuildConfig(guildId);
    const newCounter = (guildConfig.ticketCounter || 0) + 1;
    setTicketSetting(guildId, 'ticketCounter', newCounter); // <-- CORRECCIÓN: Usar setTicketSetting
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

// NUEVAS Funciones para gestionar el estado de la configuración de tickets en curso
function getOngoingTicketSetup(userId) {
    return config.ongoingTicketSetups[userId];
}

function setOngoingTicketSetup(userId, setupData) {
    config.ongoingTicketSetups[userId] = setupData;
    console.log(`[ONGOING TICKET SETUP] Estableciendo setup para ${userId}:`, JSON.stringify(config.ongoingTicketSetups[userId], null, 2));
    saveConfig();
}

function removeOngoingTicketSetup(userId) {
    delete config.ongoingTicketSetups[userId];
    saveConfig();
}

// NUEVAS Funciones para gestionar tickets activos
function getActiveTicket(guildId, channelId) {
    const guildConfig = getGuildConfig(guildId);
    return guildConfig.activeTickets[channelId];
}

function addActiveTicket(guildId, channelId, ticketData) {
    const guildConfig = getGuildConfig(guildId);
    guildConfig.activeTickets[channelId] = ticketData;
    saveConfig();
}

function removeActiveTicket(guildId, channelId) {
    const guildConfig = getGuildConfig(guildId);
    if (guildConfig.activeTickets && guildConfig.activeTickets[channelId]) {
        delete guildConfig.activeTickets[channelId];
        saveConfig();
    }
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
    getOngoingTicketSetup,
    setOngoingTicketSetup,
    removeOngoingTicketSetup,
    getActiveTicket,
    addActiveTicket,
    removeActiveTicket,
    clearGuildConfig,
};