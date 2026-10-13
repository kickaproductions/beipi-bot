import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';

export const GOOGLE_SESSION_COOKIE='beipi_google_session';
export const GOOGLE_STATE_COOKIE='beipi_google_state';
export type GoogleSession={accessToken:string;refreshToken:string;expiresAt:number;user:{id:string;email:string;name:string;picture:string};channel?:{id:string;title:string;thumbnailUrl:string;handle?:string}};
function key(){const secret=process.env.AUTH_SECRET;if(!secret)throw new Error('AUTH_SECRET is not configured');return createHash('sha256').update(secret).digest()}
export function encryptGoogleSession(value:GoogleSession){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key(),iv);const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url')}
export function decryptGoogleSession(value:string):GoogleSession|null{try{const payload=Buffer.from(value,'base64url');const iv=payload.subarray(0,12),tag=payload.subarray(12,28),encrypted=payload.subarray(28);const decipher=createDecipheriv('aes-256-gcm',key(),iv);decipher.setAuthTag(tag);return JSON.parse(Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8')) as GoogleSession}catch{return null}}
export function googleConfig(){const clientId=process.env.GOOGLE_CLIENT_ID;const clientSecret=process.env.GOOGLE_CLIENT_SECRET;const redirectUri=process.env.GOOGLE_REDIRECT_URI;if(!clientId||!clientSecret||!redirectUri)throw new Error('Google OAuth is not configured');return {clientId,clientSecret,redirectUri}}
