import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {savePlatformConnection} from '@/lib/platform-connections';
import {STATE_COOKIE,STATE_PATH,tiktokConfig} from '../config';

export async function GET(request:NextRequest){
  const config=tiktokConfig();
  function finish(result:string){
    const destination=new URL('/connections',config?.origin||request.nextUrl.origin);
    destination.searchParams.set('tiktok',result);
    const response=NextResponse.redirect(destination);
    response.cookies.set(STATE_COOKIE,'',{httpOnly:true,secure:true,sameSite:'lax',path:STATE_PATH,maxAge:0});
    return response;
  }
  if(!config||request.nextUrl.origin!==config.origin)return finish('unavailable');

  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  const params=request.nextUrl.searchParams;
  const state=params.get('state');
  if(!user||!state||request.cookies.get(STATE_COOKIE)?.value!==state+'.'+user.id)return finish('expired');
  if(params.get('error'))return finish('denied');
  const code=params.get('code');
  if(!code)return finish('error');

  try{
    const exchange=await fetch('https://open.tiktokapis.com/v2/oauth/token/',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({
        client_key:config.clientKey,client_secret:config.clientSecret,grant_type:'authorization_code',
        code,redirect_uri:config.redirectUri
      }),
      cache:'no-store',signal:AbortSignal.timeout(10000)
    });
    const tokens=await exchange.json();
    if(!exchange.ok||typeof tokens.access_token!=='string'||!tokens.access_token)return finish('error');
    const profile=await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',{
      headers:{Authorization:'Bearer '+tokens.access_token},cache:'no-store',signal:AbortSignal.timeout(10000)
    });
    const body=await profile.json();
    const creator=body.data?.user;
    if(!profile.ok||body.error?.code!=='ok'||!creator?.open_id||!creator.display_name||creator.open_id!==tokens.open_id)return finish('error');
    // Account linking uses a profile snapshot. OAuth tokens are discarded after the lookup.
    await savePlatformConnection({
      platform:'tiktok',externalUserId:creator.open_id,displayName:creator.display_name,
      avatarUrl:typeof creator.avatar_url==='string'&&creator.avatar_url.startsWith('https://')?creator.avatar_url:undefined,
      encryptedSession:''
    });
    return finish('connected');
  }catch{return finish('error')}
}
