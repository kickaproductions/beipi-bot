import {NextRequest,NextResponse} from 'next/server';
import {decryptDiscordSession,DISCORD_SESSION_COOKIE,encryptDiscordSession,refreshDiscordSession} from '../session';
import {getPlatformConnection,savePlatformConnection} from '@/lib/platform-connections';

export const runtime='nodejs';
type Guild={id:string;owner:boolean;permissions:string};
type Role={id:string;name:string;color:number;position:number;permissions:string;managed:boolean};
type BotUser={id:string};
type GuildMember={roles:string[]};

export async function GET(request:NextRequest){
  const guildId=request.nextUrl.searchParams.get('guildId');
  if(!guildId)return NextResponse.json({error:'Choose a Discord server first.'},{status:400});
  let encrypted:string|undefined;
  try{encrypted=(await getPlatformConnection('discord'))?.encrypted_session}catch{}
  if(!encrypted)encrypted=request.cookies.get(DISCORD_SESSION_COOKIE)?.value;
  let session=encrypted?decryptDiscordSession(encrypted):null;
  if(!session)return NextResponse.json({error:'Connect Discord before choosing roles.'},{status:401});
  try{
    let guildResponse=await fetch('https://discord.com/api/users/@me/guilds',{headers:{Authorization:`Bearer ${session.accessToken}`},cache:'no-store'});
    if(guildResponse.status===401){const refreshed=await refreshDiscordSession(session);if(refreshed){session=refreshed;encrypted=encryptDiscordSession(refreshed);await savePlatformConnection({platform:'discord',externalUserId:refreshed.user.id,displayName:refreshed.user.displayName,username:refreshed.user.username,avatarUrl:refreshed.user.avatarUrl,encryptedSession:encrypted});guildResponse=await fetch('https://discord.com/api/users/@me/guilds',{headers:{Authorization:`Bearer ${session.accessToken}`},cache:'no-store'})}}
    if(!guildResponse.ok)throw new Error('Discord account access expired. Reconnect Discord and try again.');
    const guilds=await guildResponse.json() as Guild[];
    const manageGuild=BigInt(32);
    if(!guilds.some(g=>g.id===guildId&&(g.owner||(BigInt(g.permissions)&manageGuild)===manageGuild)))return NextResponse.json({error:'You do not manage that Discord server.'},{status:403});
    const token=process.env.DISCORD_BOT_TOKEN;
    if(!token)return NextResponse.json({error:'B.E.I.P.I.’s Discord bot token has not been added to Vercel yet.'},{status:503});
    const headers={Authorization:`Bot ${token}`};
    const [rolesResponse,botResponse]=await Promise.all([
      fetch(`https://discord.com/api/guilds/${guildId}/roles`,{headers,cache:'no-store'}),
      fetch('https://discord.com/api/users/@me',{headers,cache:'no-store'})
    ]);
    if(rolesResponse.status===403||rolesResponse.status===404)return NextResponse.json({error:'Add B.E.I.P.I. to this server and give her Manage Roles permission.'},{status:403});
    if(!rolesResponse.ok||!botResponse.ok)throw new Error('Discord could not load the server roles.');
    const roles=await rolesResponse.json() as Role[];const bot=await botResponse.json() as BotUser;
    const memberResponse=await fetch(`https://discord.com/api/guilds/${guildId}/members/${bot.id}`,{headers,cache:'no-store'});
    if(!memberResponse.ok)throw new Error('B.E.I.P.I. could not check her role position.');
    const member=await memberResponse.json() as GuildMember;
    const botTop=Math.max(0,...roles.filter(role=>member.roles.includes(role.id)).map(role=>role.position));
    const sensitive=BigInt(8)|BigInt(2)|BigInt(4)|BigInt(32)|BigInt(268435456)|BigInt(1099511627776);
    const safe=roles.filter(role=>role.id!==guildId&&!role.managed&&role.position<botTop&&(BigInt(role.permissions)&sensitive)===BigInt(0)).sort((a,b)=>b.position-a.position).map(role=>({id:role.id,name:role.name,color:role.color,position:role.position}));
    const response=NextResponse.json({roles:safe,botRoleReady:botTop>0},{headers:{'Cache-Control':'no-store'}});if(encrypted)response.cookies.set(DISCORD_SESSION_COOKIE,encrypted,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:60*60*24*30});return response;
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Discord roles could not be loaded.'},{status:502})}
}
