import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';

export async function POST(request:Request){
 try{
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return Response.json({error:'Sign in before accepting this invitation.'},{status:401});
  const parsed=z.object({token:z.string().min(32).max(256)}).safeParse(await request.json());
  if(!parsed.success)return Response.json({error:'This invitation link is not valid.'},{status:400});
  const {data,error}=await supabase.rpc('accept_crew_invite_link',{invite_token:parsed.data.token});
  if(error)throw error;
  if(!data?.ok)return Response.json({error:data?.error||'This invitation could not be accepted.'},{status:400});
  return Response.json(data,{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'B.E.I.P.I. could not accept this invitation. Run the latest Supabase migration first.'},{status:500})}
}
