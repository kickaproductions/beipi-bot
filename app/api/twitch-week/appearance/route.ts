import {createAdminClient} from '@/lib/supabase/admin';
import {createClient} from '@/lib/supabase/server';
import {readTwitchPanelAppearance,twitchPanelAppearanceSchema} from '@/lib/twitch-panel-appearance';

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

async function signedInUser(){
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  return user;
}

export async function GET(){
  const user=await signedInUser();
  if(!user)return json({error:'Sign in to edit the panel appearance.'},401);
  const {data,error}=await createAdminClient().from('twitch_panel_appearance').select('appearance').eq('user_id',user.id).maybeSingle();
  if(error)return json({error:'Could not load the panel appearance.'},500);
  return json({appearance:readTwitchPanelAppearance(data?.appearance)});
}

export async function PUT(request:Request){
  const user=await signedInUser();
  if(!user)return json({error:'Sign in to edit the panel appearance.'},401);
  const parsed=twitchPanelAppearanceSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return json({error:'Check the panel title, theme and accent colour.'},400);
  const {error}=await createAdminClient().from('twitch_panel_appearance').upsert({user_id:user.id,appearance:parsed.data});
  if(error)return json({error:'Could not save the panel appearance.'},500);
  return json({appearance:parsed.data});
}
