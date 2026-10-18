import {createClient} from '@/lib/supabase/server';

export async function GET(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return Response.json({error:'Sign in to view reaction roles.'},{status:401});
 const {data,error}=await supabase.from('discord_reaction_menus').select('id,title,guild_name,channel_name,discord_reaction_role_items(emoji,role_name)').eq('user_id',user.id).eq('active',true).order('created_at',{ascending:false});
 if(error)return Response.json({error:'Published reaction roles could not be loaded.'},{status:500});
 return Response.json({menus:(data||[]).map(menu=>({id:menu.id,title:menu.title,guildName:menu.guild_name,channelName:menu.channel_name,roles:(menu.discord_reaction_role_items||[]).map(role=>({emoji:role.emoji,roleName:role.role_name}))}))},{headers:{'Cache-Control':'no-store'}});
}
