import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import ResetPasswordPortal from './reset-password-portal';

export const metadata={title:'Choose a new password · B.E.I.P.I.'};
export const dynamic='force-dynamic';

export default async function ResetPasswordPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/account?recovery=expired');
  return <ResetPasswordPortal/>;
}
