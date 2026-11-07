'use client';

import {useEffect,useState,type FormEvent} from 'react';
import {ArrowLeft,Check,Eye,EyeOff,KeyRound,LockKeyhole,ShieldCheck} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';

type Factor={id:string;status:'verified'|'unverified';friendly_name?:string};

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
  const [checkingSecurity,setCheckingSecurity]=useState(true);
  const [mfaFactor,setMfaFactor]=useState<Factor|null>(null);
  const [mfaCode,setMfaCode]=useState('');
  const [error,setError]=useState('');
  const passedRules=passwordRules.filter(rule=>rule.test(password)).length;
  const strength=passedRules<=2?'Needs more':passedRules<=4?'Nearly there':'Strong';

  useEffect(()=>{
    const checkSecurity=async()=>{
      const supabase=createClient();
      const {data:aal,error:aalError}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if(aalError)throw aalError;
      if(aal?.currentLevel==='aal1'&&aal.nextLevel==='aal2'){
        const {data:list,error:listError}=await supabase.auth.mfa.listFactors();
        if(listError)throw listError;
        const verified=(list?.totp||[]).find(factor=>factor.status==='verified') as Factor|undefined;
        if(!verified)throw new Error('Two-factor authentication is enabled, but B.E.I.P.I. could not find your authenticator. Sign in and check Account Security.');
        setMfaFactor(verified);
      }
    };
    void checkSecurity().catch(value=>setError(value instanceof Error?value.message:'B.E.I.P.I. could not check your account security.')).finally(()=>setCheckingSecurity(false));
  },[]);

  async function updatePassword(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setError('');
    if(!passwordRules.every(rule=>rule.test(password))){setError('Choose a password that meets every requirement.');return}
    if(password!==confirmation){setError('Those passwords do not match yet.');return}
    setBusy(true);
    try{
      const supabase=createClient();
      if(mfaFactor){
        const code=mfaCode.replace(/\s/g,'');
        if(!/^\d{6}$/.test(code))throw new Error('Enter the current six-digit code from your authenticator app.');
        const {error:mfaError}=await supabase.auth.mfa.challengeAndVerify({factorId:mfaFactor.id,code});
        if(mfaError)throw new Error(mfaError.code==='mfa_verification_failed'?'That authenticator code was not accepted. Wait for a new code and try again.':mfaError.message);
      }
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
        {mfaFactor&&<div className="account-recovery-mfa"><div><span><KeyRound size={17}/></span><div><strong>Confirm it’s you</strong><small>Open your authenticator app and enter the current six-digit code.</small></div></div><label>Authenticator code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={mfaCode} onChange={event=>setMfaCode(event.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000"/></label></div>}
        {error&&<div className="account-error" role="alert">{error}</div>}
        <button className="primary account-submit" disabled={checkingSecurity||busy||passedRules<passwordRules.length||password!==confirmation||(Boolean(mfaFactor)&&mfaCode.length!==6)}>{checkingSecurity?'Checking security…':busy?'Updating…':mfaFactor?'Verify and save new password':'Save new password'}</button>
      </form>
      <small className="account-trust"><ShieldCheck size={14}/> Your password is securely handled by B.E.I.P.I.’s account provider.</small>
    </section>
    <div className="account-footer"><nav aria-label="Legal pages"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/nda">Beta NDA</a></nav></div>
  </main>;
}
