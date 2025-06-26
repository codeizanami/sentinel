const { Events, REST, Routes, ActivityType } = require('discord.js'); // Asegúrate de importar ActivityType

// ¡Importante! Reemplaza esto con el ID de tu aplicación de bot (Application ID)
const CLIENT_ID = '1386689579452731545'; // Ejemplo: '1234567890123456789'
module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`¡Bot de moderación listo! Logueado como ${client.user.tag}`);

        // --- CAMBIO AQUÍ para mostrar el número de servidores ---
        const serverCount = client.guilds.cache.size;
        client.user.setActivity(`${serverCount} servidores`, { type: ActivityType.Watching });
        console.log(`Estado del bot establecido como "Viendo: ${serverCount} Servidores".`);

        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        const commands = [];

        for (const [name, command] of client.commands) {
            if (command.data) {
                commands.push(command.data.toJSON());
            }
        }

        try {
            console.log('Comenzando a registrar comandos de aplicación globalmente (/).');

            await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

            console.log('Comandos de aplicación (/) registrados globalmente exitosamente.');
        } catch (error) {
            console.error('Error al registrar comandos de aplicación (/)', error);
        }
    },
};
