import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';

const defaultTemplate='# {streamer} is now live!\n{streamer} is streaming {game} on {platform}.\nThey brought their trusty {random_companion}!\nCome and say hello\n{url}';
const schema=z.object({id:z.string().uuid().optional(),guildId:z.string().min(1).max(30),guildName:z.string().trim().min(1).max(100),alertChannelId:z.string().min(1).max(30),alertChannelName:z.string().trim().min(1).max(100),everyoneEnabled:z.boolean().default(true),roleIds:z.array(z.string().max(30)).max(20).default([]),roleNames:z.array(z.string().trim().max(100)).max(20).default([]),messageTemplate:z.string().trim().min(1).max(1800).default(defaultTemplate),deleteExpiredAlert:z.boolean().default(true)});
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const output=(row:Record<string,unknown>)=>({id:row.id,guildId:row.guild_id,guildName:row.guild_name,alertChannelId:row.alert_channel_id,alertChannelName:row.alert_channel_name,everyoneEnabled:row.everyone_enabled!==false,roleIds:Array.isArray(row.mention_role_ids)?row.mention_role_ids:row.role_id?[String(row.role_id)]:[],roleNames:Array.isArray(row.mention_role_names)?row.mention_role_names:row.role_name?[String(row.role_name)]:[],messageTemplate:row.message_template||defaultTemplate,deleteExpiredAlert:row.delete_expired_alert!==false});

async function account(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();return {supabase,user}}

export async function GET(request:Request){
 try{const {supabase,user}=await account();if(!user)return json({error:'Sign in to manage personal live notifications.'},401);const guildId=new URL(request.url).searchParams.get('guildId');if(!guildId)return json({error:'Choose a Discord server first.'},400);const {data,error}=await supabase.from('discord_owner_live_settings').select('*').eq('user_id',user.id).eq('guild_id',guildId).order('created_at');if(error)throw error;return json({settings:(data||[]).map(output)})}catch{return json({error:'B.E.I.P.I. could not load your personal live notification.'},500)}
}

export async function PUT(request:Request){
 try{const {supabase,user}=await account();if(!user)return json({error:'Sign in to save personal live notifications.'},401);const parsed=schema.safeParse(await request.json());if(!parsed.success)return json({error:parsed.error.issues[0]?.message||'Check your notification settings.'},400);const value=parsed.data;const row={user_id:user.id,guild_id:value.guildId,guild_name:value.guildName,alert_channel_id:value.alertChannelId,alert_channel_name:value.alertChannelName,everyone_enabled:value.everyoneEnabled,mention_role_ids:value.roleIds,mention_role_names:value.roleNames,message_template:value.messageTemplate,delete_expired_alert:value.deleteExpiredAlert,updated_at:new Date().toISOString()};
 const table=supabase.from('discord_owner_live_settings');
 const query=value.id?table.update(row).eq('id',value.id).eq('user_id',user.id).eq('guild_id',value.guildId):table.insert(row);
 const {data,error}=await query.select('*').maybeSingle();
 if(!error&&!data)return json({error:'That personal notification was not found.'},404);if(error)throw error;return json({settings:output(data)})}catch(error){const code=typeof error==='object'&&error&&'code' in error?String(error.code):'';if(code==='23505')return json({error:'This server still allows only one personal notification. Apply the multiple personal notifications database migration.'},409);return json({error:code==='42P01'||code==='42703'?'Run the latest Supabase migration, then save again.':'B.E.I.P.I. could not save your personal live notification.'},500)}
}

export async function DELETE(request:Request){
 try{
  const {supabase,user}=await account();
  if(!user)return json({error:'Sign in to remove personal live notifications.'},401);
  const id=z.string().uuid().safeParse(new URL(request.url).searchParams.get('id'));
  if(!id.success)return json({error:'Choose a saved notification to remove.'},400);
  const {data,error}=await supabase.from('discord_owner_live_settings').delete().eq('id',id.data).eq('user_id',user.id).select('id').maybeSingle();
  if(error)throw error;
  if(!data)return json({error:'That personal notification was not found.'},404);
  return json({ok:true});
 }catch{return json({error:'B.E.I.P.I. could not remove that notification.'},500)}
}
