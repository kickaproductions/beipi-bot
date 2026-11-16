import {NextRequest, NextResponse} from 'next/server';
import {
  fetchDiscordGuildsWithRefresh, hasDiscordGuildPermissions, ManageRoles, ManageServer,
  selectDiscordSession, setDiscordSessionCookie, type DiscordGuild,
} from '@/lib/discord-guilds';

type DiscordEmoji = {id: string | null; name: string | null; animated?: boolean; available?: boolean};

export async function GET(request: NextRequest) {
  const guildId = request.nextUrl.searchParams.get('guildId');
  if (!guildId || !/^\d{17,20}$/.test(guildId)) {
    return NextResponse.json({error: 'Choose a Discord server first.'}, {status: 400});
  }
  const selected = await selectDiscordSession();
  if (!selected?.session.user?.username) {
    return NextResponse.json({error: 'Connect Discord to load server emoji.'}, {status: 401});
  }

  try {
    const {response, encrypted} = await fetchDiscordGuildsWithRefresh(selected);
    if (!response.ok) return NextResponse.json({error: 'Reconnect Discord to load server emoji.'}, {status: 401});
    const guilds = await response.json() as DiscordGuild[];
    if (!guilds.some(guild => guild.id === guildId && hasDiscordGuildPermissions(guild, ManageRoles | ManageServer))) {
      return NextResponse.json({error: 'You need Manage Server and Manage Roles to load server emoji.'}, {status: 403});
    }

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return NextResponse.json({error: 'B.E.I.P.I.’s bot token is unavailable.'}, {status: 503});
    const result = await fetch(`https://discord.com/api/v10/guilds/${guildId}/emojis`, {
      headers: {Authorization: `Bot ${token}`},
      cache: 'no-store',
    });
    if (!result.ok) return NextResponse.json({error: 'Discord could not load this server’s emoji.'}, {status: 502});

    const emojis = (await result.json() as DiscordEmoji[]).flatMap(({id, name, animated, available}) => {
      if (!id || !name || available === false) return [];
      return [{
        id: `${name}:${id}`,
        names: [name.replaceAll('_', ' '), name],
        imgUrl: `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=48`,
      }];
    });
    const output = NextResponse.json({emojis}, {headers: {'Cache-Control': 'no-store'}});
    setDiscordSessionCookie(output, encrypted);
    return output;
  } catch {
    return NextResponse.json({error: 'Server emoji could not be loaded.'}, {status: 502});
  }
}
