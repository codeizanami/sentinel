// events/interactionCreate.js
const { Events, EmbedBuilder, PermissionsBitField, MessageFlags, ActionRowBuilder, ChannelSelectMenuBuilder, StringSelectMenuBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { logModerationAction } = require('../utils/logger');
// ¡IMPORTANTE! Asegúrate de que estas funciones estén importadas correctamente
const { getActivePolls, addOrUpdateActivePoll, removeActivePoll, getCommandEnabledStatus, getTicketSettings, setTicketSetting, incrementTicketCounter, getGuildConfig } = require('../utils/configManager'); // Asegúrate de importar las funciones de ticket y getGuildConfig

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        // --- Manejo de comandos de barra (/) ---
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No se encontró ningún comando que coincidiera con ${interaction.commandName}.`);
                return interaction.reply({ content: '❌ Este comando no existe o no está registrado.', flags: [MessageFlags.Ephemeral] });
            }

            // Verificar si el comando está deshabilitado para este gremio
            if (interaction.guildId) {
                const isCommandEnabled = interaction.client.getCommandEnabledStatus(interaction.guild.id, interaction.commandName);
                if (!isCommandEnabled) {
                    return interaction.reply({
                        content: `❌ El comando \`${interaction.commandName}\` está actualmente deshabilitado en este servidor.`,
                        flags: [MessageFlags.Ephemeral]
                    });
                }
            }

            try {
                await command.execute(interaction, interaction.client);
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: '❌ Hubo un error al ejecutar este comando.', flags: [MessageFlags.Ephemeral] });
                } else {
                    await interaction.reply({ content: '❌ Hubo un error al ejecutar este comando.', flags: [MessageFlags.Ephemeral] });
                }
            }
        }

        // --- Manejo de Menús Desplegables (Select Menus) ---
        if (interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu() || interaction.isStringSelectMenu()) {
            const userId = interaction.user.id;
            const setupState = client.ticketSetupState.get(userId);

            // Asegurarse de que hay un proceso de setup activo para este usuario
            if (!setupState || setupState.guildId !== interaction.guild.id) {
                return interaction.reply({ content: '❌ No hay una configuración de tickets activa para ti en este servidor. Por favor, inicia `/ticketsetup` de nuevo.', ephemeral: true });
            }

            // Manejo de la selección de categoría
            if (interaction.customId === 'ticket_setup_category' && setupState.step === 1) {
                const categoryId = interaction.values[0];
                setupState.data.ticketCategoryId = categoryId;
                setupState.step = 2; // Avanzar al siguiente paso

                // Paso 2: Seleccionar Roles de Soporte (AHORA MÚLTIPLES)
                const roleSelect = new RoleSelectMenuBuilder()
                    .setCustomId('ticket_setup_roles') // CAMBIO: Custom ID
                    .setPlaceholder('Selecciona los roles de soporte (puedes elegir varios)')
                    .setMinValues(1) // Requiere al menos un rol
                    .setMaxValues(25); // Permite múltiples roles (Discord tiene un límite)

                const row = new ActionRowBuilder().addComponents(roleSelect);

                await interaction.update({
                    content: '⚙️ **Configuración del Sistema de Tickets:**\n\n**Paso 2/4:** Ahora, selecciona los roles que tendrán acceso a los tickets (ej. Moderadores, Soporte). Puedes seleccionar varios.',
                    components: [row],
                    ephemeral: true
                });
                client.ticketSetupState.set(userId, setupState); // Actualizar el estado
                return;
            }

            // Manejo de la selección de roles de soporte
            if (interaction.customId === 'ticket_setup_roles' && setupState.step === 2) {
                setupState.data.supportRoleIds = interaction.values; // CAMBIO: Guarda un array de IDs
                setupState.step = 3; // Avanzar al siguiente paso

                // Paso 3: Seleccionar Canal de Logs
                const logChannelSelect = new ChannelSelectMenuBuilder()
                    .setCustomId('ticket_setup_log_channel')
                    .setPlaceholder('Selecciona el canal para los logs de tickets')
                    .addChannelTypes(ChannelType.GuildText); // Solo mostrar canales de texto

                const row = new ActionRowBuilder().addComponents(logChannelSelect);

                await interaction.update({
                    content: '⚙️ **Configuración del Sistema de Tickets:**\n\n**Paso 3/4:** Luego, selecciona el canal donde se enviarán los logs de los tickets (ej. transcripciones, cierres).',
                    components: [row],
                    ephemeral: true
                });
                client.ticketSetupState.set(userId, setupState); // Actualizar el estado
                return;
            }

            // Manejo de la selección de canal de logs
            if (interaction.customId === 'ticket_setup_log_channel' && setupState.step === 3) {
                const logChannelId = interaction.values[0];
                setupState.data.ticketLogChannelId = logChannelId;
                setupState.step = 4; // Penúltimo paso: Seleccionar canal para el panel

                const panelChannelSelect = new ChannelSelectMenuBuilder()
                    .setCustomId('ticket_setup_panel_channel')
                    .setPlaceholder('Selecciona el canal donde irá el panel de tickets')
                    .addChannelTypes(ChannelType.GuildText); // Solo mostrar canales de texto

                const row = new ActionRowBuilder().addComponents(panelChannelSelect);

                await interaction.update({
                    content: '⚙️ **Configuración del Sistema de Tickets:**\n\n**Paso 4/4:** Finalmente, selecciona el canal donde quieres que aparezca el panel para que los usuarios puedan abrir tickets (un mensaje con un botón).',
                    components: [row],
                    ephemeral: true
                });
                client.ticketSetupState.set(userId, setupState); // Actualizar el estado
                return;
            }

            // Manejo de la selección del canal del panel de tickets y confirmación final
            if (interaction.customId === 'ticket_setup_panel_channel' && setupState.step === 4) {
                const panelChannelId = interaction.values[0];
                setupState.data.ticketPanelChannelId = panelChannelId;
                setupState.step = 5; // Último paso: Confirmación

                const confirmButton = new ButtonBuilder()
                    .setCustomId('ticket_setup_confirm')
                    .setLabel('Confirmar y Guardar')
                    .setStyle(ButtonStyle.Success);

                const cancelButton = new ButtonBuilder()
                    .setCustomId('ticket_setup_cancel')
                    .setLabel('Cancelar')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

                const category = interaction.guild.channels.cache.get(setupState.data.ticketCategoryId);
                const supportRoles = setupState.data.supportRoleIds.map(id => interaction.guild.roles.cache.get(id)?.name || 'No encontrado').join(', ');
                const logChannel = interaction.guild.channels.cache.get(setupState.data.ticketLogChannelId);
                const panelChannel = interaction.guild.channels.cache.get(setupState.data.ticketPanelChannelId);

                await interaction.update({
                    content: `⚙️ **Configuración del Sistema de Tickets - Resumen:**\n\n` +
                             `**Categoría de Tickets:** ${category ? category.name : 'No encontrada'}\n` +
                             `**Roles de Soporte:** ${supportRoles || 'Ninguno seleccionado'}\n` + // Muestra múltiples roles
                             `**Canal de Logs:** ${logChannel ? logChannel.name : 'No encontrado'}\n` +
                             `**Canal del Panel de Tickets:** ${panelChannel ? panelChannel.name : 'No encontrado'}\n\n` +
                             `¿Es esta configuración correcta?`,
                    components: [row],
                    ephemeral: true
                });
                client.ticketSetupState.set(userId, setupState); // Actualizar el estado
                return;
            }
        }

        // --- Manejo de botones ---
        if (interaction.isButton()) {
            // Manejo de botones de configuración de tickets
            if (interaction.customId === 'ticket_setup_confirm') {
                const userId = interaction.user.id;
                const setupState = client.ticketSetupState.get(userId);

                if (!setupState || setupState.step !== 5) {
                    return interaction.reply({ content: '❌ Error en el proceso de configuración. Por favor, inicia `/ticketsetup` de nuevo.', ephemeral: true });
                }

                const { ticketCategoryId, supportRoleIds, ticketLogChannelId, ticketPanelChannelId } = setupState.data;

                // Guardar la configuración en configManager
                client.setTicketSetting(interaction.guild.id, 'ticketCategoryId', ticketCategoryId);
                client.setTicketSetting(interaction.guild.id, 'supportRoleIds', supportRoleIds); // CAMBIO: Guarda el array
                client.setTicketSetting(interaction.guild.id, 'ticketLogChannelId', ticketLogChannelId);
                client.setTicketSetting(interaction.guild.id, 'ticketCounter', 0); // Inicializar el contador de tickets
                client.setTicketSetting(interaction.guild.id, 'ticketPanelChannelId', ticketPanelChannelId);

                client.ticketSetupState.delete(userId); // Limpiar el estado temporal

                await interaction.update({
                    content: '✅ ¡Sistema de tickets configurado exitosamente! Ahora creando el panel de tickets...',
                    components: [], // Eliminar botones
                    ephemeral: true
                });

                // --- CREAR EL PANEL DE TICKETS ---
                const panelChannel = interaction.guild.channels.cache.get(ticketPanelChannelId);
                if (panelChannel) {
                    const ticketPanelEmbed = new EmbedBuilder()
                        .setColor('Blue')
                        .setTitle('📊 Sistema de Tickets de Soporte')
                        .setDescription('Haz clic en el botón de abajo para abrir un nuevo ticket de soporte. Un miembro del equipo te atenderá pronto.')
                        .setFooter({ text: 'Sentinel - Sistema de Tickets' })
                        .setTimestamp();

                    const openTicketButton = new ButtonBuilder()
                        .setCustomId('open_ticket_button')
                        .setLabel('Abrir Nuevo Ticket')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🎫'); // Emoji de ticket

                    const panelRow = new ActionRowBuilder().addComponents(openTicketButton);

                    try {
                        const panelMessage = await panelChannel.send({
                            embeds: [ticketPanelEmbed],
                            components: [panelRow]
                        });
                        client.setTicketSetting(interaction.guild.id, 'ticketPanelMessageId', panelMessage.id); // Guardar ID del mensaje del panel
                        await interaction.followUp({
                            content: `✅ Panel de tickets enviado con éxito a ${panelChannel}.`,
                            ephemeral: true
                        });
                    } catch (error) {
                        console.error('Error al enviar el panel de tickets:', error);
                        await interaction.followUp({
                            content: `❌ Hubo un error al enviar el panel de tickets a ${panelChannel}. Asegúrate de que el bot tenga permisos de "Enviar Mensajes" e "Insertar Enlaces" en ese canal.`,
                            ephemeral: true
                        });
                    }
                } else {
                    await interaction.followUp({
                        content: '⚠️ El canal del panel de tickets seleccionado no se encontró. No se pudo enviar el panel.',
                        ephemeral: true
                    });
                }
                return;
            }

            if (interaction.customId === 'ticket_setup_cancel') {
                const userId = interaction.user.id;
                client.ticketSetupState.delete(userId); // Limpiar el estado temporal

                await interaction.update({
                    content: '❌ Configuración del sistema de tickets cancelada.',
                    components: [], // Eliminar botones
                    ephemeral: true
                });
                return;
            }

            // --- NUEVO: Manejo del botón para abrir ticket desde el panel ---
            if (interaction.customId === 'open_ticket_button') {
                const guild = interaction.guild;
                const member = interaction.member;

                const ticketCategoryId = getTicketSettings(guild.id, 'ticketCategoryId');
                const supportRoleIds = getTicketSettings(guild.id, 'supportRoleIds'); // CAMBIO: Obtener array
                const ticketLogChannelId = getTicketSettings(guild.id, 'ticketLogChannelId');
                const ticketPanelChannelId = getTicketSettings(guild.id, 'ticketPanelChannelId');
                const ticketPanelMessageId = getTicketSettings(guild.id, 'ticketPanelMessageId');

                // Validar que la configuración exista
                if (!ticketCategoryId || !supportRoleIds || supportRoleIds.length === 0 || !ticketLogChannelId || !ticketPanelChannelId || !ticketPanelMessageId) {
                    return interaction.reply({
                        content: '❌ El sistema de tickets no está configurado correctamente. Por favor, pide a un administrador que lo revise con `/ticketsetup`.',
                        ephemeral: true
                    });
                }

                // Asegurarse de que el botón se presionó en el mensaje del panel correcto
                if (interaction.channel.id !== ticketPanelChannelId || interaction.message.id !== ticketPanelMessageId) {
                    return interaction.reply({ content: '❌ Este botón no es válido aquí. Usa el panel de tickets oficial.', ephemeral: true });
                }

                // Evitar que un usuario cree múltiples tickets
                const existingTicket = guild.channels.cache.find(c =>
                    c.parentId === ticketCategoryId && c.topic === `Ticket de ${member.id}`
                );
                if (existingTicket) {
                    return interaction.reply({
                        content: `❌ Ya tienes un ticket abierto: ${existingTicket}`,
                        ephemeral: true
                    });
                }

                await interaction.deferReply({ ephemeral: true });

                try {
                    const ticketNumber = incrementTicketCounter(guild.id);
                    const channelName = `ticket-${ticketNumber}-${member.user.username.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()}`;

                    const permissionOverwrites = [
                        {
                            id: guild.id,
                            deny: [PermissionsBitField.Flags.ViewChannel], // Nadie puede ver el canal por defecto
                        },
                        {
                            id: member.id,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                        },
                        // Permitir a todos los roles de soporte ver y gestionar el ticket
                        ...supportRoleIds.map(roleId => ({
                            id: roleId,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                        })),
                        // Permitir que el bot vea el canal para gestionar
                        {
                            id: client.user.id,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels],
                        }
                    ];

                    const ticketChannel = await guild.channels.create({
                        name: channelName,
                        type: ChannelType.GuildText,
                        parent: ticketCategoryId,
                        topic: `Ticket de ${member.id}`, // Para identificar el ticket por usuario
                        permissionOverwrites: permissionOverwrites,
                    });

                    const embed = new EmbedBuilder()
                        .setColor('Green')
                        .setTitle(`Ticket #${ticketNumber} - ${member.user.tag}`)
                        .setDescription(`Un miembro del equipo de soporte te atenderá pronto.\n\nPara cerrar este ticket, usa el botón o el comando \`/ticket cerrar\`.`)
                        .setFooter({ text: `Ticket abierto por ${member.user.tag}` })
                        .setTimestamp();

                    const closeButton = new ButtonBuilder()
                        .setCustomId(`ticket_close_${ticketChannel.id}`) // Custom ID para cerrar este ticket específico
                        .setLabel('Cerrar Ticket')
                        .setStyle(ButtonStyle.Danger);

                    const row = new ActionRowBuilder().addComponents(closeButton);

                    // Mencionar a todos los roles de soporte
                    const supportMentions = supportRoleIds.map(id => `<@&${id}>`).join(', ');
                    await ticketChannel.send({ content: `${supportMentions}, <@${member.id}>`, embeds: [embed], components: [row] });
                    await interaction.editReply({ content: `✅ Tu ticket ha sido creado: ${ticketChannel}` });

                    logModerationAction(
                        guild,
                        'TICKET_OPEN',
                        member.user,
                        client.user, // Bot como el que 'inició' la acción
                        `Ticket #${ticketNumber} abierto`,
                        `Canal: ${ticketChannel.name}\nRazón: Apertura desde panel`
                    );

                } catch (error) {
                    console.error('Error al crear ticket desde el panel:', error);
                    await interaction.editReply({ content: '❌ Hubo un error al crear tu ticket. Asegúrate de que el bot tenga los permisos necesarios.' });
                }
                return;
            }

            // --- Manejo del botón de cerrar ticket dentro del canal de ticket ---
            if (interaction.customId.startsWith('ticket_close_')) {
                const channelIdToClose = interaction.customId.split('_')[2];
                const targetChannel = interaction.guild.channels.cache.get(channelIdToClose);

                if (!targetChannel || targetChannel.id !== interaction.channel.id) {
                    return interaction.reply({ content: '❌ No puedes cerrar un ticket que no sea este.', ephemeral: true });
                }

                const guild = interaction.guild;
                const member = interaction.member;

                const ticketCategoryId = getTicketSettings(guild.id, 'ticketCategoryId');
                const supportRoleIds = getTicketSettings(guild.id, 'supportRoleIds'); // Obtener array
                const ticketLogChannelId = getTicketSettings(guild.id, 'ticketLogChannelId');

                // Asegurarse de que el comando se usa en un canal de ticket y que la configuración existe
                if (interaction.channel.parentId !== ticketCategoryId || !ticketCategoryId || !supportRoleIds || supportRoleIds.length === 0 || !ticketLogChannelId) {
                    return interaction.reply({ content: '❌ Este no parece ser un canal de ticket válido o la configuración del ticket es incorrecta.', ephemeral: true });
                }

                // Asegurarse de que el usuario tiene permisos para cerrar (soporte o creador del ticket)
                const isSupport = supportRoleIds.some(roleId => member.roles.cache.has(roleId)); // CAMBIO: Comprueba si tiene ALGUNO de los roles
                const isTicketCreator = targetChannel.topic === `Ticket de ${member.id}`;

                if (!isSupport && !isTicketCreator) {
                    return interaction.reply({ content: '❌ Solo el creador del ticket o un miembro del equipo de soporte puede cerrar este ticket.', ephemeral: true });
                }

                await interaction.deferReply(); // DeferReply para que el bot tenga tiempo de procesar

                try {
                    // Generar transcripción (opcional, requeriría una librería como discord-html-transcripts)
                    // Por ahora, solo se simula un log
                    const logChannel = guild.channels.cache.get(ticketLogChannelId);
                    const ticketNumberMatch = targetChannel.name.match(/ticket-(\d+)-/);
                    const ticketNumber = ticketNumberMatch ? ticketNumberMatch[1] : 'N/A';

                    const closeEmbed = new EmbedBuilder()
                        .setColor('Red')
                        .setTitle(`Ticket #${ticketNumber} Cerrado`)
                        .setDescription(`**Cerrado por:** ${member.user.tag}\n**Razón:** Cerrado desde el panel`)
                        .setTimestamp();

                    if (logChannel) {
                        await logChannel.send({ embeds: [closeEmbed] });
                        // Aquí podrías adjuntar la transcripción si la generas
                    }

                    logModerationAction(
                        guild,
                        'TICKET_CLOSE',
                        member.user, // O el usuario que inició el ticket si quieres que el log sea sobre él
                        member.user, // Moderador que cerró
                        `Ticket #${ticketNumber} cerrado`,
                        `Canal: ${targetChannel.name}\nRazón: Cerrado desde el botón`
                    );

                    await targetChannel.delete('Ticket cerrado desde el botón.');
                    await interaction.followUp({ content: `✅ Ticket #${ticketNumber} cerrado con éxito.`, ephemeral: true });

                } catch (error) {
                    console.error('Error al cerrar ticket desde botón:', error);
                    await interaction.followUp({ content: '❌ Hubo un error al cerrar el ticket. Asegúrate de que el bot tenga los permisos para gestionar canales.', ephemeral: true });
                }
                return;
            }


            // Manejo del botón de verificación (EXISTENTE)
            if (interaction.customId === 'verify_button') {
                const guildId = interaction.guild.id;
                const guildConfig = interaction.client.getGuildConfig(guildId);

                const unverifiedRoleId = guildConfig.unverifiedRoleId;
                const verifiedRoleId = guildConfig.verifiedRoleId;

                if (!unverifiedRoleId || !verifiedRoleId) {
                    await interaction.reply({
                        content: '❌ Los roles de verificación no han sido configurados para este servidor. Un administrador debe usar `/setrole verificacion` para establecerlos.',
                        flags: [MessageFlags.Ephemeral]
                    });
                    return;
                }

                let unverifiedRole = interaction.guild.roles.cache.get(unverifiedRoleId);
                let verifiedRole = interaction.guild.roles.cache.get(verifiedRoleId);

                if (!unverifiedRole || !verifiedRole) {
                    await interaction.reply({
                        content: '❌ Los roles configurados para la verificación no se encontraron en este servidor. Asegúrate de que existen o reconfigúralos con `/setrole verificacion`.',
                        flags: [MessageFlags.Ephemeral]
                    });
                    return;
                }

                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

                try {
                    const member = interaction.member;

                    if (member.roles.cache.has(verifiedRole.id)) {
                        return interaction.editReply({ content: '✅ ¡Ya estás verificado!' });
                    }

                    if (unverifiedRole.position >= interaction.guild.members.me.roles.highest.position ||
                        verifiedRole.position >= interaction.guild.members.me.roles.highest.position) {
                        console.warn(`[WARN] Los roles de verificación pueden estar por encima del rol del bot. Revisa la jerarquía de roles.`);
                        return interaction.editReply({ content: '❌ Hubo un error. Asegúrate de que el rol de Sentinel esté por encima de los roles "No Verificado" y "Verificado" en la jerarquía de roles del servidor.', flags: [MessageFlags.Ephemeral] });
                    }

                    if (member.roles.cache.has(unverifiedRole.id)) {
                        await member.roles.remove(unverifiedRole, 'Usuario verificado.');
                    }
                    await member.roles.add(verifiedRole, 'Usuario verificado.');

                    await interaction.editReply({ content: '✅ ¡Gracias por verificarte! Ahora tienes acceso al servidor.' });

                    logModerationAction(
                        interaction.guild,
                        'USER_VERIFIED',
                        member.user,
                        interaction.client.user,
                        'Usuario se ha verificado.',
                        `Roles: Quitado '${unverifiedRole.name}', Añadido '${verifiedRole.name}'`
                    );

                } catch (error) {
                    console.error(`Error al verificar usuario ${member.user.tag}:`, error);
                    await interaction.editReply({ content: '❌ Hubo un error al intentar verificarte. Asegúrate de que el bot tenga los permisos de "Gestionar Roles".', flags: [MessageFlags.Ephemeral] });
                }
                return;
            }

            // --- Manejo de botones de Encuesta (EXISTENTE) ---
            if (interaction.customId.startsWith('poll_')) {
                const parts = interaction.customId.split('_');
                const pollType = parts[1];
                const pollMessageId = parts[2];

                const activePolls = interaction.client.getActivePolls();

                const pollData = activePolls[pollMessageId];

                if (!pollData) {
                    console.error(`[POLL ERROR] No se encontró la información para la encuesta con ID: ${pollMessageId}`);
                    return interaction.reply({ content: '❌ Esta encuesta ya no está activa o no se encontró su información.', flags: [MessageFlags.Ephemeral] });
                }

                if (interaction.guild.id !== pollData.guildId || interaction.channel.id !== pollData.channelId) {
                    console.warn(`[POLL WARN] Interacción de encuesta en canal/gremio incorrecto. Actual: G:${interaction.guild.id}/C:${interaction.channel.id}, Esperado: G:${pollData.guildId}/C:${pollData.channelId}`);
                    return interaction.reply({ content: '❌ Esta encuesta no es válida en este canal o servidor.', flags: [MessageFlags.Ephemeral] });
                }

                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

                if (pollType === 'vote') {
                    const optionIndex = parseInt(parts[3]);
                    const userId = interaction.user.id;
                    const optionName = pollData.options[optionIndex];

                    if (pollData.votedUsers[userId]) {
                        return interaction.editReply({ content: `✅ Ya votaste en esta encuesta por: **${pollData.votedUsers[userId]}**. Solo puedes votar una vez.` });
                    }

                    pollData.votes[optionName]++;
                    pollData.votedUsers[userId] = optionName;

                    interaction.client.addOrUpdateActivePoll(pollMessageId, pollData);

                    await interaction.editReply({ content: `✅ ¡Tu voto por **${optionName}** ha sido registrado!` });

                } else if (pollType === 'end') {
                    if (interaction.user.id !== pollData.creatorId && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                        return interaction.editReply({ content: '❌ Solo el creador de la encuesta o un administrador puede finalizarla.', flags: [MessageFlags.Ephemeral] });
                    }

                    interaction.client.removeActivePoll(pollMessageId);

                    const resultsEmbed = new EmbedBuilder()
                        .setColor(0x32CD32)
                        .setTitle('📊 Resultados de la Encuesta')
                        .setDescription(`**Pregunta: ${pollData.question}**\n\n`);

                    let resultsContent = '';
                    let totalVotes = 0;
                    for (const option in pollData.votes) {
                        totalVotes += pollData.votes[option];
                    }

                    if (totalVotes === 0) {
                        resultsContent = 'Nadie votó en esta encuesta.';
                    } else {
                        for (let i = 0; i < pollData.options.length; i++) {
                            const option = pollData.options[i];
                            const votesCount = pollData.votes[option];
                            const percentage = totalVotes > 0 ? ((votesCount / totalVotes) * 100).toFixed(2) : 0;
                            resultsContent += `**${option}**: ${votesCount} votos (${percentage}%)\n`;
                        }
                    }

                    resultsEmbed.addFields({ name: 'Votación Final', value: resultsContent });
                    resultsEmbed.setFooter({ text: `Encuesta finalizada por ${interaction.user.tag}` });
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
        }
    },
};