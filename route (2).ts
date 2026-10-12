import {createHash,randomBytes} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {KICK_STATE_COOKIE,KICK_VERIFIER_COOKIE,kickConfig} from '../session';

export const runtime='nodejs';

export async function GET(request:NextRequest){
  try{
    const {clientId,redirectUri}=kickConfig();
    const callbackUrl=new URL(redirectUri);
    if(request.nextUrl.origin!==callbackUrl.origin)return NextResponse.redirect(new URL('/api/auth/kick/start',callbackUrl.origin));
    const state=randomBytes(24).toString('base64url');
    const verifier=randomBytes(48).toString('base64url');
    const challenge=createHash('sha256').update(verifier).digest('base64url');
    const authorize=new URL('https://id.kick.com/oauth/authorize');
    authorize.searchParams.set('response_type','code');
    authorize.searchParams.set('client_id',clientId);
    authorize.searchParams.set('redirect_uri',redirectUri);
    authorize.searchParams.set('scope','user:read');
    authorize.searchParams.set('code_challenge',challenge);
    authorize.searchParams.set('code_challenge_method','S256');
    authorize.searchParams.set('state',state);
    const response=NextResponse.redirect(authorize);
    const cookie={httpOnly:true,secure:true,sameSite:'lax' as const,path:'/',maxAge:600};
    response.cookies.set(KICK_STATE_COOKIE,state,cookie);
    response.cookies.set(KICK_VERIFIER_COOKIE,verifier,cookie);
    return response;
  }catch{return NextResponse.redirect(new URL('/dashboard?kick=not-configured',process.env.NEXT_PUBLIC_APP_URL||'http://localhost:3000'))}
}
