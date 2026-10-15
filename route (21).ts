import {NextRequest,NextResponse} from 'next/server';
import {decryptKickSession,encryptKickSession,KICK_SESSION_COOKIE,kickConfig} from '../session';
import {getPlatformConnection,savePlatformConnection} from '@/lib/platform-connections';
export const runtime='nodejs';
type TokenResponse={access_token?:string;refresh_token?:string;expires_in?:number};
export async function GET(request:NextRequest){
  let value=request.cookies.get(KICK_SESSION_COOKIE)?.value;
  if(!value){try{value=(await getPlatformConnection('kick'))?.encrypted_session}catch{}}
  if(!value)return NextResponse.json({connected:false});
  let session=decryptKickSession(value);
  if(!session)return NextResponse.json({connected:false});
  if(session.expiresAt<=Date.now()+60_000){
    if(!session.refreshToken)return NextResponse.json({connected:false});
    try{
      const {clientId,clientSecret}=kickConfig();
      const tokenResponse=await fetch('https://id.kick.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:clientId,client_secret:clientSecret,refresh_token:session.refreshToken}),cache:'no-store'});
      const tokens=await tokenResponse.json() as TokenResponse;
      if(!tokenResponse.ok||!tokens.access_token)throw new Error('Kick refresh failed');
      session={...session,accessToken:tokens.access_token,refreshToken:tokens.refresh_token||session.refreshToken,expiresAt:Date.now()+(tokens.expires_in??3600)*1000};
      const encrypted=encryptKickSession(session);
      try{await savePlatformConnection({platform:'kick',externalUserId:String(session.user.id),displayName:session.user.username,username:session.user.username,avatarUrl:session.user.profilePicture,encryptedSession:encrypted})}catch{}
      const response=NextResponse.json({connected:true,user:session.user},{headers:{'Cache-Control':'no-store'}});
      response.cookies.set(KICK_SESSION_COOKIE,encrypted,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:60*60*24*30});
      return response;
    }catch{return NextResponse.json({connected:false})}
  }
  const response=NextResponse.json({connected:true,user:session.user},{headers:{'Cache-Control':'no-store'}});
  if(!request.cookies.get(KICK_SESSION_COOKIE)&&value)response.cookies.set(KICK_SESSION_COOKIE,value,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:60*60*24*30});
  return response;
}
