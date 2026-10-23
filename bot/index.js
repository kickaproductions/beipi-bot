import {ActionRowBuilder,ActivityType,ButtonBuilder,ButtonStyle,Client,Events,GatewayIntentBits,Partials,Routes} from 'discord.js';
import {createClient} from '@supabase/supabase-js';

const discordToken=process.env.DISCORD_BOT_TOKEN||process.env.DISCORD_TOKEN;
const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
for(const name of required)if(!process.env[name])throw new Error(`${name} is required.`);
if(!discordToken)throw new Error('DISCORD_BOT_TOKEN or DISCORD_TOKEN is required.');

const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildPresences,GatewayIntentBits.GuildMessages,GatewayIntentBits.GuildMessageReactions,GatewayIntentBits.DirectMessages],partials:[Partials.Message,Partials.Channel,Partials.Reaction]});
const settings=new Map();const pendingOffline=new Map();const memberQueues=new Map();const activityCooldown=new Map();const activityCleanup=new Map();let confirmationPollRunning=false;
const randomItems=['rubber duck','spatula','traffic cone','emotional-support potato','garden gnome','squeaky hammer','battle spoon','glittery cactus','enchanted teacup','questionable wizard hat'];
const randomAnimals=['platypus','capybara','penguin','red panda','axolotl','wombat','quokka','tiny goose','sleepy fox','chaotic raccoon'];
const randomDinosaurs=['tiny triceratops','pocket velociraptor','baby stegosaurus','sparkly brachiosaurus','sleepy ankylosaurus','dramatic T-Rex'];
const pick=list=>list[Math.floor(Math.random()*list.length)];
const ownerDefault='# {streamer} is now live!\n{streamer} is streaming {game} on {platform}.\nThey brought their trusty {random_companion}!\nCome and say hello\n{url}';
const creatorDefault='# {streamer} is now live!\nStreaming {game} on {platform}.\nCome and say hello\n{url}';

const discordTimestamp=value=>Math.floor(new Date(value).getTime()/1000);
const streamDetails=note=>{try{const value=JSON.parse(note);if(value?.v===1)return {platform:String(value.platform||'stream'),game:String(value.game||''),username:String(value.username||'')}}catch{}return {platform:note||'stream',game:'',username:''}};
const streamDestination=details=>details.username?`${details.platform} (@${details.username.replace(/^@/,'')})`:details.platform;
const defaultConfirmationMessage='# Stream in 1 hour!\n\n{username} is streaming {game}, see you soon!\n\n{embed}\n\n@{role}';
const defaultCancellationMessage='# Stream Cancelled\n\n{username} has cancelled their stream.';
function streamLinks(details){
 if(details.platform==='Twitch'&&details.username)return `https://twitch.tv/${details.username.replace(/^@/,'')}`;
 if(details.platform==='YouTube'&&details.username){const name=details.username.replace(/^@/,'');return `https://youtube.com/@${name}`}
 if(details.platform==='Multi-platform')return [...details.username.matchAll(/(Twitch|YouTube)\s+@([^·\s]+)/g)].map(([,platform,name])=>platform==='Twitch'?`https://twitch.tv/${name}`:`https://youtube.com/@${name}`).join('\n');
 return '';
}
function renderConfirmationMessage(template,stream,details,config){
 const username=details.platform==='Multi-platform'?details.username:`@${details.username.replace(/^@/,'')}`;
 const roleMention=config.role_id?`<@&${config.role_id}>`:`@${config.role_name||'streamers'}`;
 const values={username:username||'Your streamer',game:details.game||stream.title,title:stream.title,platform:details.platform,embed:streamLinks(details)||streamDestination(details)};
 return (template||defaultConfirmationMessage).replaceAll('@{role}',roleMention).replaceAll('{role}',config.role_name||'streamers').replace(/\{(username|game|title|platform|embed)\}/g,(_,key)=>values[key]||'').trim().slice(0,1950);
}
const confirmationButtons=streamId=>new ActionRowBuilder().addComponents(
 new ButtonBuilder().setCustomId(`stream-confirm:${streamId}:yes`).setLabel('Yes, I’m streaming').setStyle(ButtonStyle.Success),
 new ButtonBuilder().setCustomId(`stream-confirm:${streamId}:no`).setLabel('No, cancel it').setStyle(ButtonStyle.Secondary)
);

async function processStreamConfirmations(){
 if(confirmationPollRunning)return;confirmationPollRunning=true;
 try{
  const {data:confirmationSettings,error:settingsError}=await supabase.from('stream_confirmation_settings').select('*').eq('enabled',true);
  if(settingsError){if(settingsError.code!=='42P01')console.error('[stream-confirmations]',settingsError.message);return}
  if(!confirmationSettings?.length)return;
  const userIds=confirmationSettings.map(row=>row.user_id),now=new Date(),cutoff=new Date(now.getTime()+60*60*1000);
  const [{data:connections,error:connectionsError},{data:streams,error:streamsError}]=await Promise.all([
   supabase.from('platform_connections').select('user_id,external_user_id,display_name').eq('platform','discord').in('user_id',userIds),
   supabase.from('companion_items').select('id,user_id,title,note,due').eq('kind','crew-stream').eq('done',false).in('user_id',userIds).gt('due',now.toISOString()).lte('due',cutoff.toISOString())
  ]);
  if(connectionsError||streamsError){console.error('[stream-confirmations]',connectionsError?.message||streamsError?.message);return}
  if(!streams?.length)return;
  const {data:existing,error:runsError}=await supabase.from('stream_confirmation_runs').select('stream_id').in('stream_id',streams.map(row=>row.id));
  if(runsError){console.error('[stream-confirmations]',runsError.message);return}
  const sent=new Set((existing||[]).map(row=>row.stream_id)),connectionByUser=new Map((connections||[]).map(row=>[row.user_id,row]));
  for(const stream of streams){
   if(sent.has(stream.id))continue;
   const config=confirmationSettings.find(row=>row.user_id===stream.user_id),connection=connectionByUser.get(stream.user_id);
   if(!config||!connection?.external_user_id)continue;
   const guild=client.guilds.cache.get(config.guild_id);
   if(!guild){await logActivity(config.guild_id,'stream_confirmation_error','warning','Confirmation server unavailable','B.E.I.P.I. is not connected to the selected Discord server.',{streamId:stream.id});continue}
   const {error:claimError}=await supabase.from('stream_confirmation_runs').insert({stream_id:stream.id,user_id:stream.user_id,discord_user_id:connection.external_user_id,status:'claiming'});
   if(claimError){if(claimError.code!=='23505')console.error('[stream-confirmations]',claimError.message);continue}
   try{
    const user=await client.users.fetch(connection.external_user_id);
    const when=discordTimestamp(stream.due),details=streamDetails(stream.note),game=details.game?` playing **${details.game}**`:'',message=await user.send({content:`Hi ${connection.display_name||user.displayName}! Your **${stream.title}** stream${game} on ${streamDestination(details)} is scheduled for <t:${when}:F> (<t:${when}:R>).\n\nAre you still going live?`,components:[confirmationButtons(stream.id)]});
    await supabase.from('stream_confirmation_runs').update({status:'pending',dm_message_id:message.id,sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('stream_id',stream.id);
    console.log(`[stream-confirmation] Asked ${user.tag} about ${stream.title}.`);
   }catch(error){
    await supabase.from('stream_confirmation_runs').delete().eq('stream_id',stream.id);
    console.error('[stream-confirmation-dm]',error);
    await logActivity(config.guild_id,'stream_confirmation_error','warning','Stream confirmation DM failed',`B.E.I.P.I. could not message ${connection.display_name||'the streamer'}.`,{streamId:stream.id});
   }
  }
 }finally{confirmationPollRunning=false}
}

async function handleStreamConfirmation(interaction){
 if(!interaction.isButton()||!interaction.customId.startsWith('stream-confirm:'))return;
 const [,streamId,answer]=interaction.customId.split(':');if(!streamId||!['yes','no'].includes(answer))return;
 const {data:run,error:runError}=await supabase.from('stream_confirmation_runs').select('*').eq('stream_id',streamId).eq('discord_user_id',interaction.user.id).maybeSingle();
 if(runError||!run){await interaction.reply({content:'I could not match this confirmation to your schedule.',ephemeral:true}).catch(()=>{});return}
 if(run.status!=='pending'){await interaction.update({content:interaction.message.content+'\n\nThis stream has already been answered.',components:[]}).catch(()=>{});return}
 await interaction.deferUpdate().catch(()=>{});
 const status=answer==='yes'?'confirmed':'cancelled',respondedAt=new Date().toISOString();
 const {data:updated,error:updateError}=await supabase.from('stream_confirmation_runs').update({status:'claiming',updated_at:respondedAt}).eq('id',run.id).eq('status','pending').select('id').maybeSingle();
 if(updateError||!updated){await interaction.editReply({content:`${interaction.message.content}\n\nThat answer was already received.`,components:[]}).catch(()=>{});return}
 const [{data:stream},{data:config}]=await Promise.all([
  supabase.from('companion_items').select('title,note,due').eq('id',streamId).maybeSingle(),
  supabase.from('stream_confirmation_settings').select('*').eq('user_id',run.user_id).maybeSingle()
 ]);
 if(!stream||!config){await supabase.from('stream_confirmation_runs').update({status:'pending',updated_at:new Date().toISOString()}).eq('id',run.id);await interaction.editReply({content:`${interaction.message.content}\n\n**I saved your click, but I could not find the schedule settings. Please try again.**`,components:[confirmationButtons(streamId)]}).catch(()=>{});return}
 const name=interaction.user.globalName||interaction.user.username,when=discordTimestamp(stream.due),details=streamDetails(stream.note);
 const content=status==='confirmed'
  ?renderConfirmationMessage(config.message_template,stream,details,config)
  :renderConfirmationMessage(config.cancel_message_template||defaultCancellationMessage,stream,details,config);
 try{
  const message=await client.rest.post(Routes.channelMessages(config.channel_id),{body:{content,allowed_mentions:{parse:[],roles:config.role_id?[config.role_id]:[]}}});
  if(!message?.id)throw new Error('Discord did not return a message ID.');
  await supabase.from('stream_confirmation_runs').update({status,responded_at:respondedAt,announcement_message_id:message.id,updated_at:new Date().toISOString()}).eq('id',run.id);
  const resultText=status==='confirmed'?'Perfect — you’re confirmed. I’ve let the server know.':'Got it — I’ve marked this stream as cancelled and let the server know.';
  await interaction.editReply({content:`${interaction.message.content}\n\n**${resultText}**`,components:[]}).catch(()=>{});
  await logActivity(config.guild_id,status==='confirmed'?'stream_confirmed':'stream_cancelled','info',status==='confirmed'?'Scheduled stream confirmed':'Scheduled stream cancelled',`${name}: ${stream.title}`,{streamId,channelId:config.channel_id});
 }catch(error){
  await supabase.from('stream_confirmation_runs').update({status:'pending',updated_at:new Date().toISOString()}).eq('id',run.id);
  const code=Number(error?.code||error?.rawError?.code||0),detail=error?.rawError?.message||error?.message||'Discord rejected the message.';
  const help=code===50013
   ?'Discord reports Missing Permissions. Open the channel settings, add the B.E.I.P.I. Bot role directly, and allow View Channel and Send Messages.'
   :code===50001
    ?'Discord reports Missing Access. B.E.I.P.I. cannot currently see this channel; check its channel-specific permission overrides.'
    :code===10003
     ?'Discord can no longer find this channel. Re-select the scheduling channel in My Crew → Confirmations.'
     :`Discord returned: ${String(detail).slice(0,180)}`;
  await interaction.editReply({content:`${interaction.message.content}\n\n**I couldn’t post in #${config.channel_name||'the selected channel'} yet. ${help} Then press your answer again.**`,components:[confirmationButtons(streamId)]}).catch(()=>{});
  console.error('[stream-confirmation-post]',error);
  await logActivity(config.guild_id,'stream_confirmation_error','error','Stream confirmation could not be posted',detail,{streamId,channelId:config.channel_id});
 }
}

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

const reactionKey=reaction=>reaction.emoji.id?`${reaction.emoji.name}:${reaction.emoji.id}`:reaction.emoji.name;
async function handleReaction(reaction,user,adding){
 if(user.bot)return;
 try{
  if(reaction.partial)await reaction.fetch();
  const guild=reaction.message.guild;if(!guild)return;
  const {data:item,error}=await supabase.from('discord_reaction_role_items').select('role_id,role_name,discord_reaction_menus!inner(message_id,remove_on_unreact,active)').eq('emoji',reactionKey(reaction)).eq('discord_reaction_menus.message_id',reaction.message.id).eq('discord_reaction_menus.active',true).maybeSingle();
  if(error){console.error('[reaction-role]',error.message);return}if(!item)return;
  const menu=Array.isArray(item.discord_reaction_menus)?item.discord_reaction_menus[0]:item.discord_reaction_menus;if(!adding&&!menu?.remove_on_unreact)return;
  const member=await guild.members.fetch(user.id);const role=guild.roles.cache.get(item.role_id);
  if(!role?.editable){await logActivity(guild.id,'reaction_role_error','warning','Reaction role could not be managed',`B.E.I.P.I. cannot manage ${item.role_name||'the selected role'}.`,{roleId:item.role_id,messageId:reaction.message.id});return}
  if(adding)await member.roles.add(role,'B.E.I.P.I. reaction role');else await member.roles.remove(role,'B.E.I.P.I. reaction removed');
 }catch(error){console.error('[reaction-role]',error);const guildId=reaction.message.guildId;if(guildId)await logActivity(guildId,'reaction_role_error','error','Reaction role update failed',error instanceof Error?error.message:'Discord rejected the role update.',{messageId:reaction.message.id})}
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
client.on(Events.MessageReactionAdd,(reaction,user)=>void handleReaction(reaction,user,true));
client.on(Events.MessageReactionRemove,(reaction,user)=>void handleReaction(reaction,user,false));
client.on(Events.InteractionCreate,interaction=>void handleStreamConfirmation(interaction));

client.once(Events.ClientReady,async ready=>{console.log(`[ready] ${ready.user.tag} is online.`);await Promise.all([...ready.guilds.cache.values()].map(async guild=>{await syncGuild(guild);await logActivity(guild.id,'bot_online','info','B.E.I.P.I. came online','The Discord worker connected successfully.') }));await loadSettings();await reconcileAll();await processStreamConfirmations();setInterval(()=>void loadSettings(),60000).unref();setInterval(()=>void processStreamConfirmations(),60000).unref();setInterval(()=>void reconcileAll(),30000).unref();setInterval(()=>void Promise.all([...client.guilds.cache.values()].map(guild=>syncGuild(guild))),300000).unref()});
client.on(Events.GuildCreate,guild=>void (async()=>{await syncGuild(guild);await logActivity(guild.id,'bot_joined','info','B.E.I.P.I. joined the server','The bot installation was registered.')})());
client.on(Events.GuildDelete,guild=>void (async()=>{await logActivity(guild.id,'bot_removed','warning','B.E.I.P.I. left the server','The bot is no longer installed.');await syncGuild(guild,false)})());
client.on(Events.Error,error=>console.error('[discord]',error));
process.on('unhandledRejection',error=>console.error('[unhandled]',error));
await client.login(discordToken);
