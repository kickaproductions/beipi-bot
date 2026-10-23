import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';
import {getPlatformConnection,savePlatformConnection} from '@/lib/platform-connections';
import {DISCORD_SESSION_COOKIE,encryptDiscordSession,newestDiscordSession,refreshDiscordSession} from '@/app/api/auth/discord/session';

export const runtime='nodejs';
const defaultMessage='# Stream in 1 hour!\n\n{username} is streaming {game}, see you soon!\n\n{embed}\n\n@{role}';
const defaultCancelMessage='# Stream Cancelled\n\n{username} has cancelled their stream.';
const schema=z.object({enabled:z.boolean(),guildId:z.string().max(30).default(''),channelId:z.string().max(30).default(''),roleId:z.string().max(30).default(''),messageTemplate:z.string().min(1).max(2000).default(defaultMessage),cancelMessageTemplate:z.string().min(1).max(2000).default(defaultCancelMessage)});
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
type Guild={id:string;name:string;owner:boolean;permissions:string};
type DiscordChannel={id:string;name:string;type:number};
type DiscordRole={id:string;name:string;managed:boolean};

async function account(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();return {supabase,user}}

async function selectedDiscordSession(request:NextRequest){
  const cookieSession=request.cookies.get(DISCORD_SESSION_COOKIE)?.value;
  let storedSession:string|undefined;
  try{storedSession=(await getPlatformConnection('discord'))?.encrypted_session}catch{}
  const selected=newestDiscordSession(cookieSession,storedSession);
  return {encrypted:selected?.encrypted,session:selected?.session||null};
}

export async function GET(){
  try{
    const {supabase,user}=await account();
    if(!user)return json({error:'Sign in to manage stream confirmations.'},401);
    const [{data:settings,error:settingsError},{data:runs,error:runsError},{data:discord,error:discordError}]=await Promise.all([
      supabase.from('stream_confirmation_settings').select('*').eq('user_id',user.id).maybeSingle(),
      supabase.from('stream_confirmation_runs').select('stream_id,status,sent_at,responded_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50),
      supabase.from('platform_connections').select('external_user_id').eq('user_id',user.id).eq('platform','discord').maybeSingle()
    ]);
    if(settingsError||runsError||discordError)throw settingsError||runsError||discordError;
    return json({connectedDiscord:Boolean(discord?.external_user_id),settings:settings?{enabled:settings.enabled,guildId:settings.guild_id||'',guildName:settings.guild_name||'',channelId:settings.channel_id||'',channelName:settings.channel_name||'',roleId:settings.role_id||'',roleName:settings.role_name||'',messageTemplate:settings.message_template||defaultMessage,cancelMessageTemplate:settings.cancel_message_template||defaultCancelMessage}:null,statuses:Object.fromEntries((runs||[]).map(run=>[run.stream_id,{status:run.status,sentAt:run.sent_at,respondedAt:run.responded_at}]))});
  }catch{return json({error:'B.E.I.P.I. could not load stream confirmations. Run the latest Supabase migration if this is your first visit.'},500)}
}

export async function PUT(request:NextRequest){
  try{
    const {supabase,user}=await account();
    if(!user)return json({error:'Sign in to manage stream confirmations.'},401);
    const parsed=schema.safeParse(await request.json());
    if(!parsed.success)return json({error:'Check the confirmation settings and try again.'},400);
    const value=parsed.data;
    let guildName='',channelName='',roleName='',refreshedCookie:string|undefined;
    if(value.enabled){
      if(!value.guildId||!value.channelId||!value.roleId)return json({error:'Choose a Discord server, channel and notification role.'},400);
      const selected=await selectedDiscordSession(request);let session=selected.session;
      if(!session)return json({error:'Connect Discord before turning on stream confirmations.'},401);
      let guildResponse=await fetch('https://discord.com/api/users/@me/guilds',{headers:{Authorization:`Bearer ${session.accessToken}`},cache:'no-store'});
      if(guildResponse.status===401){
        const refreshed=await refreshDiscordSession(session);
        if(refreshed){session=refreshed;refreshedCookie=encryptDiscordSession(refreshed);await savePlatformConnection({platform:'discord',externalUserId:refreshed.user.id,displayName:refreshed.user.displayName,username:refreshed.user.username,avatarUrl:refreshed.user.avatarUrl,encryptedSession:refreshedCookie});guildResponse=await fetch('https://discord.com/api/users/@me/guilds',{headers:{Authorization:`Bearer ${session.accessToken}`},cache:'no-store'})}
      }
      if(!guildResponse.ok)return json({error:'Reconnect Discord, then choose your confirmation channel again.'},401);
      const guilds=await guildResponse.json() as Guild[],manageGuild=BigInt(32);
      const guild=guilds.find(item=>item.id===value.guildId&&(item.owner||(BigInt(item.permissions)&manageGuild)===manageGuild));
      if(!guild)return json({error:'You must manage that Discord server to use its channels.'},403);
      const botToken=process.env.DISCORD_BOT_TOKEN;
      if(!botToken)return json({error:'B.E.I.P.I.’s Discord bot token has not been added to Vercel yet.'},503);
      const [channelResponse,roleResponse]=await Promise.all([fetch(`https://discord.com/api/guilds/${value.guildId}/channels`,{headers:{Authorization:`Bot ${botToken}`},cache:'no-store'}),fetch(`https://discord.com/api/guilds/${value.guildId}/roles`,{headers:{Authorization:`Bot ${botToken}`},cache:'no-store'})]);
      if(channelResponse.status===403||channelResponse.status===404||roleResponse.status===403||roleResponse.status===404)return json({error:'Add B.E.I.P.I. to that server before choosing a channel and role.'},403);
      if(!channelResponse.ok||!roleResponse.ok)return json({error:'Discord could not check that channel and role right now.'},502);
      const channel=(await channelResponse.json() as DiscordChannel[]).find(item=>item.id===value.channelId&&(item.type===0||item.type===5));
      if(!channel)return json({error:'Choose a text or announcement channel B.E.I.P.I. can access.'},400);
      const role=(await roleResponse.json() as DiscordRole[]).find(item=>item.id===value.roleId&&!item.managed);
      if(!role)return json({error:'Choose a Discord role B.E.I.P.I. can mention.'},400);
      guildName=guild.name;channelName=channel.name;roleName=role.name;
    }
    const {data,error}=await supabase.from('stream_confirmation_settings').upsert({user_id:user.id,enabled:value.enabled,guild_id:value.enabled?value.guildId:null,guild_name:value.enabled?guildName:null,channel_id:value.enabled?value.channelId:null,channel_name:value.enabled?channelName:null,role_id:value.enabled?value.roleId:null,role_name:value.enabled?roleName:null,message_template:value.messageTemplate,cancel_message_template:value.cancelMessageTemplate,lead_minutes:60,updated_at:new Date().toISOString()},{onConflict:'user_id'}).select('*').single();
    if(error)throw error;
    const response=json({settings:{enabled:data.enabled,guildId:data.guild_id||'',guildName:data.guild_name||'',channelId:data.channel_id||'',channelName:data.channel_name||'',roleId:data.role_id||'',roleName:data.role_name||'',messageTemplate:data.message_template||defaultMessage,cancelMessageTemplate:data.cancel_message_template||defaultCancelMessage}});
    if(refreshedCookie)response.cookies.set(DISCORD_SESSION_COOKIE,refreshedCookie,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:60*60*24*30});
    return response;
  }catch(error){const code=typeof error==='object'&&error&&'code' in error?String(error.code):'';return json({error:code==='42703'?'Run the latest Supabase migration, then save these settings again.':'B.E.I.P.I. could not save stream confirmations.'},500)}
}
