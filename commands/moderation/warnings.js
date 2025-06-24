const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Ruta al archivo JSON donde se guardan las advertencias
const warningsFilePath = path.join(__dirname, '../../utils/warnings.json');

// Función para cargar advertencias desde el archivo JSON
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('Muestra las advertencias de un usuario.')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario del que quieres ver las advertencias.')
                .setRequired(true)),
    async execute(interaction) {
        // Verifica si el usuario tiene permiso para moderar miembros
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return interaction.reply({ content: '❌ No tienes permiso para ver advertencias.', ephemeral: true });
        }

        const userToShowWarnings = interaction.options.getUser('usuario');
        const warnings = loadWarnings();
        const guildId = interaction.guild.id;
        const userId = userToShowWarnings.id;

        // Comprueba si el usuario tiene advertencias
        if (!warnings[guildId] || !warnings[guildId][userId] || warnings[guildId][userId].length === 0) {
            return interaction.reply({ content: `✅ **${userToShowWarnings.tag}** no tiene advertencias en este servidor.`, ephemeral: true });
        }

        const userWarnings = warnings[guildId][userId];

        // Crea un embed para mostrar las advertencias
        const embed = new EmbedBuilder()
            .setColor(0x0099FF) // Color azul
            .setTitle(`Advertencias de ${userToShowWarnings.tag}`)
            .setThumbnail(userToShowWarnings.displayAvatarURL({ dynamic: true }))
            .setDescription(`Total de advertencias: **${userWarnings.length}**\n\n`)
            .setTimestamp()
            .setFooter({ text: `ID: ${userId}` });

        // Añade cada advertencia como un campo en el embed
        userWarnings.forEach((warn, index) => {
            // Intenta obtener el moderador por su ID, si no se encuentra, lo marca como 'Desconocido'
            const moderator = interaction.client.users.cache.get(warn.moderatorId) || { tag: 'Desconocido' };
            const date = new Date(warn.timestamp).toLocaleString(); // Formatea la fecha
            embed.addFields({
                name: `Advertencia #${warn.warningNumber} (${date})`,
                value: `**Razón:** ${warn.reason}\n**Moderador:** ${moderator.tag}`,
                inline: false
            });
        });

        await interaction.reply({ embeds: [embed] });
    },
};