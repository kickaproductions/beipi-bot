import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function account(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();return {supabase,user}}

export async function GET(){
 try{const {supabase,user}=await account();if(!user)return json({error:'Sign in to manage shared spaces.'},401);const {data,error}=await supabase.rpc('crew_invitation_overview');if(error)throw error;return json(data)}catch{return json({error:'B.E.I.P.I. could not load your invitations. Run the latest Supabase migration first.'},500)}
}

export async function POST(request:Request){
 try{const {supabase,user}=await account();if(!user)return json({error:'Sign in to invite a moderator.'},401);const parsed=z.object({twitchUsername:z.string().trim().min(1).max(60)}).safeParse(await request.json());if(!parsed.success)return json({error:'Enter the moderator’s Twitch username.'},400);const {data,error}=await supabase.rpc('invite_crew_moderator',{target_twitch_username:parsed.data.twitchUsername.replace(/^@/,'')});if(error)throw error;if(!data?.ok)return json({error:data?.error||'That moderator could not be invited.'},400);return json(data,201)}catch{return json({error:'B.E.I.P.I. could not send that invitation.'},500)}
}

export async function PATCH(request:Request){
 try{const {supabase,user}=await account();if(!user)return json({error:'Sign in to answer this invitation.'},401);const parsed=z.object({id:z.string().uuid(),action:z.enum(['accept','decline','revoke'])}).safeParse(await request.json());if(!parsed.success)return json({error:'That invitation could not be changed.'},400);const {data,error}=await supabase.rpc('update_crew_invitation',{invitation_id:parsed.data.id,requested_action:parsed.data.action});if(error)throw error;if(!data)return json({error:'That invitation is no longer available.'},404);return json({ok:true})}catch{return json({error:'B.E.I.P.I. could not update that invitation.'},500)}
}
