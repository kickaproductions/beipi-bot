import {createAdminClient} from '@/lib/supabase/admin';
import {decryptSession} from '@/app/api/auth/twitch/session';
import {createClient} from '@/lib/supabase/server';

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function GET(){
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user)return json({error:'Sign in to manage your public schedule.'},401);
  const {data,error}=await createAdminClient().from('twitch_week_shares').select('broadcaster_id').eq('user_id',user.id).maybeSingle();
  if(error)return json({error:'Could not load public schedule settings.'},500);
  return json({broadcasterId:data?.broadcaster_id??null});
}

export async function PUT(request:Request){
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user)return json({error:'Sign in to manage your public schedule.'},401);
  const body=await request.json().catch(()=>null);
  if(typeof body?.enabled!=='boolean')return json({error:'Choose whether to publish your schedule.'},400);
  let broadcasterId:string|null=null;
  if(body.enabled){
    const {data,error}=await db.from('platform_connections').select('external_user_id,encrypted_session').eq('user_id',user.id).eq('platform','twitch').maybeSingle();
    if(error)return json({error:'Could not check your Twitch connection.'},500);
    if(!data||decryptSession(data.encrypted_session||'')?.user.id!==data.external_user_id||!/^\d{1,20}$/.test(data.external_user_id))return json({error:'Connect Twitch before publishing your schedule.'},400);
    broadcasterId=data.external_user_id;
  }
  const shares=createAdminClient().from('twitch_week_shares');
  const {error}=await (broadcasterId?shares.upsert({user_id:user.id,broadcaster_id:broadcasterId},{onConflict:'user_id'}):shares.delete().eq('user_id',user.id));
  if(error)return json({error:'Could not save public schedule settings.'},500);
  return json({broadcasterId});
}
