import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import TesterPortal from './tester-portal';
export const metadata={title:'Tester Portal · B.E.I.P.I.'};export const dynamic='force-dynamic';
export default async function TesterPage(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/account');const {data:profile}=await supabase.from('profiles').select('display_name,role,founding_tester,lifetime_free').eq('id',user.id).maybeSingle();if(!profile?.founding_tester&&profile?.role!=='developer')redirect('/dashboard');return <TesterPortal name={profile.display_name||user.user_metadata?.full_name||'Tester'} lifetimeFree={Boolean(profile.lifetime_free)} isDeveloper={profile.role==='developer'}/>}
