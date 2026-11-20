'use client';

import {useEffect,useState} from 'react';

type Connection={configured:boolean;profile:{display_name:string;avatar_url:string|null}|null};
const messages:Record<string,string>={
  connected:'TikTok profile linked.',
  denied:'TikTok did not authorise the connection.',
  expired:'This connection attempt expired. Start again from here.',
  unavailable:'TikTok linking is awaiting setup.',
  error:'TikTok could not be linked. Try again.'
};

export default function TikTokConnection(){
  const [connection,setConnection]=useState<Connection|null>(null);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [avatarFailed,setAvatarFailed]=useState(false);

  async function update(method:'GET'|'DELETE',signal?:AbortSignal){
    setError('');
    try{
      const response=await fetch('/api/auth/tiktok/status',{method,signal,cache:'no-store'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error);
      setConnection(data);
      if(method==='DELETE')setMessage('TikTok profile unlinked.');
    }catch(value){
      if(!signal?.aborted)setError(value instanceof Error?value.message:'Could not update your TikTok connection.');
    }finally{
      if(!signal?.aborted){setLoading(false);setBusy(false);}
    }
  }

  useEffect(()=>{
    const url=new URL(window.location.href);
    const result=url.searchParams.get('tiktok');
    if(result){
      setMessage(Object.hasOwn(messages,result)?messages[result]:'');
      url.searchParams.delete('tiktok');
      window.history.replaceState(window.history.state,'',url);
    }
    const controller=new AbortController();
    void update('GET',controller.signal);
    return ()=>controller.abort();
  },[]);

  const profile=connection?.profile;
  return <section className="card platform">
    <span className="platform-icon tiktok" aria-hidden="true">
      {profile?.avatar_url&&!avatarFailed
        ? <img src={profile.avatar_url} alt="" width={32} height={32} style={{borderRadius:'50%',objectFit:'cover'}} referrerPolicy="no-referrer" onError={()=>setAvatarFailed(true)}/>
        : <span>♪</span>}
    </span>
    <span className={'status '+(profile?'connected':'')}>{loading?'Checking…':profile?'Connected':connection?.configured?'Not linked':'Unavailable'}</span>
    <h2>TikTok</h2>
    <p>{profile?<>Connected as <strong>{profile.display_name}</strong>.</>:'Link your TikTok display name and profile picture.'}</p>
    {profile
      ? <button className="outline disconnect" disabled={busy} onClick={()=>{setBusy(true);void update('DELETE');}}>Disconnect TikTok</button>
      : connection?.configured
        ? <a className="outline platform-connect" href="/api/auth/tiktok/start">Connect with TikTok</a>
        : <button className="outline" disabled>Connect with TikTok</button>}
    {message&&<small role="status">{message}</small>}
    {error&&<small role="alert">{error}</small>}
    {connection&&!connection.configured&&!profile&&!message&&<small>TikTok linking is awaiting setup.</small>}
  </section>;
}
