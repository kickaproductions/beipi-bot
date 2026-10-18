import {NextRequest,NextResponse} from 'next/server';
import {DISCORD_SESSION_COOKIE,encryptDiscordSession,newestDiscordSession,refreshDiscordSession} from '../session';
import {getPlatformConnection,savePlatformConnection} from '@/lib/platform-connections';

export const runtime='nodejs';
type Guild={id:string;owner:boolean;permissions:string};
type DiscordChannel={id:string;name:string;type:number;position:number;parent_id:string|null};

export async function GET(request:NextRequest){
  const guildId=request.nextUrl.searchParams.get('guildId');
  if(!guildId)return NextResponse.json({error:'Choose a Discord server first.'},{status:400});
  const cookieSession=request.cookies.get(DISCORD_SESSION_COOKIE)?.value;let storedSession:string|undefined;
  try{storedSession=(await getPlatformConnection('discord'))?.encrypted_session}catch{}
  const selected=newestDiscordSession(cookieSession,storedSession);let encrypted=selected?.encrypted;let session=selected?.session||null;
  if(!session)return NextResponse.json({error:'Connect Discord before choosing a channel.'},{status:401});
  try{
    let guildResponse=await fetch('https://discord.com/api/users/@me/guilds',{headers:{Authorization:`Bearer ${session.accessToken}`},cache:'no-store'});
    if(guildResponse.status===401){const refreshed=await refreshDiscordSession(session);if(refreshed){session=refreshed;encrypted=encryptDiscordSession(refreshed);await savePlatformConnection({platform:'discord',externalUserId:refreshed.user.id,displayName:refreshed.user.displayName,username:refreshed.user.username,avatarUrl:refreshed.user.avatarUrl,encryptedSession:encrypted});guildResponse=await fetch('https://discord.com/api/users/@me/guilds',{headers:{Authorization:`Bearer ${session.accessToken}`},cache:'no-store'})}}
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
    const response=NextResponse.json({channels},{headers:{'Cache-Control':'no-store'}});if(encrypted)response.cookies.set(DISCORD_SESSION_COOKIE,encrypted,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:60*60*24*30});return response;
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Discord channels could not be loaded.'},{status:502})}
}
