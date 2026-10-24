import {NextResponse} from 'next/server';
import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';
import {NDA_VERSION} from '@/app/nda-agreement';

const signingSchema=z.object({signerName:z.string().trim().min(2).max(120),accepted:z.literal(true),version:z.literal(NDA_VERSION)});

export async function POST(request:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:'Please sign in first.'},{status:401});
 const {data:profile}=await supabase.from('profiles').select('role,founding_tester').eq('id',user.id).maybeSingle();
 if(!profile?.founding_tester&&profile?.role!=='developer')return NextResponse.json({error:'Your beta request must be accepted before you can sign the NDA.'},{status:403});
 const parsed=signingSchema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:'Please enter your full legal name and confirm the agreement.'},{status:400});
 const {data:existing,error:existingError}=await supabase.from('beta_nda_acceptances').select('id').eq('user_id',user.id).eq('agreement_version',NDA_VERSION).maybeSingle();
 if(existingError)return NextResponse.json({error:'The signing record is not ready yet. Run the latest Supabase migration and try again.'},{status:500});
 if(existing)return NextResponse.json({ok:true});
 const {error}=await supabase.from('beta_nda_acceptances').insert({user_id:user.id,account_email:user.email||null,signer_name:parsed.data.signerName,agreement_version:NDA_VERSION});
 if(error)return NextResponse.json({error:'The agreement could not be recorded. Please try again.'},{status:500});
 return NextResponse.json({ok:true});
}
