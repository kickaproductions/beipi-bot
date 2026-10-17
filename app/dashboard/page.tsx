import Dashboard from '../dashboard';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';

export const dynamic='force-dynamic';

export default async function DashboardPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/account');
  const {data:profile}=await supabase.from('profiles').select('role,founding_tester').eq('id',user.id).maybeSingle();
  return <Dashboard isDeveloper={profile?.role==='developer'} isTester={Boolean(profile?.founding_tester)||profile?.role==='developer'}/>;
}
