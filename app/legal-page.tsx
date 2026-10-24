import type {ReactNode} from 'react';

export default function LegalPage({eyebrow,title,intro,children}:{eyebrow:string;title:string;intro:string;children:ReactNode}){
 return <main className="legal-shell">
  <header className="legal-nav"><a className="landing-brand" href="/">B.E.I.P.I. <span>BOT</span></a><a href="/">← Back home</a></header>
  <article className="legal-page">
   <header className="legal-hero"><span>{eyebrow}</span><h1>{title}</h1><p>{intro}</p><small>Last updated: 24 October 2026</small></header>
   <div className="legal-content">{children}</div>
  </article>
  <footer className="legal-footer"><span>© 2026 B.E.I.P.I. Bot</span><nav aria-label="Legal pages"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/nda">Beta NDA</a></nav></footer>
 </main>
}
