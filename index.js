// index.js
// Carga las variables de entorno desde .env
require('dotenv').config();

// Importa las clases necesarias de discord.js
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Importa el gestor de configuración.
const configManager = require('./utils/configManager');

// Crea una nueva instancia del cliente de Discord con los intents necesarios
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
    ]
});

// Inicializa una Collection para almacenar los comandos del bot
client.commands = new Collection();
// Inicializa un Map para almacenar mensajes borrados/editados para el comando /snipe
client.snipedMessages = new Map();
// REMOVIDO: client.ticketSetupState = new Map(); // Esta línea ya no es necesaria

// --- ASIGNAR TODAS LAS FUNCIONES DE CONFIGMANAGER AL CLIENTE ---
client.getGuildConfig = configManager.getGuildConfig;
client.setGuildConfig = configManager.setGuildConfig;
client.getActivePolls = configManager.getActivePolls;
client.addOrUpdateActivePoll = configManager.addOrUpdateActivePoll;
client.removeActivePoll = configManager.removeActivePoll;

// Asignar las funciones para la configuración de tickets en curso
client.getOngoingTicketSetup = configManager.getOngoingTicketSetup;
client.setOngoingTicketSetup = configManager.setOngoingTicketSetup;
client.removeOngoingTicketSetup = configManager.removeOngoingTicketSetup;

// Asignar las funciones para tickets activos
client.getActiveTicket = configManager.getActiveTicket;
client.addActiveTicket = configManager.addActiveTicket;
client.removeActiveTicket = configManager.removeActiveTicket;

// Asignar las funciones para la configuración de tickets del gremio
client.getTicketSettings = configManager.getTicketSettings;
client.setTicketSetting = configManager.setTicketSetting;
client.incrementTicketCounter = configManager.incrementTicketCounter;


// --- Carga de Comandos ---
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.warn(`[ADVERTENCIA] El comando en ${filePath} no tiene las propiedades "data" o "execute" requeridas.`);
        }
    }
}


// --- Carga de Eventos ---
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}


// --- Inicio de Sesión del Bot ---
client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('Error al iniciar sesión con el bot:', error);
    console.error('Asegúrate de que tu token de Discord sea correcto y esté en el archivo .env.');
    console.error('También verifica que hayas activado el "MESSAGE CONTENT INTENT" en el portal de desarrolladores de Discord.');
});

// Evento que se dispara una vez que el bot ha iniciado sesión y está listo
client.once(Events.ClientReady, async c => {
    console.log(`¡Bot de moderación listo! Logueado como ${c.user.tag}`);

    // --- REGISTRO GLOBAL DE COMANDOS ---
    const commandsToRegister = [];
    client.commands.forEach(command => {
        commandsToRegister.push(command.data.toJSON());
    });

    try {
        // Esto registra los comandos globalmente para todos los servidores
        // Una vez que el bot se conecta, los envía a Discord.
        await c.application.commands.set(commandsToRegister);
        console.log('Comandos de barra registrados globalmente con Discord.');
    } catch (error) {
        console.error('Error al registrar comandos globalmente:', error);
        console.error('Asegúrate de que el bot tiene el scope "applications.commands" en su enlace de invitación.');
    }
});