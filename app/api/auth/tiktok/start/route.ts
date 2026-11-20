import {randomBytes} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {STATE_COOKIE,STATE_PATH,tiktokConfig} from '../config';

export async function GET(request:NextRequest){
  const config=tiktokConfig();
  if(!config)return NextResponse.redirect(new URL('/connections?tiktok=unavailable',request.url));
  if(request.nextUrl.origin!==config.origin)return NextResponse.redirect(new URL(STATE_PATH+'/start',config.origin));

  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.redirect(new URL('/account',config.origin));

  const state=randomBytes(32).toString('base64url');
  const authorize=new URL('https://www.tiktok.com/v2/auth/authorize/');
  authorize.search=new URLSearchParams({
    client_key:config.clientKey,redirect_uri:config.redirectUri,response_type:'code',scope:'user.info.basic',state
  }).toString();
  const response=NextResponse.redirect(authorize);
  response.cookies.set(STATE_COOKIE,state+'.'+user.id,{httpOnly:true,secure:true,sameSite:'lax',path:STATE_PATH,maxAge:600});
  return response;
}
