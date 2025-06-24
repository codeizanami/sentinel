const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { MessageFlags } = require('discord.js'); // ¡CAMBIO AQUÍ! Importamos MessageFlags

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Muestra información sobre el servidor.'),
    async execute(interaction) {
        const guild = interaction.guild;
        await guild.members.fetch();
        await guild.channels.fetch();

        const owner = await guild.fetchOwner();

        const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
        const categoryChannels = guild.channels.cache.filter(c => c.type === 4).size;
        const totalChannels = textChannels + voiceChannels + categoryChannels;

        const members = guild.members.cache.filter(member => !member.user.bot).size;
        const bots = guild.members.cache.filter(member => member.user.bot).size;
        const totalMembers = guild.memberCount;

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Información del Servidor: ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '📝 Nombre del Servidor', value: guild.name, inline: true },
                { name: '👑 Propietario', value: `${owner.user.tag} (ID: ${owner.id})`, inline: true },
                { name: '🆔 ID del Servidor', value: guild.id, inline: true },
                { name: '🗓️ Creado el', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
                { name: '🧑‍🤝‍🧑 Miembros', value: `${members} usuarios | ${bots} bots | ${totalMembers} total`, inline: true },
                { name: '✨ Nivel de Boost', value: `${guild.premiumTier} (Boosts: ${guild.premiumSubscriptionCount || 0})`, inline: true },
                { name: '💬 Canales', value: `${textChannels} texto | ${voiceChannels} voz | ${categoryChannels} categorías | ${totalChannels} total`, inline: true },
                { name: '📜 Roles', value: `${guild.roles.cache.size} roles`, inline: true },
                { name: '🌍 Región', value: guild.preferredLocale || 'No especificada', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Solicitado por ${interaction.user.tag}` });

        await interaction.reply({ embeds: [embed] });
    },
};