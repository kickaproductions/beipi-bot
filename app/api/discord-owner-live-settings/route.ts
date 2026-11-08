import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';

const defaultTemplate='# {streamer} is now live!\n{streamer} is streaming {game} on {platform}.\nThey brought their trusty {random_companion}!\nCome and say hello\n{url}';
const schema=z.object({guildId:z.string().min(1).max(30),guildName:z.string().trim().min(1).max(100),alertChannelId:z.string().min(1).max(30),alertChannelName:z.string().trim().min(1).max(100),everyoneEnabled:z.boolean().default(true),roleId:z.string().max(30).default(''),roleName:z.string().trim().max(100).default(''),messageTemplate:z.string().trim().min(1).max(1800).default(defaultTemplate)});
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const output=(row:Record<string,unknown>)=>({guildId:row.guild_id,guildName:row.guild_name,alertChannelId:row.alert_channel_id,alertChannelName:row.alert_channel_name,everyoneEnabled:row.everyone_enabled!==false,roleId:row.role_id||'',roleName:row.role_name||'',messageTemplate:row.message_template||defaultTemplate,deleteExpiredAlert:row.delete_expired_alert!==false});

async function account(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();return {supabase,user}}

export async function GET(request:Request){
 try{const {supabase,user}=await account();if(!user)return json({error:'Sign in to manage personal live notifications.'},401);const guildId=new URL(request.url).searchParams.get('guildId');if(!guildId)return json({error:'Choose a Discord server first.'},400);const {data,error}=await supabase.from('discord_owner_live_settings').select('*').eq('user_id',user.id).eq('guild_id',guildId).maybeSingle();if(error)throw error;return json({settings:data?output(data):null})}catch{return json({error:'B.E.I.P.I. could not load your personal live notification.'},500)}
}

export async function PUT(request:Request){
 try{const {supabase,user}=await account();if(!user)return json({error:'Sign in to save personal live notifications.'},401);const parsed=schema.safeParse(await request.json());if(!parsed.success)return json({error:parsed.error.issues[0]?.message||'Check your notification settings.'},400);const value=parsed.data;const {data,error}=await supabase.from('discord_owner_live_settings').upsert({user_id:user.id,guild_id:value.guildId,guild_name:value.guildName,alert_channel_id:value.alertChannelId,alert_channel_name:value.alertChannelName,everyone_enabled:value.everyoneEnabled,role_id:value.roleId||null,role_name:value.roleName||null,message_template:value.messageTemplate,updated_at:new Date().toISOString()},{onConflict:'user_id,guild_id'}).select('*').single();if(error)throw error;return json({settings:output(data)})}catch(error){const code=typeof error==='object'&&error&&'code' in error?String(error.code):'';return json({error:code==='42P01'?'Run the latest Supabase migration, then save again.':'B.E.I.P.I. could not save your personal live notification.'},500)}
}
