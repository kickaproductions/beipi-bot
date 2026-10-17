import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';

export async function proxy(request:NextRequest){
  let response=NextResponse.next({request});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return response;
  try{
    const supabase=createServerClient(url,key,{cookies:{getAll(){return request.cookies.getAll()},setAll(values){values.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});values.forEach(({name,value,options})=>response.cookies.set(name,value,options))}}});
    const {data:{user}}=await supabase.auth.getUser();
    if(user&&(request.nextUrl.pathname.startsWith('/dashboard')||request.nextUrl.pathname.startsWith('/tester')||request.nextUrl.pathname.startsWith('/developer')||(request.nextUrl.pathname.startsWith('/api/')&&!request.nextUrl.pathname.startsWith('/api/auth/')))){
      const {data:profile}=await supabase.from('profiles').select('account_status').eq('id',user.id).maybeSingle();
      if(profile?.account_status==='suspended'){
        if(request.nextUrl.pathname.startsWith('/api/'))return NextResponse.json({error:'This account is suspended. Contact B.E.I.P.I. support if you believe this is a mistake.'},{status:403});
        return NextResponse.redirect(new URL('/account?suspended=1',request.url));
      }
    }
  }catch{
    // Keep the public site available if account configuration is incomplete.
  }
  return response;
}

export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']};
