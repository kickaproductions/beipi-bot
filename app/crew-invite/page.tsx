import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import AcceptCrewInvite from './accept-crew-invite';

export const metadata={title:'Shared-space invitation · B.E.I.P.I.'};
export const dynamic='force-dynamic';

export default async function CrewInvitePage({searchParams}:{searchParams:Promise<{token?:string}>}){
 const token=(await searchParams).token?.trim()||'';
 if(!token)return <AcceptCrewInvite token=""/>;
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect(`/account?next=${encodeURIComponent(`/crew-invite?token=${token}`)}`);
 return <AcceptCrewInvite token={token}/>;
}
