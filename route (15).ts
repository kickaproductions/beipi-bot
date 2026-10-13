import {NextRequest,NextResponse} from 'next/server';
import {decryptSession,TWITCH_SESSION_COOKIE} from '../session';

export const runtime='nodejs';

export async function GET(request:NextRequest){
  const raw=request.cookies.get(TWITCH_SESSION_COOKIE)?.value;
  const session=raw?decryptSession(raw):null;
  if(!session)return NextResponse.json({connected:false});
  return NextResponse.json({connected:true,user:session.user,expiresAt:session.expiresAt},{headers:{'Cache-Control':'no-store'}});
}
