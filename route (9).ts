import {NextRequest,NextResponse} from 'next/server';
import {decryptSession,TWITCH_SESSION_COOKIE} from '../session';
import {getPlatformConnection} from '@/lib/platform-connections';

export const runtime='nodejs';

export async function GET(request:NextRequest){
  let raw=request.cookies.get(TWITCH_SESSION_COOKIE)?.value;
  if(!raw){try{raw=(await getPlatformConnection('twitch'))?.encrypted_session}catch{}}
  const session=raw?decryptSession(raw):null;
  if(!session)return NextResponse.json({connected:false});
  const response=NextResponse.json({connected:true,user:session.user,expiresAt:session.expiresAt},{headers:{'Cache-Control':'no-store'}});
  if(!request.cookies.get(TWITCH_SESSION_COOKIE)&&raw)response.cookies.set(TWITCH_SESSION_COOKIE,raw,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:60*60*24*30});
  return response;
}
