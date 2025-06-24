const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { logModerationAction } = require('../../utils/logger');
const fs = require('node:fs');
const path = require('node:path');

const warningsFilePath = path.join(__dirname, '../../utils/warnings.json');

// Función para cargar advertencias desde el archivo
function loadWarnings() {
    if (!fs.existsSync(warningsFilePath)) {
        return {};
    }
    const data = fs.readFileSync(warningsFilePath, 'utf8');
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error("Error al parsear warnings.json, devolviendo objeto vacío.", e);
        return {};
    }
}

// Función para guardar advertencias en el archivo
function saveWarnings(warnings) {
    fs.writeFileSync(warningsFilePath, JSON.stringify(warnings, null, 2), 'utf8');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearwarns')
        .setDescription('Quita advertencias de un usuario.')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario del que quieres quitar advertencias.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('numero_advertencia')
                .setDescription('El número de la advertencia a quitar (deja vacío para quitar todas).')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('razon')
                .setDescription('La razón para quitar la(s) advertencia(s).')
                .setRequired(false)),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return interaction.reply({ content: '❌ No tienes permiso para quitar advertencias.', ephemeral: true });
        }

        const userToClear = interaction.options.getUser('usuario');
        const warningNumber = interaction.options.getInteger('numero_advertencia');
        const reason = interaction.options.getString('razon') || 'No se especificó una razón.';

        let warnings = loadWarnings();
        const guildId = interaction.guild.id;
        const userId = userToClear.id;

        if (!warnings[guildId] || !warnings[guildId][userId] || warnings[guildId][userId].length === 0) {
            return interaction.reply({ content: `❌ **${userToClear.tag}** no tiene advertencias en este servidor.`, ephemeral: true });
        }

        let userWarnings = warnings[guildId][userId];
        let removedCount = 0;
        let actionDescription = '';
        let logActionType = '';

        if (warningNumber) {
            // Quitar una advertencia específica
            const initialLength = userWarnings.length;
            userWarnings = userWarnings.filter(warn => warn.warningNumber !== warningNumber);

            if (userWarnings.length < initialLength) {
                removedCount = 1;
                // Reindexar los números de advertencia después de la eliminación
                userWarnings.forEach((warn, index) => {
                    warn.warningNumber = index + 1;
                });
                warnings[guildId][userId] = userWarnings; // Actualiza el array en el objeto warnings
                actionDescription = `la advertencia #${warningNumber}`;
                logActionType = 'WARN_REMOVE_ONE';
            } else {
                return interaction.reply({ content: `❌ No se encontró la advertencia #${warningNumber} para **${userToClear.tag}**.`, ephemeral: true });
            }
        } else {
            // Quitar todas las advertencias
            removedCount = userWarnings.length;
            delete warnings[guildId][userId]; // Elimina todas las advertencias del usuario
            actionDescription = `todas las ${removedCount} advertencia(s)`;
            logActionType = 'WARN_REMOVE_ALL';
        }

        saveWarnings(warnings); // Guarda los cambios en el archivo

        const remainingWarnings = warnings[guildId] && warnings[guildId][userId] ? warnings[guildId][userId].length : 0;

        await interaction.reply({
            content: `✅ Se ha(n) quitado ${actionDescription} de **${userToClear.tag}**. Ahora tiene **${remainingWarnings}** advertencia(s) restantes. Razón: \`${reason}\``
        });

        // Registrar la acción de moderación
        logModerationAction(
            interaction.guild,
            logActionType,
            userToClear,
            interaction.user,
            reason,
            `Se quitaron: ${removedCount}. Quedan: ${remainingWarnings}`
        );
    },
};