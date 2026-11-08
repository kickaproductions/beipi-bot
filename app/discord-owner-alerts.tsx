'use client';
import {useState,type FormEvent} from 'react';
import {ChevronDown,Crown,Save} from 'lucide-react';
import LiveMessageTemplate from './live-message-template';

type Guild={id:string;name:string};
type Channel={id:string;name:string};
type Settings={guildId:string;guildName:string;creatorRoleId:string;creatorRoleName:string;liveRoleId:string;liveRoleName:string;alertChannelId:string;alertChannelName:string;ownerAlertChannelId:string;ownerAlertChannelName:string;ownerEveryoneEnabled:boolean;ownerMessageTemplate:string;creatorMessageTemplate:string;discordPresenceEnabled:boolean;platformConfirmationEnabled:boolean;deleteExpiredAlert:boolean};
const defaultTemplate='# {streamer} is now live!\n{streamer} is streaming {game} on {platform}.\nThey brought their trusty {random_companion}!\nCome and say hello\n{url}';

export default function DiscordOwnerAlerts({guilds}:{guilds:Guild[]}){
 const [guildId,setGuildId]=useState(''),[channels,setChannels]=useState<Channel[]>([]),[settings,setSettings]=useState<Settings|null>(null),[channelId,setChannelId]=useState(''),[everyone,setEveryone]=useState(true),[template,setTemplate]=useState(defaultTemplate),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function choose(id:string){
  setGuildId(id);setMessage('');setError('');setChannels([]);setSettings(null);setChannelId('');
  if(!id)return;
  setBusy(true);
  try{
   const [channelResponse,settingsResponse]=await Promise.all([fetch('/api/auth/discord/channels?guildId='+encodeURIComponent(id),{cache:'no-store'}),fetch('/api/discord-live-settings?guildId='+encodeURIComponent(id),{cache:'no-store'})]);
   const channelData=await channelResponse.json() as {channels?:Channel[];error?:string};
   const settingsData=await settingsResponse.json() as {settings?:Settings|null;error?:string};
   if(!channelResponse.ok)throw Error(channelData.error||'B.E.I.P.I. could not load that server’s channels.');
   if(!settingsResponse.ok)throw Error(settingsData.error||'B.E.I.P.I. could not load the live settings.');
   setChannels(channelData.channels||[]);setSettings(settingsData.settings||null);setChannelId(settingsData.settings?.ownerAlertChannelId||settingsData.settings?.alertChannelId||'');setEveryone(settingsData.settings?.ownerEveryoneEnabled!==false);setTemplate(settingsData.settings?.ownerMessageTemplate||defaultTemplate);
  }catch(value){setError(value instanceof Error?value.message:'B.E.I.P.I. could not load that server.')}finally{setBusy(false)}
 }
 async function save(event:FormEvent){
  event.preventDefault();setMessage('');setError('');
  if(!settings){setError('Set up Community streamer notifications for this server first, then return here to choose your personal live channel.');return}
  setBusy(true);
  try{
   const channel=channels.find(item=>item.id===channelId);
   const response=await fetch('/api/discord-live-settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...settings,ownerAlertChannelId:channelId,ownerAlertChannelName:channel?.name||'',ownerEveryoneEnabled:everyone,ownerMessageTemplate:template})});
   const data=await response.json() as {settings?:Settings;error?:string};
   if(!response.ok)throw Error(data.error||'Could not save the owner alert.');
   if(data.settings)setSettings(data.settings);setMessage('Owner live alert saved.');
  }catch(value){setError(value instanceof Error?value.message:'Could not save the owner alert.')}finally{setBusy(false)}
 }
 return <details className="card live-role-card live-accordion"><summary className="card-heading"><div><h2><Crown size={19}/> My live notifications</h2><p>Choose where B.E.I.P.I. announces your own streams.</p></div><ChevronDown size={20}/></summary><form className="form-fields" onSubmit={save}><label>Discord server<select value={guildId} onChange={event=>void choose(event.target.value)}><option value="">Choose a server</option>{guilds.map(guild=><option key={guild.id} value={guild.id}>{guild.name}</option>)}</select></label><label>Your dedicated live channel<select required disabled={!guildId||busy} value={channelId} onChange={event=>setChannelId(event.target.value)}><option value="">{busy?'Loading channels…':'Choose a channel'}</option>{channels.map(channel=><option key={channel.id} value={channel.id}># {channel.name}</option>)}</select><small>Your personal live announcement will be posted here.</small></label>{guildId&&!busy&&!settings&&<p className="field-help">Complete Community streamer notifications below once for this server, then your personal notification can use its own channel and message.</p>}<LiveMessageTemplate label="Your live message" value={template} onChange={setTemplate} help="Make it sound like you, or use the playful automatic details."/><label className="remove-reaction"><input type="checkbox" checked={everyone} onChange={event=>setEveryone(event.target.checked)}/><div>Ping @everyone for your stream<small>Community creator alerts will never use this ping.</small></div></label>{error&&<p className="field-error" role="alert">{error}</p>}{message&&<p className="save-success" role="status">{message}</p>}<div className="save-draft"><span>Each server can have its own channel and message.</span><button className="primary" disabled={!guildId||!channelId||busy}><Save size={15}/>{busy?'Saving…':'Save my notification'}</button></div></form></details>
}
