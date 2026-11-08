import {NextRequest,NextResponse} from 'next/server';
import {encryptSession,newestTwitchSession,refreshTwitchSession,TWITCH_SESSION_COOKIE} from '../session';
import {getPlatformConnection,savePlatformConnection} from '@/lib/platform-connections';

export const runtime='nodejs';

export async function GET(request:NextRequest){
  const cookieSession=request.cookies.get(TWITCH_SESSION_COOKIE)?.value;let storedSession:string|undefined;
  try{storedSession=(await getPlatformConnection('twitch'))?.encrypted_session}catch{}
  const selected=newestTwitchSession(cookieSession,storedSession);if(!selected)return NextResponse.json({connected:false});
  let {session}=selected,encrypted=selected.encrypted;
  const validation=await fetch('https://id.twitch.tv/oauth2/validate',{headers:{Authorization:`OAuth ${session.accessToken}`},cache:'no-store'}).catch(()=>null);
  if(session.expiresAt<=Date.now()+60000||validation?.status===401){const refreshed=await refreshTwitchSession(session);if(!refreshed)return NextResponse.json({connected:false,reauthorizationRequired:true});session=refreshed;encrypted=encryptSession(refreshed);await savePlatformConnection({platform:'twitch',externalUserId:refreshed.user.id,displayName:refreshed.user.displayName,username:refreshed.user.login,avatarUrl:refreshed.user.profileImageUrl,encryptedSession:encrypted})}
  const response=NextResponse.json({connected:true,user:session.user,expiresAt:session.expiresAt},{headers:{'Cache-Control':'no-store'}});
  if(encrypted!==cookieSession)response.cookies.set(TWITCH_SESSION_COOKIE,encrypted,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:60*60*24*30});
  return response;
}
