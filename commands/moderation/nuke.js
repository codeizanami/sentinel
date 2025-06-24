const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const { logModerationAction } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nuke')
        .setDescription('¡Elimina todo el historial de mensajes de un canal (clonándolo y recreándolo)!')
        .addBooleanOption(option => // <-- OPCIÓN OBLIGATORIA PRIMERO (CORREGIDO)
            option.setName('confirmar')
                .setDescription('Confirma que quieres limpiar el canal (requerido).')
                .setRequired(true))
        .addChannelOption(option => // <-- OPCIONAL DESPUÉS DE OBLIGATORIAS
            option.setName('canal')
                .setDescription('El canal a limpiar (por defecto el actual).')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false))
        .addStringOption(option => // <-- OPCIONAL DESPUÉS
            option.setName('razon')
                .setDescription('La razón para limpiar el canal.')
                .setRequired(false)),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.reply({ content: '❌ No tienes permiso para limpiar canales (nuke).', ephemeral: true });
        }

        const confirm = interaction.options.getBoolean('confirmar'); // Obtener 'confirmar' primero
        const channelToNuke = interaction.options.getChannel('canal') || interaction.channel;
        const reason = interaction.options.getString('razon') || 'No se especificó una razón.';

        if (channelToNuke.type !== ChannelType.GuildText) {
            return interaction.reply({ content: '❌ Solo puedes limpiar canales de texto.', ephemeral: true });
        }

        if (!confirm) { // Aunque es requerido, siempre es buena práctica verificar
            return interaction.reply({ content: '❌ Debes confirmar la acción estableciendo la opción `confirmar` a `True`.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const position = channelToNuke.position;
            const parent = channelToNuke.parent;
            const name = channelToNuke.name;
            const topic = channelToNuke.topic;
            const nsfw = channelToNuke.nsfw;
            const rateLimitPerUser = channelToNuke.rateLimitPerUser;
            const permissionOverwrites = channelToNuke.permissionOverwrites.cache;

            const newChannel = await channelToNuke.clone({
                name: name,
                topic: topic,
                nsfw: nsfw,
                rateLimitPerUser: rateLimitPerUser,
                parent: parent,
                position: position,
                permissionOverwrites: permissionOverwrites
            });

            await channelToNuke.delete();

            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('💣 ¡Canal Nukeado! 💣')
                .setDescription(`Este canal ha sido completamente limpiado. Razón: \`${reason}\``)
                .setImage('https://media.giphy.com/media/oe3pQ1P6sYgqY/giphy.gif')
                .setTimestamp()
                .setFooter({ text: `Acción realizada por ${interaction.user.tag}` });

            await newChannel.send({ embeds: [embed] });

            await interaction.editReply({ content: `✅ El canal ${channelToNuke.name} ha sido limpiado y recreado como ${newChannel}.`, ephemeral: true });

            logModerationAction(
                interaction.guild,
                'NUKE_CHANNEL',
                null,
                interaction.user,
                reason,
                `Canal original: #${channelToNuke.name} (${channelToNuke.id})`
            );

        } catch (error) {
            console.error(`Error al limpiar el canal (nuke) ${channelToNuke.name}:`, error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '❌ Hubo un error al intentar limpiar este canal. Asegúrate de que el bot tenga el permiso "Gestionar Canales".', ephemeral: true });
            } else {
                await interaction.reply({ content: '❌ Hubo un error al intentar limpiar este canal. Asegúrate de que el bot tenga el permiso "Gestionar Canales".', ephemeral: true, });
            }
        }
    },
};