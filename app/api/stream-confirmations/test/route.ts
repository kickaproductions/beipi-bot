import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';

export const runtime='nodejs';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(){
  try{
    const supabase=await createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return json({error:'Sign in before testing B.E.I.P.I.’s DMs.'},401);
    const {data:connection,error}=await supabase.from('platform_connections').select('external_user_id,display_name').eq('user_id',user.id).eq('platform','discord').maybeSingle();
    if(error)throw error;
    if(!connection?.external_user_id)return json({error:'Connect your Discord account before testing DMs.'},400);
    const token=process.env.DISCORD_BOT_TOKEN;
    if(!token)return json({error:'B.E.I.P.I.’s Discord bot token is missing from Vercel.'},503);
    const headers={Authorization:`Bot ${token}`,'Content-Type':'application/json'};
    const dmResponse=await fetch('https://discord.com/api/v10/users/@me/channels',{method:'POST',headers,body:JSON.stringify({recipient_id:connection.external_user_id}),cache:'no-store'});
    const dm=await dmResponse.json() as {id?:string;message?:string};
    if(!dmResponse.ok||!dm.id){
      if(dmResponse.status===403)return json({error:'Discord blocked the DM. Allow direct messages from server members for a server you share with B.E.I.P.I., then try again.'},403);
      return json({error:dm.message||'Discord could not open a DM with your account.'},dmResponse.status||502);
    }
    const messageResponse=await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`,{method:'POST',headers,body:JSON.stringify({content:`💜 Hi ${connection.display_name||'there'}! This is your B.E.I.P.I. test DM. Smart stream confirmations can reach you.`}),cache:'no-store'});
    const message=await messageResponse.json() as {id?:string;message?:string};
    if(!messageResponse.ok||!message.id){
      if(messageResponse.status===403)return json({error:'Discord opened the conversation but blocked the message. Check your DM privacy settings, then try again.'},403);
      return json({error:message.message||'Discord could not send the test DM.'},messageResponse.status||502);
    }
    return json({ok:true,message:'Test DM sent! Check your Discord messages from B.E.I.P.I.'});
  }catch(error){
    console.error('[stream-confirmation-test]',error);
    return json({error:'B.E.I.P.I. could not send the test DM right now.'},500);
  }
}
