import {createBrowserClient} from '@supabase/ssr';

export function createClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)throw new Error('B.E.I.P.I. accounts are not configured yet.');
  return createBrowserClient(url,key);
}
