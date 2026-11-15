import {ActionRowBuilder,ActivityType,ButtonBuilder,ButtonStyle,Client,Events,GatewayIntentBits,Partials,PermissionFlagsBits,Routes} from 'discord.js';
import {createClient} from '@supabase/supabase-js';
import {createHmac} from 'node:crypto';

const discordToken=process.env.DISCORD_BOT_TOKEN||process.env.DISCORD_TOKEN;
const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
for(const name of required)if(!process.env[name])throw new Error(`${name} is required.`);
if(!discordToken)throw new Error('DISCORD_BOT_TOKEN or DISCORD_TOKEN is required.');

const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildPresences,GatewayIntentBits.GuildMessages,GatewayIntentBits.GuildMessageReactions,GatewayIntentBits.DirectMessages],partials:[Partials.Message,Partials.Channel,Partials.Reaction]});
const settings=new Map();const ownerSettings=new Map();const pendingOffline=new Map();const memberQueues=new Map();const activityCooldown=new Map();const activityCleanup=new Map();let confirmationPollRunning=false;let liveCleanupRunning=false;
const twitchByMember=new Map();
const twitchStreams=new Map();
const missingTwitchMembers=new Map();
const randomItems=['rubber duck','spatula','traffic cone','emotional-support potato','garden gnome','squeaky hammer','battle spoon','glittery cactus','enchanted teacup','questionable wizard hat'];
const randomAnimals=['platypus','capybara','penguin','red panda','axolotl','wombat','quokka','tiny goose','sleepy fox','chaotic raccoon'];
const randomDinosaurs=['tiny triceratops','pocket velociraptor','baby stegosaurus','sparkly brachiosaurus','sleepy ankylosaurus','dramatic T-Rex'];
const pick=list=>list[Math.floor(Math.random()*list.length)];
const ownerDefault='# {streamer} is now live!\n{streamer} is streaming {game} on {platform}.\nThey brought their trusty {random_companion}!\nCome and say hello\n{url}';
const creatorDefault='# {streamer} is now live!\nStreaming {game} on {platform}.\nCome and say hello\n{url}';

const discordTimestamp=value=>Math.floor(new Date(value).getTime()/1000);
const streamDetails=note=>{try{const value=JSON.parse(note);if(value?.v===1)return {platform:String(value.platform||'stream'),game:String(value.game||''),username:String(value.username||''),discordReminder:value.discordReminder!==false}}catch{}return {platform:note||'stream',game:'',username:'',discordReminder:true}};
const streamDestination=details=>details.username?`${details.platform} (@${details.username.replace(/^@/,'')})`:details.platform;
const defaultConfirmationMessage='# Stream in {lead_time}!\n\n{username} is streaming {game}, see you soon!\n\n{embed}\n\n@{role}';
const defaultCancellationMessage='# Stream Cancelled\n\n{username} has cancelled their stream.\n\nTheir next stream is on: {date and time}';
function streamLinks(details){
 if(details.platform==='Twitch'&&details.username)return `https://twitch.tv/${details.username.replace(/^@/,'')}`;
 if(details.platform==='YouTube'&&details.username){const name=details.username.replace(/^@/,'');return `https://youtube.com/@${name}`}
 if(details.platform==='Multi-platform')return [...details.username.matchAll(/(Twitch|YouTube)\s+@([^·\s]+)/g)].map(([,platform,name])=>platform==='Twitch'?`https://twitch.tv/${name}`:`https://youtube.com/@${name}`).join('\n');
 return '';
}
function renderConfirmationMessage(template,stream,details,config,nextStream=null){
 const username=details.platform==='Multi-platform'?details.username:`@${details.username.replace(/^@/,'')}`;
 const roleMention=config.role_id?`<@&${config.role_id}>`:`@${config.role_name||'streamers'}`;
 const leadMinutes=[15,30,60].includes(Number(config.lead_minutes))?Number(config.lead_minutes):60;
 const values={username:username||'Your streamer',game:details.game||stream.title,title:stream.title,platform:details.platform,embed:streamLinks(details)||streamDestination(details),lead_time:leadMinutes===60?'1 hour':`${leadMinutes} minutes`,'date and time':nextStream?`<t:${discordTimestamp(nextStream.due)}:F>`:'',next_stream:nextStream?`<t:${discordTimestamp(nextStream.due)}:F>`:''};
 let source=template||defaultConfirmationMessage;
 if(!nextStream)source=source.split('\n').filter(line=>!line.includes('{date and time}')&&!line.includes('{next_stream}')).join('\n').replace(/\n{3,}/g,'\n\n');
 return source.replaceAll('@{role}',config.role_id?roleMention:'').replaceAll('{role}',config.role_name||'').replace(/\{(username|game|title|platform|embed|lead_time|date and time|next_stream)\}/g,(_,key)=>values[key]||'').replace(/\n{3,}/g,'\n\n').trim().slice(0,1950);
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
  const today=new Date().toISOString().slice(0,10);
  const activeSettings=(confirmationSettings||[]).filter(row=>!row.holiday_mode||!row.holiday_start||!row.holiday_end||today<row.holiday_start||today>row.holiday_end);if(!activeSettings.length)return;
  const userIds=activeSettings.map(row=>row.user_id),now=new Date(),cutoff=new Date(now.getTime()+60*60*1000);
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
   if(streamDetails(stream.note).discordReminder===false)continue;
   const config=activeSettings.find(row=>row.user_id===stream.user_id),connection=connectionByUser.get(stream.user_id);
   if(!config||!connection?.external_user_id)continue;
   const leadMinutes=[15,30,60].includes(Number(config.lead_minutes))?Number(config.lead_minutes):60;
   if(new Date(stream.due).getTime()>now.getTime()+leadMinutes*60*1000)continue;
   const guild=client.guilds.cache.get(config.guild_id);
   if(!guild){await logActivity(config.guild_id,'stream_confirmation_error','warning','Confirmation server unavailable','B.E.I.P.I. is not connected to the selected Discord server.',{streamId:stream.id});continue}
   const {error:claimError}=await supabase.from('stream_confirmation_runs').insert({stream_id:stream.id,user_id:stream.user_id,discord_user_id:connection.external_user_id,status:'claiming'});
   if(claimError){if(claimError.code!=='23505')console.error('[stream-confirmations]',claimError.message);continue}
   try{
    const user=await client.users.fetch(connection.external_user_id);
    const when=discordTimestamp(stream.due),details=streamDetails(stream.note),game=details.game?` playing **${details.game}**`:'',message=await user.send({content:`Hi ${connection.display_name||user.displayName}! Your **${stream.title}** stream${game} on ${streamDestination(details)} is scheduled for <t:${when}:F> (<t:${when}:R>).\n\nYour ${leadMinutes}-minute check-in is here. Are you still going live?`,components:[confirmationButtons(stream.id)]});
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
 const {data:nextStream}=await supabase.from('companion_items').select('title,due').eq('user_id',run.user_id).eq('kind','crew-stream').eq('done',false).gt('due',stream.due).order('due',{ascending:true}).limit(1).maybeSingle();
 const name=interaction.user.globalName||interaction.user.username,when=discordTimestamp(stream.due),details=streamDetails(stream.note);
 const content=status==='confirmed'
  ?renderConfirmationMessage(config.message_template,stream,details,config)
  :renderConfirmationMessage(config.cancel_message_template||defaultCancellationMessage,stream,details,config,nextStream);
 if(config.post_to_discord===false){await supabase.from('stream_confirmation_runs').update({status,responded_at:respondedAt,updated_at:new Date().toISOString()}).eq('id',run.id);const resultText=status==='confirmed'?'Perfect — you’re confirmed. I’ll keep this one private.':'Got it — I’ve marked this stream as cancelled and won’t post it in the server.';await interaction.editReply({content:`${interaction.message.content}\n\n**${resultText}**`,components:[]}).catch(()=>{});return}
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

function watchesTwitch(member){
 return ownerSettings.has(`${member.guild.id}:${member.id}`)||
  matchingCommunityRules(member,settings.get(member.guild.id),{discord:false}).length>0;
}

function twitchStatusFor(member){
 return twitchStreams.get(twitchByMember.get(member.id));
}

function discordStreamActivity(member,presence=member.presence){
 const discordActivity=presence?.activities?.find(activity=>activity.type===ActivityType.Streaming);
 const isTwitch=discordActivity&&(discordActivity.name?.toLowerCase()==='twitch'||/^https:\/\/(?:www\.)?twitch\.tv\//i.test(discordActivity.url||''));
 if(isTwitch&&watchesTwitch(member)&&twitchStatusFor(member)?.activity===null)return;
 return discordActivity;
}

function streamActivity(member,presence=member.presence){
 const status=twitchStatusFor(member);
 if(status?.activity&&Date.now()-status.checkedAt<=90_000&&watchesTwitch(member))return status.activity;
 return discordStreamActivity(member,presence);
}

function canFinishLive(member){
 const status=twitchStatusFor(member);
 // An unavailable or stale Twitch lookup is different from a confirmed offline stream.
 if(twitchByMember.has(member.id)&&watchesTwitch(member)&&(!status||Date.now()-status.checkedAt>90_000))return false;
 return !streamActivity(member);
}

async function pollTwitch(){
 const ids=[...new Set(twitchByMember.values())];
 const connected=new Set(ids);
 for(const id of twitchStreams.keys())if(!connected.has(id))twitchStreams.delete(id);
 for(let offset=0;offset<ids.length;offset+=100){
  const batch=ids.slice(offset,offset+100);
  const body=JSON.stringify(batch),timestamp=String(Date.now());
  const signature=createHmac('sha256',discordToken).update(`beipi-twitch-live-v1\n${timestamp}\n${body}`).digest('hex');
  try{
   const response=await fetch('https://beipi.app/api/internal/twitch-live',{
    method:'POST',headers:{'Content-Type':'application/json','X-Beipi-Timestamp':timestamp,'X-Beipi-Signature':signature},
    body,redirect:'error',signal:AbortSignal.timeout(12_000),
   });
   if(!response.ok)throw new Error(`Dashboard Twitch lookup returned ${response.status}`);
   const streams=await response.json();
   if(!Array.isArray(streams)||streams.some(stream=>!stream||stream.name!=='Twitch'||!batch.includes(stream.id)))throw new Error('Invalid Twitch status response');
   const liveById=new Map(streams.map(stream=>[stream.id,{...stream,twitchConfirmed:true}]));
   const checkedAt=Date.now();
   for(const id of batch)twitchStreams.set(id,{activity:liveById.get(id)??null,checkedAt});
  }catch(error){console.warn('[twitch-live]',error.message)}
 }
}
function renderTemplate(template,member,activity){const item=pick(randomItems),animal=pick(randomAnimals),dinosaur=pick(randomDinosaurs),values={streamer:member.displayName,title:activity?.details||activity?.state||'A new adventure',game:activity?.state||activity?.details||'something exciting',platform:activity?.name||'their stream',url:activity?.url||'',server:member.guild.name,random_item:item,random_animal:animal,random_dinosaur:dinosaur,random_companion:pick([item,animal,dinosaur])};return (template||creatorDefault).replace(/\{([a-z_]+)\}/g,(match,key)=>values[key]??match).replace(/\n{3,}/g,'\n\n').trim().slice(0,1950)}

async function readLiveRules(table){
 const rows=[];
 const pageSize=500;
 for(let offset=0;;offset+=pageSize){
  const {data,error}=await supabase.from(table).select('*').order('id').range(offset,offset+pageSize-1);
  if(error)throw error;
  rows.push(...data);
  if(data.length<pageSize)return rows;
 }
}

let settingsLoadRunning=false;
async function loadSettings(){
 if(settingsLoadRunning)return;
 settingsLoadRunning=true;
 try{
  const [communityRows,ownerRows]=await Promise.all([
   readLiveRules('discord_live_settings'),
   readLiveRules('discord_owner_live_settings').catch(error=>{
    if(error.code==='42P01')return [];
    throw error;
   }),
  ]);
  const discordByUser=new Map(),twitchByUser=new Map();
  const ruleUsers=new Set([...ownerRows,...communityRows].map(row=>row.user_id));
  const communityTwitchEnabled=communityRows.some(rule=>rule.platform_confirmation_enabled);
  if(communityTwitchEnabled){
   const pageSize=500;
   for(let offset=0;;offset+=pageSize){
    const {data,error}=await supabase.from('platform_connections').select('user_id,external_user_id')
     .eq('platform','twitch').order('id').range(offset,offset+pageSize-1);
    if(error)throw error;
    for(const row of data)twitchByUser.set(row.user_id,row.external_user_id);
    if(data.length<pageSize)break;
   }
  }
  const userIds=[...new Set([...ruleUsers,...twitchByUser.keys()])];
  for(let offset=0;offset<userIds.length;offset+=100){
   const {data,error}=await supabase.from('platform_connections').select('user_id,platform,external_user_id')
    .in('platform',communityTwitchEnabled?['discord']:['discord','twitch'])
    .in('user_id',userIds.slice(offset,offset+100));
   if(error)throw error;
   for(const connection of data){
    const connections=connection.platform==='twitch'?twitchByUser:discordByUser;
    connections.set(connection.user_id,connection.external_user_id);
   }
  }

  const verifiedAuthors=new Map();
  async function authorCanManage(row){
   const discordId=discordByUser.get(row.user_id);
   const guild=client.guilds.cache.get(row.guild_id);
   if(!discordId||!guild?.available)return false;
   const key=`${row.guild_id}:${discordId}`;
   if(!verifiedAuthors.has(key)){
    const member=guild.members.cache.get(discordId)||await guild.members.fetch(discordId).catch(()=>null);
    verifiedAuthors.set(key,Boolean(member?.permissions.has(PermissionFlagsBits.ManageGuild)));
   }
   return verifiedAuthors.get(key);
  }
  const nextSettings=new Map(),nextOwnerSettings=new Map();
  for(const row of communityRows){
   if(!await authorCanManage(row))continue;
   const rules=nextSettings.get(row.guild_id)||[];
   rules.push(row);
   nextSettings.set(row.guild_id,rules);
  }
  for(const row of ownerRows){
   if(!await authorCanManage(row))continue;
   const key=`${row.guild_id}:${discordByUser.get(row.user_id)}`,rules=nextOwnerSettings.get(key)||[];
   rules.push(row);
   nextOwnerSettings.set(key,rules);
  }
  settings.clear();
  for(const [key,rules] of nextSettings)settings.set(key,rules);
  ownerSettings.clear();
  for(const [key,rules] of nextOwnerSettings)ownerSettings.set(key,rules);
  twitchByMember.clear();
  for(const [userId,twitchId] of twitchByUser){
   const discordId=discordByUser.get(userId);
   if(discordId&&twitchId&&/^\d{1,20}$/.test(twitchId))twitchByMember.set(discordId,twitchId);
  }
  console.log(`[settings] Loaded community rules for ${settings.size} server(s) and personal rules for ${ownerSettings.size} member/server pair(s).`);
 }catch(error){console.error('[settings]',error.message)}
 finally{settingsLoadRunning=false}
}

function serial(key,task){const previous=memberQueues.get(key)||Promise.resolve();const next=previous.catch(()=>{}).then(task).finally(()=>{if(memberQueues.get(key)===next)memberQueues.delete(key)});memberQueues.set(key,next);return next;}

const matchingCommunityRules=(member,rules=[],{discord=true,twitch=true}={})=>rules.filter(rule=>
 ((discord&&rule.discord_presence_enabled)||(twitch&&rule.platform_confirmation_enabled))&&
 (!rule.creator_role_id||member.roles.cache.has(rule.creator_role_id)));

async function assignLiveRole(member,rule){
 if(!rule.live_role_id||member.roles.cache.has(rule.live_role_id))return;
 try{
  const role=member.guild.roles.cache.get(rule.live_role_id);
  if(!role?.editable)throw new Error('Check B.E.I.P.I.’s Manage Roles permission and role position.');
  await member.roles.add(role,'B.E.I.P.I. detected a live stream');
 }catch(error){
  console.warn('[roles]',error);
  await logActivity(member.guild.id,'role_error','warning','Could not add the live role',
   `B.E.I.P.I. could not assign ${rule.live_role_name||'the configured live role'}.`,{roleId:rule.live_role_id}).catch(console.error);
 }
}

async function postLiveTarget(member,activity,target,existingKeys){
 if(existingKeys.has(target.sourceKey))return false;

 const channel=member.guild.channels.cache.get(target.channelId)||
  await member.guild.channels.fetch(target.channelId).catch(()=>null);
 if(channel?.guildId!==member.guild.id||!channel?.isTextBased()||typeof channel.send!=='function'){
  await logActivity(member.guild.id,'alert_error','warning','Live alert channel is unavailable',
   'The configured alert channel could not be found or cannot receive messages.',{channelId:target.channelId});
  return false;
 }

 const botMember=member.guild.members.me||await member.guild.members.fetchMe().catch(()=>null);
 const permissions=botMember?channel.permissionsFor(botMember):null;
 const missing=[
  [PermissionFlagsBits.ViewChannel,'View Channel'],
  [PermissionFlagsBits.SendMessages,'Send Messages'],
 ].filter(([flag])=>!permissions?.has(flag)).map(([,label])=>label);
 if(missing.length){
  await logActivity(member.guild.id,'alert_error','warning','Live alert lacks channel permissions',
   `Allow B.E.I.P.I. ${missing.join(' and ')} in #${channel.name}.`,
   {memberId:member.id,channelId:channel.id,sourceKey:target.sourceKey});
  return false;
 }

 const rendered=renderTemplate(target.template,member,activity);
 const roleIds=[...new Set((target.roleIds||[]).filter(Boolean))].slice(0,20);
 const mentions=[target.everyone?'@everyone':'',...roleIds.map(id=>`<@&${id}>`)].filter(Boolean);
 const prefix=mentions.length?mentions.join(' ')+'\n':'';
 const message=await channel.send({
  content:prefix+rendered.slice(0,2000-prefix.length),
  allowedMentions:{parse:target.everyone?['everyone']:[],roles:roleIds},
 });
 const now=new Date().toISOString();
 const {error}=await supabase.from('discord_live_events').upsert({
  guild_id:member.guild.id,member_id:member.id,source_key:target.sourceKey,
  message_id:message.id,channel_id:channel.id,started_at:now,updated_at:now,
 },{onConflict:'guild_id,member_id,source_key'});
 if(error)throw error;
 existingKeys.add(target.sourceKey);
 return true;
}

async function goLive(member,activity,rules=[],personal=[]){
 const community=matchingCommunityRules(member,rules,{
  discord:Boolean(discordStreamActivity(member)),
  twitch:activity.twitchConfirmed===true,
 });
 const personalRules=personal.filter(rule=>rule.alert_channel_id);
 if(!community.length&&!personalRules.length)return;
 try{
  const {data:existing,error:existingError}=await supabase.from('discord_live_events').select('source_key,channel_id').not('message_id','is',null).eq('guild_id',member.guild.id).eq('member_id',member.id);if(existingError)throw existingError;
  const existingKeys=new Set((existing||[]).map(row=>row.source_key));
  const hasPersonalAlert=[...existingKeys].some(key=>key.startsWith('personal:'));
  const hasCommunityAlert=[...existingKeys].some(key=>key.startsWith('community:'));
  const usePersonal=hasPersonalAlert||personalRules.length>0;
  const targets=[];
  for(const rule of community){
   const sourceKey=`community:${rule.id}`;
   if(!hasPersonalAlert&&!existingKeys.has(sourceKey))await assignLiveRole(member,rule);
   if(!usePersonal)targets.push({sourceKey,channelId:rule.alert_channel_id,template:rule.creator_message_template||creatorDefault,roleIds:rule.mention_role_ids||[]});
  }
  // Settings can change mid-stream. Keep the already-announced stream on its original route.
  if(!hasCommunityAlert||hasPersonalAlert){
   const postedChannels=new Set((existing||[]).filter(event=>event.source_key.startsWith('personal:')).map(event=>event.channel_id));
   const personalByChannel=new Map();
   for(const rule of personalRules){
    if(postedChannels.has(rule.alert_channel_id))continue;
    const selected=personalByChannel.get(rule.alert_channel_id);
    // Use the most recently saved rule when multiple rules point to the same channel.
    if(!selected||Date.parse(rule.updated_at)>Date.parse(selected.updated_at))personalByChannel.set(rule.alert_channel_id,rule);
   }
   for(const rule of personalByChannel.values())targets.push({sourceKey:`personal:${rule.id}`,channelId:rule.alert_channel_id,template:rule.message_template||ownerDefault,everyone:rule.everyone_enabled,roleIds:rule.mention_role_ids?.length?rule.mention_role_ids:(rule.role_id?[rule.role_id]:[])});
  }
  let sent=0;
  for(const target of targets){
   try{
    if(await postLiveTarget(member,activity,target,existingKeys))sent+=1;
   }catch(error){
    console.error('[live-target]',target.sourceKey,error);
    await logActivity(member.guild.id,'alert_error','error','Live notification failed',
     error?.message||'Discord rejected the live notification.',{memberId:member.id,channelId:target.channelId,sourceKey:target.sourceKey}).catch(console.error);
   }
  }
  if(sent)await logActivity(member.guild.id,'live_started','info','Streamer detected live',`${member.displayName} started streaming on ${activity?.name||'a connected platform'}.`,{memberId:member.id,notificationsSent:sent});
  console.log(`[live] ${member.user.tag} in ${member.guild.name}: ${sent} notification(s)`);
 }catch(error){console.error('[live]',error);await logActivity(member.guild.id,'alert_error','error','Live notification failed',error instanceof Error?error.message:'Discord rejected the live notification.',{memberId:member.id})}
}

async function finishLive(member,rules=[],personal=[]){
 try{
  const fresh=await member.guild.members.fetch(member.id).catch(()=>member);if(!canFinishLive(fresh))return;
  for(const config of rules){if(!config.live_role_id)continue;const role=member.guild.roles.cache.get(config.live_role_id);if(role?.editable&&fresh.roles.cache.has(role.id)){
   await fresh.roles.remove(role,'B.E.I.P.I. detected the stream ended').catch(async error=>{
    console.warn('[roles]',error);
    await logActivity(member.guild.id,'role_error','warning','Could not remove the live role',
     error?.message||'Discord rejected the role removal.',{roleId:role.id}).catch(console.error);
   });
  }}
  const {data:events,error:eventError}=await supabase.from('discord_live_events').select('message_id,channel_id,source_key').eq('guild_id',member.guild.id).eq('member_id',member.id);if(eventError)throw eventError;
  const ruleBySource=new Map([
   ...rules.map(rule=>[`community:${rule.id}`,rule]),
   ...personal.map(rule=>[`personal:${rule.id}`,rule]),
  ]);
  for(const event of events||[]){const config=ruleBySource.get(event.source_key);if(config?.delete_expired_alert===false||!event.message_id||!event.channel_id)continue;const channel=member.guild.channels.cache.get(event.channel_id);if(channel?.isTextBased()){const message=await channel.messages.fetch(event.message_id).catch(()=>null);if(message)await message.delete().catch(()=>{})}}
  const {error:deleteError}=await supabase.from('discord_live_events').delete().eq('guild_id',member.guild.id).eq('member_id',member.id);
  if(deleteError)throw deleteError;
  await logActivity(member.guild.id,'live_ended','info','Stream ended',`${member.displayName} is no longer detected as streaming.`,{memberId:member.id});
  console.log(`[offline] ${member.user.tag} in ${member.guild.name}`);
 }catch(error){console.error('[offline]',error);await logActivity(member.guild.id,'role_error','error','Could not finish the live session',error instanceof Error?error.message:'The live role or alert could not be cleaned up.',{memberId:member.id})}
}

function scheduleLiveCleanup(member){
 const guildId=member.guild.id,key=`${guildId}:${member.id}`;
 if(pendingOffline.has(key))return;
 const timer=setTimeout(()=>{
  void serial(key,()=>finishLive(member,settings.get(guildId)||[],ownerSettings.get(key)))
   .finally(()=>{if(pendingOffline.get(key)===timer)pendingOffline.delete(key)});
 },120000);
 pendingOffline.set(key,timer);
}

async function reconcileRecordedLiveSessions(){
 if(liveCleanupRunning)return;
 liveCleanupRunning=true;
 try{
  const seen=new Set();
  const pageSize=500;
  for(let offset=0;;offset+=pageSize){
   const {data,error}=await supabase.from('discord_live_events')
    .select('guild_id,member_id').order('id').range(offset,offset+pageSize-1);
   if(error)throw error;
   for(const event of data||[]){
    const key=`${event.guild_id}:${event.member_id}`;
    if(seen.has(key)||pendingOffline.has(key))continue;
    seen.add(key);
    const guild=client.guilds.cache.get(event.guild_id);
    if(!guild?.available)continue;
    const member=guild.members.cache.get(event.member_id)||
     await guild.members.fetch(event.member_id).catch(()=>null);
    if(member&&canFinishLive(member))scheduleLiveCleanup(member);
   }
   if((data?.length||0)<pageSize)break;
  }
 }catch(error){console.error('[live-cleanup]',error)}
 finally{liveCleanupRunning=false}
}

function queueLive(member,rules,personal){
 const key=`${member.guild.id}:${member.id}`;
 const timer=pendingOffline.get(key);
 if(timer){
  clearTimeout(timer);
  pendingOffline.delete(key);
 }
 void serial(key,()=>{
  const activity=streamActivity(member);
  if(activity)return goLive(member,activity,rules,personal);
 });
}

async function findLiveTwitchMembers(guild,liveMemberIds){
 const ids=liveMemberIds.filter(id=>!guild.members.cache.has(id)&&!missingTwitchMembers.has(`${guild.id}:${id}`));
 for(let offset=0;offset<ids.length;offset+=100){
  const batch=ids.slice(offset,offset+100);
  try{
   const found=await guild.members.fetch({user:batch,time:5_000});
   const retryAt=Date.now()+5*60_000;
   for(const id of batch)if(!found.has(id))missingTwitchMembers.set(`${guild.id}:${id}`,retryAt);
  }catch(error){
   console.warn('[twitch-members]',guild.id,error.message);
  }
 }
}

let reconcileRunning=false;
async function reconcileAll(){
 if(reconcileRunning)return;
 reconcileRunning=true;
 try{
  await pollTwitch();
  const now=Date.now();
  const liveMemberIds=[...twitchByMember].filter(([,id])=>{
   const status=twitchStreams.get(id);
   return status?.activity&&now-status.checkedAt<=90_000;
  }).map(([id])=>id);
  for(const [key,retryAt] of missingTwitchMembers)if(retryAt<=now)missingTwitchMembers.delete(key);
  for(const [guildId,rules] of settings){
   const guild=client.guilds.cache.get(guildId);
   if(!guild?.available)continue;
   if(rules.some(rule=>rule.platform_confirmation_enabled))await findLiveTwitchMembers(guild,liveMemberIds);
   for(const member of guild.members.cache.values()){
    const key=`${guild.id}:${member.id}`;
    if(member.user.bot||ownerSettings.has(key)||!matchingCommunityRules(member,rules).length)continue;
    if(streamActivity(member))queueLive(member,rules);
    else if(rules.some(rule=>rule.live_role_id&&member.roles.cache.has(rule.live_role_id)))scheduleLiveCleanup(member);
   }
  }
  for(const [key,personal] of ownerSettings){
   const [guildId,memberId]=key.split(':');
   const guild=client.guilds.cache.get(guildId);
   if(!guild?.available)continue;
   const twitchStatus=twitchStreams.get(twitchByMember.get(memberId));
   const member=guild.members.cache.get(memberId)||
    (twitchStatus?.activity&&Date.now()-twitchStatus.checkedAt<=90_000
     ? await guild.members.fetch(memberId).catch(()=>null)
     : null);
   if(member&&!member.user.bot&&streamActivity(member))queueLive(member,settings.get(guildId)||[],personal);
  }
 }catch(error){console.error('[live-reconcile]',error)}
 finally{reconcileRunning=false}
}

client.on(Events.PresenceUpdate,(oldPresence,newPresence)=>{
 const member=newPresence.member;
 if(!member||member.user.bot)return;
 const key=`${newPresence.guild.id}:${member.id}`,rules=settings.get(newPresence.guild.id)||[],personal=ownerSettings.get(key);
 if(!personal&&!matchingCommunityRules(member,rules).length)return;
 const streaming=Boolean(streamActivity(member,newPresence));
 const wasStreaming=Boolean(streamActivity(member,oldPresence??{activities:[]}));
 if(streaming&&!wasStreaming)queueLive(member,rules,personal);
 if(!streaming&&wasStreaming)scheduleLiveCleanup(member);
});
client.on(Events.MessageReactionAdd,(reaction,user)=>void handleReaction(reaction,user,true));
client.on(Events.MessageReactionRemove,(reaction,user)=>void handleReaction(reaction,user,false));
client.on(Events.InteractionCreate,interaction=>void handleStreamConfirmation(interaction));

client.once(Events.ClientReady,async ready=>{console.log(`[ready] ${ready.user.tag} is online.`);await Promise.all([...ready.guilds.cache.values()].map(async guild=>{await syncGuild(guild);await logActivity(guild.id,'bot_online','info','B.E.I.P.I. came online','The Discord worker connected successfully.') }));await loadSettings();await reconcileAll();await reconcileRecordedLiveSessions();await processStreamConfirmations();setInterval(()=>void loadSettings(),60000).unref();setInterval(()=>void processStreamConfirmations(),60000).unref();setInterval(()=>void reconcileAll(),30000).unref();setInterval(()=>void reconcileRecordedLiveSessions(),30000).unref();setInterval(()=>void Promise.all([...client.guilds.cache.values()].map(guild=>syncGuild(guild))),300000).unref()});
client.on(Events.GuildCreate,guild=>void (async()=>{await syncGuild(guild);await logActivity(guild.id,'bot_joined','info','B.E.I.P.I. joined the server','The bot installation was registered.')})());
client.on(Events.GuildDelete,guild=>void (async()=>{await logActivity(guild.id,'bot_removed','warning','B.E.I.P.I. left the server','The bot is no longer installed.');await syncGuild(guild,false)})());
client.on(Events.Error,error=>console.error('[discord]',error));
process.on('unhandledRejection',error=>console.error('[unhandled]',error));
await client.login(discordToken);
