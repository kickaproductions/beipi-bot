export type DiscordRole = {
    id: string;
    name: string;
    position: number;
    permissions: string;
    managed: boolean;
};

export function compareDiscordRoles(left: DiscordRole, right: DiscordRole) {
    if (left.position !== right.position) return left.position - right.position;
    if (left.id === right.id) return 0;
    return BigInt(left.id) < BigInt(right.id) ? 1 : -1;
}

export function highestDiscordRole(roles: DiscordRole[], memberRoleIds: string[]) {
    return roles.filter(role => memberRoleIds.includes(role.id))
        .sort((left, right) => compareDiscordRoles(right, left))[0];
}

const sensitivePermissions = [8, 2, 4, 32, 268435456, 1099511627776]
    .reduce((combined, permission) => combined | BigInt(permission), BigInt(0));

export function roleAssignmentRestriction(role: DiscordRole, guildId: string, botRole?: DiscordRole) {
    if (role.id === guildId) return 'Default server role';
    if (role.managed) return 'Managed by Discord or an integration';
    if (!botRole || compareDiscordRoles(role, botRole) >= 0) return 'At or above B.E.I.P.I.’s highest role';
    if ((BigInt(role.permissions) & sensitivePermissions) !== BigInt(0)) return 'Has sensitive server permissions';
    return null;
}
