const { SlashCommandBuilder, PermissionsBitField, ChannelType, MessageFlags } = require('discord.js'); // ¡CAMBIO AQUÍ! Importamos MessageFlags

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setrole')
        .setDescription('Configura IDs de roles o canales importantes para el bot en este servidor.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator) // Solo administradores pueden usarlo
        .addSubcommand(subcommand =>
            subcommand
                .setName('verificacion')
                .setDescription('Configura los roles de verificación.')
                .addRoleOption(option =>
                    option.setName('no_verificado_rol')
                        .setDescription('El rol que los usuarios tienen antes de verificarse.')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('verificado_rol')
                        .setDescription('El rol que los usuarios obtienen al verificarse.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('log_canal')
                .setDescription('Configura el canal donde el bot enviará los logs de moderación.')
                .addChannelOption(option =>
                    option.setName('canal')
                        .setDescription('El canal de texto para los logs de moderación.')
                        .addChannelTypes(ChannelType.GuildText) // Asegura que sea un canal de texto
                        .setRequired(true))),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            // Usamos MessageFlags.Ephemeral
            return interaction.reply({ content: '❌ Solo los administradores pueden usar este comando.', flags: [MessageFlags.Ephemeral] });
        }

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        // Usamos MessageFlags.Ephemeral
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            if (subcommand === 'verificacion') {
                const unverifiedRole = interaction.options.getRole('no_verificado_rol');
                const verifiedRole = interaction.options.getRole('verificado_rol');

                // Guardar los IDs de los roles en la configuración del gremio
                interaction.client.setGuildConfig(guildId, {
                    unverifiedRoleId: unverifiedRole.id,
                    verifiedRoleId: verifiedRole.id
                });

                await interaction.editReply({ content: `✅ Roles de verificación actualizados:\n- Rol "No Verificado": **${unverifiedRole.name}** (\`${unverifiedRole.id}\`)\n- Rol "Verificado": **${verifiedRole.name}** (\`${verifiedRole.id}\`)` });

            } else if (subcommand === 'log_canal') {
                const logChannel = interaction.options.getChannel('canal');

                // Guardar el ID del canal de logs en la configuración del gremio
                interaction.client.setGuildConfig(guildId, {
                    logChannelId: logChannel.id
                });

                await interaction.editReply({ content: `✅ Canal de logs de moderación actualizado a **#${logChannel.name}** (\`${logChannel.id}\`).` });
            }
        } catch (error) {
            console.error(`Error al configurar roles/canal para el gremio ${guildId}:`, error);
            // Usamos MessageFlags.Ephemeral
            await interaction.editReply({ content: '❌ Hubo un error al guardar la configuración. Por favor, inténtalo de nuevo.', flags: [MessageFlags.Ephemeral] });
        }
    },
};