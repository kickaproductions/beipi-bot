'use client';
import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowUpRight,CheckCircle2,Search,Server,ShieldCheck,TriangleAlert,Users} from 'lucide-react';

type Guild={guildId:string;guildName:string;botActive:boolean;memberCount:number;installedAt:string;lastSeenAt:string;setupComplete:boolean;liveEnabled:boolean;ownerName:string;ownerEmail:string};

export default function ServerDirectory(){
 const [servers,setServers]=useState<Guild[]>([]),[query,setQuery]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{fetch('/api/developer/servers',{cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error);setServers(data.servers||[])}).catch(value=>setError(value.message)).finally(()=>setLoading(false))},[]);
 const shown=useMemo(()=>servers.filter(server=>`${server.guildName} ${server.guildId} ${server.ownerName} ${server.ownerEmail}`.toLowerCase().includes(query.toLowerCase())),[servers,query]);
 return <main className="developer-shell servers-shell">
  <header className="developer-topbar"><a href="/developer"><ArrowLeft size={16}/> Developer portal</a><span><ShieldCheck size={15}/> Server management</span></header>
  <div className="developer-heading"><div><span>DISCORD COMMUNITIES</span><h1>B.E.I.P.I. servers</h1></div><p>Open a server to inspect its setup, connections and last bot check-in.</p></div>
  <section className="server-directory-stats"><article><Server size={20}/><strong>{servers.length}</strong><span>Registered</span></article><article><CheckCircle2 size={20}/><strong>{servers.filter(item=>item.botActive).length}</strong><span>Installed</span></article><article><TriangleAlert size={20}/><strong>{servers.filter(item=>!item.setupComplete).length}</strong><span>Need setup</span></article></section>
  <label className="server-search"><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search server, owner or Discord ID" aria-label="Search Discord servers"/></label>
  {error&&<p className="tester-error">{error}</p>}
  {loading?<div className="accounts-loading">Loading B.E.I.P.I. servers…</div>:<section className="server-directory-grid">{shown.map(server=><a href={'/developer/servers/'+encodeURIComponent(server.guildId)} className="server-directory-card" key={server.guildId}>
   <header><span><Server size={22}/></span><div><h2>{server.guildName}</h2><p>{server.guildId}</p></div><ArrowUpRight size={18}/></header>
   <div className="server-directory-meta"><span><Users size={15}/>{server.memberCount.toLocaleString()} members</span><span className={server.botActive?'healthy':'offline'}>{server.botActive?'Installed':'Removed'}</span></div>
   <p>{server.ownerName||'Owner not linked'}{server.ownerEmail&&<small>{server.ownerEmail}</small>}</p>
   <footer><span>{server.setupComplete?'Setup complete':'Setup needed'}</span><span>{server.liveEnabled?'Live alerts on':'Live alerts off'}</span></footer>
  </a>)}{!shown.length&&<div className="tester-card tester-empty">No servers match this search.</div>}</section>}
 </main>
}
