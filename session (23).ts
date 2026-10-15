import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';

export const KICK_SESSION_COOKIE='beipi_kick_session';
export const KICK_STATE_COOKIE='beipi_kick_state';
export const KICK_VERIFIER_COOKIE='beipi_kick_verifier';

export type KickSession={
  accessToken:string;
  refreshToken:string;
  expiresAt:number;
  user:{id:number;username:string;email:string;profilePicture:string};
};

function key(){const secret=process.env.AUTH_SECRET;if(!secret)throw new Error('AUTH_SECRET is not configured');return createHash('sha256').update(secret).digest()}
export function encryptKickSession(value:KickSession){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key(),iv);const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url')}
export function decryptKickSession(value:string):KickSession|null{try{const payload=Buffer.from(value,'base64url');const iv=payload.subarray(0,12),tag=payload.subarray(12,28),encrypted=payload.subarray(28);const decipher=createDecipheriv('aes-256-gcm',key(),iv);decipher.setAuthTag(tag);return JSON.parse(Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8')) as KickSession}catch{return null}}
export function kickConfig(){const clientId=process.env.KICK_CLIENT_ID;const clientSecret=process.env.KICK_CLIENT_SECRET;const redirectUri=process.env.KICK_REDIRECT_URI;if(!clientId||!clientSecret||!redirectUri)throw new Error('Kick OAuth is not configured');return {clientId,clientSecret,redirectUri}}
