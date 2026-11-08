import {NextRequest,NextResponse} from 'next/server';
import {DISCORD_SESSION_COOKIE,encryptDiscordSession,newestDiscordSession,refreshDiscordSession} from '../session';
import {getPlatformConnection,savePlatformConnection} from '@/lib/platform-connections';

export const runtime='nodejs';

type Guild={id:string;name:string;icon:string|null;owner:boolean;permissions:string};

export async function GET(request:NextRequest){
  const cookieSession=request.cookies.get(DISCORD_SESSION_COOKIE)?.value;let storedSession:string|undefined;
  try{storedSession=(await getPlatformConnection('discord'))?.encrypted_session}catch{}
  const selected=newestDiscordSession(cookieSession,storedSession);if(!selected)return NextResponse.json({connected:false});
  let value=selected.encrypted,session=selected.session;
  try{
    const load=()=>fetch('https://discord.com/api/users/@me/guilds',{headers:{Authorization:`Bearer ${session.accessToken}`},cache:'no-store'});
    let discordResponse=session.expiresAt<=Date.now()+60000?null:await load();
    if(!discordResponse||discordResponse.status===401){const refreshed=await refreshDiscordSession(session);if(!refreshed)return NextResponse.json({connected:false,reauthorizationRequired:true});session=refreshed;value=encryptDiscordSession(refreshed);await savePlatformConnection({platform:'discord',externalUserId:refreshed.user.id,displayName:refreshed.user.displayName,username:refreshed.user.username,avatarUrl:refreshed.user.avatarUrl,encryptedSession:value});discordResponse=await load()}
    if(!discordResponse.ok)return NextResponse.json({connected:false,reauthorizationRequired:discordResponse.status===401});
    const guilds=await discordResponse.json() as Guild[];
    const manageGuildPermission=BigInt(32);
    const manageable=guilds.filter(g=>g.owner||(BigInt(g.permissions)&manageGuildPermission)===manageGuildPermission).map(g=>({id:g.id,name:g.name,iconUrl:g.icon?`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`:''}));
    const result=NextResponse.json({connected:true,user:session.user,guilds:manageable},{headers:{'Cache-Control':'no-store'}});
    if(value!==cookieSession)result.cookies.set(DISCORD_SESSION_COOKIE,value,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:60*60*24*30});
    return result;
  }catch{return NextResponse.json({connected:false})}
}
