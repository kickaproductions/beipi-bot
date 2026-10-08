import {NextRequest,NextResponse} from 'next/server';
import {decryptSession,TWITCH_SESSION_COOKIE,twitchConfig} from '../session';

export const runtime='nodejs';

export async function POST(request:NextRequest){
  const raw=request.cookies.get(TWITCH_SESSION_COOKIE)?.value;
  const session=raw?decryptSession(raw):null;
  if(session){
    try{
      const {clientId}=twitchConfig();
      await fetch('https://id.twitch.tv/oauth2/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,token:session.accessToken}),cache:'no-store'});
    }catch{}
  }
  const response=NextResponse.json({connected:false});
  response.cookies.delete(TWITCH_SESSION_COOKIE);
  return response;
}
