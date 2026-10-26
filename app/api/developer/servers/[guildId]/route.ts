import {createClient} from '@/lib/supabase/server';

export async function GET(_request:Request,{params}:{params:Promise<{guildId:string}>}){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return Response.json({error:'Sign in to view this server.'},{status:401});
  const {data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();
  if(profile?.role!=='developer')return Response.json({error:'Developer access is required.'},{status:403});
  const {data:assurance}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if(assurance?.currentLevel!=='aal2')return Response.json({error:'Two-factor authentication is required.'},{status:403});
  const {guildId}=await params;
  const {data,error}=await supabase.rpc('get_admin_server_detail',{target_guild_id:guildId});
  if(error)return Response.json({error:'Server details could not be loaded. Run the server-management migration if it has not been applied yet.'},{status:500});
  if(!data)return Response.json({error:'This B.E.I.P.I. server could not be found.'},{status:404});
  const server=data as {owner?:{id?:string;name?:string}|null};
  if(server.owner?.id){const {data:owner}=await supabase.from('profiles').select('username').eq('id',server.owner.id).maybeSingle();if(owner?.username)server.owner.name=owner.username}
  return Response.json({server},{headers:{'Cache-Control':'no-store'}});
}
