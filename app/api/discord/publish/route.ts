import {NextRequest,NextResponse} from 'next/server';
import {draftSchema} from '@/app/discord-schema';
import {decryptDiscordSession,DISCORD_SESSION_COOKIE} from '@/app/api/auth/discord/session';
import {getPlatformConnection} from '@/lib/platform-connections';

export const runtime='nodejs';
type Guild={id:string;owner:boolean;permissions:string};
type Channel={id:string;name:string;type:number};

const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:NextRequest){
  let encrypted=request.cookies.get(DISCORD_SESSION_COOKIE)?.value;
  if(!encrypted){try{encrypted=(await getPlatformConnection('discord'))?.encrypted_session}catch{}}
  const session=encrypted?decryptDiscordSession(encrypted):null;
  if(!session)return json({error:'Connect Discord before publishing.'},401);
  const parsed=draftSchema.safeParse(await request.json());
  if(!parsed.success)return json({error:parsed.error.issues[0]?.message||'Check the message details.'},400);
  const draft=parsed.data;
  if(!draft.serverId)return json({error:'Choose a Discord server first.'},400);
  if(!draft.text.trim())return json({error:'Add some message text before publishing.'},400);
  const botToken=process.env.DISCORD_BOT_TOKEN;
  if(!botToken)return json({error:'B.E.I.P.I.’s Discord bot token is not configured.'},503);
  try{
    const guildResponse=await fetch('https://discord.com/api/users/@me/guilds',{headers:{Authorization:`Bearer ${session.accessToken}`},cache:'no-store'});
    if(!guildResponse.ok)return json({error:'Reconnect Discord, then try publishing again.'},401);
    const guilds=await guildResponse.json() as Guild[];
    const manageGuild=BigInt(32);
    const allowed=guilds.some(g=>g.id===draft.serverId&&(g.owner||(BigInt(g.permissions)&manageGuild)===manageGuild));
    if(!allowed)return json({error:'You must manage this server to publish there.'},403);

    let channelId=draft.channelId;
    let channelName=draft.channel;
    if(draft.mode==='new'){
      let parentId:string|undefined;
      if(draft.category.trim()){
        const channelsResponse=await fetch(`https://discord.com/api/guilds/${draft.serverId}/channels`,{headers:{Authorization:`Bot ${botToken}`},cache:'no-store'});
        if(channelsResponse.ok){const channels=await channelsResponse.json() as Channel[];parentId=channels.find(channel=>channel.type===4&&channel.name.toLowerCase()===draft.category.trim().toLowerCase())?.id}
      }
      const createResponse=await fetch(`https://discord.com/api/guilds/${draft.serverId}/channels`,{method:'POST',headers:{Authorization:`Bot ${botToken}`,'Content-Type':'application/json'},body:JSON.stringify({name:draft.channel,type:0,...(parentId?{parent_id:parentId}:{})}),cache:'no-store'});
      const created=await createResponse.json() as Channel&{message?:string};
      if(!createResponse.ok||!created.id)return json({error:created.message||'B.E.I.P.I. could not create that channel. Check her permissions.'},createResponse.status||502);
      channelId=created.id;channelName=created.name;
    }
    if(!channelId)return json({error:'Choose an existing Discord channel first.'},400);
    const sendResponse=await fetch(`https://discord.com/api/channels/${channelId}/messages`,{method:'POST',headers:{Authorization:`Bot ${botToken}`,'Content-Type':'application/json'},body:JSON.stringify({content:draft.text}),cache:'no-store'});
    const sent=await sendResponse.json() as {id?:string;message?:string};
    if(!sendResponse.ok||!sent.id)return json({error:sent.message||'B.E.I.P.I. could not publish there. Check her channel permissions.'},sendResponse.status||502);
    return json({ok:true,messageId:sent.id,channelId,channelName});
  }catch{return json({error:'Discord could not publish the message right now. Please try again.'},502)}
}
