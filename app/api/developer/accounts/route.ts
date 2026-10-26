import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {z} from 'zod';

const updateSchema=z.object({id:z.string().uuid(),role:z.enum(['user','developer']),foundingTester:z.boolean(),lifetimeFree:z.boolean(),accountStatus:z.enum(['active','suspended']),reason:z.string().trim().max(500).optional().default('')});
type Profile={id:string;email:string;display_name:string|null;username:string|null;avatar_url:string|null;role:'user'|'developer';founding_tester:boolean;lifetime_free:boolean;account_status:'active'|'suspended';suspension_reason:string|null;suspended_at:string|null;joined_at:string;updated_at:string};
type Server={user_id:string;guild_id:string;guild_name:string;bot_active:boolean;member_count:number;last_seen_at:string;setup_complete:boolean;live_enabled:boolean};
type Audit={target_user_id:string;action:string;reason:string|null;created_at:string};
const output=(profile:Profile,feedbackCount=0,servers:Server[]=[],audit:Audit[]=[],mfaStatus:'enabled'|'disabled'|'unavailable'='unavailable')=>({id:profile.id,email:profile.email,name:profile.display_name||profile.email.split('@')[0],username:profile.username||'',avatarUrl:profile.avatar_url||'',role:profile.role,foundingTester:Boolean(profile.founding_tester),lifetimeFree:Boolean(profile.lifetime_free),accountStatus:profile.account_status||'active',suspensionReason:profile.suspension_reason||'',suspendedAt:profile.suspended_at||'',joinedAt:profile.joined_at,updatedAt:profile.updated_at,feedbackCount,mfaStatus,servers:servers.map(server=>({id:server.guild_id,name:server.guild_name,active:server.bot_active,members:server.member_count,lastSeenAt:server.last_seen_at,setupComplete:server.setup_complete,liveEnabled:server.live_enabled})),audit:audit.map(item=>({action:item.action,reason:item.reason||'',createdAt:item.created_at}))});

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
  const [{data:profiles,error},{data:feedback},{data:servers},{data:audit}]=await Promise.all([
    supabase.from('profiles').select('id,email,display_name,username,avatar_url,role,founding_tester,lifetime_free,account_status,suspension_reason,suspended_at,joined_at,updated_at').order('joined_at',{ascending:false}),
    supabase.from('tester_feedback').select('user_id'),
    supabase.rpc('get_admin_account_servers'),
    supabase.from('account_admin_audit').select('target_user_id,action,reason,created_at').order('created_at',{ascending:false}).limit(200)
  ]);
  if(error)return Response.json({error:'Accounts could not be loaded. Run the account-management migration if it has not been applied yet.'},{status:500});
  const counts=new Map<string,number>();
  for(const report of feedback||[])counts.set(report.user_id,(counts.get(report.user_id)||0)+1);
  const mfa=new Map<string,'enabled'|'disabled'|'unavailable'>();
  try{const admin=createAdminClient();await Promise.all(((profiles||[]) as Profile[]).map(async profile=>{const {data,error}=await admin.auth.admin.mfa.listFactors({userId:profile.id});mfa.set(profile.id,error?'unavailable':data?.factors?.some(factor=>factor.status==='verified')?'enabled':'disabled')}))}catch{for(const profile of (profiles||[]) as Profile[])mfa.set(profile.id,'unavailable')}
  return Response.json({accounts:((profiles||[]) as Profile[]).map(profile=>output(profile,counts.get(profile.id)||0,((servers||[]) as Server[]).filter(server=>server.user_id===profile.id),((audit||[]) as Audit[]).filter(item=>item.target_user_id===profile.id).slice(0,10),mfa.get(profile.id)||'unavailable'))});
}

export async function PATCH(request:Request){
  const {supabase,user,error:accessError}=await developerAccount();
  if(accessError)return accessError;
  const parsed=updateSchema.safeParse(await request.json());
  if(!parsed.success)return Response.json({error:parsed.error.issues[0]?.message||'Check the account update.'},{status:400});
  if(parsed.data.id===user?.id&&(parsed.data.role!=='developer'||parsed.data.accountStatus==='suspended'))return Response.json({error:'You cannot demote or suspend your own developer account.'},{status:400});
  if(parsed.data.accountStatus==='suspended'&&!parsed.data.reason)return Response.json({error:'Choose or enter a suspension reason.'},{status:400});
  const {data,error}=await supabase.rpc('manage_account_access',{target_id:parsed.data.id,new_role:parsed.data.role,new_founding_tester:parsed.data.foundingTester,new_lifetime_free:parsed.data.lifetimeFree,new_account_status:parsed.data.accountStatus,moderation_reason:parsed.data.reason||null});
  if(error||!data)return Response.json({error:error?.message||'The account could not be updated.'},{status:500});
  const profile=(Array.isArray(data)?data[0]:data) as Profile;
  return Response.json({account:output(profile)});
}
