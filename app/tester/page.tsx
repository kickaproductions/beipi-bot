import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import TesterPortal from './tester-portal';
import TesterAccessWall from './tester-access-wall';
import NdaAcceptance from './nda-acceptance';
import {NDA_VERSION} from '../nda-agreement';
export const metadata={title:'Tester Portal · B.E.I.P.I.'};export const dynamic='force-dynamic';
export default async function TesterPage(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/account?next=/tester');const {data:profile}=await supabase.from('profiles').select('display_name,username,role,founding_tester').eq('id',user.id).maybeSingle();const name=profile?.username||profile?.display_name||user.user_metadata?.full_name||'Creator';if(!profile?.founding_tester&&profile?.role!=='developer'){const {data:request}=await supabase.from('tester_access_requests').select('status,developer_response,created_at,updated_at').eq('user_id',user.id).maybeSingle();return <TesterAccessWall name={name} initialRequest={request||null}/>;}const {data:acceptance,error:acceptanceError}=await supabase.from('beta_nda_acceptances').select('id').eq('user_id',user.id).eq('agreement_version',NDA_VERSION).maybeSingle();if(!acceptanceError&&!acceptance)return <NdaAcceptance email={user.email||'Your B.E.I.P.I. account'}/>;return <TesterPortal name={name}/>}
