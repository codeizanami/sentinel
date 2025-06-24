const { Events, EmbedBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const { logModerationAction } = require('../utils/logger');
// ¡IMPORTANTE! Asegúrate de que estas funciones estén importadas correctamente
const { getActivePolls, addOrUpdateActivePoll, removeActivePoll, getCommandEnabledStatus } = require('../utils/configManager'); // ¡NUEVO: Añadir getCommandEnabledStatus!

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // --- Manejo de comandos de barra (/) ---
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No se encontró ningún comando que coincidiera con ${interaction.commandName}.`);
                return interaction.reply({ content: '❌ Este comando no existe o no está registrado.', flags: [MessageFlags.Ephemeral] });
            }

            // **¡NUEVO! Comprobación para comandos deshabilitados**
            // Usa interaction.client.getCommandEnabledStatus() para verificar el estado
            if (!interaction.client.getCommandEnabledStatus(interaction.guild.id, interaction.commandName)) {
                return interaction.reply({
                    content: `❌ El comando \`/${interaction.commandName}\` está deshabilitado en este servidor por un administrador.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            try {
                // Aquí pasamos el objeto 'client' al comando
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

        // --- Manejo de botones ---
        if (interaction.isButton()) {
            // Manejo del botón de verificación
            if (interaction.customId === 'verify_button') {
                const guildId = interaction.guild.id;
                // Accede a getGuildConfig a través de interaction.client
                const guildConfig = interaction.client.getGuildConfig(guildId);

                const unverifiedRoleId = guildConfig.unverifiedRoleId;
                const verifiedRoleId = guildConfig.verifiedRoleId;

                if (!unverifiedRoleId || !verifiedRoleId) {
                    await interaction.reply({
                        content: '❌ Los roles de verificación no han sido configurados para este servidor. Un administrador debe usar `/setrole verificacion` para establecerlos.',
                        flags: [MessageFlags.Ephemeral]
                    });
                    return;
                }

                let unverifiedRole = interaction.guild.roles.cache.get(unverifiedRoleId);
                let verifiedRole = interaction.guild.roles.cache.get(verifiedRoleId);

                if (!unverifiedRole || !verifiedRole) {
                    await interaction.reply({
                        content: '❌ Los roles configurados para la verificación no se encontraron en este servidor. Asegúrate de que existen o reconfigúralos con `/setrole verificacion`.',
                        flags: [MessageFlags.Ephemeral]
                    });
                    return;
                }

                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

                try {
                    const member = interaction.member;

                    if (member.roles.cache.has(verifiedRole.id)) {
                        return interaction.editReply({ content: '✅ ¡Ya estás verificado!' });
                    }

                    if (unverifiedRole.position >= interaction.guild.members.me.roles.highest.position ||
                        verifiedRole.position >= interaction.guild.members.me.roles.highest.position) {
                        console.warn(`[WARN] Los roles de verificación pueden estar por encima del rol del bot. Revisa la jerarquía de roles.`);
                        return interaction.editReply({ content: '❌ Hubo un error. Asegúrate de que el rol de Sentinel esté por encima de los roles "No Verificado" y "Verificado" en la jerarquía de roles del servidor.', flags: [MessageFlags.Ephemeral] });
                    }

                    if (member.roles.cache.has(unverifiedRole.id)) {
                        await member.roles.remove(unverifiedRole, 'Usuario verificado.');
                    }
                    await member.roles.add(verifiedRole, 'Usuario verificado.');

                    await interaction.editReply({ content: '✅ ¡Gracias por verificarte! Ahora tienes acceso al servidor.' });

                    logModerationAction(
                        interaction.guild,
                        'USER_VERIFIED',
                        member.user,
                        interaction.client.user,
                        'Usuario se ha verificado.',
                        `Roles: Quitado '${unverifiedRole.name}', Añadido '${verifiedRole.name}'`
                    );

                } catch (error) {
                    console.error(`Error al verificar usuario ${member.user.tag}:`, error);
                    await interaction.editReply({ content: '❌ Hubo un error al intentar verificarte. Asegúrate de que el bot tenga los permisos de "Gestionar Roles".', flags: [MessageFlags.Ephemeral] });
                }
                return;
            }

            // --- Manejo de botones de Encuesta ---
            if (interaction.customId.startsWith('poll_')) {
                const parts = interaction.customId.split('_');
                const pollType = parts[1];
                const pollMessageId = parts[2];

                // Usa interaction.client.getActivePolls() para obtener las encuestas
                const activePolls = interaction.client.getActivePolls();
                
                const pollData = activePolls[pollMessageId];
                
                // Si la encuesta no existe (fue eliminada, o no se cargó correctamente al inicio del bot)
                if (!pollData) {
                    console.error(`[POLL ERROR] No se encontró la información para la encuesta con ID: ${pollMessageId}`);
                    return interaction.reply({ content: '❌ Esta encuesta ya no está activa o no se encontró su información.', flags: [MessageFlags.Ephemeral] });
                }

                // Asegurarse de que la interacción es en el mismo gremio y canal que la encuesta original
                if (interaction.guild.id !== pollData.guildId || interaction.channel.id !== pollData.channelId) {
                    console.warn(`[POLL WARN] Interacción de encuesta en canal/gremio incorrecto. Actual: G:${interaction.guild.id}/C:${interaction.channel.id}, Esperado: G:${pollData.guildId}/C:${pollData.channelId}`);
                    return interaction.reply({ content: '❌ Esta encuesta no es válida en este canal o servidor.', flags: [MessageFlags.Ephemeral] });
                }

                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

                if (pollType === 'vote') {
                    const optionIndex = parseInt(parts[3]);
                    const userId = interaction.user.id;
                    const optionName = pollData.options[optionIndex];

                    // Verificar si el usuario ya votó
                    if (pollData.votedUsers[userId]) {
                        return interaction.editReply({ content: `✅ Ya votaste en esta encuesta por: **${pollData.votedUsers[userId]}**. Solo puedes votar una vez.` });
                    }

                    // Registrar el voto
                    pollData.votes[optionName]++;
                    pollData.votedUsers[userId] = optionName; // Registrar el voto del usuario

                    // Actualizar la encuesta en el archivo de configuración
                    // Usa interaction.client.addOrUpdateActivePoll()
                    interaction.client.addOrUpdateActivePoll(pollMessageId, pollData);
                    
                    await interaction.editReply({ content: `✅ ¡Tu voto por **${optionName}** ha sido registrado!` });

                } else if (pollType === 'end') {
                    // Solo el creador de la encuesta o un administrador puede finalizarla
                    if (interaction.user.id !== pollData.creatorId && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                        return interaction.editReply({ content: '❌ Solo el creador de la encuesta o un administrador puede finalizarla.', flags: [MessageFlags.Ephemeral] });
                    }

                    // Eliminar la encuesta de las encuestas activas
                    // Usa interaction.client.removeActivePoll()
                    interaction.client.removeActivePoll(pollMessageId);
                    
                    const resultsEmbed = new EmbedBuilder()
                        .setColor(0x32CD32) // Verde lima para resultados
                        .setTitle('📊 Resultados de la Encuesta')
                        .setDescription(`**Pregunta: ${pollData.question}**\n\n`);

                    let resultsContent = '';
                    let totalVotes = 0;
                    for (const option in pollData.votes) {
                        totalVotes += pollData.votes[option];
                    }

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

                    // Editar el mensaje original para mostrar los resultados y eliminar los botones
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
        }
    },
};