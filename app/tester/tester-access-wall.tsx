'use client';
import {FormEvent,useState} from 'react';
import {ArrowLeft,BadgeCheck,Check,Clock3,Heart,LockKeyhole,Send,Sparkles} from 'lucide-react';

type AccessRequest={status:string;developer_response:string|null;created_at:string;updated_at:string};

export default function TesterAccessWall({name,initialRequest}:{name:string;initialRequest:AccessRequest|null}){
 const [request,setRequest]=useState(initialRequest),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');const form=event.currentTarget;try{const response=await fetch('/api/tester-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:String(new FormData(form).get('message')||'')})});const data=await response.json();if(!response.ok)throw Error(data.error||'Your request could not be sent.');setRequest(data.request);form.reset()}catch(value){setError(value instanceof Error?value.message:'Your request could not be sent.')}finally{setBusy(false)}}
 const pending=request?.status==='pending';
 return <main className="tester-shell tester-wall-shell">
  <header className="tester-topbar"><a href="/dashboard"><ArrowLeft size={16}/> Back to dashboard</a><span><LockKeyhole size={15}/> Private beta</span></header>
  <section className="tester-wall">
   <div className="tester-wall-copy"><span className="tester-kicker"><Sparkles size={15}/> B.E.I.P.I. BETA CREW</span><h1>{pending?'Your request is aboard.':'Beta access required.'}</h1>{pending?<><p>Thanks, {name}. Your request is waiting for review. You’ll see the Tester Portal here as soon as you’re approved.</p><div className="tester-wall-status"><Clock3 size={19}/><div><strong>Request pending</strong><span>Sent {new Date(request.created_at).toLocaleDateString()}</span></div></div></>:<><p>The Tester Portal is a private space for approved creators helping us test B.E.I.P.I. before launch.</p><div className="tester-wall-perks"><span><Check size={16}/> Test new features early</span><span><Check size={16}/> Send private bug reports</span><span><Check size={16}/> Help shape B.E.I.P.I.</span></div></>}</div>
   <section className="tester-card tester-wall-card">{pending?<><BadgeCheck size={34}/><h2>Nothing else to do.</h2><p>Your dashboard remains available while the request is reviewed. We’ll keep this page updated.</p><a className="outline tester-wall-button" href="/dashboard">Return to dashboard</a></>:<><div className="tester-card-heading"><span><LockKeyhole size={20}/></span><div><h2>Request beta access</h2><p>Tell us a little about how you’d like to help.</p></div></div>{request?.status==='declined'&&<div className="tester-wall-declined"><strong>Your previous request wasn’t approved yet.</strong>{request.developer_response&&<span>{request.developer_response}</span>}<span>You’re welcome to send a new request.</span></div>}<form className="tester-form" onSubmit={submit}><label>Why would you like to join? <small>optional</small><textarea name="message" maxLength={1000} rows={5} placeholder="For example: the platforms you stream on or the parts of B.E.I.P.I. you’d love to test."/></label>{error&&<p className="tester-error" role="alert">{error}</p>}<button className="primary tester-submit" disabled={busy}><Send size={16}/>{busy?'Sending…':request?.status==='declined'?'Send a new request':'Request beta access'}</button></form></>}</section>
  </section>
  <footer className="tester-wall-footer"><span><Heart size={13}/> Here when you need me.</span><nav aria-label="Tester legal information"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/nda">Beta NDA</a></nav></footer>
 </main>;
}
