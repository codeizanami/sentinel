const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js'); // Añade ChannelType
const { logModerationAction } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Silencia a un usuario en el servidor.')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario a silenciar.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('tiempo')
                .setDescription('Duración del silencio (ej. 10m, 1h, 1d). Deja vacío para permanente.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('razon')
                .setDescription('La razón del silencio.')
                .setRequired(false)),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.MuteMembers)) {
            return interaction.reply({ content: '❌ No tienes permiso para silenciar miembros.', ephemeral: true });
        }

        const userToMute = interaction.options.getUser('usuario');
        const memberToMute = interaction.guild.members.cache.get(userToMute.id);
        const durationString = interaction.options.getString('tiempo');
        const reason = interaction.options.getString('razon') || 'No se especificó una razón.';

        if (!memberToMute) {
            return interaction.reply({ content: '❌ No se encontró al usuario en este servidor.', ephemeral: true });
        }

        if (memberToMute.id === interaction.client.user.id) {
            return interaction.reply({ content: '❌ No me puedo silenciar a mí mismo.', ephemeral: true });
        }
        if (memberToMute.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '❌ No puedo silenciar a un administrador.', ephemeral: true });
        }
        if (memberToMute.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: '❌ No puedes silenciar a alguien con un rol igual o superior al tuyo.', ephemeral: true });
        }

        let mutedRole = interaction.guild.roles.cache.find(role => role.name === 'Muted' || role.name === 'Silenciado');

        // Si el rol 'Muted' no existe, intentamos crearlo
        if (!mutedRole) {
            try {
                await interaction.deferReply({ ephemeral: true }); // Envía una respuesta diferida para dar tiempo a crear el rol

                mutedRole = await interaction.guild.roles.create({
                    name: 'Muted',
                    color: '#808080', // Color gris, común para roles silenciados
                    permissions: [], // Inicialmente sin permisos
                    reason: 'Rol "Muted" creado por Sentinel para silenciar usuarios.'
                });

                // Configurar permisos en todos los canales existentes
                for (const [channelId, channel] of interaction.guild.channels.cache) {
                    if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildVoice) {
                        try {
                            await channel.permissionOverwrites.edit(mutedRole, {
                                SendMessages: false, // No puede enviar mensajes en canales de texto
                                AddReactions: false, // No puede añadir reacciones
                                Speak: false, // No puede hablar en canales de voz
                                Connect: false // No puede conectarse a canales de voz (opcional)
                            }, { reason: `Configurando permisos para rol Muted en ${channel.name}` });
                        } catch (permError) {
                            console.error(`Error al configurar permisos para Muted en el canal ${channel.name}:`, permError);
                        }
                    }
                }
                await interaction.editReply({ content: '✅ El rol "Muted" fue creado y configurado exitosamente en todos los canales existentes.', ephemeral: true });

            } catch (error) {
                console.error('Error al crear o configurar el rol "Muted":', error);
                return interaction.editReply({ content: '❌ Hubo un error al crear o configurar el rol "Muted". Asegúrate de que el bot tenga el permiso "Gestionar Roles".', ephemeral: true });
            }
        }

        if (memberToMute.roles.cache.has(mutedRole.id)) {
            return interaction.reply({ content: `❌ **${userToMute.tag}** ya está silenciado.`, ephemeral: true });
        }

        let durationMs = 0;
        let durationText = 'permanente';

        if (durationString) {
            const matches = durationString.match(/^(\d+)([smhd])$/);
            if (matches) {
                const value = parseInt(matches[1]);
                const unit = matches[2];

                if (unit === 's') durationMs = value * 1000;
                else if (unit === 'm') durationMs = value * 1000 * 60;
                else if (unit === 'h') durationMs = value * 1000 * 60 * 60;
                else if (unit === 'd') durationMs = value * 1000 * 60 * 60 * 24;

                durationText = `${value}${unit}`;
            } else {
                return interaction.reply({ content: '❌ Formato de tiempo inválido. Usa: 10m, 1h, 1d, etc.', ephemeral: true });
            }
        }

        try {
            await memberToMute.roles.add(mutedRole, reason);

            let dmMessage = `Has sido silenciado en el servidor **${interaction.guild.name}** por: \`${reason}\`.`;
            if (durationMs > 0) {
                dmMessage += ` Duración: \`${durationText}\`.`;
            } else {
                dmMessage += ` El silencio es permanente.`;
            }
            await userToMute.send(dmMessage).catch(() => console.log(`No se pudo enviar DM a ${userToMute.tag}.`));

            // Si la respuesta inicial fue diferida (por la creación del rol), la editamos
            if (interaction.deferred) {
                await interaction.editReply({ content: `✅ **${userToMute.tag}** ha sido silenciado ${durationText !== 'permanente' ? `por ${durationText}` : 'permanentemente'} por: \`${reason}\``, ephemeral: false });
            } else {
                await interaction.reply({ content: `✅ **${userToMute.tag}** ha sido silenciado ${durationText !== 'permanente' ? `por ${durationText}` : 'permanentemente'} por: \`${reason}\`` });
            }


            logModerationAction(
                interaction.guild,
                'MUTE',
                userToMute,
                interaction.user,
                reason,
                `Duración: ${durationText}`
            );

            // Si es un mute temporal, programa el unmute
            if (durationMs > 0) {
                setTimeout(async () => {
                    if (memberToMute.roles.cache.has(mutedRole.id)) {
                        try {
                            await memberToMute.roles.remove(mutedRole, 'Fin de silencio temporal.');
                            const unmutedLogMessage = `✅ **${userToMute.tag}** ha sido desilenciado automáticamente tras un silencio temporal.`;
                            // Asegúrate de que el canal de la interacción aún existe antes de enviar
                            if (interaction.channel) {
                                interaction.channel.send(unmutedLogMessage).catch(console.error);
                            }
                            logModerationAction(
                                interaction.guild,
                                'UNMUTE (Automático)',
                                userToMute,
                                interaction.client.user,
                                'Fin de silencio temporal.'
                            );
                        } catch (unmuteError) {
                            console.error(`Error al desilenciar automáticamente a ${userToMute.tag}:`, unmuteError);
                            logModerationAction(
                                interaction.guild,
                                'ERROR UNMUTE (Automático)',
                                userToMute,
                                interaction.client.user,
                                `Error al desilenciar: ${unmuteError.message}`
                            );
                        }
                    }
                }, durationMs);
            }

        } catch (error) {
            console.error('Error al silenciar:', error);
            // Si la respuesta inicial fue diferida, la editamos para mostrar el error
            if (interaction.deferred) {
                await interaction.editReply({ content: '❌ Hubo un error al intentar silenciar a este usuario.', ephemeral: true });
            } else {
                await interaction.reply({ content: '❌ Hubo un error al intentar silenciar a este usuario.', ephemeral: true });
            }
        }
    },
};