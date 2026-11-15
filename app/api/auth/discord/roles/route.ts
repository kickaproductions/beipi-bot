import {NextRequest,NextResponse} from 'next/server';
import {DISCORD_SESSION_COOKIE} from '../session';
import {fetchDiscordGuildsWithRefresh,hasDiscordGuildPermissions,selectDiscordSession,setDiscordSessionCookie,type DiscordGuild,ManageServer,ManageRoles} from '@/lib/discord-guilds';

import {compareDiscordRoles, highestDiscordRole, roleAssignmentRestriction, type DiscordRole} from '@/lib/discord-role-eligibility';

export const runtime='nodejs';
type Role=DiscordRole&{color:number};
type BotUser={id:string};
type GuildMember={roles:string[]};

export async function GET(request:NextRequest){
  const guildId=request.nextUrl.searchParams.get('guildId');
  const mentionOnly=request.nextUrl.searchParams.get('purpose')==='mention';
  if(!guildId)return NextResponse.json({error:'Choose a Discord server first.'},{status:400});
  const cookieSession=request.cookies.get(DISCORD_SESSION_COOKIE)?.value;
  const selected=await selectDiscordSession(cookieSession);
  if(!selected)return NextResponse.json({error:'Connect Discord before choosing roles.'},{status:401});
  try{
    const {response:guildResponse,encrypted}=await fetchDiscordGuildsWithRefresh(selected);
    if(guildResponse.status===401)throw new Error('Discord account access expired. Reconnect Discord and try again.');
    if(guildResponse.status===429)throw new Error('Discord is temporarily limiting requests. Wait a few seconds, then choose the server again.');
    if(!guildResponse.ok)throw new Error('Discord could not check your server access right now.');
    const guilds=await guildResponse.json() as DiscordGuild[];
    if(!guilds.some(g=>g.id===guildId&&hasDiscordGuildPermissions(g)))return NextResponse.json({error:'You do not manage that Discord server.'},{status:403});
    const token=process.env.DISCORD_BOT_TOKEN;
    if(!token)return NextResponse.json({error:'B.E.I.P.I.’s Discord bot token has not been added to Vercel yet.'},{status:503});
    const headers={Authorization:`Bot ${token}`};
    const [rolesResponse,botResponse]=await Promise.all([
      fetch(`https://discord.com/api/guilds/${guildId}/roles`,{headers,cache:'no-store'}),
      mentionOnly ? null : fetch('https://discord.com/api/users/@me',{headers,cache:'no-store'})
    ]);
    if(rolesResponse.status===403||rolesResponse.status===404)return NextResponse.json({error:'Add B.E.I.P.I. to this server and give her Manage Roles permission.'},{status:403});
    if(!rolesResponse.ok||(!mentionOnly&&!botResponse?.ok))throw new Error('Discord could not load the server roles.');
    const roles=(await rolesResponse.json() as Role[]).sort((a,b)=>compareDiscordRoles(b,a));
    const roleOption=(role:Role)=>({id:role.id,name:role.name,color:role.color,position:role.position});
    if(mentionOnly){
      const mentionRoles=roles.map(roleOption);
      const response=NextResponse.json({roles:mentionRoles},{headers:{'Cache-Control':'no-store'}});setDiscordSessionCookie(response,encrypted);return response;
    }
    const bot=await botResponse!.json() as BotUser;
    const memberResponse=await fetch(`https://discord.com/api/guilds/${guildId}/members/${bot.id}`,{headers,cache:'no-store'});
    if(!memberResponse.ok)throw new Error('B.E.I.P.I. could not check her role position.');
    const member=await memberResponse.json() as GuildMember;
    const botTop=highestDiscordRole(roles,member.roles);
    const roleOptions=roles.map(role=>({...roleOption(role),assignmentRestriction:roleAssignmentRestriction(role,guildId,botTop)}));
    const response=NextResponse.json({roles:roleOptions,botRoleReady:Boolean(botTop)},{headers:{'Cache-Control':'no-store'}});setDiscordSessionCookie(response,encrypted);return response;
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Discord roles could not be loaded.'},{status:502})}
}

export async function POST(request:NextRequest){
  const body=await request.json() as {guildId?:string;name?:string};
  const guildId=body.guildId?.trim(),name=body.name?.trim();
  if(!guildId||!name||name.length>100)return NextResponse.json({error:'Enter a role name up to 100 characters.'},{status:400});
  const selected=await selectDiscordSession();
  if(!selected?.session.user?.username)return NextResponse.json({error:'Sign in and connect Discord before creating a role.'},{status:401});
  try{
    const {response:guildResponse,encrypted}=await fetchDiscordGuildsWithRefresh(selected);
    if(!guildResponse.ok)return NextResponse.json({error:'Reconnect Discord, then try creating the role again.'},{status:401});
    const guilds=await guildResponse.json() as DiscordGuild[];
    if(!guilds.some(g=>g.id===guildId&&hasDiscordGuildPermissions(g,ManageServer|ManageRoles)))return NextResponse.json({error:'You need Manage Server and Manage Roles to create roles.'},{status:403});
    const token=process.env.DISCORD_BOT_TOKEN;if(!token)return NextResponse.json({error:'B.E.I.P.I.’s bot token is not configured.'},{status:503});
    const createdResponse=await fetch(`https://discord.com/api/guilds/${guildId}/roles`,{method:'POST',headers:{Authorization:`Bot ${token}`,'Content-Type':'application/json'},body:JSON.stringify({name,permissions:'0',mentionable:false,hoist:false}),cache:'no-store'});
    const role=await createdResponse.json() as Role&{message?:string};if(!createdResponse.ok||!role.id)return NextResponse.json({error:role.message||'B.E.I.P.I. could not create that role. Check her Manage Roles permission.'},{status:createdResponse.status||502});
    const response=NextResponse.json({role:{id:role.id,name:role.name,color:role.color,position:role.position}},{headers:{'Cache-Control':'no-store'}});setDiscordSessionCookie(response,encrypted);return response;
  }catch{return NextResponse.json({error:'Discord could not create the role right now.'},{status:502})}
}
