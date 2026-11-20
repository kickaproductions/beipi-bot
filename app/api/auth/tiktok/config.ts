export const STATE_COOKIE='beipi_tiktok_state';
export const STATE_PATH='/api/auth/tiktok';

export function tiktokConfig(){
  const {TIKTOK_CLIENT_KEY:clientKey,TIKTOK_CLIENT_SECRET:clientSecret,TIKTOK_REDIRECT_URI:redirectUri}=process.env;
  if(!clientKey||!clientSecret||!redirectUri)return null;
  try{
    const callback=new URL(redirectUri);
    if(callback.protocol!=='https:'||callback.pathname!==STATE_PATH+'/callback'||callback.search||callback.hash)return null;
    return {clientKey,clientSecret,redirectUri,origin:callback.origin};
  }catch{return null}
}
