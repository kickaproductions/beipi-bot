import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function account(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();return {supabase,user}}

export async function GET(request:Request){
 try{const {supabase,user}=await account();if(!user)return json({error:'Sign in to open a shared space.'},401);const broadcasterId=new URL(request.url).searchParams.get('broadcasterId');if(!broadcasterId)return json({error:'Choose a streamer first.'},400);const {data,error}=await supabase.rpc('get_shared_crew_space',{target_broadcaster_id:broadcasterId});if(error)throw error;return json(data)}catch{return json({error:'B.E.I.P.I. could not open this shared space. Run the latest Supabase migration first.'},500)}
}

const itemSchema=z.object({broadcasterId:z.string().min(1),id:z.string().uuid().nullable().optional(),kind:z.enum(['task','note']),title:z.string().trim().min(1).max(200),note:z.string().max(2000).default(''),due:z.string().datetime().nullable().optional(),done:z.boolean().default(false)});
async function save(request:Request){const {supabase,user}=await account();if(!user)return json({error:'Sign in to change a shared space.'},401);const parsed=itemSchema.safeParse(await request.json());if(!parsed.success)return json({error:'Check the shared item and try again.'},400);const value=parsed.data;const {data,error}=await supabase.rpc('save_shared_crew_item',{target_broadcaster_id:value.broadcasterId,item_id:value.id||null,item_kind:value.kind,item_title:value.title,item_note:value.note,item_due:value.due||null,item_done:value.done});if(error)throw error;return json(data,value.id?200:201)}
export async function POST(request:Request){try{return await save(request)}catch{return json({error:'B.E.I.P.I. could not save that shared item.'},500)}}
export async function PATCH(request:Request){try{return await save(request)}catch{return json({error:'B.E.I.P.I. could not update that shared item.'},500)}}

export async function DELETE(request:Request){
 try{const {supabase,user}=await account();if(!user)return json({error:'Sign in to change a shared space.'},401);const url=new URL(request.url),broadcasterId=url.searchParams.get('broadcasterId'),id=url.searchParams.get('id');if(!broadcasterId||!id)return json({error:'Shared item not found.'},404);const {data,error}=await supabase.rpc('delete_shared_crew_item',{target_broadcaster_id:broadcasterId,item_id:id});if(error)throw error;if(!data)return json({error:'Shared item not found.'},404);return json({ok:true})}catch{return json({error:'B.E.I.P.I. could not delete that shared item.'},500)}
}
