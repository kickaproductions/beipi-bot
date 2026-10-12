import {NextRequest,NextResponse} from 'next/server';
import {decryptDiscordSession,DISCORD_SESSION_COOKIE} from '../session';

export const runtime='nodejs';

type Guild={id:string;name:string;icon:string|null;owner:boolean;permissions:string};

export async function GET(request:NextRequest){
  const value=request.cookies.get(DISCORD_SESSION_COOKIE)?.value;
  if(!value)return NextResponse.json({connected:false});
  const session=decryptDiscordSession(value);
  if(!session||session.expiresAt<=Date.now())return NextResponse.json({connected:false});
  try{
    const response=await fetch('https://discord.com/api/users/@me/guilds',{headers:{Authorization:`Bearer ${session.accessToken}`},cache:'no-store'});
    if(!response.ok)return NextResponse.json({connected:false});
    const guilds=await response.json() as Guild[];
    const manageable=guilds.filter(g=>g.owner||(BigInt(g.permissions)&32n)===32n).map(g=>({id:g.id,name:g.name,iconUrl:g.icon?`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`:''}));
    return NextResponse.json({connected:true,user:session.user,guilds:manageable},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({connected:false})}
}
