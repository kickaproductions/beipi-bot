'use client';

import {useEffect,useState} from 'react';

const futureProviders=['Google','Kick','TikTok','Facebook'] as const;

export default function LandingPage(){
  const [loginOpen,setLoginOpen]=useState(false);
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    if(!loginOpen)return;
    const close=(event:KeyboardEvent)=>event.key==='Escape'&&setLoginOpen(false);
    window.addEventListener('keydown',close);
    return()=>window.removeEventListener('keydown',close);
  },[loginOpen]);
  function comingSoon(name:string){setNotice(`${name} sign-in is coming soon. Twitch and Discord are ready to test now.`)}
  return <div className="landing-shell">
    <header className="landing-wrap landing-nav"><a className="landing-brand" href="#top">B.E.I.P.I. <span>BOT</span></a><nav><a href="#meet">Meet B.E.I.P.I.</a><a href="#features">Features</a><a href="#promise">Our promise</a><button className="landing-button ghost" onClick={()=>setLoginOpen(true)}>Log in</button></nav></header>
    <main id="top">
      <div className="landing-wrap landing-hero"><div><div className="landing-eyebrow"><i/>Your streaming companion</div><h1>Big dreams.<br/><em>Little helper.</em></h1><p>B.E.I.P.I. helps busy, neuro-spicy and wonderfully forgetful creators stay organised, bring their communities together and enjoy streaming with a little less mental load.</p><div className="landing-actions"><a className="landing-button primary" href="#features">Meet B.E.I.P.I.</a><button className="landing-button ghost" onClick={()=>setLoginOpen(true)}>Log in</button></div></div><div className="landing-mascot"><div className="landing-orb"/><span>Oh, hi! ♡</span><img src="/beipi-dashboard-peek-v3.png" alt="B.E.I.P.I., a cheerful purple and yellow companion wearing a headset"/></div></div>
      <div className="landing-wrap landing-trust" id="meet"><div><strong>One calm home</strong><span>for your stream</span></div><div><strong>Multi-platform</strong><span>your connections together</span></div><div><strong>Creator-first</strong><span>built around real needs</span></div><div><strong>Collaboration Space</strong><span>for creators and their teams</span></div></div>
      <section className="landing-wrap landing-section" id="features"><div className="landing-section-head"><span>A gentler way to stream</span><h2>Less juggling.<br/>More creating.</h2><p>B.E.I.P.I. brings the everyday pieces of streaming into one friendly space, without making you learn another complicated system.</p></div><div className="landing-features"><article className="highlight"><i>✓</i><h3>Remember the little things</h3><p>Simple stream checklists and thoughtful reminders help you arrive prepared, even when your brain has twelve tabs open.</p></article><article><i>◉</i><h3>Keep communities close</h3><p>Connect Twitch and Discord so your stream and your people feel like part of the same world.</p></article><article><i>↗</i><h3>See what matters</h3><p>Friendly, uncluttered insights designed to be understood at a glance, not another wall of numbers.</p></article></div></section>
      <section className="landing-wrap landing-promise" id="promise"><div className="landing-promise-title"><span>Made for human brains</span><h2>A companion,<br/>not another chore.</h2></div><div className="landing-promise-list"><article><h3>Calm by design</h3><p>A focused view keeps what matters in front of you, without clutter competing for your attention.</p></article><article><h3>You stay in control</h3><p>Choose what to connect and which tools belong in your workflow.</p></article><article><h3>Growing with streamers</h3><p>B.E.I.P.I. is being shaped by content creators and streamers.</p></article></div></section>
      <section className="landing-wrap landing-section"><div className="landing-cta"><span>Ready when you are</span><h2>Come meet your<br/>new co-pilot.</h2><p>Connect your stream, settle in, and let B.E.I.P.I. help carry the mental load.</p><button className="landing-button primary" onClick={()=>setLoginOpen(true)}>Get started</button></div></section>
    </main>
    <footer className="landing-wrap landing-footer"><span>© 2026 B.E.I.P.I. Bot</span><span>Your stream. Your community. Your companion.</span><span>Privacy · Terms</span></footer>
    {loginOpen&&<div className="landing-modal-backdrop" onMouseDown={event=>event.target===event.currentTarget&&setLoginOpen(false)}><section className="landing-login" role="dialog" aria-modal="true" aria-labelledby="landing-login-title"><button className="landing-close" aria-label="Close" onClick={()=>setLoginOpen(false)}>×</button><span className="landing-kicker">Welcome aboard</span><h2 id="landing-login-title">Join B.E.I.P.I.</h2><p>Create your home base or log back in.</p><div className="landing-account-options"><button className="create" onClick={()=>comingSoon('Account creation')}>Create an account</button><button onClick={()=>comingSoon('Email')}>Log in with email</button></div><div className="landing-divider">or continue with</div><div className="landing-providers"><a href="/api/auth/twitch/start"><i>T</i>Twitch</a><a href="/api/auth/discord/start"><i>D</i>Discord</a>{futureProviders.map(provider=><button key={provider} onClick={()=>comingSoon(provider)}><i>{provider==='TikTok'?'♪':provider[0]}</i>{provider}</button>)}</div>{notice&&<div className="landing-login-notice" role="status">{notice}</div>}<small>We only ask for the access B.E.I.P.I. needs.</small></section></div>}
  </div>
}
