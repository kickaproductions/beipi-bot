import {createClient} from '@/lib/supabase/server';
import {z} from 'zod';

const updateSchema=z.object({id:z.string().uuid(),role:z.enum(['user','developer']),foundingTester:z.boolean(),lifetimeFree:z.boolean()});
type Profile={id:string;email:string;display_name:string|null;avatar_url:string|null;role:'user'|'developer';founding_tester:boolean;lifetime_free:boolean;joined_at:string;updated_at:string};
const output=(profile:Profile,feedbackCount=0)=>({id:profile.id,email:profile.email,name:profile.display_name||profile.email.split('@')[0],avatarUrl:profile.avatar_url||'',role:profile.role,foundingTester:Boolean(profile.founding_tester),lifetimeFree:Boolean(profile.lifetime_free),joinedAt:profile.joined_at,updatedAt:profile.updated_at,feedbackCount});

async function developerAccount(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return {supabase,user:null,error:Response.json({error:'Sign in to manage accounts.'},{status:401})};
  const {data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();
  if(profile?.role!=='developer')return {supabase,user,error:Response.json({error:'Developer access is required.'},{status:403})};
  const {data:assurance}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if(assurance?.currentLevel!=='aal2')return {supabase,user,error:Response.json({error:'Two-factor authentication is required.'},{status:403})};
  return {supabase,user,error:null};
}

export async function GET(){
  const {supabase,error:accessError}=await developerAccount();
  if(accessError)return accessError;
  const [{data:profiles,error},{data:feedback}]=await Promise.all([
    supabase.from('profiles').select('id,email,display_name,avatar_url,role,founding_tester,lifetime_free,joined_at,updated_at').order('joined_at',{ascending:false}),
    supabase.from('tester_feedback').select('user_id')
  ]);
  if(error)return Response.json({error:'Accounts could not be loaded. Run the account-management migration if it has not been applied yet.'},{status:500});
  const counts=new Map<string,number>();
  for(const report of feedback||[])counts.set(report.user_id,(counts.get(report.user_id)||0)+1);
  return Response.json({accounts:((profiles||[]) as Profile[]).map(profile=>output(profile,counts.get(profile.id)||0))});
}

export async function PATCH(request:Request){
  const {supabase,user,error:accessError}=await developerAccount();
  if(accessError)return accessError;
  const parsed=updateSchema.safeParse(await request.json());
  if(!parsed.success)return Response.json({error:parsed.error.issues[0]?.message||'Check the account update.'},{status:400});
  if(parsed.data.id===user?.id&&parsed.data.role!=='developer')return Response.json({error:'You cannot remove your own developer access.'},{status:400});
  const {data,error}=await supabase.rpc('manage_account_access',{target_id:parsed.data.id,new_role:parsed.data.role,new_founding_tester:parsed.data.foundingTester,new_lifetime_free:parsed.data.lifetimeFree});
  if(error||!data)return Response.json({error:error?.message||'The account could not be updated.'},{status:500});
  const profile=(Array.isArray(data)?data[0]:data) as Profile;
  return Response.json({account:output(profile)});
}
