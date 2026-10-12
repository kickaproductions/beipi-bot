import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';

export const DISCORD_SESSION_COOKIE='beipi_discord_session';
export const DISCORD_STATE_COOKIE='beipi_discord_state';

export type DiscordSession={
  accessToken:string;
  refreshToken:string;
  expiresAt:number;
  user:{id:string;username:string;displayName:string;avatarUrl:string};
};

function key(){
  const secret=process.env.AUTH_SECRET;
  if(!secret)throw new Error('AUTH_SECRET is not configured');
  return createHash('sha256').update(secret).digest();
}

export function encryptDiscordSession(value:DiscordSession){
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key(),iv);
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  const tag=cipher.getAuthTag();
  return Buffer.concat([iv,tag,encrypted]).toString('base64url');
}

export function decryptDiscordSession(value:string):DiscordSession|null{
  try{
    const payload=Buffer.from(value,'base64url');
    const iv=payload.subarray(0,12),tag=payload.subarray(12,28),encrypted=payload.subarray(28);
    const decipher=createDecipheriv('aes-256-gcm',key(),iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8')) as DiscordSession;
  }catch{return null}
}

export function discordConfig(){
  const clientId=process.env.DISCORD_CLIENT_ID;
  const clientSecret=process.env.DISCORD_CLIENT_SECRET;
  const redirectUri=process.env.DISCORD_REDIRECT_URI;
  if(!clientId||!clientSecret||!redirectUri)throw new Error('Discord OAuth is not configured');
  return {clientId,clientSecret,redirectUri};
}
