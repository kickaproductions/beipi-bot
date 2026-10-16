import {NextRequest,NextResponse} from 'next/server';
import {decryptDiscordSession,DISCORD_SESSION_COOKIE} from '../session';
import {getPlatformConnection} from '@/lib/platform-connections';

export const runtime='nodejs';

type Guild={id:string;name:string;icon:string|null;owner:boolean;permissions:string};

export async function GET(request:NextRequest){
  let value:string|undefined;
  try{value=(await getPlatformConnection('discord'))?.encrypted_session}catch{}
  if(!value)value=request.cookies.get(DISCORD_SESSION_COOKIE)?.value;
  if(!value)return NextResponse.json({connected:false});
  const session=decryptDiscordSession(value);
  if(!session||session.expiresAt<=Date.now())return NextResponse.json({connected:false});
  try{
    const response=await fetch('https://discord.com/api/users/@me/guilds',{headers:{Authorization:`Bearer ${session.accessToken}`},cache:'no-store'});
    if(!response.ok)return NextResponse.json({connected:false});
    const guilds=await response.json() as Guild[];
    const manageGuildPermission=BigInt(32);
    const manageable=guilds.filter(g=>g.owner||(BigInt(g.permissions)&manageGuildPermission)===manageGuildPermission).map(g=>({id:g.id,name:g.name,iconUrl:g.icon?`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`:''}));
    const result=NextResponse.json({connected:true,user:session.user,guilds:manageable},{headers:{'Cache-Control':'no-store'}});
    if(!request.cookies.get(DISCORD_SESSION_COOKIE)&&value)result.cookies.set(DISCORD_SESSION_COOKIE,value,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:60*60*24*30});
    return result;
  }catch{return NextResponse.json({connected:false})}
}
