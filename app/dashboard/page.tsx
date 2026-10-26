import Dashboard from '../dashboard';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {NDA_VERSION} from '../nda-agreement';

export const dynamic='force-dynamic';

export default async function DashboardPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/account');
  const {data:profile}=await supabase.from('profiles').select('display_name,username,role,founding_tester').eq('id',user.id).maybeSingle();
  const userName=profile?.username||profile?.display_name||user.user_metadata?.full_name||user.email?.split('@')[0]||'Creator';
  const approved=Boolean(profile?.founding_tester)||profile?.role==='developer';
  const {data:acceptance,error:acceptanceError}=approved?await supabase.from('beta_nda_acceptances').select('id').eq('user_id',user.id).eq('agreement_version',NDA_VERSION).maybeSingle():{data:null,error:null};
  const ndaAccepted=acceptanceError?approved:Boolean(acceptance);
  return <Dashboard userName={userName} initialUsername={profile?.username||''} isDeveloper={profile?.role==='developer'} isTester={approved&&ndaAccepted}/>;
}
