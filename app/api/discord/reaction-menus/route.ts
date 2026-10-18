import {createClient} from '@/lib/supabase/server';

export async function GET(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return Response.json({error:'Sign in to view reaction roles.'},{status:401});
 const {data,error}=await supabase.from('discord_reaction_menus').select('id,title,guild_id,channel_id,message_id,guild_name,channel_name,remove_on_unreact,discord_reaction_role_items(emoji,role_id,role_name)').eq('user_id',user.id).eq('active',true).order('created_at',{ascending:false});
 if(error)return Response.json({error:'Published reaction roles could not be loaded.'},{status:500});
 return Response.json({menus:(data||[]).map(menu=>({id:menu.id,title:menu.title,guildId:menu.guild_id,channelId:menu.channel_id,messageId:menu.message_id,guildName:menu.guild_name,channelName:menu.channel_name,removeOnUnreact:menu.remove_on_unreact,roles:(menu.discord_reaction_role_items||[]).map(role=>({emoji:role.emoji,roleId:role.role_id,roleName:role.role_name}))}))},{headers:{'Cache-Control':'no-store'}});
}
