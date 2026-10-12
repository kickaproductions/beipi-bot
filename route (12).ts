import {randomBytes} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {DISCORD_STATE_COOKIE,discordConfig} from '../session';

export const runtime='nodejs';

export async function GET(request:NextRequest){
  try{
    const {clientId,redirectUri}=discordConfig();
    const callbackUrl=new URL(redirectUri);
    if(request.nextUrl.origin!==callbackUrl.origin){
      return NextResponse.redirect(new URL('/api/auth/discord/start',callbackUrl.origin));
    }
    const state=randomBytes(24).toString('base64url');
    const authorize=new URL('https://discord.com/oauth2/authorize');
    authorize.searchParams.set('response_type','code');
    authorize.searchParams.set('client_id',clientId);
    authorize.searchParams.set('redirect_uri',redirectUri);
    authorize.searchParams.set('scope','identify guilds');
    authorize.searchParams.set('state',state);
    authorize.searchParams.set('prompt','consent');
    const response=NextResponse.redirect(authorize);
    response.cookies.set(DISCORD_STATE_COOKIE,state,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:600});
    return response;
  }catch{
    return NextResponse.redirect(new URL('/dashboard?discord=not-configured',process.env.NEXT_PUBLIC_APP_URL||'http://localhost:3000'));
  }
}
