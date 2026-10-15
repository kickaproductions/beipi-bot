import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import SecurityPortal from './security-portal';

export const metadata={title:'Security & 2FA · B.E.I.P.I.'};
export const dynamic='force-dynamic';

export default async function SecurityPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/account');
  return <SecurityPortal email={user.email||''}/>;
}
