import {ActivityType,Client,Events,GatewayIntentBits} from 'discord.js';
import {createClient} from '@supabase/supabase-js';

const discordToken=process.env.DISCORD_BOT_TOKEN||process.env.DISCORD_TOKEN;
const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
for(const name of required)if(!process.env[name])throw new Error(`${name} is required.`);
if(!discordToken)throw new Error('DISCORD_BOT_TOKEN or DISCORD_TOKEN is required.');

const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildPresences]});
const settings=new Map();const pendingOffline=new Map();const memberQueues=new Map();

function isStreaming(presence){return Boolean(presence?.activities?.some(activity=>activity.type===ActivityType.Streaming));}
function streamActivity(presence){return presence?.activities?.find(activity=>activity.type===ActivityType.Streaming);}

async function loadSettings(){
 const {data,error}=await supabase.from('discord_live_settings').select('*');
 if(error){console.error('[settings]',error.message);return}
 settings.clear();for(const row of data||[])settings.set(row.guild_id,row);
 console.log(`[settings] Loaded ${settings.size} configured server(s).`);
}

function serial(key,task){const previous=memberQueues.get(key)||Promise.resolve();const next=previous.catch(()=>{}).then(task).finally(()=>{if(memberQueues.get(key)===next)memberQueues.delete(key)});memberQueues.set(key,next);return next;}

async function goLive(member,presence,config){
 if(!member.roles.cache.has(config.creator_role_id)||member.roles.cache.has(config.live_role_id))return;
 const role=member.guild.roles.cache.get(config.live_role_id);if(!role?.editable){console.warn(`[roles] Cannot manage ${config.live_role_name} in ${member.guild.name}.`);return}
 await member.roles.add(role,'B.E.I.P.I. detected Discord Streaming activity');
 const channel=member.guild.channels.cache.get(config.alert_channel_id);let message=null;const activity=streamActivity(presence);
 if(channel?.isTextBased())message=await channel.send({content:`# ${member.displayName} is now live!\nCome and say hello${activity?.url?`\n${activity.url}`:' 💜'}`,allowedMentions:{parse:[]}});
 const {error}=await supabase.from('discord_live_events').upsert({guild_id:member.guild.id,member_id:member.id,message_id:message?.id||null,channel_id:channel?.id||config.alert_channel_id,started_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'guild_id,member_id'});
 if(error)console.error('[live-event]',error.message);console.log(`[live] ${member.user.tag} in ${member.guild.name}`);
}

async function finishLive(member,config){
 const fresh=await member.guild.members.fetch(member.id).catch(()=>member);if(isStreaming(fresh.presence))return;
 const role=member.guild.roles.cache.get(config.live_role_id);if(role?.editable&&fresh.roles.cache.has(role.id))await fresh.roles.remove(role,'B.E.I.P.I. detected the stream ended');
 const {data}=await supabase.from('discord_live_events').select('message_id,channel_id').eq('guild_id',member.guild.id).eq('member_id',member.id).maybeSingle();
 if(config.delete_expired_alert&&data?.message_id&&data.channel_id){const channel=member.guild.channels.cache.get(data.channel_id);if(channel?.isTextBased()){const message=await channel.messages.fetch(data.message_id).catch(()=>null);if(message)await message.delete().catch(()=>{})}}
 await supabase.from('discord_live_events').delete().eq('guild_id',member.guild.id).eq('member_id',member.id);console.log(`[offline] ${member.user.tag} in ${member.guild.name}`);
}

async function reconcileAll(){
 for(const config of settings.values()){
  if(!config.discord_presence_enabled)continue;
  const guild=client.guilds.cache.get(config.guild_id);if(!guild)continue;
  const members=await guild.members.fetch().catch(error=>{console.error(`[members] ${guild.name}:`,error.message);return null});if(!members)continue;
  for(const member of members.values()){
   if(member.user.bot||!member.roles.cache.has(config.creator_role_id))continue;
   const key=`${guild.id}:${member.id}`;
   if(isStreaming(member.presence)){const timer=pendingOffline.get(key);if(timer){clearTimeout(timer);pendingOffline.delete(key)}void serial(key,()=>goLive(member,member.presence,config))}
   else if(member.roles.cache.has(config.live_role_id)&&!pendingOffline.has(key)){const timer=setTimeout(()=>{pendingOffline.delete(key);void serial(key,()=>finishLive(member,config))},120000);pendingOffline.set(key,timer)}
  }
 }
}

client.on(Events.PresenceUpdate,(oldPresence,newPresence)=>{
 const config=settings.get(newPresence.guild.id);if(!config?.discord_presence_enabled)return;
 const member=newPresence.member;if(!member||!member.roles.cache.has(config.creator_role_id))return;
 const key=`${newPresence.guild.id}:${member.id}`;const streaming=isStreaming(newPresence),wasStreaming=isStreaming(oldPresence);
 if(streaming){const timer=pendingOffline.get(key);if(timer){clearTimeout(timer);pendingOffline.delete(key)}if(!wasStreaming)void serial(key,()=>goLive(member,newPresence,config));return}
 if(wasStreaming){const timer=setTimeout(()=>{pendingOffline.delete(key);void serial(key,()=>finishLive(member,config))},120000);pendingOffline.set(key,timer)}
});

client.once(Events.ClientReady,async ready=>{console.log(`[ready] ${ready.user.tag} is online.`);await loadSettings();await reconcileAll();setInterval(()=>void loadSettings(),60000).unref();setInterval(()=>void reconcileAll(),30000).unref()});
client.on(Events.Error,error=>console.error('[discord]',error));
process.on('unhandledRejection',error=>console.error('[unhandled]',error));
await client.login(discordToken);
