'use client';

import {useState,type FormEvent} from 'react';
import {ArrowLeft,Check,Eye,EyeOff,LockKeyhole,ShieldCheck} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';

const passwordRules=[
  {label:'At least 12 characters',test:(value:string)=>value.length>=12},
  {label:'One uppercase letter',test:(value:string)=>/[A-Z]/.test(value)},
  {label:'One lowercase letter',test:(value:string)=>/[a-z]/.test(value)},
  {label:'One number',test:(value:string)=>/[0-9]/.test(value)},
  {label:'One symbol',test:(value:string)=>/[^A-Za-z0-9]/.test(value)},
];

export default function ResetPasswordPortal(){
  const [password,setPassword]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const passedRules=passwordRules.filter(rule=>rule.test(password)).length;
  const strength=passedRules<=2?'Needs more':passedRules<=4?'Nearly there':'Strong';

  async function updatePassword(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setError('');
    if(!passwordRules.every(rule=>rule.test(password))){setError('Choose a password that meets every requirement.');return}
    if(password!==confirmation){setError('Those passwords do not match yet.');return}
    setBusy(true);
    try{
      const supabase=createClient();
      const {error}=await supabase.auth.updateUser({password});
      if(error)throw error;
      await supabase.auth.signOut({scope:'local'});
      window.location.assign('/account?password=updated');
    }catch(value){
      setError(value instanceof Error?value.message:'B.E.I.P.I. could not update your password. Request a new reset link and try again.');
      setBusy(false);
    }
  }

  return <main className="account-shell">
    <a href="/account" className="account-back"><ArrowLeft size={16}/> Back to login</a>
    <section className="account-card">
      <div className="account-brand"><img src="/beipi-account-logo.png" alt="B.E.I.P.I. Bot mascot logo"/><div><strong>B.E.I.P.I.</strong><small>Your streaming companion</small></div></div>
      <span className="account-kicker">SECURE ACCOUNT RECOVERY</span>
      <h1>Choose a new password</h1>
      <p className="account-lead">Make it memorable to you and difficult for anyone else to guess.</p>
      <form onSubmit={updatePassword}>
        <label>New password<div className="account-input"><LockKeyhole size={17}/><input required type={showPassword?'text':'password'} autoComplete="new-password" minLength={12} value={password} onChange={event=>setPassword(event.target.value)} placeholder="Create a strong password"/><button type="button" aria-label={showPassword?'Hide password':'Show password'} onClick={()=>setShowPassword(value=>!value)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
        <div className={`password-strength strength-${passedRules}`} aria-live="polite"><div><span style={{width:`${passedRules*20}%`}}/></div><strong>{strength}</strong></div>
        <ul className="password-checklist" aria-label="Password requirements">{passwordRules.map(rule=>{const passed=rule.test(password);return <li className={passed?'passed':''} key={rule.label}><span><Check size={12}/></span>{rule.label}</li>})}</ul>
        <label>Confirm new password<div className={`account-input ${confirmation&&password!==confirmation?'input-mismatch':''}`}><LockKeyhole size={17}/><input required type={showPassword?'text':'password'} autoComplete="new-password" minLength={12} value={confirmation} onChange={event=>setConfirmation(event.target.value)} placeholder="Type it once more"/></div></label>
        {confirmation&&password===confirmation&&<small className="password-match"><Check size={13}/> Passwords match</small>}
        {error&&<div className="account-error" role="alert">{error}</div>}
        <button className="primary account-submit" disabled={busy||passedRules<passwordRules.length||password!==confirmation}>{busy?'Updating…':'Save new password'}</button>
      </form>
      <small className="account-trust"><ShieldCheck size={14}/> Your password is securely handled by B.E.I.P.I.’s account provider.</small>
    </section>
    <div className="account-footer"><nav aria-label="Legal pages"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/nda">Beta NDA</a></nav></div>
  </main>;
}
