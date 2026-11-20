import {createAdminClient} from '@/lib/supabase/admin';
import {createClient} from '@/lib/supabase/server';
import {z} from 'zod';

const selection=z.discriminatedUnion('source',[
  z.object({source:z.literal('twitch')}),
  z.object({source:z.literal('discord')}),
  z.object({source:z.literal('initials')}),
  z.object({source:z.literal('upload'),image:z.string().max(55000).regex(/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/)})
]);

export async function PUT(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return Response.json({error:'Sign in to change your profile picture.'},{status:401});

  const parsed=selection.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return Response.json({error:'Choose a supported profile picture.'},{status:400});

  const choice=parsed.data;
  let avatarUrl:string|null=null;
  if(choice.source==='upload'){
    avatarUrl=choice.image;
  }else if(choice.source!=='initials'){
    const {data,error}=await supabase.from('platform_connections').select('avatar_url')
      .eq('user_id',user.id).eq('platform',choice.source).maybeSingle();
    if(error)return Response.json({error:'Could not load your connected profile picture.'},{status:500});
    if(!data?.avatar_url?.startsWith('https://')){
      return Response.json({error:'This connection has no profile picture available.'},{status:422});
    }
    avatarUrl=data.avatar_url;
  }

  const {data,error}=await createAdminClient().from('profiles').update({avatar_url:avatarUrl})
    .eq('id',user.id).select('avatar_url').single();
  if(error)return Response.json({error:'Could not save your profile picture.'},{status:500});
  return Response.json({avatarUrl:data.avatar_url});
}
