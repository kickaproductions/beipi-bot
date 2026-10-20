import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';

const schema=z.object({
  enabled:z.boolean(),
  guildId:z.string().max(30).default(''),
  channelId:z.string().max(30).default('')
});
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

async function account(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  return {supabase,user};
}

async function destinations(supabase:Awaited<ReturnType<typeof createClient>>,userId:string){
  const {data,error}=await supabase.from('discord_live_settings').select('guild_id,guild_name,alert_channel_id,alert_channel_name,owner_alert_channel_id,owner_alert_channel_name').eq('user_id',userId);
  if(error)throw error;
  return (data||[]).map(row=>({
    guildId:row.guild_id,
    guildName:row.guild_name,
    channelId:row.owner_alert_channel_id||row.alert_channel_id,
    channelName:row.owner_alert_channel_name||row.alert_channel_name
  }));
}

export async function GET(){
  try{
    const {supabase,user}=await account();
    if(!user)return json({error:'Sign in to manage stream confirmations.'},401);
    const [available,{data:settings,error:settingsError},{data:runs,error:runsError},{data:discord,error:discordError}]=await Promise.all([
      destinations(supabase,user.id),
      supabase.from('stream_confirmation_settings').select('*').eq('user_id',user.id).maybeSingle(),
      supabase.from('stream_confirmation_runs').select('stream_id,status,sent_at,responded_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50),
      supabase.from('platform_connections').select('external_user_id').eq('user_id',user.id).eq('platform','discord').maybeSingle()
    ]);
    if(settingsError||runsError||discordError)throw settingsError||runsError||discordError;
    return json({
      connectedDiscord:Boolean(discord?.external_user_id),
      destinations:available,
      settings:settings?{enabled:settings.enabled,guildId:settings.guild_id||'',guildName:settings.guild_name||'',channelId:settings.channel_id||'',channelName:settings.channel_name||''}:null,
      statuses:Object.fromEntries((runs||[]).map(run=>[run.stream_id,{status:run.status,sentAt:run.sent_at,respondedAt:run.responded_at}]))
    });
  }catch{return json({error:'B.E.I.P.I. could not load stream confirmations. Run the latest Supabase migration if this is your first visit.'},500)}
}

export async function PUT(request:Request){
  try{
    const {supabase,user}=await account();
    if(!user)return json({error:'Sign in to manage stream confirmations.'},401);
    const parsed=schema.safeParse(await request.json());
    if(!parsed.success)return json({error:'Check the confirmation settings and try again.'},400);
    const value=parsed.data,available=await destinations(supabase,user.id);
    const selected=available.find(item=>item.guildId===value.guildId&&item.channelId===value.channelId);
    if(value.enabled&&!selected)return json({error:'Choose a channel already configured in Discord Setup.'},400);
    const {data:discord}=await supabase.from('platform_connections').select('external_user_id').eq('user_id',user.id).eq('platform','discord').maybeSingle();
    if(value.enabled&&!discord?.external_user_id)return json({error:'Connect Discord before turning on stream confirmations.'},400);
    const {data,error}=await supabase.from('stream_confirmation_settings').upsert({
      user_id:user.id,
      enabled:value.enabled,
      guild_id:selected?.guildId||null,
      guild_name:selected?.guildName||null,
      channel_id:selected?.channelId||null,
      channel_name:selected?.channelName||null,
      lead_minutes:60,
      updated_at:new Date().toISOString()
    },{onConflict:'user_id'}).select('*').single();
    if(error)throw error;
    return json({settings:{enabled:data.enabled,guildId:data.guild_id||'',guildName:data.guild_name||'',channelId:data.channel_id||'',channelName:data.channel_name||''}});
  }catch{return json({error:'B.E.I.P.I. could not save stream confirmations.'},500)}
}
