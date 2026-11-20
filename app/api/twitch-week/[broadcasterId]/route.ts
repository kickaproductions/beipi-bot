import {readTwitchPanelAppearance} from '@/lib/twitch-panel-appearance';
import {decryptSession} from '@/app/api/auth/twitch/session';
import {createAdminClient} from '@/lib/supabase/admin';

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{
  'Cache-Control':'no-store',
  'Access-Control-Allow-Origin':'*',
}});

export async function GET(request:Request,{params}:{params:Promise<{broadcasterId:string}>}){
  const {broadcasterId}=await params;
  if(!/^\d{1,20}$/.test(broadcasterId))return json({error:'Schedule unavailable.'},404);
  const search=new URL(request.url).searchParams;
  const start=Date.parse(search.get('from')||'');
  const end=Date.parse(search.get('to')||'');
  const day=86_400_000;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>Date.now()||Date.now()-start>26*60*60*1000||end-start<6*day||end-start>8*day){
    return json({error:'Open the schedule to view the next seven days.'},400);
  }
  try{
    const db=createAdminClient();
    const {data:share,error:shareError}=await db.from('twitch_week_shares').select('user_id').eq('broadcaster_id',broadcasterId).maybeSingle();
    if(shareError)throw shareError;
    if(!share)return json({error:'This channel has not shared its schedule.'},404);
    const userId=share.user_id;
    const {data:connection,error:connectionError}=await db.from('platform_connections').select('encrypted_session').eq('user_id',userId).eq('platform','twitch').eq('external_user_id',broadcasterId).maybeSingle();
    if(connectionError)throw connectionError;
    if(!connection||decryptSession(connection.encrypted_session||'')?.user.id!==broadcasterId)return json({error:'This channel has not shared its schedule.'},404);

    const [{data:design},{data:streams,error:streamError}]=await Promise.all([
      db.from('twitch_panel_appearance').select('appearance').eq('user_id',userId).maybeSingle(),
      db.from('companion_items').select('id,title,note,due,pinned').eq('user_id',userId).eq('kind','crew-stream').gte('due',new Date(start).toISOString()).lt('due',new Date(end).toISOString()).order('due').limit(100),
    ]);
    const appearance=readTwitchPanelAppearance(design?.appearance);
    if(streamError)throw streamError;
    const twitchStreams=streams.flatMap(stream=>{
      let platform=stream.note||'Twitch',game='';
      try{
        const details=JSON.parse(platform);
        if(details?.v===1){platform=String(details.platform||'Twitch');game=String(details.game||'');}
      }catch{}
      return platform.toLowerCase()==='twitch'?[{id:stream.id,title:stream.title,game,date:stream.due,special:Boolean(stream.pinned)}]:[];
    });
    if(!twitchStreams.length)return json({streams:[],appearance});
    const {data:runs,error:runError}=await db.from('stream_confirmation_runs').select('stream_id,status').eq('user_id',userId).in('stream_id',twitchStreams.map(stream=>stream.id));
    if(runError)throw runError;
    const statuses=new Map(runs.map(run=>[run.stream_id,run.status]));
    return json({appearance,streams:twitchStreams.map(({id,...stream})=>{
      const status=statuses.get(id);
      return {...stream,status:status==='confirmed'||status==='cancelled'?status:'scheduled'};
    })});
  }catch{
    return json({error:'The schedule is temporarily unavailable.'},503);
  }
}
