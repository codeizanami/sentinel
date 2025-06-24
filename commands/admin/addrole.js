const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addrole')
        .setDescription('Asigna un rol a un usuario.')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario al que quieres añadir el rol.')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('rol')
                .setDescription('El rol que quieres añadir.')
                .setRequired(true)),
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

        const targetUser = interaction.options.getUser('usuario');
        const role = interaction.options.getRole('rol');
        const member = interaction.guild.members.cache.get(targetUser.id);

        if (!member) {
            return interaction.reply({
                content: '❌ No pude encontrar a ese usuario en el servidor.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Verificar si el rol es el @everyone o un rol que el bot no puede gestionar
            if (role.managed || role.comparePositionTo(interaction.guild.members.me.roles.highest) >= 0) {
                return interaction.editReply({
                    content: '❌ No puedo añadir ese rol. Podría ser un rol gestionado o tener una posición superior o igual a mi rol más alto.',
                    flags: [MessageFlags.Ephemeral]
                });
            }
            
            // Verificar si el usuario ya tiene el rol
            if (member.roles.cache.has(role.id)) {
                return interaction.editReply({
                    content: `❌ **${targetUser.tag}** ya tiene el rol **${role.name}**.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            await member.roles.add(role);
            await interaction.editReply({
                content: `✅ El rol **${role.name}** ha sido añadido a **${targetUser.tag}**.`,
                flags: [MessageFlags.Ephemeral]
            });

        } catch (error) {
            console.error(`Error al añadir rol a ${targetUser.tag}:`, error);
            await interaction.editReply({
                content: '❌ Ocurrió un error al intentar añadir el rol. Asegúrate de que el rol del bot esté por encima del rol que intentas asignar.',
                flags: [MessageFlags.Ephemeral]
            });
        }
    },
};