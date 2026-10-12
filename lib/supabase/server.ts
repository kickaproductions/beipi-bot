import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';

export async function createClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)throw new Error('B.E.I.P.I. accounts are not configured yet.');
  const store=await cookies();
  return createServerClient(url,key,{cookies:{getAll(){return store.getAll()},setAll(values){try{values.forEach(({name,value,options})=>store.set(name,value,options))}catch{/* Server Components cannot always write refreshed cookies. */}}}});
}
