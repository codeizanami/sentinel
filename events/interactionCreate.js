// events/interactionCreate.js
const { Events, EmbedBuilder, PermissionsBitField, MessageFlags, ActionRowBuilder, ChannelSelectMenuBuilder, StringSelectMenuBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { logModerationAction } = require('../utils/logger');
// ¡IMPORTANTE! Asegúrate de que estas funciones estén importadas correctamente
const { getActivePolls, addOrUpdateActivePoll, removeActivePoll, getTicketSettings, setTicketSetting, incrementTicketCounter, setGuildConfig, getOngoingTicketSetup, setOngoingTicketSetup, removeOngoingTicketSetup, getActiveTicket, addActiveTicket, removeActiveTicket: removeActiveTicketFromConfig } = require('../utils/configManager');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) { // Asegúrate de que 'client' se pase aquí
        // --- Manejo de comandos de barra (/) ---
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No se encontró ningún comando que coincidiera con ${interaction.commandName}.`);
                return interaction.reply({ content: '❌ Este comando no existe o no está registrado.', flags: [MessageFlags.Ephemeral] });
            }

            try {
                await command.execute(interaction, interaction.client);
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'Hubo un error al ejecutar este comando!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'Hubo un error al ejecutar este comando!', ephemeral: true });
                }
            }
        }

        // --- Manejo de interacciones de botones y menús de selección ---
        if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
            const { customId, user, guild } = interaction;

            // Manejo del sistema de tickets por select menus (para el setup)
            if (customId.startsWith('ticket_setup_')) {
                const setupStep = customId.split('_')[2]; // 'category', 'supportrole', 'logchannel', 'panelchannel'
                const state = client.getOngoingTicketSetup(user.id);

                if (!state || state.guildId !== guild.id) {
                    return interaction.reply({ content: '❌ No hay una configuración de tickets en curso para ti en este servidor.', ephemeral: true });
                }

                try {
                    await interaction.deferUpdate(); // Deferir la actualización para evitar timeout

                    let data = state.data;
                    let nextStep = state.step + 1;
                    let replyContent = '';
                    let components = [];

                    switch (setupStep) {
                        case 'category':
                            data.ticketCategoryId = interaction.values[0];
                            replyContent = '⚙️ **Paso 2/4:** ¡Categoría seleccionada! Ahora, por favor, selecciona el/los rol(es) de soporte que podrán gestionar los tickets. (Puedes seleccionar varios)';
                            const supportRoleSelect = new RoleSelectMenuBuilder()
                                .setCustomId('ticket_setup_supportrole')
                                .setPlaceholder('Selecciona el rol de soporte')
                                .setMinValues(1)
                                .setMaxValues(10); // Permitir seleccionar múltiples roles
                            components.push(new ActionRowBuilder().addComponents(supportRoleSelect));
                            break;
                        case 'supportrole':
                            data.supportRoleIds = interaction.values;
                            replyContent = '⚙️ **Paso 3/4:** ¡Rol(es) de soporte seleccionados! Ahora, selecciona el canal donde se registrarán las acciones de los tickets (apertura, cierre, etc.).';
                            const logChannelSelect = new ChannelSelectMenuBuilder()
                                .setCustomId('ticket_setup_logchannel')
                                .setPlaceholder('Selecciona el canal de logs de tickets')
                                .addChannelTypes(ChannelType.GuildText); // Solo canales de texto
                            components.push(new ActionRowBuilder().addComponents(logChannelSelect));
                            break;
                        case 'logchannel':
                            data.ticketLogChannelId = interaction.values[0];
                            replyContent = '⚙️ **Paso 4/4:** ¡Canal de logs seleccionado! Finalmente, selecciona el canal donde quieres que aparezca el panel de creación de tickets.';
                            const panelChannelSelect = new ChannelSelectMenuBuilder()
                                .setCustomId('ticket_setup_panelchannel')
                                .setPlaceholder('Selecciona el canal del panel de tickets')
                                .addChannelTypes(ChannelType.GuildText); // Solo canales de texto
                            components.push(new ActionRowBuilder().addComponents(panelChannelSelect));
                            break;
                        case 'panelchannel':
                            data.ticketPanelChannelId = interaction.values[0];
                            // Todas las configuraciones están completas
                            // Crear el embed del panel de tickets
                            const ticketPanelEmbed = new EmbedBuilder()
                                .setColor(0x0099FF)
                                .setTitle('Sistema de Tickets')
                                .setDescription('Haz clic en el botón de abajo para crear un nuevo ticket.')
                                .setFooter({ text: guild.name, iconURL: guild.iconURL() })
                                .setTimestamp();

                            const createTicketButton = new ButtonBuilder()
                                .setCustomId('open_ticket') // Cambiado a 'open_ticket' para usar el manejador existente
                                .setLabel('Crear Ticket')
                                .setStyle(ButtonStyle.Primary)
                                .setEmoji('➕'); // Un emoji visual

                            const panelRow = new ActionRowBuilder().addComponents(createTicketButton);

                            const panelChannel = guild.channels.cache.get(data.ticketPanelChannelId);
                            if (panelChannel) {
                                const sentMessage = await panelChannel.send({ embeds: [ticketPanelEmbed], components: [panelRow] });
                                data.ticketPanelMessageId = sentMessage.id; // Guardar la ID del mensaje del panel
                            } else {
                                throw new Error('El canal del panel de tickets no se encontró.');
                            }

                            // Guardar la configuración final en el configManager
                            client.setGuildConfig(guild.id, {
                                ticketCategoryId: data.ticketCategoryId,
                                supportRoleIds: data.supportRoleIds,
                                ticketLogChannelId: data.ticketLogChannelId,
                                ticketPanelChannelId: data.ticketPanelChannelId,
                                ticketPanelMessageId: data.ticketPanelMessageId,
                                ticketCounter: 0 // Inicializar contador de tickets
                            });

                            client.removeOngoingTicketSetup(user.id); // Limpiar el estado de setup
                            replyContent = '✅ ¡El sistema de tickets ha sido configurado exitosamente!';
                            components = []; // Eliminar componentes
                            nextStep = 5; // Marcar como finalizado
                            break;
                    }

                    // Actualizar el estado para el siguiente paso o finalizar
                    if (nextStep <= 4) {
                        client.setOngoingTicketSetup(user.id, { guildId: guild.id, step: nextStep, data: data });
                    }

                    await interaction.editReply({ content: replyContent, components: components, ephemeral: true });

                } catch (error) {
                    console.error('Error durante la configuración del ticket:', error);
                    client.removeOngoingTicketSetup(user.id); // Limpiar el estado en caso de error
                    await interaction.editReply({ content: '❌ Hubo un error al configurar el sistema de tickets. Por favor, inténtalo de nuevo. Asegúrate de que tengo los permisos adecuados para gestionar canales y roles.', components: [], ephemeral: true });
                }
            }
            // Manejo de tickets (tus botones existentes - NO MODIFICADA)
            else if (customId === 'open_ticket') {
                await interaction.deferReply({ ephemeral: true });
                const guildConfig = client.getGuildConfig(guild.id);
                const { ticketCategoryId, supportRoleIds, ticketLogChannelId } = guildConfig;

                if (!ticketCategoryId || !supportRoleIds || supportRoleIds.length === 0 || !ticketLogChannelId) {
                    return interaction.editReply({ content: '❌ El sistema de tickets no está configurado correctamente en este servidor. Contacta a un administrador.', ephemeral: true });
                }

                // Verificar que el usuario no tenga ya un ticket abierto
                // Usamos el ID del usuario como clave para saber si tienen un ticket activo
                const existingTicket = client.getActiveTicket(guild.id, user.id);
                if (existingTicket) {
                    const existingChannel = guild.channels.cache.get(existingTicket.channelId);
                    if (existingChannel) {
                        return interaction.editReply({ content: `❌ Ya tienes un ticket abierto: ${existingChannel}. Por favor, ciérralo antes de abrir uno nuevo.`, ephemeral: true });
                    } else {
                        // Si el canal no existe pero el registro sí, limpiarlo
                        removeActiveTicketFromConfig(guild.id, user.id); // Usar la función de remoción por userId si fue guardado así
                    }
                }
                
                // Generar un nuevo número de ticket
                const ticketNumber = client.incrementTicketCounter(guild.id);
                const channelName = `ticket-${ticketNumber}-${user.username.substring(0, 20).toLowerCase().replace(/[^a-z0-9-]/g, '')}`;

                try {
                    const permissions = [
                        {
                            id: guild.id, // @everyone
                            deny: [PermissionsBitField.Flags.ViewChannel],
                        },
                        {
                            id: user.id, // Creador del ticket
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                        },
                        // Permisos para los roles de soporte
                        ...supportRoleIds.map(roleId => ({
                            id: roleId,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                        })),
                    ];

                    const ticketChannel = await guild.channels.create({
                        name: channelName,
                        type: ChannelType.GuildText,
                        parent: ticketCategoryId,
                        permissionOverwrites: permissions,
                    });

                    const ticketEmbed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle(`Ticket #${ticketNumber} - ${user.tag}`)
                        .setDescription(`Bienvenido al ticket, ${user}. Describe tu problema con el mayor detalle posible.\n\nEl equipo de soporte te atenderá en breve.`)
                        .addFields(
                            { name: 'Usuario', value: `<@${user.id}>`, inline: true },
                            { name: 'ID de Usuario', value: user.id, inline: true }
                        )
                        .setFooter({ text: 'Sistema de Tickets' })
                        .setTimestamp();

                    const closeButton = new ButtonBuilder()
                        .setCustomId(`close_ticket_${ticketChannel.id}`)
                        .setLabel('Cerrar Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒');

                    const transcriptButton = new ButtonBuilder()
                        .setCustomId(`transcript_ticket_${ticketChannel.id}`)
                        .setLabel('Transcipción')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📄');

                    const claimButton = new ButtonBuilder()
                        .setCustomId(`claim_ticket_${ticketChannel.id}`)
                        .setLabel('Reclamar Ticket')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🙋‍♂️');

                    const ticketActionRow = new ActionRowBuilder().addComponents(closeButton, transcriptButton, claimButton);

                    await ticketChannel.send({
                        content: supportRoleIds.map(roleId => `<@&${roleId}>`).join(' ') || 'Equipo de soporte',
                        embeds: [ticketEmbed],
                        components: [ticketActionRow],
                    });

                    await interaction.editReply({ content: `✅ Tu ticket ha sido creado en ${ticketChannel}.`, ephemeral: true });

                    // Registrar ticket activo, usando el channelId como clave para getActiveTicket en otros lugares
                    client.addActiveTicket(guild.id, ticketChannel.id, {
                        userId: user.id, // También guardamos el userId
                        ticketNumber: ticketNumber,
                        openedAt: new Date().toISOString(),
                        claimedBy: null,
                    });

                    // Log en el canal de logs de tickets
                    const logEmbed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('Ticket Abierto')
                        .addFields(
                            { name: 'Usuario', value: `<@${user.id}> (${user.tag})`, inline: true },
                            { name: 'Canal', value: `<#${ticketChannel.id}>`, inline: true },
                            { name: 'Número de Ticket', value: `#${ticketNumber}`, inline: true }
                        )
                        .setTimestamp();

                    const ticketLogChannel = guild.channels.cache.get(ticketLogChannelId);
                    if (ticketLogChannel) {
                        await ticketLogChannel.send({ embeds: [logEmbed] });
                    }
                } catch (error) {
                    console.error('Error al crear el ticket:', error);
                    await interaction.editReply({ content: '❌ Hubo un error al intentar crear tu ticket. Por favor, inténtalo de nuevo más tarde. Asegúrate de que el bot tenga los permisos de "Gestionar Canales" y "Gestionar Roles".', ephemeral: true });
                }
            } else if (customId.startsWith('close_ticket_')) {
                await interaction.deferReply({ ephemeral: true });
                const channelId = customId.split('_')[2];
                const ticketChannel = guild.channels.cache.get(channelId);
                if (!ticketChannel) {
                    return interaction.editReply({ content: '❌ Este canal de ticket ya no existe.', ephemeral: true });
                }

                const guildConfig = client.getGuildConfig(guild.id);
                const { supportRoleIds } = guildConfig;

                const isSupport = interaction.member.roles.cache.some(role => supportRoleIds.includes(role.id));
                const ticketData = client.getActiveTicket(guild.id, channelId); // Obtener datos del ticket
                const isCreator = ticketData && ticketData.userId === user.id;

                if (!isSupport && !isCreator) {
                    return interaction.editReply({ content: '❌ Solo el creador del ticket o un miembro del equipo de soporte puede cerrar este ticket.', ephemeral: true });
                }

                try {
                    await ticketChannel.permissionOverwrites.edit(user.id, { ViewChannel: false });
                    await ticketChannel.setName(`closed-${ticketChannel.name.replace('closed-', '')}`);

                    const reopenButton = new ButtonBuilder()
                        .setCustomId(`reopen_ticket_${ticketChannel.id}`)
                        .setLabel('Reabrir Ticket')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🔓');

                    const deleteButton = new ButtonBuilder()
                        .setCustomId(`delete_ticket_${ticketChannel.id}`)
                        .setLabel('Eliminar Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🗑️');

                    const closedActionsRow = new ActionRowBuilder().addComponents(reopenButton, deleteButton);

                    await interaction.editReply({ content: `✅ El ticket ha sido cerrado. Puedes reabrirlo o eliminarlo.`, components: [closedActionsRow], ephemeral: true });
                    await ticketChannel.send({ content: `🔒 Este ticket ha sido cerrado por ${user}. Utiliza los botones de abajo para reabrirlo o eliminarlo.` });

                    logModerationAction(
                        guild,
                        'TICKET_CLOSE',
                        ticketChannel,
                        user,
                        `Ticket cerrado`,
                        `Canal: #${ticketChannel.name} (${ticketChannel.id})`
                    );
                } catch (error) {
                    console.error('Error al cerrar el ticket:', error);
                    await interaction.editReply({ content: '❌ Hubo un error al cerrar el ticket. Asegúrate de que el bot tenga los permisos necesarios.', ephemeral: true });
                }
            } else if (customId.startsWith('reopen_ticket_')) {
                await interaction.deferReply({ ephemeral: true });
                const channelId = customId.split('_')[2];
                const ticketChannel = guild.channels.cache.get(channelId);
                if (!ticketChannel) {
                    return interaction.editReply({ content: '❌ Este canal de ticket ya no existe.', ephemeral: true });
                }

                const guildConfig = client.getGuildConfig(guild.id);
                const { supportRoleIds } = guildConfig;

                const isSupport = interaction.member.roles.cache.some(role => supportRoleIds.includes(role.id));
                const ticketData = client.getActiveTicket(guild.id, channelId); // Obtener datos del ticket
                const isCreator = ticketData && ticketData.userId === user.id;

                if (!isSupport && !isCreator) {
                    return interaction.editReply({ content: '❌ Solo el creador del ticket o un miembro del equipo de soporte puede reabrir este ticket.', ephemeral: true });
                }

                try {
                    // Restaurar permisos de ver canal al creador (si no los tiene)
                    await ticketChannel.permissionOverwrites.edit(ticketData.userId, { ViewChannel: true });
                    await ticketChannel.setName(ticketChannel.name.replace('closed-', '')); // Eliminar 'closed-' del nombre

                    const closeButton = new ButtonBuilder()
                        .setCustomId(`close_ticket_${ticketChannel.id}`)
                        .setLabel('Cerrar Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒');

                    const transcriptButton = new ButtonBuilder()
                        .setCustomId(`transcript_ticket_${ticketChannel.id}`)
                        .setLabel('Transcipción')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📄');

                    const claimButton = new ButtonBuilder()
                        .setCustomId(`claim_ticket_${ticketChannel.id}`)
                        .setLabel('Reclamar Ticket')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🙋‍♂️');

                    const ticketActionRow = new ActionRowBuilder().addComponents(closeButton, transcriptButton, claimButton);

                    await interaction.editReply({ content: '✅ El ticket ha sido reabierto.', components: [ticketActionRow], ephemeral: true });
                    await ticketChannel.send({ content: `🔓 Este ticket ha sido reabierto por ${user}.` });

                    logModerationAction(
                        guild,
                        'TICKET_REOPEN',
                        ticketChannel,
                        user,
                        `Ticket reabierto`,
                        `Canal: #${ticketChannel.name} (${ticketChannel.id})`
                    );
                } catch (error) {
                    console.error('Error al reabrir el ticket:', error);
                    await interaction.editReply({ content: '❌ Hubo un error al reabrir el ticket. Asegúrate de que el bot tenga los permisos necesarios.', ephemeral: true });
                }
            } else if (customId.startsWith('delete_ticket_')) {
                await interaction.deferReply({ ephemeral: true });
                const channelId = customId.split('_')[2];
                const ticketChannel = guild.channels.cache.get(channelId);
                if (!ticketChannel) {
                    return interaction.editReply({ content: '❌ Este canal de ticket ya no existe.', ephemeral: true });
                }

                const guildConfig = client.getGuildConfig(guild.id);
                const { supportRoleIds } = guildConfig;

                const isSupport = interaction.member.roles.cache.some(role => supportRoleIds.includes(role.id));
                const ticketData = client.getActiveTicket(guild.id, channelId); // Obtener datos del ticket
                const isCreator = ticketData && ticketData.userId === user.id;

                if (!isSupport && !isCreator) {
                    return interaction.editReply({ content: '❌ Solo el creador del ticket o un miembro del equipo de soporte puede eliminar este ticket.', ephemeral: true });
                }

                try {
                    // Eliminar el ticket de la configuración de tickets activos
                    removeActiveTicketFromConfig(guild.id, channelId); // Usamos removeActiveTicketFromConfig ya que el ID de la clave es el channelId

                    await interaction.editReply({ content: '✅ El ticket se eliminará en 5 segundos...', ephemeral: true });

                    logModerationAction(
                        guild,
                        'TICKET_DELETE',
                        null, // El canal será eliminado
                        user,
                        `Ticket eliminado`,
                        `ID Canal: ${ticketChannel.id}, Creador: ${ticketData?.userId || 'Desconocido'}`
                    );

                    setTimeout(async () => {
                        await ticketChannel.delete('Ticket eliminado por el bot.');
                    }, 5000);
                } catch (error) {
                    console.error('Error al eliminar el ticket:', error);
                    await interaction.editReply({ content: '❌ Hubo un error al eliminar el ticket.', ephemeral: true });
                }
            } else if (customId.startsWith('transcript_ticket_')) {
                await interaction.deferReply({ ephemeral: true });
                const channelId = customId.split('_')[2];
                const ticketChannel = guild.channels.cache.get(channelId);
                if (!ticketChannel) {
                    return interaction.editReply({ content: '❌ Este canal de ticket ya no existe.', ephemeral: true });
                }

                const guildConfig = client.getGuildConfig(guild.id);
                const { supportRoleIds, ticketLogChannelId } = guildConfig;

                const isSupport = interaction.member.roles.cache.some(role => supportRoleIds.includes(role.id));
                if (!isSupport) {
                    return interaction.editReply({ content: '❌ Solo los miembros del equipo de soporte pueden generar transcripciones.', ephemeral: true });
                }

                try {
                    const messages = await ticketChannel.messages.fetch({ limit: 100 }); // Obtener los últimos 100 mensajes
                    const transcript = messages.map(msg => `${new Date(msg.createdTimestamp).toLocaleString()}: ${msg.author.tag}: ${msg.content}`).reverse().join('\n');

                    // Enviar la transcripción al canal de logs si está configurado
                    const logChannel = guild.channels.cache.get(ticketLogChannelId);
                    if (logChannel) {
                        const transcriptEmbed = new EmbedBuilder()
                            .setColor(0x0099FF)
                            .setTitle(`Transcripción del Ticket #${ticketChannel.name.replace('ticket-', '').replace('closed-', '')}`)
                            .setDescription(`Transcripción del canal ${ticketChannel.name} generado por ${user.tag}.`)
                            .setTimestamp();
                        
                        await logChannel.send({
                            embeds: [transcriptEmbed],
                            files: [{
                                attachment: Buffer.from(transcript),
                                name: `${ticketChannel.name}_transcript.txt`
                            }]
                        });
                        await interaction.editReply({ content: `✅ Transcripción generada y enviada a ${logChannel}.`, ephemeral: true });
                    } else {
                        await interaction.editReply({ content: '❌ No se encontró un canal de logs de tickets. No se pudo enviar la transcripción.', ephemeral: true });
                    }

                    logModerationAction(
                        guild,
                        'TICKET_TRANSCRIPT',
                        ticketChannel,
                        user,
                        `Transcripción generada`,
                        `Canal: #${ticketChannel.name} (${ticketChannel.id})`
                    );
                } catch (error) {
                    console.error('Error al generar transcripción del ticket:', error);
                    await interaction.editReply({ content: '❌ Hubo un error al generar la transcripción del ticket.', ephemeral: true });
                }
            } else if (customId.startsWith('claim_ticket_')) {
                await interaction.deferReply({ ephemeral: true });
                const channelId = customId.split('_')[2];
                const ticketChannel = guild.channels.cache.get(channelId);
                if (!ticketChannel) {
                    return interaction.editReply({ content: '❌ Este canal de ticket ya no existe.', ephemeral: true });
                }

                const guildConfig = client.getGuildConfig(guild.id);
                const { supportRoleIds } = guildConfig;

                const isSupport = interaction.member.roles.cache.some(role => supportRoleIds.includes(role.id));
                if (!isSupport) {
                    return interaction.editReply({ content: '❌ Solo los miembros del equipo de soporte pueden reclamar tickets.', ephemeral: true });
                }

                try {
                    const ticketData = client.getActiveTicket(guild.id, channelId);
                    if (ticketData && ticketData.claimedBy) {
                        const claimedByUser = await guild.members.fetch(ticketData.claimedBy).catch(() => null);
                        if (claimedByUser) {
                            return interaction.editReply({ content: `❌ Este ticket ya ha sido reclamado por ${claimedByUser.user.tag}.`, ephemeral: true });
                        }
                    }

                    // Actualizar el ticket como reclamado
                    client.addActiveTicket(guild.id, channelId, { ...ticketData, claimedBy: user.id });

                    await interaction.editReply({ content: `✅ Has reclamado este ticket.`, ephemeral: true });
                    await ticketChannel.send({ content: `🙋‍♂️ Este ticket ha sido reclamado por ${user}.` });

                    logModerationAction(
                        guild,
                        'TICKET_CLAIM',
                        ticketChannel,
                        user,
                        `Ticket reclamado`,
                        `Reclamado por: ${user.tag}, Canal: #${ticketChannel.name} (${ticketChannel.id})`
                    );
                } catch (error) {
                    console.error('Error al reclamar el ticket:', error);
                    await interaction.editReply({ content: '❌ Hubo un error al reclamar el ticket.', ephemeral: true });
                }
            }
            // --- Manejo del botón de verificación ---
            else if (customId === 'verify_button') {
                await interaction.deferReply({ ephemeral: true }); // Deferir la respuesta para evitar timeout

                try {
                    const guildConfig = client.getGuildConfig(guild.id);
                    const unverifiedRoleId = guildConfig.unverifiedRoleId;
                    const verifiedRoleId = guildConfig.verifiedRoleId;

                    // Verificar que los roles de verificación estén configurados
                    if (!unverifiedRoleId || !verifiedRoleId) {
                        return interaction.editReply({ content: '❌ Los roles de verificación no están configurados correctamente. Por favor, contacta a un administrador del servidor.', ephemeral: true });
                    }

                    const member = interaction.member;

                    // Verificar si el miembro ya tiene el rol verificado
                    if (member.roles.cache.has(verifiedRoleId)) {
                        return interaction.editReply({ content: '✅ Ya estás verificado en este servidor.', ephemeral: true });
                    }

                    // Remover el rol de no verificado si lo tiene
                    if (member.roles.cache.has(unverifiedRoleId)) {
                        await member.roles.remove(unverifiedRoleId, 'Verificación completada.');
                    }

                    // Asignar el rol de verificado
                    await member.roles.add(verifiedRoleId, 'Verificación completada.');

                    await interaction.editReply({ content: '✅ ¡Verificación completada! Ahora tienes acceso a los canales del servidor.', ephemeral: true });

                    // Log the moderation action
                    logModerationAction(
                        guild,
                        'USER_VERIFIED',
                        null,
                        user,
                        `Usuario verificado`,
                        `Usuario: ${user.tag} (${user.id})`
                    );

                } catch (error) {
                    console.error('Error al manejar el botón de verificación:', error);
                    await interaction.editReply({ content: '❌ Hubo un error al procesar tu verificación. Asegúrate de que el bot tenga los permisos necesarios para "Gestionar Roles".', ephemeral: true });
                }
            }
            // --- Manejo de la lógica de encuestas ---
            else if (customId.startsWith('poll_vote_')) {
                await interaction.deferReply({ ephemeral: true });

                const pollMessageId = interaction.message.id;
                const userId = user.id;
                const optionIndex = parseInt(customId.split('_')[2]);

                const activePolls = client.getActivePolls();
                const pollData = activePolls[pollMessageId];

                if (!pollData || pollData.guildId !== guild.id) {
                    return interaction.editReply({ content: '❌ Esta encuesta no es válida o ya ha terminado.', flags: [MessageFlags.Ephemeral] });
                }

                if (pollData.endTime && new Date() > new Date(pollData.endTime)) {
                    client.removeActivePoll(pollMessageId);
                    return interaction.editReply({ content: '❌ Esta encuesta ya ha terminado.', flags: [MessageFlags.Ephemeral] });
                }

                if (pollData.voters[userId] !== undefined) {
                    return interaction.editReply({ content: '❌ Ya has votado en esta encuesta.', flags: [MessageFlags.Ephemeral] });
                }

                if (optionIndex >= 0 && optionIndex < pollData.options.length) {
                    if (!pollData.votes[pollData.options[optionIndex]]) {
                        pollData.votes[pollData.options[optionIndex]] = 0;
                    }
                    pollData.votes[pollData.options[optionIndex]]++;
                    pollData.voters[userId] = optionIndex; // Registrar que el usuario ya votó

                    client.addOrUpdateActivePoll(pollMessageId, pollData); // Guardar el voto

                    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
                    let newDescription = `**Pregunta:** ${pollData.question}\n\n`;
                    let totalVotes = 0;
                    for (const opt in pollData.votes) {
                        totalVotes += pollData.votes[opt];
                    }

                    for (let i = 0; i < pollData.options.length; i++) {
                        const option = pollData.options[i];
                        const votesCount = pollData.votes[option] || 0;
                        const percentage = totalVotes > 0 ? ((votesCount / totalVotes) * 100).toFixed(2) : 0;
                        newDescription += `**${option}**: ${votesCount} votos (${percentage}%)\n`;
                    }
                    if (pollData.duration) {
                        const remaining = new Date(pollData.endTime).getTime() - new Date().getTime();
                        if (remaining > 0) {
                            const minutes = Math.floor((remaining / (1000 * 60)) % 60);
                            const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
                            newDescription += `\nTermina en: ${hours}h ${minutes}m`;
                        } else {
                            newDescription += `\nLa encuesta ha terminado.`;
                        }
                    }

                    updatedEmbed.setDescription(newDescription);

                    await interaction.message.edit({ embeds: [updatedEmbed] });
                    await interaction.editReply({ content: '✅ ¡Tu voto ha sido registrado!', flags: [MessageFlags.Ephemeral] });
                } else {
                    await interaction.editReply({ content: '❌ Opción de voto inválida.', flags: [MessageFlags.Ephemeral] });
                }
            } else if (customId.startsWith('poll_end_')) {
                await interaction.deferReply({ ephemeral: true });

                const pollMessageId = interaction.message.id;
                
                const activePolls = client.getActivePolls();
                const pollData = activePolls[pollMessageId];

                if (!pollData || pollData.guildId !== guild.id) {
                    return interaction.editReply({ content: '❌ Esta encuesta no es válida o ya ha terminado.', flags: [MessageFlags.Ephemeral] });
                }

                if (pollData.creatorId !== user.id && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    return interaction.editReply({ content: '❌ Solo el creador de la encuesta o un administrador puede finalizarla.', flags: [MessageFlags.Ephemeral] });
                }

                client.removeActivePoll(pollMessageId); // Eliminar la encuesta activa

                const resultsEmbed = new EmbedBuilder()
                    .setColor(0x00FF00) // Verde para resultados finales
                    .setTitle(`Resultados de la Encuesta: "${pollData.question}"`);

                let resultsContent = '';
                let totalVotes = 0;
                for (const opt in pollData.votes) {
                    totalVotes += pollData.votes[opt];
                }

                if (totalVotes === 0) {
                    resultsContent = 'Nadie votó en esta encuesta.';
                } else {
                    for (let i = 0; i < pollData.options.length; i++) {
                        const option = pollData.options[i];
                        const votesCount = pollData.votes[option] || 0; // Asegura que no sea undefined
                        const percentage = totalVotes > 0 ? ((votesCount / totalVotes) * 100).toFixed(2) : 0;
                        resultsContent += `**${option}**: ${votesCount} votos (${percentage}%)\n`;
                    }
                }

                resultsEmbed.addFields({ name: 'Votación Final', value: resultsContent });
                resultsEmbed.setFooter({ text: `Encuesta finalizada por ${user.tag}` });
                resultsEmbed.setTimestamp();

                try {
                    const originalMessage = await interaction.channel.messages.fetch(pollMessageId);
                    await originalMessage.edit({ embeds: [resultsEmbed], components: [] });
                    await interaction.editReply({ content: '✅ La encuesta ha sido finalizada y los resultados publicados.', flags: [MessageFlags.Ephemeral] });
                } catch (error) {
                    console.error(`[POLL ERROR] Error al editar mensaje de encuesta ID ${pollMessageId}:`, error);
                    await interaction.editReply({ content: '❌ Hubo un error al publicar los resultados de la encuesta.', flags: [MessageFlags.Ephemeral] });
                }
            }
        }
    },
};