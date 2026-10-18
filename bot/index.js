import {ActivityType,Client,Events,GatewayIntentBits} from 'discord.js';
import {createClient} from '@supabase/supabase-js';

const discordToken=process.env.DISCORD_BOT_TOKEN||process.env.DISCORD_TOKEN;
const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
for(const name of required)if(!process.env[name])throw new Error(`${name} is required.`);
if(!discordToken)throw new Error('DISCORD_BOT_TOKEN or DISCORD_TOKEN is required.');

const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildPresences]});
const settings=new Map();const pendingOffline=new Map();const memberQueues=new Map();const activityCooldown=new Map();const activityCleanup=new Map();
const randomItems=['rubber duck','spatula','traffic cone','emotional-support potato','garden gnome','squeaky hammer','battle spoon','glittery cactus','enchanted teacup','questionable wizard hat'];
const randomAnimals=['platypus','capybara','penguin','red panda','axolotl','wombat','quokka','tiny goose','sleepy fox','chaotic raccoon'];
const randomDinosaurs=['tiny triceratops','pocket velociraptor','baby stegosaurus','sparkly brachiosaurus','sleepy ankylosaurus','dramatic T-Rex'];
const pick=list=>list[Math.floor(Math.random()*list.length)];
const ownerDefault='# {streamer} is now live!\n{streamer} is streaming {game} on {platform}.\nThey brought their trusty {random_companion}!\nCome and say hello\n{url}';
const creatorDefault='# {streamer} is now live!\nStreaming {game} on {platform}.\nCome and say hello\n{url}';

async function logActivity(guildId,eventType,severity,title,detail='',metadata={}){
 if(!guildId)return;
 const clean=value=>String(value||'').replace(/[\r\n]+/g,' ').trim();
 const payload={guild_id:guildId,event_type:clean(eventType).slice(0,80),severity:['info','warning','error'].includes(severity)?severity:'info',title:clean(title).slice(0,160),detail:clean(detail).slice(0,500),metadata,created_at:new Date().toISOString()};
 const cooldownKey=`${guildId}:${payload.event_type}:${payload.title}`,now=Date.now();
 if(now-(activityCooldown.get(cooldownKey)||0)<300000)return;
 activityCooldown.set(cooldownKey,now);
 const {error}=await supabase.from('discord_server_activity').insert(payload);
 if(error)console.error('[activity-log]',error.message);
 const lastCleanup=activityCleanup.get(guildId)||0;
 if(now-lastCleanup>3600000){activityCleanup.set(guildId,now);const cutoff=new Date(now-30*24*60*60*1000).toISOString();const {error:cleanupError}=await supabase.from('discord_server_activity').delete().eq('guild_id',guildId).lt('created_at',cutoff);if(cleanupError)console.error('[activity-cleanup]',cleanupError.message)}
}

async function syncGuild(guild,active=true){
 const payload={guild_id:guild.id,guild_name:guild.name,owner_discord_id:guild.ownerId,member_count:guild.memberCount||0,bot_active:active,last_seen_at:new Date().toISOString(),removed_at:active?null:new Date().toISOString()};
 const {error}=await supabase.from('discord_guild_registry').upsert(payload,{onConflict:'guild_id'});
 if(error)console.error('[guild-registry]',guild.name,error.message);
}

function isStreaming(presence){return Boolean(presence?.activities?.some(activity=>activity.type===ActivityType.Streaming));}
function streamActivity(presence){return presence?.activities?.find(activity=>activity.type===ActivityType.Streaming);}
function renderTemplate(template,member,activity){const item=pick(randomItems),animal=pick(randomAnimals),dinosaur=pick(randomDinosaurs),values={streamer:member.displayName,title:activity?.details||activity?.state||'A new adventure',game:activity?.state||activity?.details||'something exciting',platform:activity?.name||'their stream',url:activity?.url||'',server:member.guild.name,random_item:item,random_animal:animal,random_dinosaur:dinosaur,random_companion:pick([item,animal,dinosaur])};return (template||creatorDefault).replace(/\{([a-z_]+)\}/g,(match,key)=>values[key]??match).replace(/\n{3,}/g,'\n\n').trim().slice(0,1950)}

async function loadSettings(){
 const {data,error}=await supabase.from('discord_live_settings').select('*');
 if(error){console.error('[settings]',error.message);return}
 settings.clear();for(const row of data||[])settings.set(row.guild_id,row);
 console.log(`[settings] Loaded ${settings.size} configured server(s).`);
}

function serial(key,task){const previous=memberQueues.get(key)||Promise.resolve();const next=previous.catch(()=>{}).then(task).finally(()=>{if(memberQueues.get(key)===next)memberQueues.delete(key)});memberQueues.set(key,next);return next;}

async function goLive(member,presence,config){
 if(!member.roles.cache.has(config.creator_role_id)||member.roles.cache.has(config.live_role_id))return;
 const role=member.guild.roles.cache.get(config.live_role_id);if(!role?.editable){console.warn(`[roles] Cannot manage ${config.live_role_name} in ${member.guild.name}.`);await logActivity(member.guild.id,'role_error','warning','Could not add the live role',`B.E.I.P.I. cannot manage ${config.live_role_name||'the configured live role'}.`,{roleId:config.live_role_id});return}
 try{
  await member.roles.add(role,'B.E.I.P.I. detected Discord Streaming activity');
  const isOwner=member.id===member.guild.ownerId;const channelId=isOwner&&config.owner_alert_channel_id?config.owner_alert_channel_id:config.alert_channel_id;const channel=member.guild.channels.cache.get(channelId);let message=null;const activity=streamActivity(presence);
  const template=isOwner?(config.owner_message_template||ownerDefault):(config.creator_message_template||creatorDefault);const rendered=renderTemplate(template,member,activity);const content=isOwner&&config.owner_everyone_enabled?`@everyone\n${rendered}`:rendered;
  if(channel?.isTextBased())message=await channel.send({content,allowedMentions:{parse:isOwner&&config.owner_everyone_enabled?['everyone']:[]}});
  else await logActivity(member.guild.id,'alert_error','warning','Live alert channel is unavailable','The configured alert channel could not be found or is not a text channel.',{channelId});
  const {error}=await supabase.from('discord_live_events').upsert({guild_id:member.guild.id,member_id:member.id,message_id:message?.id||null,channel_id:channel?.id||config.alert_channel_id,started_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'guild_id,member_id'});
  if(error)console.error('[live-event]',error.message);
  await logActivity(member.guild.id,'live_started','info','Streamer detected live',`${member.displayName} started streaming on ${activity?.name||'a connected platform'}.`,{memberId:member.id,channelId:channel?.id||channelId,messageSent:Boolean(message)});
  console.log(`[live] ${member.user.tag} in ${member.guild.name}`);
 }catch(error){console.error('[live]',error);await logActivity(member.guild.id,'alert_error','error','Live notification failed',error instanceof Error?error.message:'Discord rejected the live notification.',{memberId:member.id})}
}

async function finishLive(member,config){
 try{
  const fresh=await member.guild.members.fetch(member.id).catch(()=>member);if(isStreaming(fresh.presence))return;
  const role=member.guild.roles.cache.get(config.live_role_id);if(role?.editable&&fresh.roles.cache.has(role.id))await fresh.roles.remove(role,'B.E.I.P.I. detected the stream ended');
  const {data}=await supabase.from('discord_live_events').select('message_id,channel_id').eq('guild_id',member.guild.id).eq('member_id',member.id).maybeSingle();
  if(config.delete_expired_alert&&data?.message_id&&data.channel_id){const channel=member.guild.channels.cache.get(data.channel_id);if(channel?.isTextBased()){const message=await channel.messages.fetch(data.message_id).catch(()=>null);if(message)await message.delete().catch(()=>{})}}
  await supabase.from('discord_live_events').delete().eq('guild_id',member.guild.id).eq('member_id',member.id);
  await logActivity(member.guild.id,'live_ended','info','Stream ended',`${member.displayName} is no longer detected as streaming.`,{memberId:member.id,expiredAlertRemoved:Boolean(config.delete_expired_alert)});
  console.log(`[offline] ${member.user.tag} in ${member.guild.name}`);
 }catch(error){console.error('[offline]',error);await logActivity(member.guild.id,'role_error','error','Could not finish the live session',error instanceof Error?error.message:'The live role or alert could not be cleaned up.',{memberId:member.id})}
}

async function reconcileAll(){
 for(const config of settings.values()){
  if(!config.discord_presence_enabled)continue;
  const guild=client.guilds.cache.get(config.guild_id);if(!guild)continue;
  const members=guild.members.cache;
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

client.once(Events.ClientReady,async ready=>{console.log(`[ready] ${ready.user.tag} is online.`);await Promise.all([...ready.guilds.cache.values()].map(async guild=>{await syncGuild(guild);await logActivity(guild.id,'bot_online','info','B.E.I.P.I. came online','The Discord worker connected successfully.') }));await loadSettings();await reconcileAll();setInterval(()=>void loadSettings(),60000).unref();setInterval(()=>void reconcileAll(),30000).unref();setInterval(()=>void Promise.all([...client.guilds.cache.values()].map(guild=>syncGuild(guild))),300000).unref()});
client.on(Events.GuildCreate,guild=>void (async()=>{await syncGuild(guild);await logActivity(guild.id,'bot_joined','info','B.E.I.P.I. joined the server','The bot installation was registered.')})());
client.on(Events.GuildDelete,guild=>void (async()=>{await logActivity(guild.id,'bot_removed','warning','B.E.I.P.I. left the server','The bot is no longer installed.');await syncGuild(guild,false)})());
client.on(Events.Error,error=>console.error('[discord]',error));
process.on('unhandledRejection',error=>console.error('[unhandled]',error));
await client.login(discordToken);
