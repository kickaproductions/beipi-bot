'use client';
import {useState,type FormEvent} from 'react';
import {ChevronDown,Crown,Save} from 'lucide-react';
import LiveMessageTemplate from './live-message-template';

type Guild={id:string;name:string};
type Channel={id:string;name:string};
type Role={id:string;name:string;color:number};
type Settings={guildId:string;guildName:string;creatorRoleId:string;creatorRoleName:string;liveRoleId:string;liveRoleName:string;alertChannelId:string;alertChannelName:string;ownerAlertChannelId:string;ownerAlertChannelName:string;ownerEveryoneEnabled:boolean;ownerRoleId:string;ownerRoleName:string;ownerMessageTemplate:string;creatorMessageTemplate:string;discordPresenceEnabled:boolean;platformConfirmationEnabled:boolean;deleteExpiredAlert:boolean};
const defaultTemplate='# {streamer} is now live!\n{streamer} is streaming {game} on {platform}.\nThey brought their trusty {random_companion}!\nCome and say hello\n{url}';

export default function DiscordOwnerAlerts({guilds}:{guilds:Guild[]}){
 const [guildId,setGuildId]=useState(''),[channels,setChannels]=useState<Channel[]>([]),[roles,setRoles]=useState<Role[]>([]),[settings,setSettings]=useState<Settings|null>(null),[channelId,setChannelId]=useState(''),[everyone,setEveryone]=useState(true),[roleEnabled,setRoleEnabled]=useState(false),[roleId,setRoleId]=useState(''),[template,setTemplate]=useState(defaultTemplate),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function choose(id:string){
  setGuildId(id);setMessage('');setError('');setChannels([]);setRoles([]);setSettings(null);setChannelId('');setRoleId('');setRoleEnabled(false);
  if(!id)return;
  setBusy(true);
  try{
   const [channelResponse,roleResponse,settingsResponse]=await Promise.all([fetch('/api/auth/discord/channels?guildId='+encodeURIComponent(id),{cache:'no-store'}),fetch('/api/auth/discord/roles?purpose=mention&guildId='+encodeURIComponent(id),{cache:'no-store'}),fetch('/api/discord-live-settings?guildId='+encodeURIComponent(id),{cache:'no-store'})]);
   const channelData=await channelResponse.json() as {channels?:Channel[];error?:string};
   const roleData=await roleResponse.json() as {roles?:Role[];error?:string};
   const settingsData=await settingsResponse.json() as {settings?:Settings|null;error?:string};
   if(!channelResponse.ok)throw Error(channelData.error||'B.E.I.P.I. could not load that server’s channels.');
   if(!roleResponse.ok)throw Error(roleData.error||'B.E.I.P.I. could not load that server’s roles.');
   if(!settingsResponse.ok)throw Error(settingsData.error||'B.E.I.P.I. could not load the live settings.');
   const savedRoleId=settingsData.settings?.ownerRoleId||'';
   setChannels(channelData.channels||[]);setRoles(roleData.roles||[]);setSettings(settingsData.settings||null);setChannelId(settingsData.settings?.ownerAlertChannelId||settingsData.settings?.alertChannelId||'');setEveryone(settingsData.settings?.ownerEveryoneEnabled!==false);setRoleId(savedRoleId);setRoleEnabled(Boolean(savedRoleId));setTemplate(settingsData.settings?.ownerMessageTemplate||defaultTemplate);
  }catch(value){setError(value instanceof Error?value.message:'B.E.I.P.I. could not load that server.')}finally{setBusy(false)}
 }
 async function save(event:FormEvent){
  event.preventDefault();setMessage('');setError('');
  if(!settings){setError('Set up Community streamer notifications for this server first, then return here to choose your personal live channel.');return}
  setBusy(true);
  try{
   const channel=channels.find(item=>item.id===channelId);
   const role=roles.find(item=>item.id===roleId);
   const response=await fetch('/api/discord-live-settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...settings,ownerAlertChannelId:channelId,ownerAlertChannelName:channel?.name||'',ownerEveryoneEnabled:everyone,ownerRoleId:roleEnabled?roleId:'',ownerRoleName:roleEnabled?(role?.name||''):'',ownerMessageTemplate:template})});
   const data=await response.json() as {settings?:Settings;error?:string};
   if(!response.ok)throw Error(data.error||'Could not save the owner alert.');
   if(data.settings)setSettings(data.settings);setMessage('Owner live alert saved.');
  }catch(value){setError(value instanceof Error?value.message:'Could not save the owner alert.')}finally{setBusy(false)}
 }
 return <details className="card live-role-card live-accordion"><summary className="card-heading"><div><h2><Crown size={19}/> My live notifications</h2><p>Choose where B.E.I.P.I. announces your own streams.</p></div><ChevronDown size={20}/></summary><form className="form-fields" onSubmit={save}><label>Discord server<select value={guildId} onChange={event=>void choose(event.target.value)}><option value="">Choose a server</option>{guilds.map(guild=><option key={guild.id} value={guild.id}>{guild.name}</option>)}</select></label><label>Your dedicated live channel<select required disabled={!guildId||busy} value={channelId} onChange={event=>setChannelId(event.target.value)}><option value="">{busy?'Loading channels…':'Choose a channel'}</option>{channels.map(channel=><option key={channel.id} value={channel.id}># {channel.name}</option>)}</select><small>Your personal live announcement will be posted here.</small></label>{guildId&&!busy&&!settings&&<p className="field-help">Complete Community streamer notifications below once for this server, then your personal notification can use its own channel and message.</p>}<LiveMessageTemplate label="Your live message" value={template} onChange={setTemplate} help="Make it sound like you, or use the playful automatic details."/><div className="live-options"><label><input type="checkbox" checked={everyone} onChange={event=>setEveryone(event.target.checked)}/><span><strong>Ping @everyone</strong><small>Notify everyone in this server.</small></span></label><label><input type="checkbox" checked={roleEnabled} onChange={event=>setRoleEnabled(event.target.checked)}/><span><strong>Ping a role</strong><small>Notify a role you choose from this server.</small></span></label></div>{roleEnabled&&<label>Role to notify<select required disabled={!guildId||busy} value={roleId} onChange={event=>setRoleId(event.target.value)}><option value="">{busy?'Loading roles…':'Choose a role'}</option>{roles.map(role=><option key={role.id} value={role.id}>@{role.name}</option>)}</select><small>You can use this on its own or together with @everyone.</small></label>}{error&&<p className="field-error" role="alert">{error}</p>}{message&&<p className="save-success" role="status">{message}</p>}<div className="save-draft"><span>Choose @everyone, a role, both, or neither.</span><button className="primary" disabled={!guildId||!channelId||busy||(roleEnabled&&!roleId)}><Save size={15}/>{busy?'Saving…':'Save my notification'}</button></div></form></details>
}
