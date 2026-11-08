import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {z} from 'zod';

const schema=z.object({id:z.string().uuid(),action:z.enum(['grant','revoke']),accessType:z.enum(['beta','trusted']).optional()});

export async function PATCH(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return Response.json({error:'Sign in to manage accounts.'},{status:401});
  const {data:developer}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();
  if(developer?.role!=='developer')return Response.json({error:'Developer access is required.'},{status:403});
  const {data:assurance}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if(assurance?.currentLevel!=='aal2')return Response.json({error:'Two-factor authentication is required.'},{status:403});

  const parsed=schema.safeParse(await request.json());
  if(!parsed.success)return Response.json({error:'Choose a valid access action.'},{status:400});
  if(parsed.data.id===user.id)return Response.json({error:'Your own developer access does not need a trusted-access exemption.'},{status:400});

  const admin=createAdminClient();
  const [{data:target,error:targetError},{data:authTarget,error:authTargetError}]=await Promise.all([admin.from('profiles').select('id,role,founding_tester,lifetime_free,account_status').eq('id',parsed.data.id).maybeSingle(),admin.auth.admin.getUserById(parsed.data.id)]);
  if(targetError||!target||authTargetError||!authTarget.user)return Response.json({error:'That account could not be found.'},{status:404});
  if(target.role==='developer')return Response.json({error:'Developer accounts already have their own protected access.'},{status:400});
  if(target.account_status!=='active')return Response.json({error:'Restore or unlock this account before granting access.'},{status:400});

  const granting=parsed.data.action==='grant';
  const accessType=parsed.data.accessType||'trusted';
  const trusted=granting&&accessType==='trusted';
  const previousMetadata=authTarget.user.app_metadata||{};
  const {error:authError}=await admin.auth.admin.updateUserById(parsed.data.id,{app_metadata:{...previousMetadata,trusted_access:trusted,beta_rules_version:null,beta_rules_accepted_at:null}});
  if(authError)return Response.json({error:'Trusted access could not be updated.'},{status:500});
  const {data:profile,error}=await admin.from('profiles').update({founding_tester:granting,updated_at:new Date().toISOString()}).eq('id',parsed.data.id).select('id,founding_tester,lifetime_free').single();
  if(error||!profile){await admin.auth.admin.updateUserById(parsed.data.id,{app_metadata:previousMetadata});return Response.json({error:'Trusted access could not be updated.'},{status:500});}

  const action=!granting?'trusted_access_revoked':trusted?'trusted_access_granted':'beta_access_granted';
  const reason=!granting?'B.E.I.P.I. access revoked':trusted?'Trusted B.E.I.P.I. access granted without an agreement requirement':'Beta tester access granted; NDA acceptance required';
  await admin.from('account_admin_audit').insert({target_user_id:parsed.data.id,actor_user_id:user.id,action,reason,previous_values:{foundingTester:target.founding_tester,ndaExempt:Boolean(previousMetadata.trusted_access)},new_values:{foundingTester:profile.founding_tester,ndaExempt:trusted}});
  return Response.json({ok:true,foundingTester:Boolean(profile.founding_tester),lifetimeFree:Boolean(profile.lifetime_free),ndaExempt:trusted});
}

