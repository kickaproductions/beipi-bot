import type {NextResponse} from 'next/server';
import {
  DISCORD_SESSION_COOKIE,
  encryptDiscordSession,
  newestDiscordSession,
  refreshDiscordSession,
  type DiscordSession,
} from '@/app/api/auth/discord/session';
import {getPlatformConnection, savePlatformConnection} from '@/lib/platform-connections';

export type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
};

export const ManageChannels = BigInt(16);
export const ManageServer = BigInt(32);
export const ManageRoles = BigInt(268435456);
const Administrator = BigInt(8);

export function hasDiscordGuildPermissions(guild: DiscordGuild, required = ManageServer) {
  if (guild.owner) return true;
  const permissions = BigInt(guild.permissions);
  return (permissions & Administrator) === Administrator || (permissions & required) === required;
}

export async function selectDiscordSession(cookieSession?: string) {
  let storedSession: string | undefined;
  try {
    storedSession = (await getPlatformConnection('discord'))?.encrypted_session;
  } catch {
    // The lookup routes can also use the encrypted session cookie.
  }
  return newestDiscordSession(cookieSession, storedSession);
}

export function fetchDiscordGuilds(session: DiscordSession) {
  return fetch('https://discord.com/api/users/@me/guilds', {
    headers: {Authorization: `Bearer ${session.accessToken}`},
    cache: 'no-store',
  });
}

export async function fetchDiscordGuildsWithRefresh(
  selected: {encrypted: string; session: DiscordSession},
  refreshNearExpiry = false,
) {
  let {session, encrypted} = selected;
  let response = refreshNearExpiry && session.expiresAt <= Date.now() + 60_000
    ? new Response(null, {status: 401})
    : await fetchDiscordGuilds(session);
  if (response.status !== 401) return {response, session, encrypted};

  const refreshed = await refreshDiscordSession(session);
  if (!refreshed) return {response, session, encrypted};

  session = refreshed;
  encrypted = encryptDiscordSession(session);
  await savePlatformConnection({
    platform: 'discord',
    externalUserId: session.user.id,
    displayName: session.user.displayName,
    username: session.user.username,
    avatarUrl: session.user.avatarUrl,
    encryptedSession: encrypted,
  });
  response = await fetchDiscordGuilds(session);
  return {response, session, encrypted};
}

export function setDiscordSessionCookie(response: NextResponse, encrypted: string) {
  response.cookies.set(DISCORD_SESSION_COOKIE, encrypted, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}
