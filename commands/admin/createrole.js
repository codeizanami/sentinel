const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('createrole')
        .setDescription('Crea un nuevo rol en el servidor.')
        .addStringOption(option =>
            option.setName('nombre')
                .setDescription('El nombre del nuevo rol.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('Color hexadecimal del rol (ej. #FF0000 para rojo).')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('mencionar')
                .setDescription('¿Se puede mencionar este rol (@rol)?')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('separado')
                .setDescription('¿Mostrar este rol por separado en la lista de miembros?')
                .setRequired(false)),
        // Se pueden añadir más opciones para permisos específicos si es necesario
        // .addStringOption(option =>
        //     option.setName('permisos')
        //         .setDescription('Lista de permisos a añadir (ej. KICK_MEMBERS, BAN_MEMBERS).')
        //         .setRequired(false)),
    async execute(interaction) {
        // Verificar si el usuario tiene permisos para gestionar roles
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.reply({
                content: '❌ No tienes permisos para usar este comando. Necesitas el permiso "Gestionar roles".',
                flags: [MessageFlags.Ephemeral]
            });
        }

        // Verificar que el bot tiene permisos para gestionar roles
        if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.reply({
                content: '❌ No tengo los permisos necesarios para gestionar roles. Necesito el permiso "Gestionar roles".',
                flags: [MessageFlags.Ephemeral]
            });
        }

        const roleName = interaction.options.getString('nombre');
        const roleColor = interaction.options.getString('color');
        const roleMentionable = interaction.options.getBoolean('mencionar') || false;
        const roleHoist = interaction.options.getBoolean('separado') || false;
        // const permissionsInput = interaction.options.getString('permisos'); // Para permisos avanzados

        await interaction.deferReply({ ephemeral: true });

        try {
            // Opciones para la creación del rol
            const roleOptions = {
                name: roleName,
                color: roleColor || 'Default', // Si no se proporciona color, usa el predeterminado
                mentionable: roleMentionable,
                hoist: roleHoist,
                // permissions: permissionsInput ? new PermissionsBitField(permissionsInput.split(',').map(p => PermissionsBitField.Flags[p.trim().toUpperCase()])) : [],
                // Si quieres añadir permisos, deberás validar que sean nombres de Flags válidos
            };

            const newRole = await interaction.guild.roles.create(roleOptions);

            await interaction.editReply({
                content: `✅ Rol **${newRole.name}** creado con éxito.`,
                flags: [MessageFlags.Ephemeral]
            });

        } catch (error) {
            console.error(`Error al crear el rol "${roleName}":`, error);
            await interaction.editReply({
                content: '❌ Ocurrió un error al intentar crear el rol. Asegúrate de que el nombre no esté ya en uso y el color sea válido (ej. #RRGGBB).',
                flags: [MessageFlags.Ephemeral]
            });
        }
    },
};