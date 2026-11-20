'use client';

import {useEffect,useState} from 'react';
import {ExternalLink} from 'lucide-react';
import TwitchPanelAppearanceSettings from './twitch-panel-appearance';

export default function TwitchWeekSharing({twitchId}:{twitchId:string}){
    const [broadcasterId,setBroadcasterId]=useState<string|null>(null);
    const [loading,setLoading]=useState(true);
    const [saving,setSaving]=useState(false);
    const [error,setError]=useState('');
    const visible=Boolean(twitchId&&broadcasterId===twitchId);

    useEffect(()=>{
        const controller=new AbortController();
        fetch('/api/twitch-week/sharing',{signal:controller.signal})
            .then(async response=>{
                const data=await response.json();
                if(!response.ok)throw Error(data.error);
                if(!controller.signal.aborted)setBroadcasterId(data.broadcasterId);
            })
            .catch(reason=>{if(!controller.signal.aborted)setError(reason.message||'Could not load sharing settings.');})
            .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
        return ()=>controller.abort();
    },[]);

    async function changeSharing(enabled:boolean){
        setSaving(true);
        setError('');
        try{
            const response=await fetch('/api/twitch-week/sharing',{
                method:'PUT',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({enabled}),
            });
            const data=await response.json();
            if(!response.ok)throw Error(data.error);
            setBroadcasterId(data.broadcasterId);
        }catch(reason){
            setError(reason instanceof Error?reason.message:'Could not save sharing settings.');
        }finally{
            setSaving(false);
        }
    }

    return <div className="twitch-week-preview">
        <label className="stream-confirm-switch">
            <input type="checkbox" checked={visible} disabled={loading||saving||!twitchId} onChange={event=>void changeSharing(event.currentTarget.checked)}/>
            <span />
            <div>
                <strong>Share my Twitch schedule with viewers</strong>
                <small>{twitchId?'Publishes the next seven days of Twitch stream titles, games, dates and statuses.':'Connect Twitch to share your schedule.'}</small>
            </div>
        </label>
        {saving&&<p role="status">Saving sharing settings…</p>}
        {error&&<p className="stream-confirm-error" role="alert">{error}</p>}
        {visible&&<div>
            <a className="outline" href={'/twitch-schedule/index.html?channel='+broadcasterId} target="_blank" rel="noopener noreferrer">Open public schedule <ExternalLink size={14}/></a>
        </div>}
        <TwitchPanelAppearanceSettings/>
    </div>;
}
