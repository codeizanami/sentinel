const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
// ¡VERIFICA ESTA RUTA DE IMPORTACIÓN con EXTREMA PRECAUCIÓN!
// Debe ser ../../utils/configManager porque estás en commands/utility/
const { addOrUpdateActivePoll, removeActivePoll, getActivePolls } = require('../../utils/configManager'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('encuesta')
        .setDescription('Crea una encuesta con opciones para que los usuarios voten.')
        .addStringOption(option =>
            option.setName('pregunta')
                .setDescription('La pregunta principal de la encuesta.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('opcion1')
                .setDescription('Primera opción de la encuesta.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('opcion2')
                .setDescription('Segunda opción de la encuesta.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('opcion3')
                .setDescription('Tercera opción de la encuesta.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('opcion4')
                .setDescription('Cuarta opción de la encuesta.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('opcion5')
                .setDescription('Quinta opción de la encuesta.')
                .setRequired(false)),
    async execute(interaction) {
        console.log('[ENCUESTA DEBUG] Comando /encuesta ejecutado.');

        const question = interaction.options.getString('pregunta');
        const options = [];
        for (let i = 1; i <= 5; i++) {
            const option = interaction.options.getString(`opcion${i}`);
            if (option) options.push(option);
        }

        if (options.length < 2) {
            console.log('[ENCUESTA DEBUG] Menos de 2 opciones proporcionadas.');
            return interaction.reply({ content: '❌ Debes proporcionar al menos dos opciones para la encuesta.', flags: [MessageFlags.Ephemeral] });
        }

        const votes = {};
        options.forEach(opt => {
            votes[opt] = 0; 
        });

        const votedUsers = {}; 

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📊 Nueva Encuesta')
            .setDescription(`**${question}**\n\n`)
            .setFooter({ text: `Encuesta creada por ${interaction.user.tag}` })
            .setTimestamp();

        let descriptionContent = '';
        for (let i = 0; i < options.length; i++) {
            const optionText = options[i];
            const emoji = String.fromCodePoint(0x1F1E6 + i); // Emoji de letra de teclado (🇦, 🇧, 🇨...)
            descriptionContent += `${emoji} ${optionText}\n`;
        }
        embed.setDescription(`**${question}**\n\n${descriptionContent}\n\n*Vota haciendo clic en el botón de tu opción preferida.*`);

        // Enviamos la encuesta inicialmente *sin* los customIds definitivos en los botones
        // porque aún no tenemos el ID del mensaje.
        console.log('[ENCUESTA DEBUG] Intentando responder a la interacción inicialmente...');
        await interaction.reply({
            embeds: [embed],
            // Los botones aquí son solo placeholders o se pueden dejar vacíos por ahora
            // o usar un ID temporal si es necesario, pero lo editaremos justo después.
            // Para simplicidad, los creamos aquí con el interaction.id y los re-generamos después.
            components: [
                new ActionRowBuilder().addComponents(
                    options.map((opt, i) => new ButtonBuilder()
                        .setCustomId(`temp_poll_vote_${i}`) // ID temporal
                        .setLabel(`${String.fromCodePoint(0x1F1E6 + i)} ${opt}`)
                        .setStyle(ButtonStyle.Primary)
                    )
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('temp_poll_end') // ID temporal
                        .setLabel('Finalizar Encuesta')
                        .setStyle(ButtonStyle.Danger)
                )
            ]
        });
        console.log('[ENCUESTA DEBUG] Interacción respondida. Intentando obtener el mensaje...');

        let pollMessage;
        try {
            // fetchReply obtiene el mensaje de la respuesta inicial que el bot acaba de enviar.
            pollMessage = await interaction.fetchReply(); 
            console.log(`[ENCUESTA DEBUG] Mensaje de la encuesta obtenido. ID: ${pollMessage.id}`);
        } catch (error) {
            console.error('[ENCUESTA ERROR] Error al obtener el mensaje de la encuesta (fetchReply):', error);
            // Si esto falla, la encuesta no se puede guardar correctamente
            return interaction.followUp({ content: '❌ No se pudo crear la encuesta completamente. Inténtalo de nuevo.', flags: [MessageFlags.Ephemeral] });
        }

        // --- ¡AQUÍ ESTÁ EL CAMBIO CRÍTICO! ---
        // Ahora que tenemos pollMessage.id, RECONSTRUIMOS los botones con el ID correcto.
        const finalButtons = [];
        for (let i = 0; i < options.length; i++) {
            const optionText = options[i];
            const emoji = String.fromCodePoint(0x1F1E6 + i); 

            finalButtons.push(
                new ButtonBuilder()
                    .setCustomId(`poll_vote_${pollMessage.id}_${i}`) // ¡USAR pollMessage.id AQUÍ!
                    .setLabel(`${emoji} ${optionText}`)
                    .setStyle(ButtonStyle.Primary)
            );
        }

        const finalEndPollButton = new ButtonBuilder()
            .setCustomId(`poll_end_${pollMessage.id}`) // ¡USAR pollMessage.id AQUÍ!
            .setLabel('Finalizar Encuesta')
            .setStyle(ButtonStyle.Danger);

        const finalActionRowVote = new ActionRowBuilder().addComponents(finalButtons);
        const finalActionRowEnd = new ActionRowBuilder().addComponents(finalEndPollButton);

        // Editamos el mensaje original para que los botones ahora tengan los customIds correctos
        console.log('[ENCUESTA DEBUG] Editando el mensaje de la encuesta con botones corregidos...');
        await pollMessage.edit({
            components: [finalActionRowVote, finalActionRowEnd]
        });
        console.log('[ENCUESTA DEBUG] Botones de la encuesta actualizados con el ID del mensaje correcto.');

        console.log('[ENCUESTA DEBUG] Intentando guardar la encuesta en config.json...');
        try {
            if (typeof addOrUpdateActivePoll === 'function') {
                addOrUpdateActivePoll(pollMessage.id, {
                    question: question,
                    options: options,
                    votes: votes,
                    votedUsers: votedUsers,
                    creatorId: interaction.user.id,
                    channelId: interaction.channel.id,
                    guildId: interaction.guild.id
                });
                console.log(`[ENCUESTA DEBUG] Encuesta guardada en config.json con ID: ${pollMessage.id}`);
            } else {
                console.error('[ENCUESTA ERROR] addOrUpdateActivePoll NO es una función. Esto indica un problema con la importación de configManager.');
                return interaction.followUp({ content: '❌ Error interno del bot al guardar la encuesta. El desarrollador necesita revisar el archivo.', flags: [MessageFlags.Ephemeral] });
            }
        } catch (error) {
            console.error('[ENCUESTA ERROR] Error al llamar a addOrUpdateActivePoll o al guardar la encuesta:', error);
            return interaction.followUp({ content: '❌ Hubo un error al guardar los datos de la encuesta. Inténtalo de nuevo.', flags: [MessageFlags.Ephemeral] });
        }
    },
};