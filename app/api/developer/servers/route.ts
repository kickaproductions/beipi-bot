import {createClient} from '@/lib/supabase/server';

async function developer(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return {supabase,error:Response.json({error:'Sign in to view servers.'},{status:401})};
  const {data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();
  if(profile?.role!=='developer')return {supabase,error:Response.json({error:'Developer access is required.'},{status:403})};
  const {data:assurance}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if(assurance?.currentLevel!=='aal2')return {supabase,error:Response.json({error:'Two-factor authentication is required.'},{status:403})};
  return {supabase,error:null};
}

export async function GET(){
  const {supabase,error:accessError}=await developer();
  if(accessError)return accessError;
  const {data,error}=await supabase.rpc('get_admin_servers');
  if(error)return Response.json({error:'Server information could not be loaded. Run the server-management migration if it has not been applied yet.'},{status:500});
  const servers=((data||[]) as Record<string,unknown>[]).map(row=>({
    guildId:row.guild_id,guildName:row.guild_name,botActive:row.bot_active,memberCount:row.member_count,
    installedAt:row.installed_at,lastSeenAt:row.last_seen_at,setupComplete:row.setup_complete,
    liveEnabled:row.live_enabled,ownerName:row.owner_name,ownerEmail:row.owner_email
  }));
  return Response.json({servers},{headers:{'Cache-Control':'no-store'}});
}
