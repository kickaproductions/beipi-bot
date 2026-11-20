'use client';

import {useEffect,useRef,useState} from 'react';
import {defaultTwitchPanelAppearance,type TwitchPanelAppearance} from '@/lib/twitch-panel-appearance';

export default function TwitchPanelAppearanceSettings(){
  const [design,setDesign]=useState(defaultTwitchPanelAppearance);
  const [saved,setSaved]=useState(defaultTwitchPanelAppearance);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [feedback,setFeedback]=useState('');
  const [error,setError]=useState('');
  const preview=useRef<HTMLIFrameElement>(null);

  useEffect(()=>{
    const controller=new AbortController();
    void (async ()=>{
      try{
        const response=await fetch('/api/twitch-week/appearance',{signal:controller.signal});
        const data=await response.json();
        if(!response.ok)throw Error(data.error);
        if(controller.signal.aborted)return;
        setDesign(data.appearance);
        setSaved(data.appearance);
      }catch(reason){
        if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Could not load the panel appearance.');
      }finally{
        if(!controller.signal.aborted)setLoading(false);
      }
    })();
    return ()=>controller.abort();
  },[]);

  function sendPreview(){
    preview.current?.contentWindow?.postMessage({type:'beipi-panel-appearance',appearance:design},window.location.origin);
  }

  useEffect(()=>{
    preview.current?.contentWindow?.postMessage({type:'beipi-panel-appearance',appearance:design},window.location.origin);
  },[design]);

  function change(values:Partial<TwitchPanelAppearance>){
    setDesign(current=>({...current,...values}));
    setFeedback('');
  }

  async function save(){
    setSaving(true);
    setFeedback('');
    setError('');
    try{
      const response=await fetch('/api/twitch-week/appearance',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(design)});
      const data=await response.json();
      if(!response.ok)throw Error(data.error);
      setDesign(data.appearance);
      setSaved(data.appearance);
      setFeedback('Panel appearance saved.');
    }catch(reason){
      setError(reason instanceof Error?reason.message:'Could not save the panel appearance.');
    }finally{
      setSaving(false);
    }
  }

  return <section className="twitch-panel-appearance" aria-label="Panel appearance">
    <fieldset className="twitch-panel-controls" disabled={loading||saving}>
      <legend>Panel appearance</legend>
      <label>Theme<select value={design.theme} onChange={event=>change({theme:event.currentTarget.value as TwitchPanelAppearance['theme']})}>
        <option value="violet">Violet Portal</option><option value="lavender">Soft Lavender</option><option value="midnight">Midnight</option>
      </select></label>
      <label>Accent colour<input type="color" value={design.accent} onChange={event=>change({accent:event.currentTarget.value})}/></label>
      <label>Panel title<input type="text" maxLength={50} value={design.title} onChange={event=>change({title:event.currentTarget.value})}/></label>
      <label>Layout<select value={design.layout} onChange={event=>change({layout:event.currentTarget.value as TwitchPanelAppearance['layout']})}>
        <option value="compact">Compact</option><option value="roomy">Roomy</option>
      </select></label>
      <label className="twitch-panel-pip-toggle"><input type="checkbox" checked={design.showPip} onChange={event=>change({showPip:event.currentTarget.checked})}/> Show Pip in the header</label>
      <button className="primary" type="button" disabled={!design.title.trim()||JSON.stringify(design)===JSON.stringify(saved)} onClick={()=>void save()}>{saving?'Saving…':'Save appearance'}</button>
      {feedback&&<p role="status">{feedback}</p>}
      {error&&<p className="stream-confirm-error" role="alert">{error}</p>}
    </fieldset>
    <div className="twitch-panel-preview">
      <p>Live preview · Sample streams</p>
      <iframe ref={preview} onLoad={sendPreview} title="Twitch panel appearance preview" src="/twitch-schedule/index.html?preview=appearance" />
    </div>
  </section>;
}
