import {createClient} from '@/lib/supabase/server';
import {draftSchema} from '@/app/discord-schema';

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function account(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();return {supabase,user}}
const output=(row:{id:string;payload:unknown;updated_at:string})=>({id:row.id,payload:row.payload,updatedAt:row.updated_at});

export async function GET(){
  const {supabase,user}=await account();if(!user)return json({error:'Sign in to view your drafts.'},401);
  const {data,error}=await supabase.from('discord_drafts').select('id,payload,updated_at').eq('user_id',user.id).order('updated_at',{ascending:false});
  if(error)return json({error:'Could not load your Discord drafts.'},500);return json((data||[]).map(output));
}
export async function POST(request:Request){
  const {supabase,user}=await account();if(!user)return json({error:'Sign in to save a draft.'},401);
  const body=await request.json() as {payload?:unknown};const parsed=draftSchema.safeParse(body.payload);if(!parsed.success)return json({error:parsed.error.issues[0]?.message||'Check the draft details.'},400);
  const {count,error:countError}=await supabase.from('discord_drafts').select('id',{count:'exact',head:true}).eq('user_id',user.id);if(countError)return json({error:'Could not check your saved drafts.'},500);
  if((count||0)>=5)return json({error:'You can keep up to five drafts. Delete one before saving another.'},409);
  const {data,error}=await supabase.from('discord_drafts').insert({user_id:user.id,payload:parsed.data}).select('id,payload,updated_at').single();if(error)return json({error:'Could not save this Discord draft.'},500);return json(output(data),201);
}
export async function PATCH(request:Request){
  const {supabase,user}=await account();if(!user)return json({error:'Sign in to update a draft.'},401);
  const body=await request.json() as {id?:string;payload?:unknown};if(!body.id)return json({error:'Draft ID is missing.'},400);const parsed=draftSchema.safeParse(body.payload);if(!parsed.success)return json({error:parsed.error.issues[0]?.message||'Check the draft details.'},400);
  const {data,error}=await supabase.from('discord_drafts').update({payload:parsed.data,updated_at:new Date().toISOString()}).eq('id',body.id).eq('user_id',user.id).select('id,payload,updated_at').maybeSingle();if(error)return json({error:'Could not update this Discord draft.'},500);if(!data)return json({error:'Draft not found.'},404);return json(output(data));
}
export async function DELETE(request:Request){
  const {supabase,user}=await account();if(!user)return json({error:'Sign in to delete a draft.'},401);const id=new URL(request.url).searchParams.get('id');if(!id)return json({error:'Draft ID is missing.'},400);
  const {error}=await supabase.from('discord_drafts').delete().eq('id',id).eq('user_id',user.id);if(error)return json({error:'Could not delete this draft.'},500);return json({ok:true});
}
