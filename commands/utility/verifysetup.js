const { SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { logModerationAction } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verifysetup')
        .setDescription('Envía el mensaje de configuración de verificación al canal actual.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator), // Solo administradores pueden usarlo
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '❌ No tienes permiso para configurar el sistema de verificación.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        // Nombres de los roles de verificación
        const unverifiedRoleName = 'No Verificado';
        const verifiedRoleName = 'Verificado';

        let unverifiedRole = interaction.guild.roles.cache.find(role => role.name === unverifiedRoleName);
        let verifiedRole = interaction.guild.roles.cache.find(role => role.name === verifiedRoleName);

        try {
            // Crear rol "No Verificado" si no existe
            if (!unverifiedRole) {
                unverifiedRole = await interaction.guild.roles.create({
                    name: unverifiedRoleName,
                    color: '#FF0000', // Rojo para no verificados
                    permissions: [],
                    reason: 'Rol creado automáticamente para miembros no verificados.',
                });
                console.log(`[VERIFY_SETUP] Rol '${unverifiedRoleName}' creado automáticamente: ${unverifiedRole.id}`);
            }

            // Crear rol "Verificado" si no existe
            if (!verifiedRole) {
                verifiedRole = await interaction.guild.roles.create({
                    name: verifiedRoleName,
                    color: '#00FF00', // Verde para verificados
                    permissions: [],
                    reason: 'Rol creado automáticamente para miembros verificados.',
                });
                console.log(`[VERIFY_SETUP] Rol '${verifiedRoleName}' creado automáticamente: ${verifiedRole.id}`);
            }

            // Establecer permisos para el canal actual para que solo los verificados lo vean
            // Y los no verificados NO vean los canales principales
            await interaction.channel.permissionOverwrites.edit(interaction.guild.id, {
                ViewChannel: false // Por defecto, nadie lo ve si no tiene el rol
            });
            if (unverifiedRole) {
                await interaction.channel.permissionOverwrites.edit(unverifiedRole.id, {
                    ViewChannel: true // Solo los no verificados pueden ver este canal
                });
            }
            if (verifiedRole) {
                await interaction.channel.permissionOverwrites.edit(verifiedRole.id, {
                    ViewChannel: false // Los verificados no necesitan ver el canal de verificación.
                });
            }

            const verifyButton = new ButtonBuilder()
                .setCustomId('verify_button')
                .setLabel('Verificarse')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder()
                .addComponents(verifyButton);

            const verificationMessage = await interaction.channel.send({ // Guarda el mensaje enviado
                content: `¡Bienvenido al servidor **${interaction.guild.name}**!\\n\\nPara acceder al resto de los canales y participar, por favor, haz clic en el botón **\"Verificarse\"** a continuación.`,
                components: [row],
            });

            // --- ¡NUEVO! Guardar las IDs en config.json ---
            const guildConfig = interaction.client.getGuildConfig(interaction.guild.id);
            guildConfig.unverifiedRoleId = unverifiedRole.id;
            guildConfig.verifiedRoleId = verifiedRole.id;
            guildConfig.verificationPanelChannelId = interaction.channel.id; // Guarda el canal del panel
            guildConfig.verificationPanelMessageId = verificationMessage.id; // Guarda la ID del mensaje
            interaction.client.setGuildConfig(interaction.guild.id, guildConfig);
            // La función setGuildConfig ya llama a saveConfig internamente.
            console.log(`[VERIFY_SETUP] Configuración de verificación guardada para ${interaction.guild.id}:`, JSON.stringify(guildConfig, null, 2));
            // --- FIN NUEVO ---

            await interaction.editReply({ content: '✅ El mensaje de verificación ha sido enviado a este canal y los roles/permisos básicos han sido verificados/creados.', ephemeral: true });

            logModerationAction(
                interaction.guild,
                'VERIFY_SETUP',
                null,
                interaction.user,
                'Mensaje de verificación enviado y roles/permisos configurados.',
                `Canal: #${interaction.channel.name} (${interaction.channel.id})`
            );

        } catch (error) {
            console.error('Error al configurar la verificación:', error);
            await interaction.editReply({ content: '❌ Hubo un error al configurar el sistema de verificación. Asegúrate de que el bot tenga los permisos de \"Gestionar Roles\" y \"Gestionar Canales\".', ephemeral: true });
        }
    },
};