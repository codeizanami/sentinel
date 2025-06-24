const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { MessageFlags } = require('discord.js'); // ¡CAMBIO AQUÍ! Importamos MessageFlags

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Muestra información sobre un usuario.')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario del que quieres ver la información (por defecto, tú mismo).')
                .setRequired(false)),
    async execute(interaction) {
        const user = interaction.options.getUser('usuario') || interaction.user;
        const member = interaction.guild.members.cache.get(user.id);

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Información de ${user.tag}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '👤 ID de Usuario', value: user.id, inline: true },
                { name: '🗓️ Se Unió a Discord', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true },
            );

        if (member) {
            embed.addFields(
                { name: '🤝 Se Unió al Servidor', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>`, inline: true },
                { name: '🌟 Roles', value: member.roles.cache.size > 1 ? member.roles.cache.filter(role => role.id !== interaction.guild.id).map(role => `${role}`).join(', ') : 'Ninguno', inline: false }
            );
        }

        await interaction.reply({ embeds: [embed] });
    },
};