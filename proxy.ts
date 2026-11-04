import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
import {NDA_VERSION} from './app/nda-agreement';

const MAX_SESSION_AGE_MS=7*24*60*60*1000;

function sessionIsOlderThanOneWeek(lastSignInAt?:string){
  if(!lastSignInAt)return false;
  const signedInAt=Date.parse(lastSignInAt);
  return Number.isFinite(signedInAt)&&Date.now()-signedInAt>=MAX_SESSION_AGE_MS;
}

export async function proxy(request:NextRequest){
  let response=NextResponse.next({request});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return response;
  try{
    const supabase=createServerClient(url,key,{cookies:{getAll(){return request.cookies.getAll()},setAll(values){values.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});values.forEach(({name,value,options})=>response.cookies.set(name,value,options))}}});
    const {data:{user}}=await supabase.auth.getUser();
    if(user&&(request.nextUrl.pathname.startsWith('/dashboard')||request.nextUrl.pathname.startsWith('/tester')||request.nextUrl.pathname.startsWith('/developer')||request.nextUrl.pathname.startsWith('/api/'))){
      if(sessionIsOlderThanOneWeek(user.last_sign_in_at)){
        if(request.nextUrl.pathname.startsWith('/api/'))return NextResponse.json({error:'Your seven-day sign-in has expired. Please log in again.'},{status:401});
        const loginUrl=new URL('/account',request.url);
        loginUrl.searchParams.set('session','expired');
        loginUrl.searchParams.set('next',`${request.nextUrl.pathname}${request.nextUrl.search}`);
        return NextResponse.redirect(loginUrl);
      }
      const {data:profile}=await supabase.from('profiles').select('account_status,founding_tester,role').eq('id',user.id).maybeSingle();
      if(profile?.account_status==='suspended'){
        if(request.nextUrl.pathname.startsWith('/api/'))return NextResponse.json({error:'This account is suspended. Contact B.E.I.P.I. support if you believe this is a mistake.'},{status:403});
        return NextResponse.redirect(new URL('/account?suspended=1',request.url));
      }
      const isTester=Boolean(profile?.founding_tester)||profile?.role==='developer';
      const isProtectedApi=request.nextUrl.pathname.startsWith('/api/')&&!request.nextUrl.pathname.startsWith('/api/tester-access')&&!request.nextUrl.pathname.startsWith('/api/tester-nda');
      if(!isTester&&isProtectedApi)return NextResponse.json({error:'Private beta access is required for this feature.'},{status:403});
      if(isTester&&isProtectedApi){
        const {data:acceptance,error:acceptanceError}=await supabase.from('beta_nda_acceptances').select('id').eq('user_id',user.id).eq('agreement_version',NDA_VERSION).maybeSingle();
        if(!acceptanceError&&!acceptance)return NextResponse.json({error:'Please accept the beta NDA in the Tester Portal before using this feature.'},{status:403});
      }
    }
  }catch{
    // Keep the public site available if account configuration is incomplete.
  }
  return response;
}

export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']};
