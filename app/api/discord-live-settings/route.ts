import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';
import {fetchDiscordGuildsWithRefresh,hasDiscordGuildPermissions,selectDiscordSession,type DiscordGuild} from '@/lib/discord-guilds';
import {twitchAppFetch} from '@/lib/twitch-app';

const ownerDefault='# {streamer} is now live!\n{streamer} is streaming {game} on {platform}.\nThey brought their trusty {random_companion}!\nCome and say hello\n{url}';
const creatorDefault='# {streamer} is now live!\nStreaming {game} on {platform}.\nCome and say hello\n{url}';
const schema=z.object({id:z.string().uuid().optional(),guildId:z.string().min(1).max(30),guildName:z.string().trim().min(1).max(100),creatorRoleId:z.string().max(30).default(''),creatorRoleName:z.string().trim().max(100).default(''),liveRoleId:z.string().max(30).default(''),liveRoleName:z.string().trim().max(100).default(''),mentionRoleIds:z.array(z.string().max(30)).max(20).default([]),mentionRoleNames:z.array(z.string().trim().max(100)).max(20).default([]),alertChannelId:z.string().min(1).max(30),alertChannelName:z.string().trim().min(1).max(100),ownerAlertChannelId:z.string().max(30).default(''),ownerAlertChannelName:z.string().trim().max(100).default(''),ownerEveryoneEnabled:z.boolean().default(true),ownerRoleId:z.string().max(30).default(''),ownerRoleName:z.string().trim().max(100).default(''),ownerMessageTemplate:z.string().trim().max(1800).default(ownerDefault).transform(value=>value||ownerDefault),creatorMessageTemplate:z.string().trim().min(1).max(1800).default(creatorDefault),twitchWatchText:z.string().max(2000).optional(),deleteExpiredAlert:z.boolean().default(true)}).refine(value=>!value.creatorRoleId||!value.liveRoleId||value.creatorRoleId!==value.liveRoleId,{message:'Choose two different roles.',path:['liveRoleId']});
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
type TwitchWatch={discordId:string;twitchId:string;twitchLogin:string};
function watchText(value:unknown) {
  if(!Array.isArray(value))return '';
  return (value as TwitchWatch[]).filter(item=>item?.discordId&&item.twitchLogin)
    .map(item=>`${item.discordId}, ${item.twitchLogin}`).join('\n');
}

async function resolveTwitchWatch(input:string,guildId:string) {
  const entries=input.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{
    const [discordId,twitchLogin,extra]=line.split(',').map(value=>value.trim());
    if(extra!==undefined||!/^\d{17,20}$/.test(discordId)||!twitchLogin||!/^[a-z0-9_]{1,25}$/i.test(twitchLogin))return null;
    return {discordId,twitchLogin:twitchLogin.toLowerCase()};
  });
  const pairs=entries.filter(item=>item!==null);
  if(entries.length>20||pairs.length!==entries.length||
    new Set(pairs.map(item=>item.discordId)).size!==pairs.length||
    new Set(pairs.map(item=>item.twitchLogin)).size!==pairs.length){
    return {error:json({error:'Enter up to 20 unique pairs, one per line, using Discord user ID, Twitch username.'},400)};
  }
  if(!pairs.length)return {value:[]};
  const session=await selectDiscordSession();
  if(!session?.session.user?.username)return {error:json({error:'Connect Discord before adding Twitch streamers.'},401)};
  const {response}=await fetchDiscordGuildsWithRefresh(session);
  if(!response.ok)return {error:json({error:'Reconnect Discord so B.E.I.P.I. can check your server permissions.'},401)};
  const guilds=await response.json() as DiscordGuild[];
  if(!guilds.some(guild=>guild.id===guildId&&hasDiscordGuildPermissions(guild))){
    return {error:json({error:'You need Manage Server to add Twitch streamers.'},403)};
  }
  try{
    const url=new URL('https://api.twitch.tv/helix/users');
    for(const {twitchLogin} of pairs)url.searchParams.append('login',twitchLogin);
    const response=await twitchAppFetch(url);
    if(!response.ok)throw new Error('Twitch lookup failed');
    const {data}=await response.json() as {data:{id:string;login:string}[]};
    const ids=new Map(data.map(user=>[user.login.toLowerCase(),user.id]));
    const missing=pairs.find(item=>!ids.has(item.twitchLogin));
    if(missing)return {error:json({error:`Twitch could not find @${missing.twitchLogin}. Check the username and try again.`},400)};
    return {value:pairs.map(item=>({...item,twitchId:ids.get(item.twitchLogin)!}))};
  }catch{
    return {error:json({error:'Twitch could not check the usernames right now. Try saving again shortly.'},502)};
  }
}

const output=(row:Record<string,unknown>)=>({id:row.id,guildId:row.guild_id,guildName:row.guild_name,creatorRoleId:row.creator_role_id||'',creatorRoleName:row.creator_role_name||'',liveRoleId:row.live_role_id||'',liveRoleName:row.live_role_name||'',mentionRoleIds:Array.isArray(row.mention_role_ids)?row.mention_role_ids:[],mentionRoleNames:Array.isArray(row.mention_role_names)?row.mention_role_names:[],alertChannelId:row.alert_channel_id,alertChannelName:row.alert_channel_name,ownerAlertChannelId:row.owner_alert_channel_id||'',ownerAlertChannelName:row.owner_alert_channel_name||'',ownerEveryoneEnabled:row.owner_everyone_enabled!==false,ownerRoleId:row.owner_role_id||'',ownerRoleName:row.owner_role_name||'',ownerMessageTemplate:row.owner_message_template||ownerDefault,creatorMessageTemplate:row.creator_message_template||creatorDefault,discordPresenceEnabled:true,platformConfirmationEnabled:true,twitchWatchText:watchText(row.twitch_watch),deleteExpiredAlert:row.delete_expired_alert!==false,updatedAt:row.updated_at});
async function account(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();return {supabase,user}}

export async function GET(request:Request){try{const {supabase,user}=await account();if(!user)return json({error:'Sign in to manage live-role settings.'},401);const guildId=new URL(request.url).searchParams.get('guildId');if(!guildId)return json({settings:[]});const {data,error}=await supabase.from('discord_live_settings').select('*').eq('user_id',user.id).eq('guild_id',guildId).order('created_at',{ascending:true});if(error)throw error;return json({settings:(data||[]).map(output)})}catch{return json({error:'B.E.I.P.I. could not load live-role settings.'},500)}}

export async function PUT(request:Request){try{const {supabase,user}=await account();if(!user)return json({error:'Sign in to save live-role settings.'},401);const parsed=schema.safeParse(await request.json());if(!parsed.success){
  const issue=parsed.error.issues[0];
  const field=issue?.path[0];
  const error=field==='alertChannelId'||field==='alertChannelName'?'Choose a live-alert channel for this server.'
    :field==='guildId'||field==='guildName'?'Choose a Discord server.'
    :field==='creatorMessageTemplate'?'Enter a live message of up to 1,800 characters.'
    :field==='mentionRoleIds'||field==='mentionRoleNames'?'Choose up to 20 roles to notify.'
    :issue?.message||'Check your live-role settings.';
  return json({error},400);
}
const value=parsed.data;
const watch=value.twitchWatchText===undefined?null:await resolveTwitchWatch(value.twitchWatchText,value.guildId);
if(watch?.error)return watch.error;
const row={user_id:user.id,guild_id:value.guildId,guild_name:value.guildName,creator_role_id:value.creatorRoleId||null,creator_role_name:value.creatorRoleName||null,live_role_id:value.liveRoleId||null,live_role_name:value.liveRoleName||null,mention_role_ids:value.mentionRoleIds,mention_role_names:value.mentionRoleNames,alert_channel_id:value.alertChannelId,alert_channel_name:value.alertChannelName,owner_alert_channel_id:value.ownerAlertChannelId||null,owner_alert_channel_name:value.ownerAlertChannelName||null,owner_everyone_enabled:value.ownerEveryoneEnabled,owner_role_id:value.ownerRoleId||null,owner_role_name:value.ownerRoleName||null,owner_message_template:value.ownerMessageTemplate,creator_message_template:value.creatorMessageTemplate,discord_presence_enabled:true,platform_confirmation_enabled:true,...(watch?{twitch_watch:watch.value}:{}),delete_expired_alert:value.deleteExpiredAlert,updated_at:new Date().toISOString()};const query=value.id?supabase.from('discord_live_settings').update(row).eq('id',value.id).eq('user_id',user.id):supabase.from('discord_live_settings').insert(row);const {data,error}=await query.select('*').single();if(error)throw error;return json({settings:output(data)})}catch(error){const code=typeof error==='object'&&error&&'code' in error?String(error.code):'';return json({error:code==='23502'||code==='23505'||code==='42703'?'Run the latest Supabase migration, then save again.':'Could not save live-role settings.'},500)}}

export async function DELETE(request:Request){try{const {supabase,user}=await account();if(!user)return json({error:'Sign in to remove live-role settings.'},401);const id=new URL(request.url).searchParams.get('id');if(!id)return json({error:'Notification not found.'},404);const {data,error}=await supabase.from('discord_live_settings').delete().eq('id',id).eq('user_id',user.id).select('id').maybeSingle();if(error)throw error;if(!data)return json({error:'Notification not found.'},404);return json({ok:true})}catch{return json({error:'Could not remove that community notification.'},500)}}
