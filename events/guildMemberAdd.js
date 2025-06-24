const { Events, PermissionsBitField } = require('discord.js');
const { logModerationAction } = require('../utils/logger');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const unverifiedRoleName = 'No Verificado';

        try {
            let unverifiedRole = member.guild.roles.cache.find(role => role.name === unverifiedRoleName);

            // Crear el rol "No Verificado" si no existe
            if (!unverifiedRole) {
                unverifiedRole = await member.guild.roles.create({
                    name: unverifiedRoleName,
                    color: '#FF0000',
                    permissions: [],
                    reason: 'Rol creado automáticamente para miembros no verificados.',
                });
                console.log(`[INFO] Rol '${unverifiedRoleName}' creado automáticamente en el servidor '${member.guild.name}'.`);
            }

            // Asignar el rol "No Verificado" al nuevo miembro
            await member.roles.add(unverifiedRole, 'Asignación automática de rol a nuevo miembro para verificación.');

            console.log(`✅ Rol '${unverifiedRoleName}' asignado a ${member.user.tag} en ${member.guild.name}.`);

            // Opcional: Log la acción de añadir rol al logger si lo consideras relevante para auditoría
            // logModerationAction(
            //     member.guild,
            //     'ASSIGN_UNVERIFIED_ROLE',
            //     member.user,
            //     member.guild.members.cache.get(member.client.user.id), // Bot como moderador
            //     `Asignado rol '${unverifiedRoleName}' a nuevo miembro.`,
            //     `Usuario: ${member.user.tag} (${member.user.id})`
            // );

        } catch (error) {
            console.error(`Error al asignar rol '${unverifiedRoleName}' a ${member.user.tag}:`, error);
        }
    },
};