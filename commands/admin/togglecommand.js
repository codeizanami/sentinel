const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('togglecommand')
        .setDescription('Habilita o deshabilita un comando específico del bot en este servidor.')
        .addStringOption(option =>
            option.setName('comando')
                .setDescription('El nombre del comando a habilitar/deshabilitar (sin la barra /).')
                .setRequired(true))
        .addBooleanOption(option => // Usar un booleano es más claro para on/off
            option.setName('estado')
                .setDescription('Indica si el comando debe estar habilitado (verdadero) o deshabilitado (falso).')
                .setRequired(true)),
    async execute(interaction) {
        // Verificar si el usuario tiene permisos de administrador
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
                content: '❌ No tienes permisos para usar este comando. Necesitas el permiso de Administrador.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        const commandName = interaction.options.getString('comando').toLowerCase();
        const newState = interaction.options.getBoolean('estado'); // true para on, false para off

        await interaction.deferReply({ ephemeral: true });

        // **IMPORTANTE: Aquí iría la lógica para guardar esto en tu base de datos.**
        // Tu manejador de comandos principal (en index.js) necesitaría consultar esta DB
        // ANTES de ejecutar cualquier comando para verificar si está habilitado para el servidor.

        // Simulación:
        // try {
        //    const guildId = interaction.guild.id;
        //    await database.setCommandStatus(guildId, commandName, newState); // Guarda en la DB
        //    // Tu manejador de comandos también necesitaría ser notificado o recargar la configuración.
        // } catch (error) {
        //    console.error(`Error al cambiar el estado del comando ${commandName}:`, error);
        //    return interaction.editReply({ content: '❌ Ocurrió un error al cambiar el estado del comando.', flags: [MessageFlags.Ephemeral] });
        // }

        // Mensaje de confirmación
        const statusText = newState ? 'habilitado' : 'deshabilitado';
        await interaction.editReply({
            content: `✅ El comando \`${commandName}\` ha sido marcado como **${statusText}** para este servidor. (Comando Deshabilitado).`,
            flags: [MessageFlags.Ephemeral]
        });

        // Advertencia si el comando intentado deshabilitar no existe
        if (!interaction.client.commands.has(commandName)) {
            await interaction.followUp({
                content: `⚠️ El comando \`${commandName}\` no fue encontrado en la lista de comandos del bot. Asegúrate de escribirlo correctamente.`,
                flags: [MessageFlags.Ephemeral]
            });
        }
    },
};