const reactionPermissions = [
  ['View Channel', BigInt(1_024)],
  ['Read Message History', BigInt(65_536)],
  ['Add Reactions', BigInt(64)],
] as const;

type Overwrite = {id: string; type: number; allow: string; deny: string};

async function missingReactionPermissions(guildId: string, channelId: string, botToken: string) {
  const options = {headers: {Authorization: `Bot ${botToken}`}, cache: 'no-store', signal: AbortSignal.timeout(4_000)} as const;
  const request = (path: string) => fetch('https://discord.com/api/v10' + path, options);
  try {
    const [identity, channel, roles] = await Promise.all([
      request('/users/@me'),
      request(`/channels/${channelId}`),
      request(`/guilds/${guildId}/roles`),
    ]);
    if (!identity.ok || !channel.ok || !roles.ok) return [];
    const {id: botId} = await identity.json() as {id: string};
    const {guild_id, permission_overwrites = []} = await channel.json() as {guild_id: string; permission_overwrites?: Overwrite[]};
    if (guild_id !== guildId) return [];
    const member = await request(`/guilds/${guildId}/members/${botId}`);
    if (!member.ok) return [];
    const {roles: memberRoles} = await member.json() as {roles: string[]};
    const memberRoleIds = new Set(memberRoles);
    let permissions = BigInt(0);
    for (const role of await roles.json() as {id: string; permissions: string}[]) {
      if (role.id === guildId || memberRoleIds.has(role.id)) permissions |= BigInt(role.permissions);
    }
    if (permissions & BigInt(8)) return [];

    const everyone = permission_overwrites.find(overwrite => overwrite.type === 0 && overwrite.id === guildId);
    if (everyone) permissions = (permissions & ~BigInt(everyone.deny)) | BigInt(everyone.allow);
    let roleAllow = BigInt(0), roleDeny = BigInt(0);
    for (const overwrite of permission_overwrites) {
      if (overwrite.type === 0 && memberRoleIds.has(overwrite.id)) {
        roleAllow |= BigInt(overwrite.allow);
        roleDeny |= BigInt(overwrite.deny);
      }
    }
    permissions = (permissions & ~roleDeny) | roleAllow;
    const individual = permission_overwrites.find(overwrite => overwrite.type === 1 && overwrite.id === botId);
    if (individual) permissions = (permissions & ~BigInt(individual.deny)) | BigInt(individual.allow);
    return reactionPermissions.filter(([, bit]) => !(permissions & bit)).map(([name]) => name);
  } catch {
    return [];
  }
}

export async function describeDiscordReactionError(
  response: Response,
  context: {emoji: string; guildId: string; channelId: string; botToken: string},
) {
  const {code, message} = (await response.json().catch(() => null) ?? {}) as {code?: number; message?: string};
  const {emoji, guildId, channelId, botToken} = context;
  const label = /^([a-z0-9_]+):\d+$/i.exec(emoji)?.[1] ?? emoji;
  const prefix = `Discord could not add ${label}.`;
  if (code === 50013 || code === 50001 || response.status === 403) {
    const missing = await missingReactionPermissions(guildId, channelId, botToken);
    const detail = missing.length
      ? `B.E.I.P.I. is missing ${missing.join(', ')} in this channel.`
      : code === 50001
        ? 'Discord denied access to this channel.'
        : 'Discord denied permission to add this reaction. Check Read Message History, Add Reactions, and any restrictions on the emoji.';
    return {error: `${prefix} ${detail}${code ? ` (Discord ${code})` : ''}`, status: 403};
  }
  if (code === 10014) {
    return {error: `${prefix} Discord did not recognise this emoji. Pick it again from the emoji library. (Discord 10014)`, status: 400};
  }
  if (response.status === 429) {
    return {error: `${prefix} Discord is rate limiting reactions. Try again shortly.`, status: 429};
  }
  const reason = typeof message === 'string' && message.trim() ? message.trim().slice(0, 250) : `HTTP ${response.status}`;
  return {error: `${prefix} ${reason}${code ? ` (Discord ${code})` : ''}`, status: 502};
}
