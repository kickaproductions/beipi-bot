import {NextRequest,NextResponse} from 'next/server';
import {decryptDiscordSession,DISCORD_SESSION_COOKIE} from '../session';
import {getPlatformConnection} from '@/lib/platform-connections';

export const runtime='nodejs';
type Guild={id:string;owner:boolean;permissions:string};
type DiscordChannel={id:string;name:string;type:number;position:number;parent_id:string|null};

export async function GET(request:NextRequest){
  const guildId=request.nextUrl.searchParams.get('guildId');
  if(!guildId)return NextResponse.json({error:'Choose a Discord server first.'},{status:400});
  let encrypted=request.cookies.get(DISCORD_SESSION_COOKIE)?.value;
  if(!encrypted){try{encrypted=(await getPlatformConnection('discord'))?.encrypted_session}catch{}}
  const session=encrypted?decryptDiscordSession(encrypted):null;
  if(!session)return NextResponse.json({error:'Connect Discord before choosing a channel.'},{status:401});
  try{
    const guildResponse=await fetch('https://discord.com/api/users/@me/guilds',{headers:{Authorization:`Bearer ${session.accessToken}`},cache:'no-store'});
    if(!guildResponse.ok)throw new Error('Discord account access expired. Reconnect Discord and try again.');
    const guilds=await guildResponse.json() as Guild[];
    const manageGuild=BigInt(32);
    const allowed=guilds.some(g=>g.id===guildId&&(g.owner||(BigInt(g.permissions)&manageGuild)===manageGuild));
    if(!allowed)return NextResponse.json({error:'You do not manage that Discord server.'},{status:403});
    const botToken=process.env.DISCORD_BOT_TOKEN;
    if(!botToken)return NextResponse.json({error:'B.E.I.P.I.’s Discord bot token has not been added to Vercel yet.'},{status:503});
    const channelResponse=await fetch(`https://discord.com/api/guilds/${guildId}/channels`,{headers:{Authorization:`Bot ${botToken}`},cache:'no-store'});
    if(channelResponse.status===403||channelResponse.status===404)return NextResponse.json({error:'Add B.E.I.P.I. to this server, then try again.'},{status:403});
    if(!channelResponse.ok)throw new Error('Discord could not load the server channels.');
    const channels=(await channelResponse.json() as DiscordChannel[]).filter(channel=>channel.type===0||channel.type===5).sort((a,b)=>a.position-b.position).map(channel=>({id:channel.id,name:channel.name,type:channel.type,parentId:channel.parent_id}));
    return NextResponse.json({channels},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Discord channels could not be loaded.'},{status:502})}
}
