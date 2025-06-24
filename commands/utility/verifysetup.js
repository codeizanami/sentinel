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
                    permissions: [], // Sin permisos por defecto
                    reason: 'Rol creado para miembros no verificados.',
                });
                await interaction.followUp({ content: `✅ Rol **${unverifiedRoleName}** creado.`, ephemeral: true });
            }

            // Crear rol "Verificado" si no existe
            if (!verifiedRole) {
                verifiedRole = await interaction.guild.roles.create({
                    name: verifiedRoleName,
                    color: '#00FF00', // Verde para verificados
                    permissions: [PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel], // Permisos básicos
                    reason: 'Rol creado para miembros verificados.',
                });
                await interaction.followUp({ content: `✅ Rol **${verifiedRoleName}** creado.`, ephemeral: true });
            }

            // Mover el rol "No Verificado" por debajo del "Verificado" y del bot para asegurar permisos
            if (unverifiedRole.position >= verifiedRole.position) {
                 await unverifiedRole.setPosition(verifiedRole.position - 1, { reason: 'Ajustando jerarquía de roles para verificación.' });
                 await interaction.followUp({ content: `✅ Jerarquía de roles ajustada: **${unverifiedRoleName}** ahora está debajo de **${verifiedRoleName}**.`, ephemeral: true });
            }
            if (unverifiedRole.position >= interaction.guild.members.me.roles.highest.position) {
                await unverifiedRole.setPosition(interaction.guild.members.me.roles.highest.position - 1, { reason: 'Ajustando jerarquía del rol no verificado para que el bot pueda gestionarlo.' });
                await interaction.followUp({ content: `✅ Jerarquía de roles ajustada: **${unverifiedRoleName}** ahora está debajo del rol del bot.`, ephemeral: true });
            }


            // Configurar permisos del canal de verificación para @everyone y el rol "No Verificado"
            const everyoneRole = interaction.guild.roles.everyone;
            await interaction.channel.permissionOverwrites.edit(everyoneRole, {
                ViewChannel: true,
                ReadMessageHistory: true,
                SendMessages: false, // NO pueden enviar mensajes
            }, { reason: 'Ajustando permisos del canal para verificación.' });
            await interaction.channel.permissionOverwrites.edit(unverifiedRole, {
                ViewChannel: true,
                ReadMessageHistory: true,
                SendMessages: false, // NO pueden enviar mensajes
            }, { reason: 'Ajustando permisos del canal para el rol No Verificado.' });
             await interaction.channel.permissionOverwrites.edit(verifiedRole, {
                ViewChannel: false, // Los verificados no necesitan ver este canal
            }, { reason: 'Los miembros verificados no necesitan ver el canal de verificación.' });


            const verifyButton = new ButtonBuilder()
                .setCustomId('verify_button')
                .setLabel('Verificarse')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder()
                .addComponents(verifyButton);

            await interaction.channel.send({
                content: `¡Bienvenido al servidor **${interaction.guild.name}**!\n\nPara acceder al resto de los canales y participar, por favor, haz clic en el botón **"Verificarse"** a continuación.`,
                components: [row],
            });

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
            await interaction.editReply({ content: '❌ Hubo un error al configurar el sistema de verificación. Asegúrate de que el bot tenga los permisos de "Gestionar Roles" y "Gestionar Canales".', ephemeral: true });
        }
    },
};