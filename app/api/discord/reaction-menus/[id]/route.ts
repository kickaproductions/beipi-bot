import {NextRequest} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {describeDiscordReactionError} from '@/lib/discord-reaction-error';
import {createDiscordReactionBatch} from '@/lib/discord-reaction-batch';
import {fetchDiscordGuilds,fetchDiscordGuildsWithRefresh,hasDiscordGuildPermissions,ManageRoles,ManageServer,selectDiscordSession,type DiscordGuild} from '@/lib/discord-guilds';

import {highestDiscordRole, roleAssignmentRestriction, type DiscordRole} from '@/lib/discord-role-eligibility';

export const maxDuration=60;

type BotUser={id:string};type GuildMember={roles:string[]};
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return Response.json({error:'Sign in to edit reaction roles.'},{status:401});
 const body=await request.json() as {reactions?:{emoji?:string;roleId?:string;roleName?:string}[];removeOnUnreact?:boolean};const reactions=(body.reactions||[]).map(item=>({emoji:item.emoji?.trim()||'',roleId:item.roleId||'',roleName:item.roleName?.trim()||''}));
 if(!reactions.length||reactions.length>20||reactions.some(item=>!item.emoji||!item.roleId||!item.roleName)||new Set(reactions.map(item=>item.emoji)).size!==reactions.length)return Response.json({error:'Choose one different emoji and Discord role for every row.'},{status:400});
 const {data:menu,error:menuError}=await supabase.from('discord_reaction_menus').select('id,guild_id,channel_id,message_id,discord_reaction_role_items(emoji)').eq('id',id).eq('user_id',user.id).eq('active',true).maybeSingle();if(menuError||!menu)return Response.json({error:'That published menu could not be found.'},{status:404});
 const token=process.env.DISCORD_BOT_TOKEN;if(!token)return Response.json({error:'B.E.I.P.I.’s bot token is not configured.'},{status:503});const headers={Authorization:`Bot ${token}`};
 try{
  const session=(await selectDiscordSession())?.session;
  if(!session?.user?.username)return Response.json({error:'Reconnect Discord to edit reaction roles.'},{status:401});
  const guildResponse=await fetchDiscordGuilds(session);
  if(!guildResponse.ok)return Response.json({error:'Reconnect Discord so B.E.I.P.I. can check your server permissions.'},{status:401});
  const guild=(await guildResponse.json() as DiscordGuild[]).find(g=>g.id===menu.guild_id&&hasDiscordGuildPermissions(g,ManageServer|ManageRoles));
  if(!guild)return Response.json({error:'You need Manage Server and Manage Roles in this Discord server.'},{status:403});
  const channelResponse=await fetch(`https://discord.com/api/channels/${menu.channel_id}`,{headers,cache:'no-store'});
  if(!channelResponse.ok||(await channelResponse.json() as {guild_id?:string}).guild_id!==menu.guild_id)return Response.json({error:'That channel is outside the selected server or unavailable.'},{status:403});
  const [rolesResponse,botResponse]=await Promise.all([fetch(`https://discord.com/api/guilds/${menu.guild_id}/roles`,{headers,cache:'no-store'}),fetch('https://discord.com/api/users/@me',{headers,cache:'no-store'})]);if(!rolesResponse.ok||!botResponse.ok)return Response.json({error:'B.E.I.P.I. could not verify those Discord roles.'},{status:502});
  const roles=await rolesResponse.json() as DiscordRole[],bot=await botResponse.json() as BotUser;const memberResponse=await fetch(`https://discord.com/api/guilds/${menu.guild_id}/members/${bot.id}`,{headers,cache:'no-store'});if(!memberResponse.ok)return Response.json({error:'B.E.I.P.I. could not check her role position.'},{status:502});const member=await memberResponse.json() as GuildMember;const botTop=highestDiscordRole(roles,member.roles);const allowed=new Set(roles.filter(role=>!roleAssignmentRestriction(role,menu.guild_id,botTop)).map(role=>role.id));if(reactions.some(item=>!allowed.has(item.roleId)))return Response.json({error:'One of those roles cannot be assigned by B.E.I.P.I. Check the reason next to its name.'},{status:400});
  const requestReaction=createDiscordReactionBatch(token,menu.channel_id,menu.message_id);
  const existingEmoji=new Set((menu.discord_reaction_role_items||[]).map(item=>item.emoji));
  const newEmoji=new Set(reactions.map(item=>item.emoji));
  const added:string[]=[];
  for(const emoji of newEmoji){
   const response=await requestReaction(emoji);
   if(!response.ok){
    for(const addedEmoji of added)await requestReaction(addedEmoji,'DELETE');
    const {error,status}=await describeDiscordReactionError(response,{emoji,guildId:menu.guild_id,channelId:menu.channel_id,botToken:token});
    return Response.json({error},{status});
   }
   if(!existingEmoji.has(emoji))added.push(emoji);
  }
  const {error:deleteError}=await supabase.from('discord_reaction_role_items').delete().eq('menu_id',menu.id);if(deleteError)throw deleteError;const {error:insertError}=await supabase.from('discord_reaction_role_items').insert(reactions.map(item=>({menu_id:menu.id,emoji:item.emoji,role_id:item.roleId,role_name:item.roleName})));if(insertError)throw insertError;const {error:updateError}=await supabase.from('discord_reaction_menus').update({remove_on_unreact:body.removeOnUnreact!==false,updated_at:new Date().toISOString()}).eq('id',menu.id).eq('user_id',user.id);if(updateError)throw updateError;
  for(const emoji of existingEmoji){
   if(!newEmoji.has(emoji))await requestReaction(emoji,'DELETE');
  }
  return Response.json({ok:true,reactions,removeOnUnreact:body.removeOnUnreact!==false});
 }catch{return Response.json({error:'The published reaction-role menu could not be updated.'},{status:500})}
}

async function discordResourceIsGone(response: Response) {
 if(response.status!==404)return false;
 const error=await response.json().catch(()=>null) as {code?:number}|null;
 return error?.code===10003||error?.code===10008;
}

export async function DELETE(_request: NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return Response.json({error:'Sign in to delete reaction roles.'},{status:401});

 const {data:menu,error}=await supabase.from('discord_reaction_menus')
  .select('id,guild_id,channel_id,message_id').eq('id',id).eq('user_id',user.id).maybeSingle();
 if(error)return Response.json({error:'The published menu could not be loaded.'},{status:500});
 if(!menu)return Response.json({error:'That published menu could not be found.'},{status:404});

 try{
  const session=await selectDiscordSession();
  if(!session?.session.user?.username)return Response.json({error:'Reconnect Discord to delete reaction roles.'},{status:401});
  const {response:guildResponse}=await fetchDiscordGuildsWithRefresh(session);
  if(!guildResponse.ok)return Response.json({error:'Reconnect Discord so B.E.I.P.I. can check your server permissions.'},{status:401});
  const guilds=await guildResponse.json() as DiscordGuild[];
  if(!guilds.some(guild=>guild.id===menu.guild_id&&hasDiscordGuildPermissions(guild,ManageServer|ManageRoles))){
   return Response.json({error:'You need Manage Server and Manage Roles in this Discord server.'},{status:403});
  }

  const token=process.env.DISCORD_BOT_TOKEN;
  if(!token)return Response.json({error:'B.E.I.P.I.’s bot token is not configured.'},{status:503});
  const options={headers:{Authorization:`Bot ${token}`},cache:'no-store'} as const;
  const channelUrl=`https://discord.com/api/v10/channels/${menu.channel_id}`;
  const channel=await fetch(channelUrl,options);
  if(channel.ok){
   if((await channel.json() as {guild_id?:string}).guild_id!==menu.guild_id){
    return Response.json({error:'That message is outside the selected server.'},{status:403});
   }
   const messageUrl=`${channelUrl}/messages/${menu.message_id}`;
   const message=await fetch(messageUrl,options);
   if(message.ok){
    const identity=await fetch('https://discord.com/api/v10/users/@me',options);
    if(!identity.ok)return Response.json({error:'B.E.I.P.I. could not verify the message author.'},{status:502});
    const bot=await identity.json() as BotUser;
    const published=await message.json() as {author?:{id:string}};
    if(!bot.id||published.author?.id!==bot.id){
     return Response.json({error:'B.E.I.P.I. can only delete her own published messages.'},{status:403});
    }
    const removed=await fetch(messageUrl,{...options,method:'DELETE'});
    if(!removed.ok&&!await discordResourceIsGone(removed)){
     return Response.json({error:'Discord could not delete the message. Check B.E.I.P.I.’s channel access and try again.'},{status:502});
    }
   }else if(!await discordResourceIsGone(message)){
    return Response.json({error:'B.E.I.P.I. could not read the message. Check View Channel and Read Message History.'},{status:502});
   }
  }else if(!await discordResourceIsGone(channel)){
   return Response.json({error:'B.E.I.P.I. could not access the channel. Check View Channel and try again.'},{status:502});
  }

  const {error:deleteError}=await supabase.from('discord_reaction_menus').delete().eq('id',menu.id).eq('user_id',user.id);
  if(deleteError)return Response.json({error:'The Discord message is gone, but the saved menu could not be deleted. Try again.'},{status:500});
  return Response.json({ok:true});
 }catch{
  return Response.json({error:'The reaction-role menu could not be deleted. Try again shortly.'},{status:502});
 }
}
