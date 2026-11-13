'use client';
import {useState,type FormEvent} from 'react';
import {ChevronDown,Crown,Save} from 'lucide-react';
import LiveMessageTemplate from './live-message-template';
import LiveRolePicker from './live-role-picker';

type Guild={id:string;name:string};
type Channel={id:string;name:string};
type Role={id:string;name:string;color:number};
type Settings={guildId:string;guildName:string;alertChannelId:string;alertChannelName:string;everyoneEnabled:boolean;roleIds:string[];roleNames:string[];messageTemplate:string;deleteExpiredAlert:boolean};
const defaultTemplate='# {streamer} is now live!\n{streamer} is streaming {game} on {platform}.\nThey brought their trusty {random_companion}!\nCome and say hello\n{url}';

export default function DiscordOwnerAlerts({guilds}:{guilds:Guild[]}){
 const [guildId,setGuildId]=useState(''),[channels,setChannels]=useState<Channel[]>([]),[roles,setRoles]=useState<Role[]>([]),[settings,setSettings]=useState<Settings|null>(null),[channelId,setChannelId]=useState(''),[everyone,setEveryone]=useState(true),[roleIds,setRoleIds]=useState<string[]>([]),[template,setTemplate]=useState(defaultTemplate),[deleteExpiredAlert,setDeleteExpiredAlert]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function choose(id:string){
  setGuildId(id);setMessage('');setError('');setChannels([]);setRoles([]);setSettings(null);setChannelId('');setRoleIds([]);setDeleteExpiredAlert(true);
  if(!id)return;
  setBusy(true);
  try{
   const channelResponse=await fetch('/api/auth/discord/channels?guildId='+encodeURIComponent(id),{cache:'no-store'});
   const channelData=await channelResponse.json() as {channels?:Channel[];error?:string};
   if(!channelResponse.ok)throw Error(channelData.error||'B.E.I.P.I. could not load that server’s channels.');
   const roleResponse=await fetch('/api/auth/discord/roles?purpose=mention&guildId='+encodeURIComponent(id),{cache:'no-store'});
   const roleData=await roleResponse.json() as {roles?:Role[];error?:string};
   if(!roleResponse.ok)throw Error(roleData.error||'B.E.I.P.I. could not load that server’s roles.');
   const settingsResponse=await fetch('/api/discord-owner-live-settings?guildId='+encodeURIComponent(id),{cache:'no-store'});
   const settingsData=await settingsResponse.json() as {settings?:Settings|null;error?:string};
   if(!settingsResponse.ok)throw Error(settingsData.error||'B.E.I.P.I. could not load the live settings.');
   setChannels(channelData.channels||[]);setRoles(roleData.roles||[]);setSettings(settingsData.settings||null);setChannelId(settingsData.settings?.alertChannelId||'');setEveryone(settingsData.settings?.everyoneEnabled!==false);setRoleIds(settingsData.settings?.roleIds||[]);setTemplate(settingsData.settings?.messageTemplate||defaultTemplate);setDeleteExpiredAlert(settingsData.settings?.deleteExpiredAlert!==false);
  }catch(value){setError(value instanceof Error?value.message:'B.E.I.P.I. could not load that server.')}finally{setBusy(false)}
 }
 async function save(event:FormEvent){
  event.preventDefault();setMessage('');setError('');
  setBusy(true);
  try{
   const channel=channels.find(item=>item.id===channelId);
   const selectedRoles=roles.filter(item=>item.id!==guildId&&roleIds.includes(item.id));
   const guild=guilds.find(item=>item.id===guildId);
   const response=await fetch('/api/discord-owner-live-settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({guildId,guildName:guild?.name||'',alertChannelId:channelId,alertChannelName:channel?.name||'',everyoneEnabled:everyone,roleIds:selectedRoles.map(role=>role.id),roleNames:selectedRoles.map(role=>role.name),messageTemplate:template,deleteExpiredAlert})});
   const data=await response.json() as {settings?:Settings;error?:string};
   if(!response.ok)throw Error(data.error||'Could not save the owner alert.');
   if(data.settings)setSettings(data.settings);setMessage('Owner live alert saved.');
  }catch(value){setError(value instanceof Error?value.message:'Could not save the owner alert.')}finally{setBusy(false)}
 }
 return <details className="card live-role-card live-accordion"><summary className="card-heading"><div><h2><Crown size={19}/> My live notifications</h2><p>Choose where B.E.I.P.I. announces your own streams.</p></div><ChevronDown size={20}/></summary><form className="form-fields" onSubmit={save}><label>Discord server<select value={guildId} onChange={event=>void choose(event.target.value)}><option value="">Choose a server</option>{guilds.map(guild=><option key={guild.id} value={guild.id}>{guild.name}</option>)}</select></label><label>Your dedicated live channel<select required disabled={!guildId||busy} value={channelId} onChange={event=>setChannelId(event.target.value)}><option value="">{busy?'Loading channels…':'Choose a channel'}</option>{channels.map(channel=><option key={channel.id} value={channel.id}># {channel.name}</option>)}</select><small>Your personal live announcement will be posted here.</small></label><LiveMessageTemplate label="Your live message" value={template} onChange={setTemplate} help="Make it sound like you, or use the playful automatic details."/><div className="live-options"><label><input type="checkbox" checked={everyone} onChange={event=>setEveryone(event.target.checked)}/><span><strong>Ping @everyone</strong><small>Notify everyone in this server.</small></span></label><label><input type="checkbox" checked={deleteExpiredAlert} onChange={event=>setDeleteExpiredAlert(event.target.checked)}/><span><strong>Clean up finished alerts</strong><small>Remove this notification after your stream ends.</small></span></label></div><LiveRolePicker roles={roles} guildId={guildId} everyoneControl selected={roleIds} onChange={setRoleIds} disabled={!guildId||busy}/>{error&&<p className="field-error" role="alert">{error}</p>}{message&&<p className="save-success" role="status">{message}</p>}<div className="save-draft"><span>Choose @everyone, multiple roles, both, or neither.</span><button className="primary" disabled={!guildId||!channelId||busy}><Save size={15}/>{busy?'Saving…':'Save my notification'}</button></div></form></details>
}
