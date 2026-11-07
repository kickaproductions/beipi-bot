import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {z} from 'zod';

const schema=z.object({id:z.string().uuid(),action:z.enum(['lock','unlock'])});

export async function PATCH(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return Response.json({error:'Sign in to manage accounts.'},{status:401});
  const {data:developer}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();
  if(developer?.role!=='developer')return Response.json({error:'Developer access is required.'},{status:403});
  const {data:assurance}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if(assurance?.currentLevel!=='aal2')return Response.json({error:'Two-factor authentication is required.'},{status:403});

  const parsed=schema.safeParse(await request.json());
  if(!parsed.success)return Response.json({error:'Choose a valid account action.'},{status:400});
  if(parsed.data.id===user.id)return Response.json({error:'You cannot lock your own developer account.'},{status:400});

  const {data:target,error:targetError}=await supabase.from('profiles').select('id,role,founding_tester,lifetime_free').eq('id',parsed.data.id).maybeSingle();
  if(targetError||!target)return Response.json({error:'That account could not be found.'},{status:404});

  const admin=createAdminClient();
  const locking=parsed.data.action==='lock';
  const reason=locking?'Emergency lock — suspected account compromise':'Emergency account lock removed by developer';
  const {error:authError}=await admin.auth.admin.updateUserById(parsed.data.id,{ban_duration:locking?'876000h':'none'});
  if(authError)return Response.json({error:locking?'The account could not be locked.':'The account could not be unlocked.'},{status:500});

  const {data:profile,error:profileError}=await supabase.rpc('manage_account_access',{target_id:parsed.data.id,new_role:target.role,new_founding_tester:Boolean(target.founding_tester),new_lifetime_free:Boolean(target.lifetime_free),new_account_status:locking?'suspended':'active',moderation_reason:reason});
  if(profileError||!profile){
    await admin.auth.admin.updateUserById(parsed.data.id,{ban_duration:locking?'none':'876000h'});
    return Response.json({error:'B.E.I.P.I. could not finish the account security update.'},{status:500});
  }

  await admin.from('account_admin_audit').insert({target_user_id:parsed.data.id,actor_user_id:user.id,action:locking?'account_emergency_locked':'account_emergency_unlocked',reason,previous_values:{authLocked:!locking},new_values:{authLocked:locking}});
  return Response.json({ok:true,authLocked:locking,accountStatus:locking?'suspended':'active',reason:locking?reason:''});
}
