import Dashboard from '../dashboard';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';

export const dynamic='force-dynamic';

export default async function DashboardPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/account');
  const {data:profile}=await supabase.from('profiles').select('display_name,role,founding_tester').eq('id',user.id).maybeSingle();
  const userName=profile?.display_name||user.user_metadata?.full_name||user.email?.split('@')[0]||'Creator';
  return <Dashboard userName={userName} isDeveloper={profile?.role==='developer'} isTester={Boolean(profile?.founding_tester)||profile?.role==='developer'}/>;
}
