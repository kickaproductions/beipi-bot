import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import TesterRequests from './tester-requests';

export const metadata={title:'Beta Access Requests · B.E.I.P.I.'};
export const dynamic='force-dynamic';

export default async function TesterRequestsPage(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/account?next=/developer/tester-requests');const {data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();if(profile?.role!=='developer')redirect('/dashboard');const {data:assurance}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(assurance?.currentLevel!=='aal2')redirect('/account/security?next=/developer/tester-requests');return <TesterRequests/>;}
