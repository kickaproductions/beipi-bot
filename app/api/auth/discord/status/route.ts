import {NextRequest,NextResponse} from 'next/server';
import {DISCORD_SESSION_COOKIE} from '../session';
import {fetchDiscordGuildsWithRefresh,hasDiscordGuildPermissions,selectDiscordSession,setDiscordSessionCookie,type DiscordGuild} from '@/lib/discord-guilds';

export const runtime='nodejs';

export async function GET(request:NextRequest){
  const cookieSession=request.cookies.get(DISCORD_SESSION_COOKIE)?.value;
  const selected=await selectDiscordSession(cookieSession);
  if(!selected)return NextResponse.json({connected:false});
  try{
    const {response:discordResponse,session,encrypted}=await fetchDiscordGuildsWithRefresh(selected,true);
    if(!discordResponse.ok)return NextResponse.json({connected:false,reauthorizationRequired:discordResponse.status===401});
    const guilds=await discordResponse.json() as DiscordGuild[];
    const manageable=guilds.filter(g=>hasDiscordGuildPermissions(g)).map(g=>({id:g.id,name:g.name,iconUrl:g.icon?`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`:''}));
    const result=NextResponse.json({connected:true,user:session.user,guilds:manageable},{headers:{'Cache-Control':'no-store'}});
    if(encrypted!==cookieSession)setDiscordSessionCookie(result,encrypted);
    return result;
  }catch{return NextResponse.json({connected:false})}
}
