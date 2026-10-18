import {createClient} from '@/lib/supabase/server';
import {z} from 'zod';

const resolveSchema=z.object({logId:z.string().uuid(),resolved:z.boolean()});
async function developer(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return {supabase,error:Response.json({error:'Sign in to manage activity.'},{status:401})};
 const {data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();
 if(profile?.role!=='developer')return {supabase,error:Response.json({error:'Developer access is required.'},{status:403})};
 const {data:assurance}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
 if(assurance?.currentLevel!=='aal2')return {supabase,error:Response.json({error:'Two-factor authentication is required.'},{status:403})};
 return {supabase,error:null};
}

export async function PATCH(request:Request,{params}:{params:Promise<{guildId:string}>}){
 const {supabase,error:accessError}=await developer();if(accessError)return accessError;
 const parsed=resolveSchema.safeParse(await request.json());if(!parsed.success)return Response.json({error:'Choose a valid activity entry.'},{status:400});
 const {guildId}=await params;
 const {data,error}=await supabase.rpc('manage_server_activity',{target_guild_id:guildId,target_log_id:parsed.data.logId,operation:parsed.data.resolved?'resolve':'reopen'});
 if(error)return Response.json({error:error.message||'The activity entry could not be updated.'},{status:500});
 return Response.json({activity:data});
}

export async function DELETE(_request:Request,{params}:{params:Promise<{guildId:string}>}){
 const {supabase,error:accessError}=await developer();if(accessError)return accessError;
 const {guildId}=await params;
 const {data,error}=await supabase.rpc('manage_server_activity',{target_guild_id:guildId,target_log_id:null,operation:'clear_resolved'});
 if(error)return Response.json({error:error.message||'Resolved entries could not be cleared.'},{status:500});
 return Response.json({removed:data});
}
