import {NextResponse} from 'next/server';
import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {BETA_RULES_VERSION} from '@/app/beta-rules';

const schema=z.object({accepted:z.literal(true),version:z.literal(BETA_RULES_VERSION)});

export async function POST(request:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:'Please sign in first.'},{status:401});
 const {data:profile}=await supabase.from('profiles').select('founding_tester').eq('id',user.id).maybeSingle();
 if(!user.app_metadata?.trusted_access||!profile?.founding_tester)return NextResponse.json({error:'Trusted beta access has not been granted to this account.'},{status:403});
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:'Please confirm that you accept the current beta testing rules.'},{status:400});
 if(user.app_metadata?.beta_rules_version===BETA_RULES_VERSION)return NextResponse.json({ok:true});
 const admin=createAdminClient();
 const {error}=await admin.auth.admin.updateUserById(user.id,{app_metadata:{...(user.app_metadata||{}),trusted_access:true,beta_rules_version:BETA_RULES_VERSION,beta_rules_accepted_at:new Date().toISOString()}});
 if(error)return NextResponse.json({error:'Your acceptance could not be recorded. Please try again.'},{status:500});
 return NextResponse.json({ok:true});
}
