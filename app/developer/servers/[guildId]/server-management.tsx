'use client';
import {useEffect,useState} from 'react';
import {Activity,ArrowLeft,Bell,CheckCircle2,Clock3,Hash,Link2,MessageSquareText,Radio,Server,ShieldCheck,Tag,TriangleAlert,Users} from 'lucide-react';

type Platform={platform:string;displayName:string;username:string;connectedAt:string};
type Detail={guildId:string;guildName:string;botActive:boolean;memberCount:number;installedAt:string;lastSeenAt:string;removedAt:string;owner:{id:string;name:string;email:string}|null;platforms:Platform[];settings:null|{guildName:string;creatorRoleId:string;creatorRoleName:string;liveRoleId:string;liveRoleName:string;alertChannelId:string;alertChannelName:string;ownerAlertChannelId:string;ownerAlertChannelName:string;ownerEveryoneEnabled:boolean;discordPresenceEnabled:boolean;platformConfirmationEnabled:boolean;deleteExpiredAlert:boolean;updatedAt:string}};
const ago=(value:string)=>{if(!value)return 'Never';const seconds=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));if(seconds<60)return 'Just now';if(seconds<3600)return Math.floor(seconds/60)+' min ago';if(seconds<86400)return Math.floor(seconds/3600)+' hr ago';return Math.floor(seconds/86400)+' days ago'};

export default function ServerManagement({guildId}:{guildId:string}){
 const [server,setServer]=useState<Detail|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{fetch('/api/developer/servers/'+encodeURIComponent(guildId),{cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error);setServer(data.server)}).catch(value=>setError(value.message)).finally(()=>setLoading(false))},[guildId]);
 if(loading)return <main className="developer-shell server-detail-shell"><div className="accounts-loading">Opening server management…</div></main>;
 if(error||!server)return <main className="developer-shell server-detail-shell"><header className="developer-topbar"><a href="/developer/servers"><ArrowLeft size={16}/> All servers</a></header><p className="tester-error">{error||'Server not found.'}</p></main>;
 const settings=server.settings;
 return <main className="developer-shell server-detail-shell">
  <header className="developer-topbar"><a href="/developer/servers"><ArrowLeft size={16}/> All servers</a><span><ShieldCheck size={15}/> Developer server view</span></header>
  <section className="server-detail-hero"><div><span className="developer-kicker"><Server size={15}/> DISCORD SERVER</span><h1>{server.guildName}</h1><p>{server.guildId}</p></div><div className={'server-health '+(server.botActive?'healthy':'offline')}>{server.botActive?<CheckCircle2 size={19}/>:<TriangleAlert size={19}/>}<div><b>{server.botActive?'B.E.I.P.I. installed':'B.E.I.P.I. removed'}</b><span>Last check-in {ago(server.lastSeenAt)}</span></div></div></section>
  <nav className="server-section-menu" aria-label="Server sections"><a href="#overview"><Activity size={17}/> Overview</a><a href="#connections"><Link2 size={17}/> Connections</a><a href="#live"><Radio size={17}/> Live notifications</a><a href="#roles"><Tag size={17}/> Reaction roles</a><a href="#channels"><Hash size={17}/> Channels</a></nav>
  <section id="overview" className="server-detail-grid">
   <article className="server-detail-card"><span><Users size={19}/></span><div><small>Members</small><strong>{server.memberCount.toLocaleString()}</strong></div></article>
   <article className="server-detail-card"><span><Clock3 size={19}/></span><div><small>Installed</small><strong>{new Date(server.installedAt).toLocaleDateString()}</strong></div></article>
   <article className="server-detail-card"><span><Activity size={19}/></span><div><small>Last bot check-in</small><strong>{ago(server.lastSeenAt)}</strong></div></article>
  </section>
  <section className="server-management-layout">
   <div>
    <article id="connections" className="server-management-card"><header><Link2 size={20}/><div><h2>Connections</h2><p>Account and platforms associated with this server.</p></div></header>{server.owner?<div className="server-owner"><b>{server.owner.name}</b><span>{server.owner.email}</span></div>:<p className="server-empty">The Discord owner has not been linked to a B.E.I.P.I. account.</p>}<div className="server-platforms">{server.platforms.length?server.platforms.map(item=><div key={item.platform}><b>{item.platform}</b><span>{item.displayName}{item.username&&item.username!==item.displayName?' · '+item.username:''}</span></div>):<p className="server-empty">No connected platforms found.</p>}</div></article>
    <article id="live" className="server-management-card"><header><Bell size={20}/><div><h2>Live notifications</h2><p>Saved roles, channels and detection settings.</p></div></header>{settings?<div className="server-settings-grid"><div><small>Creator role</small><b>@{settings.creatorRoleName}</b></div><div><small>Currently live role</small><b>@{settings.liveRoleName}</b></div><div><small>Creator alerts</small><b>#{settings.alertChannelName}</b></div><div><small>Owner alerts</small><b>#{settings.ownerAlertChannelName||settings.alertChannelName}</b></div><div><small>Discord presence</small><b>{settings.discordPresenceEnabled?'On':'Off'}</b></div><div><small>Platform confirmation</small><b>{settings.platformConfirmationEnabled?'On':'Off'}</b></div><div><small>Delete finished alerts</small><b>{settings.deleteExpiredAlert?'On':'Off'}</b></div><div><small>@everyone for owner</small><b>{settings.ownerEveryoneEnabled?'On':'Off'}</b></div></div>:<p className="server-empty">Live notifications have not been configured for this server.</p>}</article>
   </div>
   <aside>
    <article id="roles" className="server-management-card"><header><Tag size={20}/><div><h2>Reaction roles</h2><p>Server role menus and assignments.</p></div></header><p className="server-empty">No reaction-role configuration is registered yet.</p></article>
    <article id="channels" className="server-management-card"><header><Hash size={20}/><div><h2>Channels</h2><p>Channels B.E.I.P.I. has been configured to use.</p></div></header>{settings?<ul className="server-channel-list"><li><MessageSquareText size={16}/>#{settings.alertChannelName}<small>Creator alerts</small></li><li><MessageSquareText size={16}/>#{settings.ownerAlertChannelName||settings.alertChannelName}<small>Server-owner alerts</small></li></ul>:<p className="server-empty">No channel configuration is registered yet.</p>}</article>
    <article className="server-management-card server-admin-note"><header><ShieldCheck size={20}/><div><h2>Admin tools</h2><p>Developer-only diagnostics.</p></div></header><p>Registry and setup information is read-only here. Safe repair and removal tools can be added once activity logging is connected.</p></article>
   </aside>
  </section>
 </main>
}
