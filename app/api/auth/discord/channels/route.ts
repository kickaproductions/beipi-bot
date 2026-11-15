import {NextRequest,NextResponse} from 'next/server';
import {DISCORD_SESSION_COOKIE} from '../session';
import {fetchDiscordGuildsWithRefresh,hasDiscordGuildPermissions,selectDiscordSession,setDiscordSessionCookie,type DiscordGuild} from '@/lib/discord-guilds';

export const runtime='nodejs';
type DiscordChannel={id:string;name:string;type:number;position:number;parent_id:string|null};

export async function GET(request:NextRequest){
  const guildId=request.nextUrl.searchParams.get('guildId');
  if(!guildId)return NextResponse.json({error:'Choose a Discord server first.'},{status:400});
  const cookieSession=request.cookies.get(DISCORD_SESSION_COOKIE)?.value;
  const selected=await selectDiscordSession(cookieSession);
  if(!selected)return NextResponse.json({error:'Connect Discord before choosing a channel.'},{status:401});
  try{
    const {response:guildResponse,encrypted}=await fetchDiscordGuildsWithRefresh(selected);
    if(guildResponse.status===401)throw new Error('Discord account access expired. Reconnect Discord and try again.');
    if(guildResponse.status===429)throw new Error('Discord is temporarily limiting requests. Wait a few seconds, then choose the server again.');
    if(!guildResponse.ok)throw new Error('Discord could not check your server access right now.');
    const guilds=await guildResponse.json() as DiscordGuild[];
    const allowed=guilds.some(g=>g.id===guildId&&hasDiscordGuildPermissions(g));
    if(!allowed)return NextResponse.json({error:'You do not manage that Discord server.'},{status:403});
    const botToken=process.env.DISCORD_BOT_TOKEN;
    if(!botToken)return NextResponse.json({error:'B.E.I.P.I.’s Discord bot token has not been added to Vercel yet.'},{status:503});
    const channelResponse=await fetch(`https://discord.com/api/guilds/${guildId}/channels`,{headers:{Authorization:`Bot ${botToken}`},cache:'no-store'});
    if(channelResponse.status===403||channelResponse.status===404)return NextResponse.json({error:'Add B.E.I.P.I. to this server, then try again.'},{status:403});
    if(!channelResponse.ok)throw new Error('Discord could not load the server channels.');
    const channels=(await channelResponse.json() as DiscordChannel[]).filter(channel=>channel.type===0||channel.type===5).sort((a,b)=>a.position-b.position).map(channel=>({id:channel.id,name:channel.name,type:channel.type,parentId:channel.parent_id}));
    const response=NextResponse.json({channels},{headers:{'Cache-Control':'no-store'}});setDiscordSessionCookie(response,encrypted);return response;
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Discord channels could not be loaded.'},{status:502})}
}
