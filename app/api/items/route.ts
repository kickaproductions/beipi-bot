import {createClient} from '@/lib/supabase/server';

type ItemRow={id:string;kind:string;title:string;note:string;due:string|null;done:boolean;priority:'low'|'medium'|'high';checklist_phase:'pre'|'post';sort_order:number;created_by_pip:boolean;series_id:string|null;recurrence:'weekly'|'fortnightly'|'monthly'|null;recurrence_ongoing:boolean;created_at:string};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const fields='id,kind,title,note,due,done,priority,checklist_phase,sort_order,created_by_pip,series_id,recurrence,recurrence_ongoing,created_at';
const present=(item:ItemRow)=>({id:item.id,kind:item.kind,title:item.title,note:item.note,due:item.due,done:item.done,priority:item.priority||'medium',checklistPhase:item.checklist_phase||'pre',sortOrder:Number(item.sort_order)||0,createdByPip:Boolean(item.created_by_pip),seriesId:item.series_id||'',recurrence:item.recurrence||'',recurrenceOngoing:Boolean(item.recurrence_ongoing),createdAt:item.created_at});

function nextRecurringDate(value:string,recurrence:ItemRow['recurrence']){const date=new Date(value);if(recurrence==='weekly')date.setDate(date.getDate()+7);else if(recurrence==='fortnightly')date.setDate(date.getDate()+14);else if(recurrence==='monthly')date.setMonth(date.getMonth()+1);return date}

async function signedIn(){
  const supabase=await createClient();
  const {data:{user},error}=await supabase.auth.getUser();
  return {supabase,user,error};
}

export async function GET(request:Request){
  try{
    const {supabase,user,error:authError}=await signedIn();
    if(authError||!user)return json({error:'Please sign in to open your saved space.'},401);
    const now=new Date();
    const {data:recurring,error:recurringError}=await supabase.from('companion_items').select(fields).eq('user_id',user.id).eq('kind','crew-stream').eq('done',false).eq('recurrence_ongoing',true).not('series_id','is',null).order('due',{ascending:true});
    if(recurringError)throw recurringError;
    const series=new Map<string,ItemRow[]>();
    for(const row of (recurring||[]) as ItemRow[]){const key=row.series_id||'';if(key)series.set(key,[...(series.get(key)||[]),row])}
    for(const rows of series.values()){
      const sample=rows[rows.length-1],recurrence=sample.recurrence;
      if(!sample.due||!recurrence)continue;
      let latest=new Date(sample.due),futureCount=rows.filter(row=>row.due&&new Date(row.due)>now).length;
      const additions:Record<string,unknown>[]=[];
      while(futureCount<12){latest=nextRecurringDate(latest.toISOString(),recurrence);if(latest>now)futureCount++;additions.push({user_id:user.id,kind:'crew-stream',title:sample.title,note:sample.note,due:latest.toISOString(),series_id:sample.series_id,recurrence,recurrence_ongoing:true})}
      if(additions.length){const {error}=await supabase.from('companion_items').upsert(additions,{onConflict:'user_id,series_id,due',ignoreDuplicates:true});if(error)throw error}
    }
    const pastStreamsBefore=new URL(request.url).searchParams.get('pastStreamsBefore');
    if(pastStreamsBefore){
      const cutoff=new Date(pastStreamsBefore);
      if(!Number.isNaN(cutoff.getTime())){
        const {error:cleanupError}=await supabase.from('companion_items').delete().eq('user_id',user.id).eq('kind','crew-stream').lt('due',cutoff.toISOString());
        if(cleanupError)throw cleanupError;
      }
    }
    const {data,error}=await supabase.from('companion_items').select(fields).eq('user_id',user.id).order('created_at',{ascending:false});
    if(error)throw error;
    return json((data as ItemRow[]).map(present));
  }catch{return json({error:'B.E.I.P.I. could not load your saved items.'},500)}
}

export async function POST(request:Request){
  try{
    const {supabase,user,error:authError}=await signedIn();
    if(authError||!user)return json({error:'Please sign in before saving.'},401);
    const body=await request.json() as {kind?:string;title?:string;note?:string;due?:string|null;priority?:string;checklistPhase?:string;sortOrder?:number;createdByPip?:boolean;seriesId?:string;recurrence?:string;recurrenceOngoing?:boolean};
    const title=String(body.title??'').trim(),kind=String(body.kind??'');
    if(!title||!['reminder','checklist','idea','connection','crew-task','crew-stream','crew-milestone'].includes(kind))return json({error:'Check the title and try again.'},400);
    const priority=['low','medium','high'].includes(String(body.priority))?String(body.priority):'medium';
    const checklistPhase=body.checklistPhase==='post'?'post':'pre',recurrence=['weekly','fortnightly','monthly'].includes(String(body.recurrence))?String(body.recurrence):null;
    const {data,error}=await supabase.from('companion_items').insert({user_id:user.id,kind,title:title.slice(0,200),note:String(body.note??'').slice(0,2000),due:body.due||null,priority,checklist_phase:checklistPhase,sort_order:Number.isFinite(body.sortOrder)?body.sortOrder:0,created_by_pip:Boolean(body.createdByPip),series_id:body.seriesId||null,recurrence,recurrence_ongoing:Boolean(body.recurrenceOngoing&&recurrence)}).select(fields).single();
    if(error)throw error;
    return json(present(data as ItemRow),201);
  }catch{return json({error:'B.E.I.P.I. could not save that item.'},500)}
}

export async function PATCH(request:Request){
  try{
    const {supabase,user,error:authError}=await signedIn();
    if(authError||!user)return json({error:'Please sign in before changing saved items.'},401);
    const body=await request.json() as {id?:string;title?:string;note?:string;done?:boolean;due?:string|null;priority?:string;checklistPhase?:string;sortOrder?:number;kind?:string;positions?:Array<{id:string;sortOrder:number}>};
    if(Array.isArray(body.positions)){
      const reorderKind=body.kind==='reminder'?'reminder':'checklist';
      for(const position of body.positions){if(!position.id||!Number.isFinite(position.sortOrder))continue;const {error}=await supabase.from('companion_items').update({sort_order:position.sortOrder,updated_at:new Date().toISOString()}).eq('id',position.id).eq('user_id',user.id).eq('kind',reorderKind);if(error)throw error}
      return json({ok:true});
    }
    if(!body.id)return json({error:'Item not found.'},404);
    const changes:Record<string,unknown>={updated_at:new Date().toISOString()};
    if(typeof body.title==='string'){
      const title=body.title.trim();
      if(!title)return json({error:'Add a stream title before saving.'},400);
      changes.title=title.slice(0,200);
    }
    if(typeof body.note==='string')changes.note=body.note.slice(0,2000);
    if(typeof body.done==='boolean')changes.done=body.done;
    if(body.due===null||typeof body.due==='string')changes.due=body.due;
    if(typeof body.priority==='string'&&['low','medium','high'].includes(body.priority))changes.priority=body.priority;
    if(body.checklistPhase==='pre'||body.checklistPhase==='post')changes.checklist_phase=body.checklistPhase;
    if(Number.isFinite(body.sortOrder))changes.sort_order=body.sortOrder;
    const {data,error}=await supabase.from('companion_items').update(changes).eq('id',body.id).eq('user_id',user.id).select(fields).maybeSingle();
    if(error)throw error;
    if(!data)return json({error:'Item not found.'},404);
    return json(present(data as ItemRow));
  }catch{return json({error:'B.E.I.P.I. could not update that item.'},500)}
}

export async function DELETE(request:Request){
  try{
    const {supabase,user,error:authError}=await signedIn();
    if(authError||!user)return json({error:'Please sign in before deleting saved items.'},401);
    const id=new URL(request.url).searchParams.get('id');
    if(!id)return json({error:'Item not found.'},404);
    const {data,error}=await supabase.from('companion_items').delete().eq('id',id).eq('user_id',user.id).select('id').maybeSingle();
    if(error)throw error;
    if(!data)return json({error:'Item not found.'},404);
    return json({ok:true});
  }catch{return json({error:'B.E.I.P.I. could not delete that item.'},500)}
}
