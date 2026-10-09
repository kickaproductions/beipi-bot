import {randomBytes} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {TWITCH_STATE_COOKIE,twitchConfig} from '../session';

export const runtime='nodejs';

export async function GET(request:NextRequest){
  try{
    const {clientId,redirectUri}=twitchConfig();
    const callbackUrl=new URL(redirectUri);

    // Vercel preview/deployment aliases are different cookie origins. Always
    // begin OAuth on the same permanent origin Twitch will redirect back to,
    // otherwise the callback cannot read the CSRF state cookie.
    if(request.nextUrl.origin!==callbackUrl.origin){
      return NextResponse.redirect(new URL('/api/auth/twitch/start',callbackUrl.origin));
    }

    const state=randomBytes(24).toString('base64url');
    const authorize=new URL('https://id.twitch.tv/oauth2/authorize');
    authorize.searchParams.set('response_type','code');
    authorize.searchParams.set('client_id',clientId);
    authorize.searchParams.set('redirect_uri',redirectUri);
    authorize.searchParams.set('scope','user:read:email');
    authorize.searchParams.set('state',state);
    const response=NextResponse.redirect(authorize);
    response.cookies.set(TWITCH_STATE_COOKIE,state,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:600});
    return response;
  }catch{
    return NextResponse.redirect(new URL('/?twitch=not-configured',process.env.NEXT_PUBLIC_APP_URL||'http://localhost:3000'));
  }
}
