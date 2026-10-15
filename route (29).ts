import {createClient} from '@/lib/supabase/server';

export const runtime='nodejs';
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return new Response('Not signed in.',{status:401});
  const {data:banner}=await supabase.from('discord_banners').select('storage_path,mime_type,file_name').eq('id',id).eq('user_id',user.id).maybeSingle();if(!banner)return new Response('Banner not found.',{status:404});
  const {data,error}=await supabase.storage.from('discord-banners').download(banner.storage_path);if(error||!data)return new Response('Banner file not found.',{status:404});
  return new Response(await data.arrayBuffer(),{headers:{'Content-Type':banner.mime_type,'Content-Disposition':`inline; filename="${banner.file_name.replace(/["\r\n]/g,'')}"`,'Cache-Control':'private, max-age=300'}});
}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return Response.json({error:'Not signed in.'},{status:401});
  const {data:banner}=await supabase.from('discord_banners').select('storage_path').eq('id',id).eq('user_id',user.id).maybeSingle();if(!banner)return Response.json({ok:true});
  await supabase.storage.from('discord-banners').remove([banner.storage_path]);const {error}=await supabase.from('discord_banners').delete().eq('id',id).eq('user_id',user.id);if(error)return Response.json({error:'Could not remove the banner.'},{status:500});return Response.json({ok:true});
}
