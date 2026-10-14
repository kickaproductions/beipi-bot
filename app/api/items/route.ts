import {createClient} from '@/lib/supabase/server';

type ItemRow={id:string;kind:string;title:string;note:string;due:string|null;done:boolean;created_at:string};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const present=(item:ItemRow)=>({id:item.id,kind:item.kind,title:item.title,note:item.note,due:item.due,done:item.done,createdAt:item.created_at});

async function signedIn(){
  const supabase=await createClient();
  const {data:{user},error}=await supabase.auth.getUser();
  return {supabase,user,error};
}

export async function GET(){
  try{
    const {supabase,user,error:authError}=await signedIn();
    if(authError||!user)return json({error:'Please sign in to open your saved space.'},401);
    const {data,error}=await supabase.from('companion_items').select('id,kind,title,note,due,done,created_at').order('created_at',{ascending:false});
    if(error)throw error;
    return json((data as ItemRow[]).map(present));
  }catch{return json({error:'B.E.I.P.I. could not load your saved items.'},500)}
}

export async function POST(request:Request){
  try{
    const {supabase,user,error:authError}=await signedIn();
    if(authError||!user)return json({error:'Please sign in before saving.'},401);
    const body=await request.json() as {kind?:string;title?:string;note?:string;due?:string|null};
    const title=String(body.title??'').trim(),kind=String(body.kind??'');
    if(!title||!['reminder','checklist','idea','connection'].includes(kind))return json({error:'Check the title and try again.'},400);
    const {data,error}=await supabase.from('companion_items').insert({user_id:user.id,kind,title:title.slice(0,200),note:String(body.note??'').slice(0,2000),due:body.due||null}).select('id,kind,title,note,due,done,created_at').single();
    if(error)throw error;
    return json(present(data as ItemRow),201);
  }catch{return json({error:'B.E.I.P.I. could not save that item.'},500)}
}

export async function PATCH(request:Request){
  try{
    const {supabase,user,error:authError}=await signedIn();
    if(authError||!user)return json({error:'Please sign in before changing saved items.'},401);
    const body=await request.json() as {id?:string;done?:boolean;due?:string|null};
    if(!body.id)return json({error:'Item not found.'},404);
    const changes:Record<string,unknown>={updated_at:new Date().toISOString()};
    if(typeof body.done==='boolean')changes.done=body.done;
    if(body.due===null||typeof body.due==='string')changes.due=body.due;
    const {data,error}=await supabase.from('companion_items').update(changes).eq('id',body.id).eq('user_id',user.id).select('id,kind,title,note,due,done,created_at').maybeSingle();
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
