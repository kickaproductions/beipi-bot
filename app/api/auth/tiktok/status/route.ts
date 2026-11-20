import {createClient} from '@/lib/supabase/server';
import {tiktokConfig} from '../config';

const headers={'Cache-Control':'private, no-store'};

export async function GET(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return Response.json({error:'Sign in to view your TikTok connection.'},{status:401,headers});
  const {data,error}=await supabase.from('platform_connections').select('display_name,avatar_url')
    .eq('user_id',user.id).eq('platform','tiktok').maybeSingle();
  if(error)return Response.json({error:'Could not check the TikTok connection.'},{status:500,headers});
  return Response.json({configured:Boolean(tiktokConfig()),profile:data},{headers});
}

export async function DELETE(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return Response.json({error:'Sign in to disconnect TikTok.'},{status:401,headers});
  const {error}=await supabase.from('platform_connections').delete().eq('user_id',user.id).eq('platform','tiktok');
  if(error)return Response.json({error:'Could not disconnect TikTok.'},{status:500,headers});
  return Response.json({configured:Boolean(tiktokConfig()),profile:null},{headers});
}
