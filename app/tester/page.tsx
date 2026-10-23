import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import TesterPortal from './tester-portal';
import TesterAccessWall from './tester-access-wall';
export const metadata={title:'Tester Portal · B.E.I.P.I.'};export const dynamic='force-dynamic';
export default async function TesterPage(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/account?next=/tester');const {data:profile}=await supabase.from('profiles').select('display_name,role,founding_tester').eq('id',user.id).maybeSingle();const name=profile?.display_name||user.user_metadata?.full_name||'Creator';if(!profile?.founding_tester&&profile?.role!=='developer'){const {data:request}=await supabase.from('tester_access_requests').select('status,developer_response,created_at,updated_at').eq('user_id',user.id).maybeSingle();return <TesterAccessWall name={name} initialRequest={request||null}/>;}return <TesterPortal name={name}/>}
