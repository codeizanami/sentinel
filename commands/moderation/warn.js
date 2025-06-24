const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { logModerationAction } = require('../../utils/logger');
const fs = require('node:fs');
const path = require('node:path');

// Ruta al archivo JSON donde se guardarán las advertencias
const warningsFilePath = path.join(__dirname, '../../utils/warnings.json');

// Función para cargar advertencias desde el archivo JSON
function loadWarnings() {
    if (!fs.existsSync(warningsFilePath)) {
        return {}; // Si el archivo no existe, devuelve un objeto vacío
    }
    const data = fs.readFileSync(warningsFilePath, 'utf8');
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error("Error al parsear warnings.json, creando nuevo archivo.", e);
        return {}; // Si el JSON está corrupto, devuelve un objeto vacío
    }
}

// Función para guardar advertencias en el archivo JSON
function saveWarnings(warnings) {
    fs.writeFileSync(warningsFilePath, JSON.stringify(warnings, null, 2), 'utf8');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Añade una advertencia a un usuario.')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario a advertir.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('razon')
                .setDescription('La razón de la advertencia.')
                .setRequired(true)) // La razón es obligatoria para las advertencias
        .addBooleanOption(option =>
            option.setName('silencioso')
                .setDescription('Establece en True para que la respuesta sea efímera.')
                .setRequired(false)),
    async execute(interaction) {
        // Verifica si el usuario tiene permiso para moderar miembros
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return interaction.reply({ content: '❌ No tienes permiso para advertir miembros.', ephemeral: true });
        }

        const userToWarn = interaction.options.getUser('usuario');
        const memberToWarn = interaction.guild.members.cache.get(userToWarn.id);
        const reason = interaction.options.getString('razon');
        const isEphemeral = interaction.options.getBoolean('silencioso') || false; // Por defecto no es efímero

        // Comprobaciones de seguridad
        if (!memberToWarn) {
            return interaction.reply({ content: '❌ No se encontró al usuario en este servidor.', ephemeral: true });
        }
        if (memberToWarn.id === interaction.client.user.id) {
            return interaction.reply({ content: '❌ No me puedo advertir a mí mismo.', ephemeral: true });
        }
        if (memberToWarn.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '❌ No puedo advertir a un administrador.', ephemeral: true });
        }
        // Comprueba la jerarquía de roles
        if (memberToWarn.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: '❌ No puedes advertir a alguien con un rol igual o superior al tuyo.', ephemeral: true });
        }

        let warnings = loadWarnings();
        const guildId = interaction.guild.id;
        const userId = userToWarn.id;

        // Inicializa la estructura para el servidor y el usuario si no existe
        if (!warnings[guildId]) {
            warnings[guildId] = {};
        }
        if (!warnings[guildId][userId]) {
            warnings[guildId][userId] = [];
        }

        // Crea el objeto de la advertencia
        const warning = {
            moderatorId: interaction.user.id,
            reason: reason,
            timestamp: new Date().toISOString(),
            warningNumber: warnings[guildId][userId].length + 1 // Número incremental de advertencia
        };

        // Añade la advertencia y guarda
        warnings[guildId][userId].push(warning);
        saveWarnings(warnings);

        try {
            // Notificar al usuario por DM
            const dmEmbed = new EmbedBuilder()
                .setColor(0xFEE75C) // Color amarillo para advertencias
                .setTitle(`Advertencia en ${interaction.guild.name}`)
                .setDescription(`Has recibido una advertencia.`)
                .addFields(
                    { name: 'Razón', value: reason },
                    { name: 'Moderador', value: interaction.user.tag },
                    { name: 'Total de Advertencias', value: warnings[guildId][userId].length.toString() }
                )
                .setTimestamp()
                .setFooter({ text: 'Por favor, revisa las reglas del servidor.' });

            await userToWarn.send({ embeds: [dmEmbed] }).catch(() => console.log(`No se pudo enviar DM de advertencia a ${userToWarn.tag}.`));

            // Respuesta en el canal donde se ejecutó el comando
            await interaction.reply({
                content: `✅ **${userToWarn.tag}** ha recibido la advertencia #${warning.warningNumber} por: \`${reason}\`. Ahora tiene **${warnings[guildId][userId].length}** advertencia(s).`,
                ephemeral: isEphemeral
            });

            // Registra la acción en el canal de logs
            logModerationAction(
                interaction.guild,
                'WARN',
                userToWarn,
                interaction.user,
                reason,
                `Advertencia #${warning.warningNumber}. Total de advertencias: ${warnings[guildId][userId].length}`
            );

        } catch (error) {
            console.error('Error al advertir usuario:', error);
            await interaction.reply({ content: '❌ Hubo un error al intentar advertir a este usuario.', ephemeral: true });
        }
    },
};