import {randomBytes} from 'node:crypto';
import {NextResponse} from 'next/server';
import {TWITCH_STATE_COOKIE,twitchConfig} from '../session';

export const runtime='nodejs';

export async function GET(){
  try{
    const {clientId,redirectUri}=twitchConfig();
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
