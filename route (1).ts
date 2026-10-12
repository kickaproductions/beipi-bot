import {NextRequest,NextResponse} from 'next/server';
import {decryptKickSession,KICK_SESSION_COOKIE} from '../session';
export const runtime='nodejs';
export async function POST(request:NextRequest){const value=request.cookies.get(KICK_SESSION_COOKIE)?.value;const session=value?decryptKickSession(value):null;if(session?.accessToken){try{await fetch(`https://id.kick.com/oauth/revoke?token=${encodeURIComponent(session.accessToken)}&token_hint_type=access_token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},cache:'no-store'})}catch{}}const response=NextResponse.json({ok:true});response.cookies.delete(KICK_SESSION_COOKIE);return response}
