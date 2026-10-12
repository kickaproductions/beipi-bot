import {NextRequest,NextResponse} from 'next/server';import {decryptGoogleSession,GOOGLE_SESSION_COOKIE} from '../session';
export const runtime='nodejs';
export async function GET(request:NextRequest){const value=request.cookies.get(GOOGLE_SESSION_COOKIE)?.value;if(!value)return NextResponse.json({connected:false});const session=decryptGoogleSession(value);if(!session||session.expiresAt<=Date.now())return NextResponse.json({connected:false});return NextResponse.json({connected:true,user:session.user,channel:session.channel},{headers:{'Cache-Control':'no-store'}})}
