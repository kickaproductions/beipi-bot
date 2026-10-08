import {NextRequest,NextResponse} from 'next/server';
import {encryptSession,TWITCH_SESSION_COOKIE,TWITCH_STATE_COOKIE,twitchConfig} from '../session';

export const runtime='nodejs';

type TokenResponse={access_token?:string;refresh_token?:string;expires_in?:number};
type UsersResponse={data?:Array<{id:string;login:string;display_name:string;profile_image_url:string}>};

export async function GET(request:NextRequest){
  const home=new URL('/',request.nextUrl.origin);
  const code=request.nextUrl.searchParams.get('code');
  const state=request.nextUrl.searchParams.get('state');
  const expected=request.cookies.get(TWITCH_STATE_COOKIE)?.value;
  if(request.nextUrl.searchParams.get('error')){home.searchParams.set('twitch','denied');return NextResponse.redirect(home)}
  if(!code||!state||!expected||state!==expected){home.searchParams.set('twitch','invalid-state');return NextResponse.redirect(home)}
  try{
    const {clientId,clientSecret,redirectUri}=twitchConfig();
    const tokenResponse=await fetch('https://id.twitch.tv/oauth2/token',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,grant_type:'authorization_code',redirect_uri:redirectUri}),
      cache:'no-store'
    });
    const tokens=await tokenResponse.json() as TokenResponse;
    if(!tokenResponse.ok||!tokens.access_token||!tokens.refresh_token)throw new Error('Token exchange failed');
    const userResponse=await fetch('https://api.twitch.tv/helix/users',{headers:{Authorization:`Bearer ${tokens.access_token}`,'Client-Id':clientId},cache:'no-store'});
    const users=await userResponse.json() as UsersResponse;
    const user=users.data?.[0];
    if(!userResponse.ok||!user)throw new Error('Twitch profile lookup failed');
    const session=encryptSession({accessToken:tokens.access_token,refreshToken:tokens.refresh_token,expiresAt:Date.now()+(tokens.expires_in??14400)*1000,user:{id:user.id,login:user.login,displayName:user.display_name,profileImageUrl:user.profile_image_url}});
    home.searchParams.set('twitch','connected');
    const response=NextResponse.redirect(home);
    response.cookies.set(TWITCH_SESSION_COOKIE,session,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:60*60*24*30});
    response.cookies.delete(TWITCH_STATE_COOKIE);
    return response;
  }catch{
    home.searchParams.set('twitch','error');
    return NextResponse.redirect(home);
  }
}
