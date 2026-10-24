'use client';

import {useState} from 'react';
import {ArrowLeft,Check,FileSignature,ShieldCheck} from 'lucide-react';
import NdaContent from '../nda-content';
import {NDA_TITLE,NDA_VERSION} from '../nda-agreement';

export default function NdaAcceptance({email}:{email:string}){
 const [signerName,setSignerName]=useState('');
 const [agreed,setAgreed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function sign(){
  setError('');
  if(signerName.trim().length<2){setError('Please enter your full legal name.');return;}
  if(!agreed){setError('Please confirm that you have read and agree to the NDA.');return;}
  setBusy(true);
  try{
   const response=await fetch('/api/tester-nda',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({signerName:signerName.trim(),accepted:true,version:NDA_VERSION})});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(result.error||'The agreement could not be recorded.');
   window.location.reload();
  }catch(reason){setError(reason instanceof Error?reason.message:'The agreement could not be recorded.');setBusy(false);}
 }
 return <main className="nda-sign-shell">
  <div className="nda-signing">
   <a className="nda-back" href="/"><ArrowLeft size={17}/> Back to B.E.I.P.I.</a>
   <header className="nda-sign-header"><div className="nda-sign-icon"><ShieldCheck size={28}/></div><div><span>YOU&apos;RE IN THE BETA</span><h1>One little step before we begin</h1><p>Your beta request has been accepted. Please review and sign the NDA below to unlock your Tester Portal.</p></div></header>
   <div className="nda-agreement-card">
    <div className="nda-document-title"><FileSignature size={22}/><div><strong>{NDA_TITLE}</strong><small>Agreement version {NDA_VERSION}</small></div></div>
    <div className="nda-document-body legal-content" tabIndex={0}><NdaContent/></div>
   </div>
   <section className="nda-sign-form" aria-labelledby="nda-sign-title">
    <div><span className="nda-step">SIGN AGREEMENT</span><h2 id="nda-sign-title">Confirm your acceptance</h2><p>Your name, account email, agreement version and acceptance time will be saved as your signing record.</p></div>
    <label className="nda-field"><span>Full legal name</span><input value={signerName} onChange={event=>setSignerName(event.target.value)} autoComplete="name" placeholder="Your full legal name" maxLength={120}/></label>
    <div className="nda-account"><span>Signed in as</span><strong>{email}</strong></div>
    <label className="nda-consent"><input type="checkbox" checked={agreed} onChange={event=>setAgreed(event.target.checked)}/><span>I have read and agree to the B.E.I.P.I. Bot Beta Tester Non-Disclosure Agreement.</span></label>
    {error&&<p className="nda-error" role="alert">{error}</p>}
    <button className="nda-sign-button" type="button" onClick={sign} disabled={busy||!agreed||signerName.trim().length<2}>{busy?'Recording agreement…':<><Check size={18}/> Sign NDA and enter Tester Portal</>}</button>
   </section>
  </div>
 </main>
}
