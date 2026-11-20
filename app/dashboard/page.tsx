import Dashboard from '../dashboard';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {NDA_VERSION} from '../nda-agreement';

export const dynamic='force-dynamic';

export default async function DashboardPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/account');
  const {data:profile}=await supabase.from('profiles').select('display_name,username,avatar_url,role,founding_tester').eq('id',user.id).maybeSingle();
  const {data:connections}=await supabase.from('platform_connections').select('platform,avatar_url')
    .eq('user_id',user.id).in('platform',['twitch','discord']);
  const avatarSources={
    twitch:Boolean(connections?.some(connection=>connection.platform==='twitch'&&connection.avatar_url)),
    discord:Boolean(connections?.some(connection=>connection.platform==='discord'&&connection.avatar_url)),
  };
  const userName=profile?.username||profile?.display_name||user.user_metadata?.full_name||user.email?.split('@')[0]||'Creator';
  const approved=Boolean(profile?.founding_tester)||profile?.role==='developer';
  const trusted=Boolean(user.app_metadata?.trusted_access);
  const agreement=approved&&!trusted?await supabase.from('beta_nda_acceptances').select('id').eq('user_id',user.id).eq('agreement_version',NDA_VERSION).maybeSingle():{data:null,error:null};
  const agreementAccepted=trusted?true:agreement.error?profile?.role==='developer':Boolean(agreement.data);
  return <Dashboard accountId={user.id} initialAvatarUrl={profile?.avatar_url??null} avatarSources={avatarSources} userName={userName} initialUsername={profile?.username||''} isDeveloper={profile?.role==='developer'} isTester={approved&&agreementAccepted}/>;
}
