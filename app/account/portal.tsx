'use client';

import {useEffect,useState,type FormEvent} from 'react';
import type {User} from '@supabase/supabase-js';
import {ArrowLeft,Check,Eye,EyeOff,Fingerprint,LogOut,Mail,ShieldCheck} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';

type Mode='login'|'signup';

const passwordRules=[
  {label:'At least 12 characters',test:(value:string)=>value.length>=12},
  {label:'One uppercase letter',test:(value:string)=>/[A-Z]/.test(value)},
  {label:'One lowercase letter',test:(value:string)=>/[a-z]/.test(value)},
  {label:'One number',test:(value:string)=>/[0-9]/.test(value)},
  {label:'One symbol',test:(value:string)=>/[^A-Za-z0-9]/.test(value)},
];

export default function AccountPortal(){
  const [mode,setMode]=useState<Mode>('login');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [password,setPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [user,setUser]=useState<User|null>(null);
  const [accountName,setAccountName]=useState('');
  const [configured,setConfigured]=useState(true);
  const [suspended,setSuspended]=useState(false);
  const [next,setNext]=useState('/dashboard');

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.get('mode')==='signup')setMode('signup');
    if(params.get('suspended')==='1')setSuspended(true);
    const requested=params.get('next');
    if(requested?.startsWith('/')&&!requested.startsWith('//'))setNext(requested);
    try{
      const supabase=createClient();
      const applyUser=async(nextUser:User|null)=>{
        setUser(nextUser);
        if(!nextUser){setAccountName('');return}
        const {data:profile}=await supabase.from('profiles').select('username,display_name').eq('id',nextUser.id).maybeSingle();
        setAccountName(profile?.username||profile?.display_name||'');
      };
      void supabase.auth.getUser().then(({data})=>void applyUser(data.user));
      const {data}=supabase.auth.onAuthStateChange((_event,session)=>void applyUser(session?.user??null));
      return()=>data.subscription.unsubscribe();
    }catch{setConfigured(false)}
  },[]);

  const passedRules=passwordRules.filter(rule=>rule.test(password)).length;
  const strength=passedRules<=2?'Needs more':passedRules<=4?'Nearly there':'Strong';

  function callbackUrl(){
    const callback=`${window.location.origin}/auth/callback`;
    return next==='/dashboard'?callback:`${callback}?next=${encodeURIComponent(next)}`;
  }

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const form=new FormData(event.currentTarget);
    const email=String(form.get('email')||'');
    const submittedPassword=String(form.get('password')||'');
    const name=String(form.get('name')||'');
    try{
      const supabase=createClient();
      if(mode==='signup'){
        if(!passwordRules.every(rule=>rule.test(submittedPassword)))throw new Error('Choose a password that meets every requirement.');
        if(submittedPassword!==confirmPassword)throw new Error('Those passwords do not match yet.');
        const {data,error}=await supabase.auth.signUp({email,password:submittedPassword,options:{data:{display_name:name},emailRedirectTo:callbackUrl()}});
        if(error)throw error;
        if(data.session)window.location.assign(next);
        else setMessage('Check your email to confirm your B.E.I.P.I. account.');
      }else{
        const {error}=await supabase.auth.signInWithPassword({email,password:submittedPassword});
        if(error)throw error;
        window.location.assign(next);
      }
    }catch(value){
      setError(value instanceof Error?value.message:'B.E.I.P.I. could not sign you in.');
    }finally{setBusy(false)}
  }

  async function social(provider:'google'|'discord'|'twitch'){
    setBusy(true);
    setError('');
    try{
      const supabase=createClient();
      const {error}=await supabase.auth.signInWithOAuth({provider,options:{redirectTo:callbackUrl()}});
      if(error)throw error;
    }catch(value){
      setError(value instanceof Error?value.message:'That sign-in could not be started.');
      setBusy(false);
    }
  }

  async function passkeySignIn(){
    setBusy(true);
    setError('');
    try{
      if(!window.PublicKeyCredential)throw new Error('This browser or device does not support passkeys yet.');
      const supabase=createClient();
      const {error}=await supabase.auth.signInWithPasskey();
      if(error)throw error;
      window.location.assign(next);
    }catch(value){
      const text=value instanceof Error?value.message:'Passkey sign-in could not be completed.';
      setError(text.includes('cancel')||text.includes('not allowed')?'Passkey sign-in was cancelled. You can try again whenever you’re ready.':text);
    }finally{setBusy(false)}
  }

  async function signOut(){
    setBusy(true);
    try{
      const supabase=createClient();
      await supabase.auth.signOut();
      setUser(null);
      setMessage('You’re safely signed out.');
    }finally{setBusy(false)}
  }

  function switchMode(){
    setMode(mode==='login'?'signup':'login');
    setError('');
    setMessage('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  }

  return <main className="account-shell">
    <a href="/" className="account-back"><ArrowLeft size={16}/> Back to B.E.I.P.I.</a>
    <section className="account-card">
      <div className="account-brand"><img src="/beipi-account-logo.png" alt="B.E.I.P.I. Bot mascot logo"/><div><strong>B.E.I.P.I.</strong><small>Your streaming companion</small></div></div>
      {!configured?<div className="account-state"><ShieldCheck size={31}/><h1>Accounts are nearly ready.</h1><p>Connect B.E.I.P.I.’s account database to finish this setup.</p></div>
      :suspended?<div className="account-state"><ShieldCheck size={31}/><h1>Account suspended.</h1><p>Dashboard access is paused. Contact B.E.I.P.I. support if you believe this is a mistake.</p><button className="outline" disabled={busy} onClick={()=>void signOut()}><LogOut size={16}/> Sign out</button></div>
      :user?<div className="account-state account-signed-in"><h1>{accountName?`Welcome, ${accountName}.`:'Welcome aboard.'}</h1><p>You’re signed in as <strong>{user.email}</strong>.</p><a className="primary account-dashboard" href={next}>{next.startsWith('/crew-invite')?'Continue to invitation':'Open your dashboard'}</a><button className="outline account-sign-out" disabled={busy} onClick={()=>void signOut()}><LogOut size={16}/> Sign out</button></div>
      :<>
        <span className="account-kicker">{mode==='signup'?'MAKE YOUR HOME BASE':'WELCOME BACK'}</span>
        <h1>{mode==='signup'?'Create your account':'Log in to B.E.I.P.I.'}</h1>
        <p className="account-lead">{mode==='signup'?'One account for your dashboard, connections and future Founding Tester access.':next.startsWith('/crew-invite')?'Sign in to accept your shared-space invitation.':'Your stream, community and little co-pilot are waiting.'}</p>
        {mode==='login'&&<button className="account-passkey" disabled={busy} onClick={()=>void passkeySignIn()}><Fingerprint size={19}/> Continue with a passkey</button>}
        <div className="account-social"><button disabled={busy} onClick={()=>void social('google')}><b>G</b> Continue with Google</button><button disabled={busy} onClick={()=>void social('twitch')}><b>T</b> Continue with Twitch</button><button disabled={busy} onClick={()=>void social('discord')}><b>D</b> Continue with Discord</button></div>
        <div className="account-divider"><span>or use email</span></div>
        <form onSubmit={submit}>
          {mode==='signup'&&<label>Display name<input name="name" required maxLength={60} autoComplete="name" placeholder="What should B.E.I.P.I. call you?"/></label>}
          <label>Email<div className="account-input"><Mail size={17}/><input name="email" required type="email" autoComplete="email" placeholder="you@example.com"/></div></label>
          <label>Password<div className="account-input"><input name="password" required type={showPassword?'text':'password'} autoComplete={mode==='signup'?'new-password':'current-password'} minLength={mode==='signup'?12:8} value={password} onChange={event=>setPassword(event.target.value)} placeholder={mode==='signup'?'Create a strong password':'Your password'}/><button type="button" aria-label={showPassword?'Hide password':'Show password'} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
          {mode==='signup'&&<>
            <div className={`password-strength strength-${passedRules}`} aria-live="polite"><div><span style={{width:`${passedRules*20}%`}}/></div><strong>{strength}</strong></div>
            <ul className="password-checklist" aria-label="Password requirements">{passwordRules.map(rule=>{const passed=rule.test(password);return <li className={passed?'passed':''} key={rule.label}><span><Check size={12}/></span>{rule.label}</li>})}</ul>
            <label>Confirm password<div className={`account-input ${confirmPassword&&password!==confirmPassword?'input-mismatch':''}`}><input name="confirm-password" required type={showPassword?'text':'password'} autoComplete="new-password" minLength={12} value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} placeholder="Type it once more"/></div></label>
            {confirmPassword&&password===confirmPassword&&<small className="password-match"><Check size={13}/> Passwords match</small>}
          </>}
          {error&&<div className="account-error" role="alert">{error}</div>}
          {message&&<div className="account-message" role="status">{message}</div>}
          <button className="primary account-submit" disabled={busy||(mode==='signup'&&(passedRules<passwordRules.length||password!==confirmPassword))}>{busy?'One moment…':mode==='signup'?'Create my account':'Log in'}</button>
          {mode==='signup'&&<p className="account-legal">By creating an account, you agree to the <a href="/terms">Terms of Service</a> and acknowledge the <a href="/privacy">Privacy Policy</a>.</p>}
        </form>
        <button className="account-switch" onClick={switchMode}>{mode==='login'?<>New here? <strong>Create an account</strong></>:<>Already have an account? <strong>Log in</strong></>}</button>
        <small className="account-trust"><ShieldCheck size={14}/> Your passwords are never visible to B.E.I.P.I.</small>
      </>}
    </section>
    <div className="account-footer"><nav aria-label="Legal pages"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/nda">Beta NDA</a></nav></div>
  </main>;
}
