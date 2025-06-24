const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dado')
        .setDescription('Lanza uno o varios dados.')
        .addIntegerOption(option =>
            option.setName('cantidad')
                .setDescription('Número de dados a lanzar (1-100).')
                .setRequired(false) // No es obligatorio, por defecto será 1
                .setMinValue(1)
                .setMaxValue(100))
        .addIntegerOption(option =>
            option.setName('caras')
                .setDescription('Número de caras del dado (4-1000).')
                .setRequired(false) // No es obligatorio, por defecto será 6
                .setMinValue(4)
                .setMaxValue(1000)),
    async execute(interaction) {
        const cantidad = interaction.options.getInteger('cantidad') || 1; // Por defecto 1 dado
        const caras = interaction.options.getInteger('caras') || 6;       // Por defecto 6 caras

        // Validaciones adicionales para asegurar que los números sean razonables
        if (cantidad < 1 || cantidad > 100) {
            return interaction.reply({
                content: '❌ La cantidad de dados debe estar entre 1 y 100.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        if (caras < 4 || caras > 1000) {
            return interaction.reply({
                content: '❌ El número de caras del dado debe estar entre 4 y 1000.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        const resultados = [];
        let sumaTotal = 0;

        for (let i = 0; i < cantidad; i++) {
            const resultado = Math.floor(Math.random() * caras) + 1;
            resultados.push(resultado);
            sumaTotal += resultado;
        }

        const embed = new EmbedBuilder()
            .setColor(0x7289DA) // Un bonito color azul de Discord
            .setTitle(`🎲 Lanzamiento de ${cantidad}d${caras}`)
            .addFields(
                { name: 'Resultados Individuales', value: resultados.join(', ') || 'N/A' },
                { name: 'Suma Total', value: String(sumaTotal), inline: true }
            )
            .setFooter({ text: `Lanzado por ${interaction.user.tag}` })
            .setTimestamp();

        // Si hay muchos dados, acortar la lista de resultados individuales para que el embed no sea demasiado grande
        if (resultados.length > 10) {
            embed.spliceFields(0, 1, { name: 'Resultados Individuales', value: resultados.slice(0, 10).join(', ') + '... (y más)', inline: false });
        }

        await interaction.reply({ embeds: [embed] });
    },
};