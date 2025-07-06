// commands/utility/ticket.js
const { SlashCommandBuilder, ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getTicketSettings, setTicketSetting } = require('../../utils/configManager'); // setTicketSetting se importa, pero se usa incrementTicketCounter del cliente
const { logModerationAction } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Comandos para gestionar tickets de soporte.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('crear_comando') // CAMBIO: Nombre para diferenciar de la GUI
                .setDescription('Abre un nuevo ticket de soporte (solo si el panel no está configurado).')
                .addStringOption(option =>
                    option.setName('razon')
                        .setDescription('La razón para abrir el ticket.')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cerrar')
                .setDescription('Cierra el ticket actual.')
                .addStringOption(option =>
                    option.setName('razon')
                        .setDescription('La razón para cerrar el ticket.')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Añade un usuario a un ticket existente.')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('El usuario a añadir al ticket.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Elimina un usuario de un ticket existente.')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('El usuario a eliminar del ticket.')
                        .setRequired(true))),
    async execute(interaction, client) { // Asegúrate de pasar 'client' aquí
        const { guild, member, channel } = interaction;
        const subcommand = interaction.options.getSubcommand();
        const guildId = guild.id;

        const ticketSettings = client.getTicketSettings(guildId); // Usa client.getTicketSettings
        const { ticketCategoryId, supportRoleIds, ticketLogChannelId } = ticketSettings;

        if (!ticketCategoryId || supportRoleIds.length === 0 || !ticketLogChannelId) {
            return interaction.reply({ content: '❌ El sistema de tickets no está configurado correctamente en este servidor. Un administrador debe usar `/ticketsetup` primero.', ephemeral: true });
        }

        if (subcommand === 'crear_comando') {
            const reason = interaction.options.getString('razon') || 'No se proporcionó una razón.';

            // Verificar si el usuario ya tiene un ticket abierto
            const activeTickets = client.getActiveTicket(guildId);
            const userActiveTicket = Object.values(activeTickets).find(
                (ticket) => ticket.creatorId === interaction.user.id
            );

            if (userActiveTicket) {
                return interaction.reply({
                    content: `❌ Ya tienes un ticket abierto: <#${userActiveTicket.channelId}>`,
                    ephemeral: true,
                });
            }


            await interaction.deferReply({ ephemeral: true }); // Deferir la respuesta para dar tiempo a la creación

            try {
                const ticketNumber = client.incrementTicketCounter(guildId); // Usar client.incrementTicketCounter
                const newChannelName = `ticket-${ticketNumber}-${interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '')}`;

                // Permisos para el canal de ticket
                const permissions = [
                    {
                        id: guild.roles.everyone,
                        deny: [PermissionsBitField.Flags.ViewChannel], // Denegar a @everyone
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory,
                        ],
                    },
                    // Añadir permisos para cada rol de soporte
                    ...supportRoleIds.map(roleId => ({
                        id: roleId,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory,
                        ],
                    })),
                ];

                const ticketChannel = await guild.channels.create({
                    name: newChannelName,
                    type: ChannelType.GuildText,
                    parent: ticketCategoryId,
                    permissionOverwrites: permissions,
                    reason: `Nuevo ticket creado por ${interaction.user.tag}`
                });

                // Añadir el ticket a la persistencia
                client.addActiveTicket(guildId, ticketChannel.id, {
                    channelId: ticketChannel.id,
                    creatorId: interaction.user.id,
                    createdAt: Date.now(),
                    reason: reason,
                });


                const ticketEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`Ticket #${ticketNumber} - ${interaction.user.username}`)
                    .setDescription(`**Razón:** ${reason}\n\nUn miembro del equipo de soporte se pondrá en contacto contigo pronto.`)
                    .addFields(
                        { name: 'Usuario', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Fecha de Creación', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
                    )
                    .setFooter({ text: 'Sistema de Tickets' })
                    .setTimestamp();

                const closeButton = new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Cerrar Ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒');

                const row = new ActionRowBuilder().addComponents(closeButton);

                await ticketChannel.send({
                    content: `<@${interaction.user.id}> ${supportRoleIds.map(id => `<@&${id}>`).join(', ')}`, // Menciona al usuario y roles de soporte
                    embeds: [ticketEmbed],
                    components: [row]
                });

                await interaction.editReply({ content: `✅ ¡Tu ticket ha sido creado! Dirígete a ${ticketChannel}.`, ephemeral: true });

                logModerationAction(
                    guild,
                    'TICKET_OPEN',
                    interaction.user,
                    client.user, // El bot es el "moderador" que abre el ticket
                    reason,
                    `Ticket: #${ticketChannel.name} (${ticketChannel.id})`
                );

            } catch (error) {
                console.error('Error al crear el ticket:', error);
                await interaction.editReply({ content: '❌ Hubo un error al crear tu ticket. Por favor, asegúrate de que el bot tenga los permisos necesarios y que la categoría esté configurada correctamente.', ephemeral: true });
            }
        } else if (subcommand === 'cerrar') {
            const reason = interaction.options.getString('razon') || 'No se proporcionó una razón.';

            await interaction.deferReply({ ephemeral: true });

            const activeTickets = client.getActiveTicket(guildId);
            const ticketData = activeTickets[channel.id];

            // Verificar si el canal actual es un ticket activo
            if (!ticketData) {
                return interaction.editReply({ content: '❌ Este comando solo puede usarse dentro de un canal de ticket válido que esté gestionado por el bot.', ephemeral: true });
            }

            // Verificar si el usuario tiene permiso para cerrar (creador del ticket o rol de soporte)
            const isCreator = ticketData.creatorId === member.id;
            const isSupport = supportRoleIds.some(roleId => member.roles.cache.has(roleId));

            if (!isCreator && !isSupport) {
                return interaction.editReply({ content: '❌ No tienes permiso para cerrar este ticket. Solo el creador del ticket o un miembro del equipo de soporte pueden hacerlo.', ephemeral: true });
            }

            try {
                // Enviar log antes de borrar el canal
                logModerationAction(
                    guild,
                    'TICKET_CLOSE',
                    await client.users.fetch(ticketData.creatorId), // Usuario que creó el ticket
                    member, // Usuario que cierra el ticket
                    reason,
                    `Ticket: #${channel.name} (ID: ${channel.id})`
                );

                await interaction.editReply({ content: '🔒 Cerrando el ticket en 5 segundos...', ephemeral: true });

                // Eliminar el ticket de la persistencia
                client.removeActiveTicket(guildId, channel.id);


                setTimeout(async () => {
                    await channel.delete(`Ticket cerrado por ${member.user.tag}: ${reason}`);
                }, 5000); // 5 segundos de retraso para que el mensaje de log se envíe

            } catch (error) {
                console.error('Error al cerrar el ticket:', error);
                await interaction.editReply({ content: '❌ Hubo un error al cerrar el ticket. Asegúrate de que el bot tenga los permisos necesarios.', ephemeral: true });
            }
        } else if (subcommand === 'add') {
            const userToAdd = interaction.options.getUser('usuario');
            await interaction.deferReply({ ephemeral: true });

            const activeTickets = client.getActiveTicket(guildId);
            const ticketData = activeTickets[channel.id];

            if (!ticketData) {
                return interaction.editReply({ content: '❌ Este comando solo puede usarse dentro de un canal de ticket válido que esté gestionado por el bot.', ephemeral: true });
            }

            const isSupport = supportRoleIds.some(roleId => member.roles.cache.has(roleId));
            if (!isSupport) {
                return interaction.editReply({ content: '❌ Solo un miembro del equipo de soporte puede añadir usuarios a un ticket.', ephemeral: true });
            }
            if (channel.members.has(userToAdd.id)) {
                return interaction.editReply({ content: `❌ ${userToAdd.tag} ya está en este ticket.`, ephemeral: true });
            }
            try {
                await channel.permissionOverwrites.edit(userToAdd.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                });
                await interaction.editReply({ content: `✅ ${userToAdd.tag} ha sido añadido a este ticket.`, ephemeral: false });
            } catch (error) {
                console.error('Error al añadir usuario al ticket:', error);
                await interaction.editReply({ content: '❌ Hubo un error al añadir al usuario. Asegúrate de que el bot tenga los permisos necesarios.', ephemeral: true });
            }
        } else if (subcommand === 'remove') {
            const userToRemove = interaction.options.getUser('usuario');
            await interaction.deferReply({ ephemeral: true });

            const activeTickets = client.getActiveTicket(guildId);
            const ticketData = activeTickets[channel.id];

            if (!ticketData) {
                return interaction.editReply({ content: '❌ Este comando solo puede usarse dentro de un canal de ticket válido que esté gestionado por el bot.', ephemeral: true });
            }

            const isSupport = supportRoleIds.some(roleId => member.roles.cache.has(roleId)); // CAMBIO: Comprueba si tiene ALGUNO de los roles
            if (!isSupport) {
                return interaction.editReply({ content: '❌ Solo un miembro del equipo de soporte puede eliminar usuarios de un ticket.', ephemeral: true });
            }
            if (userToRemove.id === member.id) {
                return interaction.editReply({ content: '❌ No puedes eliminarte a ti mismo del ticket con este comando.', ephemeral: true });
            }
            try {
                await channel.permissionOverwrites.delete(userToRemove.id);
                await interaction.editReply({ content: `✅ ${userToRemove.tag} ha sido eliminado de este ticket.`, ephemeral: false });
            } catch (error) {
                console.error('Error al eliminar usuario del ticket:', error);
                await interaction.editReply({ content: '❌ Hubo un error al eliminar al usuario. Asegúrate de que el bot tenga los permisos necesarios.', ephemeral: true });
            }
        }
    },
};