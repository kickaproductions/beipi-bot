import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import ServerManagement from './server-management';

export const metadata={title:'Server Management · B.E.I.P.I.'};
export const dynamic='force-dynamic';

export default async function ServerPage({params}:{params:Promise<{guildId:string}>}){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/account');
  const {data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();
  if(profile?.role!=='developer')redirect('/dashboard');
  const {data:assurance}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const {guildId}=await params;
  if(assurance?.currentLevel!=='aal2')redirect('/account/security?next=/developer/servers/'+encodeURIComponent(guildId));
  return <ServerManagement guildId={guildId}/>;
}
