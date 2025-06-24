const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deleterole')
        .setDescription('Elimina un rol del servidor.')
        .addRoleOption(option =>
            option.setName('rol')
                .setDescription('El rol que quieres eliminar.')
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

        const role = interaction.options.getRole('rol');

        await interaction.deferReply({ ephemeral: true });

        try {
            // No permitir eliminar el rol @everyone o roles gestionados por integraciones
            if (role.id === interaction.guild.id || role.managed) {
                return interaction.editReply({
                    content: '❌ No puedo eliminar el rol `@everyone` ni roles gestionados por integraciones.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Verificar si el rol del bot es más bajo que el rol a eliminar
            if (role.comparePositionTo(interaction.guild.members.me.roles.highest) >= 0) {
                return interaction.editReply({
                    content: '❌ No puedo eliminar este rol porque tiene una posición superior o igual a mi rol más alto. Mueve mi rol por encima.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            await role.delete();
            await interaction.editReply({
                content: `✅ El rol **${role.name}** ha sido eliminado.`,
                flags: [MessageFlags.Ephemeral]
            });

        } catch (error) {
            console.error(`Error al eliminar el rol "${role.name}":`, error);
            await interaction.editReply({
                content: '❌ Ocurrió un error al intentar eliminar el rol. Asegúrate de que el rol del bot esté por encima del rol que intentas eliminar.',
                flags: [MessageFlags.Ephemeral]
            });
        }
    },
};