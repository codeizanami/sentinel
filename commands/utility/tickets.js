// commands/utility/ticket.js
const { SlashCommandBuilder, ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getTicketSettings, incrementTicketCounter, setTicketSetting } = require('../../utils/configManager');
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
                .setDescription('Añade un usuario al ticket actual.')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('El usuario a añadir al ticket.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Elimina un usuario del ticket actual.')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('El usuario a eliminar del ticket.')
                        .setRequired(true))),
    async execute(interaction, client) {
        const { guild, member, channel } = interaction;

        const ticketCategoryId = getTicketSettings(guild.id, 'ticketCategoryId');
        const supportRoleIds = getTicketSettings(guild.id, 'supportRoleIds'); // CAMBIO: Obtener array
        const ticketLogChannelId = getTicketSettings(guild.id, 'ticketLogChannelId');
        const ticketPanelChannelId = getTicketSettings(guild.id, 'ticketPanelChannelId'); // NUEVO
        const ticketPanelMessageId = getTicketSettings(guild.id, 'ticketPanelMessageId'); // NUEVO


        if (!ticketCategoryId || !supportRoleIds || supportRoleIds.length === 0 || !ticketLogChannelId) {
            return interaction.reply({
                content: '❌ El sistema de tickets no está configurado. Por favor, pide a un administrador que use `/ticketsetup`.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'crear_comando') {
            // Este comando de 'crear' es un respaldo o para usar si no se usa el panel GUI.
            // Si el panel de tickets ya está configurado, es mejor que los usuarios usen el panel.
            if (ticketPanelChannelId && ticketPanelMessageId) {
                return interaction.reply({
                    content: `❌ El sistema de tickets de este servidor usa un panel para abrir tickets. Por favor, dirígete a <#${ticketPanelChannelId}> y usa el botón.`,
                    ephemeral: true
                });
            }

            const reason = interaction.options.getString('razon') || 'Sin razón especificada.';

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
                    .setDescription(`**Razón:** ${reason}\n\nUn miembro del equipo de soporte te atenderá pronto.`)
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
                await interaction.reply({ content: `✅ Tu ticket ha sido creado: ${ticketChannel}`, ephemeral: true });

                logModerationAction(
                    guild,
                    'TICKET_OPEN',
                    member.user,
                    client.user, // Bot como el que 'inició' la acción
                    `Ticket #${ticketNumber} abierto`,
                    `Canal: ${ticketChannel.name}\nRazón: ${reason} (comando)`
                );

            } catch (error) {
                console.error('Error al crear ticket:', error);
                await interaction.reply({ content: '❌ Hubo un error al crear tu ticket. Asegúrate de que el bot tenga los permisos necesarios.', ephemeral: true });
            }
        } else if (subcommand === 'cerrar') {
            const reason = interaction.options.getString('razon') || 'Sin razón especificada.';

            // Asegurarse de que el comando se usa en un canal de ticket
            if (channel.parentId !== ticketCategoryId) {
                return interaction.reply({ content: '❌ Este comando solo puede usarse dentro de un canal de ticket.', ephemeral: true });
            }

            // Asegurarse de que el usuario tiene permisos para cerrar (soporte o creador del ticket)
            const isSupport = supportRoleIds.some(roleId => member.roles.cache.has(roleId)); // CAMBIO: Comprueba si tiene ALGUNO de los roles
            const isTicketCreator = channel.topic === `Ticket de ${member.id}`;

            if (!isSupport && !isTicketCreator) {
                return interaction.reply({ content: '❌ Solo el creador del ticket o un miembro del equipo de soporte puede cerrar este ticket.', ephemeral: true });
            }

            await interaction.deferReply();

            try {
                const logChannel = guild.channels.cache.get(ticketLogChannelId);
                const ticketNumberMatch = channel.name.match(/ticket-(\d+)-/);
                const ticketNumber = ticketNumberMatch ? ticketNumberMatch[1] : 'N/A';

                const closeEmbed = new EmbedBuilder()
                    .setColor('Red')
                    .setTitle(`Ticket #${ticketNumber} Cerrado`)
                    .setDescription(`**Cerrado por:** ${member.user.tag}\n**Razón:** ${reason}`)
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
                    `Canal: ${channel.name}\nRazón: ${reason} (comando)`
                );

                await channel.delete('Ticket cerrado.');
                await interaction.followUp({ content: `✅ Ticket #${ticketNumber} cerrado con éxito.`, ephemeral: true });

            } catch (error) {
                console.error('Error al cerrar ticket:', error);
                await interaction.followUp({ content: '❌ Hubo un error al cerrar el ticket. Asegúrate de que el bot tenga los permisos para gestionar canales.', ephemeral: true });
            }
        } else if (subcommand === 'add') {
            const userToAdd = interaction.options.getUser('usuario');
            if (channel.parentId !== ticketCategoryId) {
                return interaction.reply({ content: '❌ Este comando solo puede usarse dentro de un canal de ticket.', ephemeral: true });
            }
            const isSupport = supportRoleIds.some(roleId => member.roles.cache.has(roleId)); // CAMBIO: Comprueba si tiene ALGUNO de los roles
            if (!isSupport) {
                return interaction.reply({ content: '❌ Solo un miembro del equipo de soporte puede añadir usuarios a un ticket.', ephemeral: true });
            }
            try {
                await channel.permissionOverwrites.edit(userToAdd.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });
                await interaction.reply({ content: `✅ ${userToAdd.tag} ha sido añadido a este ticket.`, ephemeral: false });
            } catch (error) {
                console.error('Error al añadir usuario al ticket:', error);
                await interaction.reply({ content: '❌ Hubo un error al añadir al usuario. Asegúrate de que el bot tenga los permisos necesarios.', ephemeral: true });
            }
        } else if (subcommand === 'remove') {
            const userToRemove = interaction.options.getUser('usuario');
            if (channel.parentId !== ticketCategoryId) {
                return interaction.reply({ content: '❌ Este comando solo puede usarse dentro de un canal de ticket.', ephemeral: true });
            }
            const isSupport = supportRoleIds.some(roleId => member.roles.cache.has(roleId)); // CAMBIO: Comprueba si tiene ALGUNO de los roles
            if (!isSupport) {
                return interaction.reply({ content: '❌ Solo un miembro del equipo de soporte puede eliminar usuarios de un ticket.', ephemeral: true });
            }
            if (userToRemove.id === member.id) {
                return interaction.reply({ content: '❌ No puedes eliminarte a ti mismo del ticket con este comando.', ephemeral: true });
            }
            try {
                await channel.permissionOverwrites.delete(userToRemove.id);
                await interaction.reply({ content: `✅ ${userToRemove.tag} ha sido eliminado de este ticket.`, ephemeral: false });
            } catch (error) {
                console.error('Error al eliminar usuario del ticket:', error);
                await interaction.reply({ content: '❌ Hubo un error al eliminar al usuario. Asegúrate de que el bot tenga los permisos necesarios.', ephemeral: true });
            }
        }
    },
};