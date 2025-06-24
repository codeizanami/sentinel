const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Muestra el avatar de un usuario o el tuyo propio.')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario del que quieres ver el avatar.')
                .setRequired(false)), // No es requerido, si no se especifica, mostrará el del autor

    async execute(interaction) {
        // Obtiene el usuario de la opción. Si no se especifica, usa el autor de la interacción.
        const user = interaction.options.getUser('usuario') || interaction.user;

        // Deferir la respuesta para que el bot tenga tiempo de procesar
        await interaction.deferReply(); // No es efímero para que todos puedan ver el avatar

        // Obtener la URL del avatar. dynamic: true asegura que obtenga GIF animados si los hay.
        const avatarURL = user.displayAvatarURL({ dynamic: true, size: 1024 }); // Tamaño 1024 para mejor calidad

        const avatarEmbed = new EmbedBuilder()
            .setColor(0x00FFFF) // Color cian
            .setTitle(`🖼️ Avatar de ${user.username}`)
            .setImage(avatarURL) // Establece la imagen del avatar
            .setURL(avatarURL) // Hace que el título del embed sea un enlace directo al avatar
            .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
            .setTimestamp();

        try {
            await interaction.editReply({ embeds: [avatarEmbed] });
        } catch (error) {
            console.error('Error al ejecutar el comando /avatar:', error);
            await interaction.editReply({ content: '❌ Hubo un error al intentar mostrar el avatar.' });
        }
    },
};