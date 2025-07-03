// events/interactionCreate.js
const { Events, EmbedBuilder, PermissionsBitField, MessageFlags, ActionRowBuilder, ChannelSelectMenuBuilder, StringSelectMenuBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { logModerationAction } = require('../utils/logger');
// ¡IMPORTANTE! Asegúrate de que estas funciones estén importadas correctamente
const { getActivePolls, addOrUpdateActivePoll, removeActivePoll, getTicketSettings, setTicketSetting, incrementTicketCounter, getGuildConfig } = require('../utils/configManager'); // Asegúrate de importar las funciones de ticket y getGuildConfig

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

            // La verificación de si el comando está deshabilitado para este gremio ha sido eliminada.

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
                // Guardar la configuración final en configManager
                try {
                    await client.setGuildConfig(interaction.guild.id, setupState.data);

                    // Enviar el panel de tickets al canal seleccionado
                    const panelChannel = interaction.guild.channels.cache.get(setupState.data.ticketPanelChannelId);
                    if (panelChannel) {
                        const ticketEmbed = new EmbedBuilder()
                            .setColor('#7289da')
                            .setTitle('Centro de Soporte')
                            .setDescription('Haz clic en el botón de abajo para abrir un nuevo ticket.')
                            .setFooter({ text: 'Sentinel Bot' })
                            .setTimestamp();

                        const ticketButton = new ButtonBuilder()
                            .setCustomId('open_ticket')
                            .setLabel('Abrir Ticket')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🎫');

                        const row = new ActionRowBuilder().addComponents(ticketButton);

                        const message = await panelChannel.send({ embeds: [ticketEmbed], components: [row] });
                        // Guardar el ID del mensaje del panel para futuras actualizaciones
                        await client.setTicketSetting(interaction.guild.id, 'ticketPanelMessageId', message.id);
                    }

                    await interaction.update({
                        content: '✅ ¡Configuración de tickets guardada y panel enviado exitosamente!',
                        components: [], // Eliminar botones después de confirmar
                        ephemeral: true
                    });
                    client.ticketSetupState.delete(userId); // Limpiar el estado del usuario
                } catch (error) {
                    console.error('Error al guardar la configuración de tickets o enviar el panel:', error);
                    await interaction.update({ content: '❌ Hubo un error al guardar la configuración o enviar el panel de tickets.', ephemeral: true });
                }
                return;
            }

            if (interaction.customId === 'ticket_setup_cancel') {
                client.ticketSetupState.delete(interaction.user.id); // Limpiar el estado del usuario
                return interaction.update({ content: '❌ Configuración de tickets cancelada.', components: [], ephemeral: true });
            }

            // Botón para abrir un nuevo ticket
            if (interaction.customId === 'open_ticket') {
                await interaction.deferReply({ ephemeral: true });

                const guildConfig = client.getGuildConfig(interaction.guild.id);
                const ticketCategoryId = guildConfig.ticketCategoryId;
                const supportRoleIds = guildConfig.supportRoleIds;
                const ticketLogChannelId = guildConfig.ticketLogChannelId; // Para logs si es necesario

                if (!ticketCategoryId || supportRoleIds.length === 0) {
                    return interaction.editReply({ content: '❌ El sistema de tickets no está configurado correctamente. Por favor, contacta a un administrador.', ephemeral: true });
                }

                // Generar un número de ticket único
                const ticketNumber = await client.incrementTicketCounter(interaction.guild.id);
                const ticketChannelName = `ticket-${ticketNumber}-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`.slice(0, 100);

                // Permisos para el canal del ticket
                const permissions = [
                    {
                        id: interaction.guild.id, // @everyone
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: interaction.user.id, // Usuario que abre el ticket
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                    },
                    // Permitir a los roles de soporte ver el canal
                    ...supportRoleIds.map(roleId => ({
                        id: roleId,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                    })),
                ];

                try {
                    const ticketChannel = await interaction.guild.channels.create({
                        name: ticketChannelName,
                        type: ChannelType.GuildText,
                        parent: ticketCategoryId,
                        permissionOverwrites: permissions,
                    });

                    const ticketCreatedEmbed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('Ticket Abierto')
                        .setDescription(`Hola ${interaction.user},\n\nTu ticket ha sido creado en ${ticketChannel}.\nUn miembro del equipo de soporte te atenderá en breve.`)
                        .addFields(
                            { name: 'Ticket ID', value: `${ticketNumber}`, inline: true },
                            { name: 'Abierto por', value: `${interaction.user.tag}`, inline: true }
                        )
                        .setFooter({ text: 'Sentinel Bot' })
                        .setTimestamp();

                    // Botón para cerrar el ticket
                    const closeButton = new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Cerrar Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒');

                    const row = new ActionRowBuilder().addComponents(closeButton);

                    await ticketChannel.send({
                        content: `Bienvenido ${interaction.user}, ${supportRoleIds.map(id => `<@&${id}>`).join(', ')}`, // Mencionar roles de soporte
                        embeds: [ticketCreatedEmbed],
                        components: [row]
                    });

                    await interaction.editReply({ content: `✅ Tu ticket ha sido abierto en ${ticketChannel}.`, ephemeral: true });

                } catch (error) {
                    console.error('Error al crear el canal de ticket:', error);
                    await interaction.editReply({ content: '❌ Ocurrió un error al intentar abrir tu ticket. Por favor, inténtalo de nuevo.', ephemeral: true });
                }
                return;
            }

            // Botón para cerrar el ticket
            if (interaction.customId === 'close_ticket') {
                await interaction.deferReply({ ephemeral: true });

                const guildConfig = client.getGuildConfig(interaction.guild.id);
                const ticketLogChannelId = guildConfig.ticketLogChannelId;
                const supportRoleIds = guildConfig.supportRoleIds;

                // Verificar si el usuario tiene permiso para cerrar (creador o rol de soporte/admin)
                const isCreator = interaction.channel.topic && interaction.channel.topic.includes(`Creator ID: ${interaction.user.id}`);
                const hasSupportRole = interaction.member.roles.cache.some(role => supportRoleIds.includes(role.id));
                const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

                if (!isCreator && !hasSupportRole && !isAdmin) {
                    return interaction.editReply({ content: '❌ No tienes permiso para cerrar este ticket.', ephemeral: true });
                }

                try {
                    // Mover el canal a una categoría de "cerrados" o simplemente eliminarlo
                    // Para simplificar, lo eliminaremos y enviaremos un log.
                    const channelName = interaction.channel.name;
                    const ticketIdMatch = channelName.match(/ticket-(\d+)-/);
                    const ticketId = ticketIdMatch ? ticketIdMatch[1] : 'N/A';
                    const ticketCreatorId = interaction.channel.topic ? interaction.channel.topic.split('Creator ID: ')[1] : 'N/A';
                    const ticketCreator = ticketCreatorId !== 'N/A' ? await client.users.fetch(ticketCreatorId).catch(() => null) : null;

                    // Fetch messages for transcription (opcional, avanzado)
                    // const messages = await interaction.channel.messages.fetch({ limit: 100 }); // Ajusta el límite si es necesario
                    // const transcription = messages.reverse().map(m => `${m.author.tag}: ${m.content}`).join('\n');

                    const closeEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('Ticket Cerrado')
                        .setDescription(`El ticket \`${channelName}\` ha sido cerrado.`)
                        .addFields(
                            { name: 'ID del Ticket', value: ticketId, inline: true },
                            { name: 'Cerrado por', value: interaction.user.tag, inline: true }
                        )
                        .setFooter({ text: 'Sentinel Bot' })
                        .setTimestamp();

                    if (ticketCreator) {
                        closeEmbed.addFields({ name: 'Creado por', value: ticketCreator.tag, inline: true });
                    }

                    // Enviar log al canal de logs si está configurado
                    if (ticketLogChannelId) {
                        const logChannel = interaction.guild.channels.cache.get(ticketLogChannelId);
                        if (logChannel) {
                            await logChannel.send({ embeds: [closeEmbed] });
                            // if (transcription) {
                            //     // Puedes guardar la transcripción en un archivo y adjuntarlo
                            //     // O enviarlo como un archivo de texto si es muy largo
                            //     const attachment = new AttachmentBuilder(Buffer.from(transcription), { name: `ticket-${ticketId}-transcript.txt` });
                            //     await logChannel.send({ files: [attachment] });
                            // }
                        }
                    }

                    await interaction.channel.delete(); // Eliminar el canal del ticket
                    await interaction.followUp({ content: `✅ Ticket \`${channelName}\` cerrado con éxito.`, ephemeral: true });

                } catch (error) {
                    console.error('Error al cerrar el ticket:', error);
                    await interaction.editReply({ content: '❌ Ocurrió un error al intentar cerrar el ticket.', ephemeral: true });
                }
                return;
            }

            // Manejo de botones de encuestas (Polls)
            if (interaction.customId.startsWith('poll_vote_')) {
                const parts = interaction.customId.split('_');
                const messageId = parts[2];
                const voteIndex = parseInt(parts[3]);

                const activePolls = client.getActivePolls();
                const pollData = activePolls[messageId];

                if (!pollData) {
                    return interaction.reply({ content: '❌ Esta encuesta ya no está activa o fue eliminada.', flags: [MessageFlags.Ephemeral] });
                }

                // Asegurarse de que el usuario no haya votado ya
                if (pollData.votedUsers[interaction.user.id]) {
                    return interaction.reply({ content: '🗳️ Ya has votado en esta encuesta.', flags: [MessageFlags.Ephemeral] });
                }

                // Registrar el voto
                const selectedOption = pollData.options[voteIndex];
                if (pollData.votes[selectedOption]) {
                    pollData.votes[selectedOption]++;
                } else {
                    pollData.votes[selectedOption] = 1;
                }
                pollData.votedUsers[interaction.user.id] = true; // Marcar usuario como votado

                client.addOrUpdateActivePoll(messageId, pollData); // Guardar el estado actualizado

                // Actualizar el embed de la encuesta con los nuevos resultados
                const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
                let totalVotes = 0;
                for (const option of pollData.options) {
                    totalVotes += pollData.votes[option] || 0;
                }

                let descriptionContent = `\`\`\`\n`;
                for (let i = 0; i < pollData.options.length; i++) {
                    const option = pollData.options[i];
                    const votesCount = pollData.votes[option] || 0;
                    const percentage = totalVotes > 0 ? ((votesCount / totalVotes) * 100).toFixed(0) : 0;
                    const progressBarLength = Math.round(percentage / 10); // Barra de 10 caracteres
                    const progressBar = '█'.repeat(progressBarLength) + ' '.repeat(10 - progressBarLength);
                    descriptionContent += `${String.fromCharCode(0x2460 + i)} ${option}: [${progressBar}] ${percentage}%\n`;
                }
                descriptionContent += `\`\`\`\nTotal de Votos: ${totalVotes}`;

                updatedEmbed.setDescription(descriptionContent);

                await interaction.update({ embeds: [updatedEmbed] });
            }

            // Botón para finalizar encuesta
            if (interaction.customId === 'poll_end') {
                const messageId = interaction.message.id;
                const activePolls = client.getActivePolls();
                const pollData = activePolls[messageId];

                if (!pollData) {
                    return interaction.reply({ content: '❌ Esta encuesta ya no está activa o fue eliminada.', flags: [MessageFlags.Ephemeral] });
                }

                // Verificar si el usuario que intenta finalizar es el creador de la encuesta o un administrador
                if (interaction.user.id !== pollData.creatorId && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    return interaction.reply({ content: '❌ Solo el creador de la encuesta o un administrador puede finalizarla.', flags: [MessageFlags.Ephemeral] });
                }

                await interaction.deferReply({ ephemeral: true });

                client.removeActivePoll(messageId); // Eliminar la encuesta de las activas

                const resultsEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`📊 Resultados de la Encuesta: "${pollData.question}"`)
                    .setDescription('La encuesta ha finalizado.')
                    .setTimestamp();

                let totalVotes = 0;
                for (const option of pollData.options) {
                    totalVotes += pollData.votes[option] || 0;
                }

                let resultsContent = '';
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
    },
};