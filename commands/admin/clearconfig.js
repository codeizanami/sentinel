// commands/admin/clearconfig.js
const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { clearGuildConfig } = require('../../utils/configManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearconfig')
        .setDescription('Borra la configuración específica del servidor. ¡Vuelve a los valores predeterminados del bot!') // Descripción acortada
        .addBooleanOption(option =>
            option.setName('confirmar')
                .setDescription('Confirma para borrar toda la configuración del servidor. ¡Esto no se puede deshacer!')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const confirm = interaction.options.getBoolean('confirmar');

        if (!confirm) {
            return interaction.reply({
                content: '❌ Debes confirmar la acción seleccionando "verdadero" en la opción `confirmar` para borrar la configuración del servidor.',
                ephemeral: true
            });
        }

        try {
            clearGuildConfig(guildId);
            await interaction.reply({
                content: '✅ ¡Toda la configuración específica de este servidor ha sido borrada! Ahora se usará la configuración predeterminada del bot.',
                ephemeral: true
            });
        } catch (error) {
            console.error('Error al borrar configuración del servidor:', error);
            await interaction.reply({
                content: '❌ Hubo un error al intentar borrar la configuración del servidor.',
                ephemeral: true
            });
        }
    },
};