import {createClient} from '@/lib/supabase/server';
import {z} from 'zod';

const schema=z.object({username:z.string().trim().min(3).max(24).regex(/^[A-Za-z0-9_]+$/,'Use only letters, numbers or underscores.')});

export async function PATCH(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return Response.json({error:'Sign in to update your profile.'},{status:401});
  const parsed=schema.safeParse(await request.json());
  if(!parsed.success)return Response.json({error:parsed.error.issues[0]?.message||'Check your username.'},{status:400});
  const {data,error}=await supabase.rpc('update_my_username',{new_username:parsed.data.username});
  if(error)return Response.json({error:error.message.includes('taken')?'That username is already taken.':error.message},{status:400});
  return Response.json({username:data});
}
