import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';

export const TWITCH_SESSION_COOKIE='beipi_twitch_session';
export const TWITCH_STATE_COOKIE='beipi_twitch_state';

export type TwitchSession={
  accessToken:string;
  refreshToken:string;
  expiresAt:number;
  user:{id:string;login:string;displayName:string;profileImageUrl:string};
};

function key(){
  const secret=process.env.AUTH_SECRET;
  if(!secret)throw new Error('AUTH_SECRET is not configured');
  return createHash('sha256').update(secret).digest();
}

export function encryptSession(value:TwitchSession){
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key(),iv);
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  const tag=cipher.getAuthTag();
  return Buffer.concat([iv,tag,encrypted]).toString('base64url');
}

export function decryptSession(value:string):TwitchSession|null{
  try{
    const payload=Buffer.from(value,'base64url');
    const iv=payload.subarray(0,12),tag=payload.subarray(12,28),encrypted=payload.subarray(28);
    const decipher=createDecipheriv('aes-256-gcm',key(),iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8')) as TwitchSession;
  }catch{return null}
}

export function twitchConfig(){
  const clientId=process.env.TWITCH_CLIENT_ID;
  const clientSecret=process.env.TWITCH_CLIENT_SECRET;
  const redirectUri=process.env.TWITCH_REDIRECT_URI;
  if(!clientId||!clientSecret||!redirectUri)throw new Error('Twitch OAuth is not configured');
  return {clientId,clientSecret,redirectUri};
}
