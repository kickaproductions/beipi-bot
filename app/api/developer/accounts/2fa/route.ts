import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {z} from 'zod';

const schema=z.object({id:z.string().uuid()});

export async function DELETE(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return Response.json({error:'Sign in to manage account security.'},{status:401});
  const {data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();
  if(profile?.role!=='developer')return Response.json({error:'Developer access is required.'},{status:403});
  const {data:assurance}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if(assurance?.currentLevel!=='aal2')return Response.json({error:'Your own two-factor authentication is required.'},{status:403});
  const parsed=schema.safeParse(await request.json());
  if(!parsed.success)return Response.json({error:'Choose a valid account.'},{status:400});
  if(parsed.data.id===user.id)return Response.json({error:'You cannot remove your own 2FA from the developer portal.'},{status:400});
  try{
    const admin=createAdminClient();
    const {data,error}=await admin.auth.admin.mfa.listFactors({userId:parsed.data.id});
    if(error)throw error;
    const verified=(data?.factors||[]).filter(factor=>factor.status==='verified');
    if(!verified.length)return Response.json({error:'This account does not have verified 2FA.'},{status:400});
    for(const factor of verified){
      const {error:deleteError}=await admin.auth.admin.mfa.deleteFactor({userId:parsed.data.id,id:factor.id});
      if(deleteError)throw deleteError;
    }
    await admin.from('account_admin_audit').insert({target_user_id:parsed.data.id,actor_user_id:user.id,action:'two_factor_removed',reason:'2FA removed by developer',previous_values:{twoFactor:true},new_values:{twoFactor:false}});
    return Response.json({removed:true});
  }catch(value){
    return Response.json({error:value instanceof Error?value.message:'Two-factor authentication could not be removed.'},{status:500});
  }
}
