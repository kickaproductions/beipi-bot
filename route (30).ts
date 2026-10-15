import {createClient} from '@/lib/supabase/server';

export const runtime='nodejs';
const allowed=new Set(['image/png','image/jpeg','image/webp','image/gif']);
const extensions:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'};

export async function POST(request:Request){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
  if(!user)return Response.json({error:'Sign in before uploading a banner.'},{status:401});
  const mime=request.headers.get('content-type')?.split(';')[0]||'';if(!allowed.has(mime))return Response.json({error:'Use a PNG, JPEG, WebP or GIF image.'},{status:415});
  const bytes=await request.arrayBuffer();if(!bytes.byteLength||bytes.byteLength>5*1024*1024)return Response.json({error:'Choose a banner smaller than 5 MB.'},{status:413});
  const id=crypto.randomUUID(),fileName=request.headers.get('x-file-name')||`banner.${extensions[mime]}`,path=`${user.id}/${id}.${extensions[mime]}`;
  const {error:uploadError}=await supabase.storage.from('discord-banners').upload(path,bytes,{contentType:mime,upsert:false});
  if(uploadError)return Response.json({error:'Could not store that banner.'},{status:500});
  const {error}=await supabase.from('discord_banners').insert({id,user_id:user.id,storage_path:path,file_name:fileName.slice(0,180),mime_type:mime,byte_size:bytes.byteLength});
  if(error){await supabase.storage.from('discord-banners').remove([path]);return Response.json({error:'Could not save that banner.'},{status:500})}
  return Response.json({id},{status:201});
}
