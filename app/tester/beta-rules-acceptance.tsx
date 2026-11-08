'use client';

import {useState} from 'react';
import {ArrowLeft,Check,ClipboardCheck,ShieldCheck} from 'lucide-react';
import {BETA_RULES,BETA_RULES_TITLE,BETA_RULES_VERSION} from '../beta-rules';

export default function BetaRulesAcceptance({email}:{email:string}){
 const [agreed,setAgreed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function accept(){
  setError('');
  if(!agreed){setError('Please confirm that you have read and agree to the beta testing rules.');return;}
  setBusy(true);
  try{const response=await fetch('/api/tester-rules',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accepted:true,version:BETA_RULES_VERSION})});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Your acceptance could not be recorded.');window.location.reload()}catch(reason){setError(reason instanceof Error?reason.message:'Your acceptance could not be recorded.');setBusy(false)}
 }
 return <main className="nda-sign-shell"><div className="nda-signing">
  <a className="nda-back" href="/"><ArrowLeft size={17}/> Back to B.E.I.P.I.</a>
  <header className="nda-sign-header"><div className="nda-sign-icon"><ShieldCheck size={28}/></div><div><span>TRUSTED BETA ACCESS</span><h1>A few friendly rules before Pip helps</h1><p>You have been personally granted access to B.E.I.P.I. Please read these simple beta testing rules before entering.</p></div></header>
  <div className="nda-agreement-card"><div className="nda-document-title"><ClipboardCheck size={22}/><div><strong>{BETA_RULES_TITLE}</strong><small>Rules version {BETA_RULES_VERSION}</small></div></div><div className="nda-document-body beta-rules-list">{BETA_RULES.map((rule,index)=><section key={rule.title}><span>{index+1}</span><div><h2>{rule.title}</h2><p>{rule.body}</p></div></section>)}</div></div>
  <section className="nda-sign-form beta-rules-form"><div><span className="nda-step">ACCEPT THE RULES</span><h2>Ready to meet Pip?</h2><p>Your account email, rules version and acceptance time will be saved.</p></div><div className="nda-account"><span>Signed in as</span><strong>{email}</strong></div><label className="nda-consent"><input type="checkbox" checked={agreed} onChange={event=>setAgreed(event.target.checked)}/><span>I have read and agree to follow the B.E.I.P.I. Beta Testing Rules.</span></label>{error&&<p className="nda-error" role="alert">{error}</p>}<button className="nda-sign-button" type="button" onClick={accept} disabled={busy||!agreed}>{busy?'Saving your acceptance…':<><Check size={18}/> Accept rules and enter B.E.I.P.I.</>}</button></section>
 </div></main>;
}

