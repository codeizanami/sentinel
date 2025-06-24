const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { MessageFlags } = require('discord.js'); // ¡CAMBIO AQUÍ! Importamos MessageFlags

module.exports = {
    data: new SlashCommandBuilder()
        .setName('snipe')
        .setDescription('Muestra el último mensaje borrado o editado en este canal.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            // Usamos MessageFlags.Ephemeral en lugar de Flags.Ephemeral
            return interaction.reply({ content: '❌ No tienes permiso para usar este comando.', flags: [MessageFlags.Ephemeral] });
        }

        const snipedMessage = interaction.client.snipedMessages.get(interaction.channel.id);

        if (!snipedMessage) {
            return interaction.reply({ content: '❌ No hay ningún mensaje borrado o editado recientemente en este canal.', flags: [MessageFlags.Ephemeral] });
        }

        const embed = new EmbedBuilder()
            .setAuthor({
                name: snipedMessage.author.tag,
                iconURL: snipedMessage.author.avatarURL
            })
            .setTimestamp(snipedMessage.timestamp);

        if (snipedMessage.type === 'deleted') {
            embed.setColor(0xFF0000)
                .setDescription(`**Mensaje Borrado en** ${interaction.channel}:\n\n\`\`\`\n${snipedMessage.content || '[Sin contenido de texto]'}\n\`\`\``)
                .setFooter({ text: 'Mensaje borrado' });
            if (snipedMessage.imageUrl) {
                embed.setImage(snipedMessage.imageUrl);
            }
        } else if (snipedMessage.type === 'edited') {
            embed.setColor(0xFFA500)
                .setDescription(`**Mensaje Editado en** ${interaction.channel}:\n\n**Antiguo:**\n\`\`\`\n${snipedMessage.oldContent || '[Sin contenido de texto]'}\n\`\`\`\n\n**Nuevo:**\n\`\`\`\n${snipedMessage.newContent || '[Sin contenido de texto]'}\n\`\`\``)
                .setFooter({ text: 'Mensaje editado' });
            if (snipedMessage.imageUrl) {
                embed.setImage(snipedMessage.imageUrl);
            }
        }

        await interaction.reply({ embeds: [embed] });
    },
};