import {createClient} from '@/lib/supabase/server';

export type Platform='twitch'|'discord'|'google'|'kick';

type ConnectionInput={
  platform:Platform;
  externalUserId:string;
  displayName:string;
  username?:string;
  avatarUrl?:string;
  metadata?:Record<string,unknown>;
  encryptedSession:string;
};

async function signedInClient(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Sign in to B.E.I.P.I. before connecting a platform.');
  return {supabase,user};
}

export async function savePlatformConnection(input:ConnectionInput){
  const {supabase,user}=await signedInClient();
  const {error}=await supabase.from('platform_connections').upsert({
    user_id:user.id,
    platform:input.platform,
    external_user_id:input.externalUserId,
    display_name:input.displayName,
    username:input.username||null,
    avatar_url:input.avatarUrl||null,
    metadata:input.metadata||{},
    encrypted_session:input.encryptedSession,
    connected_at:new Date().toISOString(),
    updated_at:new Date().toISOString()
  },{onConflict:'user_id,platform'});
  if(error)throw error;
}

export async function getPlatformConnection(platform:Platform){
  const {supabase,user}=await signedInClient();
  const {data,error}=await supabase.from('platform_connections').select('*').eq('user_id',user.id).eq('platform',platform).maybeSingle();
  if(error)throw error;
  return data;
}

export async function removePlatformConnection(platform:Platform){
  const {supabase,user}=await signedInClient();
  const {error}=await supabase.from('platform_connections').delete().eq('user_id',user.id).eq('platform',platform);
  if(error)throw error;
}
