import {NextRequest,NextResponse} from 'next/server';
import {encryptKickSession,KICK_SESSION_COOKIE,KICK_STATE_COOKIE,KICK_VERIFIER_COOKIE,kickConfig} from '../session';

export const runtime='nodejs';
type TokenResponse={access_token?:string;refresh_token?:string;expires_in?:number};
type KickUser={user_id?:number;id?:number;name?:string;username?:string;email?:string;profile_picture?:string;profile_picture_url?:string};
type UsersResponse={data?:KickUser[];message?:string};

export async function GET(request:NextRequest){
  const home=new URL('/dashboard',request.nextUrl.origin);
  const code=request.nextUrl.searchParams.get('code');
  const state=request.nextUrl.searchParams.get('state');
  const expected=request.cookies.get(KICK_STATE_COOKIE)?.value;
  const verifier=request.cookies.get(KICK_VERIFIER_COOKIE)?.value;
  if(request.nextUrl.searchParams.get('error')){home.searchParams.set('kick','denied');return NextResponse.redirect(home)}
  if(!code||!state||!expected||state!==expected||!verifier){home.searchParams.set('kick','invalid-state');return NextResponse.redirect(home)}
  try{
    const {clientId,clientSecret,redirectUri}=kickConfig();
    const tokenResponse=await fetch('https://id.kick.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,code_verifier:verifier,code}),cache:'no-store'});
    const tokens=await tokenResponse.json() as TokenResponse;
    if(!tokenResponse.ok||!tokens.access_token)throw new Error('Kick token exchange failed');
    const userResponse=await fetch('https://api.kick.com/public/v1/users',{headers:{Authorization:`Bearer ${tokens.access_token}`,'Client-Id':clientId},cache:'no-store'});
    const users=await userResponse.json() as UsersResponse;
    const user=users.data?.[0];
    const id=user?.user_id??user?.id;
    const username=user?.name??user?.username;
    if(!userResponse.ok||!user||id===undefined||!username)throw new Error('Kick profile lookup failed');
    const session=encryptKickSession({accessToken:tokens.access_token,refreshToken:tokens.refresh_token||'',expiresAt:Date.now()+(tokens.expires_in??3600)*1000,user:{id,username,email:user.email||'',profilePicture:user.profile_picture??user.profile_picture_url??''}});
    home.searchParams.set('kick','connected');
    const response=NextResponse.redirect(home);
    response.cookies.set(KICK_SESSION_COOKIE,session,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:60*60*24*30});
    response.cookies.delete(KICK_STATE_COOKIE);response.cookies.delete(KICK_VERIFIER_COOKIE);
    return response;
  }catch{home.searchParams.set('kick','error');return NextResponse.redirect(home)}
}
