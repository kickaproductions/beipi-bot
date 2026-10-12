import {NextRequest,NextResponse} from 'next/server';
import {decryptDiscordSession,DISCORD_SESSION_COOKIE,discordConfig} from '../session';

export const runtime='nodejs';

export async function POST(request:NextRequest){
  const value=request.cookies.get(DISCORD_SESSION_COOKIE)?.value;
  const session=value?decryptDiscordSession(value):null;
  if(session){
    try{
      const {clientId,clientSecret}=discordConfig();
      await fetch('https://discord.com/api/oauth2/token/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,token:session.accessToken,token_type_hint:'access_token'}),cache:'no-store'});
    }catch{}
  }
  const response=NextResponse.json({ok:true});
  response.cookies.delete(DISCORD_SESSION_COOKIE);
  return response;
}
