import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import AccountManagement from './account-management';

export const metadata={title:'Account Management · B.E.I.P.I.'};
export const dynamic='force-dynamic';

export default async function AccountsPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/account');
  const {data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();
  if(profile?.role!=='developer')redirect('/dashboard');
  const {data:assurance}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if(assurance?.currentLevel!=='aal2')redirect('/account/security?next=/developer/accounts');
  return <AccountManagement currentUserId={user.id}/>;
}
