import {NextRequest,NextResponse} from 'next/server';
import {DISCORD_SESSION_COOKIE,DISCORD_STATE_COOKIE,discordConfig,encryptDiscordSession} from '../session';

export const runtime='nodejs';

type TokenResponse={access_token?:string;refresh_token?:string;expires_in?:number};
type UserResponse={id:string;username:string;global_name?:string|null;avatar?:string|null};

export async function GET(request:NextRequest){
  const home=new URL('/',request.nextUrl.origin);
  const code=request.nextUrl.searchParams.get('code');
  const state=request.nextUrl.searchParams.get('state');
  const expected=request.cookies.get(DISCORD_STATE_COOKIE)?.value;
  if(request.nextUrl.searchParams.get('error')){home.searchParams.set('discord','denied');return NextResponse.redirect(home)}
  if(!code||!state||!expected||state!==expected){home.searchParams.set('discord','invalid-state');return NextResponse.redirect(home)}
  try{
    const {clientId,clientSecret,redirectUri}=discordConfig();
    const tokenResponse=await fetch('https://discord.com/api/oauth2/token',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:'authorization_code',code,redirect_uri:redirectUri}),
      cache:'no-store'
    });
    const tokens=await tokenResponse.json() as TokenResponse;
    if(!tokenResponse.ok||!tokens.access_token||!tokens.refresh_token)throw new Error('Discord token exchange failed');
    const userResponse=await fetch('https://discord.com/api/users/@me',{headers:{Authorization:`Bearer ${tokens.access_token}`},cache:'no-store'});
    const user=await userResponse.json() as UserResponse;
    if(!userResponse.ok||!user.id)throw new Error('Discord profile lookup failed');
    const avatarUrl=user.avatar?`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`:`https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.id)>>22n)%6}.png`;
    const session=encryptDiscordSession({accessToken:tokens.access_token,refreshToken:tokens.refresh_token,expiresAt:Date.now()+(tokens.expires_in??604800)*1000,user:{id:user.id,username:user.username,displayName:user.global_name||user.username,avatarUrl}});
    home.searchParams.set('discord','connected');
    const response=NextResponse.redirect(home);
    response.cookies.set(DISCORD_SESSION_COOKIE,session,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:60*60*24*30});
    response.cookies.delete(DISCORD_STATE_COOKIE);
    return response;
  }catch{
    home.searchParams.set('discord','error');
    return NextResponse.redirect(home);
  }
}
