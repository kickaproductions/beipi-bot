'use client';

import {useEffect,useState,type FormEvent} from 'react';
import {ArrowLeft,Check,Fingerprint,KeyRound,LoaderCircle,Pencil,ShieldCheck,Smartphone,Trash2} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';

type Factor={id:string;status:'verified'|'unverified';friendly_name?:string};
type Setup={factorId:string;qrCode:string;secret:string};
type PasskeyItem={id:string;friendly_name?:string;created_at:string;last_used_at?:string};

export default function SecurityPortal({email}:{email:string}){
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [factors,setFactors]=useState<Factor[]>([]);
  const [level,setLevel]=useState<string|null>(null);
  const [setup,setSetup]=useState<Setup|null>(null);
  const [passkeys,setPasskeys]=useState<PasskeyItem[]>([]);
  const [passkeyBusy,setPasskeyBusy]=useState(false);
  const [passkeyError,setPasskeyError]=useState('');
  const [passkeyMessage,setPasskeyMessage]=useState('');
  const [passkeySupported,setPasskeySupported]=useState(true);
  const next=typeof window==='undefined'?'/dashboard':new URLSearchParams(window.location.search).get('next')||'/dashboard';

  async function refresh(){
    const supabase=createClient();
    const [{data:list,error:listError},{data:aal,error:aalError}]=await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if(listError)throw listError;
    if(aalError)throw aalError;
    setFactors((list?.totp||[]) as Factor[]);
    setLevel(aal?.currentLevel||null);
  }

  async function refreshPasskeys(){
    const supabase=createClient();
    const {data,error}=await supabase.auth.passkey.list();
    if(error)throw error;
    setPasskeys((data||[]) as PasskeyItem[]);
  }

  useEffect(()=>{
    setPasskeySupported(Boolean(window.PublicKeyCredential));
    void refresh().catch(value=>setError(value instanceof Error?value.message:'B.E.I.P.I. could not check your security settings.')).finally(()=>setLoading(false));
    void refreshPasskeys().catch(value=>setPasskeyError(value instanceof Error?value.message:'Your passkeys could not be loaded.'));
  },[]);

  const verified=factors.find(factor=>factor.status==='verified');
  const secured=Boolean(verified)&&level==='aal2';

  async function begin(){
    setBusy(true);
    setError('');
    try{
      const supabase=createClient();
      const {data:list}=await supabase.auth.mfa.listFactors();
      for(const factor of list?.all||[])if(factor.status==='unverified')await supabase.auth.mfa.unenroll({factorId:factor.id});
      const {data,error}=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:'B.E.I.P.I. Authenticator'});
      if(error)throw error;
      if(!data.totp)throw new Error('Authenticator setup was not returned.');
      setSetup({factorId:data.id,qrCode:data.totp.qr_code,secret:data.totp.secret});
    }catch(value){setError(value instanceof Error?value.message:'Authenticator setup could not be started.')}
    finally{setBusy(false)}
  }

  async function verify(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setBusy(true);
    setError('');
    const form=new FormData(event.currentTarget);
    const code=String(form.get('code')||'').replace(/\s/g,'');
    const factorId=setup?.factorId||verified?.id;
    try{
      if(!factorId)throw new Error('No authenticator was found.');
      const supabase=createClient();
      const {error}=await supabase.auth.mfa.challengeAndVerify({factorId,code});
      if(error)throw error;
      await refresh();
      window.location.assign(next.startsWith('/')?next:'/dashboard');
    }catch(value){setError(value instanceof Error?value.message:'That code was not accepted. Please try the newest code.')}
    finally{setBusy(false)}
  }

  async function addPasskey(){
    setPasskeyBusy(true);
    setPasskeyError('');
    setPasskeyMessage('');
    try{
      if(!window.PublicKeyCredential)throw new Error('This browser or device does not support passkeys yet.');
      const supabase=createClient();
      const {data,error}=await supabase.auth.registerPasskey();
      if(error)throw error;
      await refreshPasskeys();
      setPasskeyMessage(`${data.friendly_name||'Your passkey'} is ready to use.`);
    }catch(value){
      const text=value instanceof Error?value.message:'Your passkey could not be registered.';
      setPasskeyError(text.includes('cancel')||text.includes('not allowed')?'Passkey setup was cancelled. Nothing was changed.':text);
    }finally{setPasskeyBusy(false)}
  }

  async function renamePasskey(item:PasskeyItem){
    const name=window.prompt('Give this passkey a name you will recognise:',item.friendly_name||'My passkey')?.trim();
    if(!name||name===item.friendly_name)return;
    setPasskeyBusy(true);
    setPasskeyError('');
    setPasskeyMessage('');
    try{
      const supabase=createClient();
      const {error}=await supabase.auth.passkey.update({passkeyId:item.id,friendlyName:name.slice(0,120)});
      if(error)throw error;
      await refreshPasskeys();
      setPasskeyMessage('Passkey name updated.');
    }catch(value){setPasskeyError(value instanceof Error?value.message:'The passkey name could not be updated.')}
    finally{setPasskeyBusy(false)}
  }

  async function removePasskey(item:PasskeyItem){
    if(!window.confirm(`Remove ${item.friendly_name||'this passkey'} from your B.E.I.P.I. account?`))return;
    setPasskeyBusy(true);
    setPasskeyError('');
    setPasskeyMessage('');
    try{
      const supabase=createClient();
      const {error}=await supabase.auth.passkey.delete({passkeyId:item.id});
      if(error)throw error;
      await refreshPasskeys();
      setPasskeyMessage('Passkey removed.');
    }catch(value){setPasskeyError(value instanceof Error?value.message:'The passkey could not be removed.')}
    finally{setPasskeyBusy(false)}
  }

  if(loading)return <main className="security-shell"><div className="security-loading"><LoaderCircle className="spin"/> B.E.I.P.I. is checking your security…</div></main>;

  return <main className="security-shell">
    <a href="/dashboard" className="security-back"><ArrowLeft size={16}/> Back to dashboard</a>
    <section className="security-card">
      <div className="security-brand"><img src="/beipi-account-logo.png" alt="B.E.I.P.I. Bot mascot logo"/><div><strong>SECURITY &amp; SIGN-IN</strong><small>{email}</small></div></div>
      {secured?<div className="security-success"><span><Check size={27}/></span><h1>Your account is protected.</h1><p>Authenticator verification is complete for this session.</p><a className="primary security-primary" href={next.startsWith('/')?next:'/dashboard'}>Continue securely</a></div>
      :verified?<><span className="security-kicker"><KeyRound size={14}/> ONE MORE STEP</span><h1>Enter your authenticator code.</h1><p className="security-lead">Open Google Authenticator or your preferred authenticator app and enter the current six-digit code.</p><CodeForm busy={busy} error={error} onSubmit={verify}/></>
      :setup?<><span className="security-kicker"><Smartphone size={14}/> CONNECT YOUR AUTHENTICATOR</span><h1>Scan, then verify.</h1><ol className="security-steps"><li>Open Google Authenticator on your phone.</li><li>Tap <strong>+</strong> and choose <strong>Scan a QR code</strong>.</li><li>Scan this code, then enter the six-digit number below.</li></ol><div className="security-qr"><img src={setup.qrCode} alt="QR code for B.E.I.P.I. two-factor authentication"/></div><details><summary>Can’t scan it?</summary><p>Enter this setup key manually:</p><code>{setup.secret}</code></details><CodeForm busy={busy} error={error} onSubmit={verify}/></>
      :<><span className="security-kicker"><ShieldCheck size={14}/> EXTRA ACCOUNT PROTECTION</span><h1>Add authenticator 2FA.</h1><p className="security-lead">After signing in, B.E.I.P.I. will ask for a temporary six-digit code from your authenticator app before opening protected developer controls.</p>{error&&<div className="account-error" role="alert">{error}</div>}<button className="primary security-primary" disabled={busy} onClick={()=>void begin()}>{busy?'Preparing…':'Set up authenticator 2FA'}</button><small className="security-note">Works with Google Authenticator, Microsoft Authenticator, Authy and compatible password managers.</small></>}
      {(secured||!verified)&&<section className="security-passkeys" aria-labelledby="passkey-title">
        <header><span><Fingerprint size={22}/></span><div><h2 id="passkey-title">Passkeys</h2><p>Use your fingerprint, face recognition, device PIN or security key to sign in without a password.</p></div></header>
        {!passkeySupported&&<div className="security-passkey-note">This browser or device does not support passkeys yet.</div>}
        {passkeys.length>0&&<div className="security-passkey-list">{passkeys.map(item=><article key={item.id}><div><strong>{item.friendly_name||'Passkey'}</strong><small>Added {new Date(item.created_at).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}{item.last_used_at?` · Last used ${new Date(item.last_used_at).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}`:''}</small></div><button type="button" disabled={passkeyBusy} aria-label={`Rename ${item.friendly_name||'passkey'}`} onClick={()=>void renamePasskey(item)}><Pencil size={15}/></button><button type="button" className="remove" disabled={passkeyBusy} aria-label={`Remove ${item.friendly_name||'passkey'}`} onClick={()=>void removePasskey(item)}><Trash2 size={15}/></button></article>)}</div>}
        {passkeyError&&<div className="account-error" role="alert">{passkeyError}</div>}
        {passkeyMessage&&<div className="account-message" role="status">{passkeyMessage}</div>}
        <button type="button" className="outline security-add-passkey" disabled={passkeyBusy||!passkeySupported} onClick={()=>void addPasskey()}><Fingerprint size={17}/>{passkeyBusy?'Working…':passkeys.length?'Add another passkey':'Create a passkey'}</button>
        <small className="security-note">Only register passkeys on devices or password managers you trust.</small>
      </section>}
    </section>
  </main>;
}

function CodeForm({busy,error,onSubmit}:{busy:boolean;error:string;onSubmit:(event:FormEvent<HTMLFormElement>)=>void}){
  return <form className="security-form" onSubmit={onSubmit}><label>Six-digit code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required placeholder="000000"/></label>{error&&<div className="account-error" role="alert">{error}</div>}<button className="primary security-primary" disabled={busy}>{busy?'Verifying…':'Verify and continue'}</button></form>;
}
