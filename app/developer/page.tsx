import {redirect} from 'next/navigation';
import {ArrowLeft,BarChart3,Bug,Code2,Heart,Link2,MessageSquareText,Server,ShieldCheck,Users} from 'lucide-react';
import {createClient} from '@/lib/supabase/server';

export const metadata={title:'Developer Portal · B.E.I.P.I.'};
export const dynamic='force-dynamic';

const areas=[
  {title:'Accounts',copy:'View registered accounts and manage developer, tester and launch access.',icon:Users,status:'Open account management',href:'/developer/accounts'},
  {title:'Connections',copy:'See connection health across Twitch, Discord, Google and YouTube.',icon:Link2,status:'Foundation ready'},
  {title:'Discord servers',copy:'Monitor installed communities, settings and server health.',icon:Server,status:'Open server management',href:'/developer/servers'},
  {title:'Analytics',copy:'Understand account growth, platform mix and traffic sources.',icon:BarChart3,status:'Coming next'},
  {title:'Tester feedback',copy:'Review Founding Tester reports, suggestions and screenshots.',icon:MessageSquareText,status:'Open review queue',href:'/developer/tester-feedback'},
  {title:'System health',copy:'Keep an eye on connection errors and B.E.I.P.I. services.',icon:Bug,status:'Coming next'},
];

export default async function DeveloperPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/account');
  const {data:profile}=await supabase.from('profiles').select('display_name,role').eq('id',user.id).maybeSingle();
  if(profile?.role!=='developer')redirect('/dashboard');
  const {data:assurance}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if(assurance?.currentLevel!=='aal2')redirect('/account/security?next=/developer');
  const name=profile.display_name||user.user_metadata?.full_name||'Captain';
  return <main className="developer-shell">
    <header className="developer-topbar"><a href="/dashboard"><ArrowLeft size={16}/> Back to dashboard</a><span><ShieldCheck size={15}/> Developer access</span></header>
    <section className="developer-hero"><div><span className="developer-kicker"><Code2 size={15}/> B.E.I.P.I. CONTROL DECK</span><h1>Welcome aboard, {name}.</h1><p>Your private space for building, testing and keeping an eye on B.E.I.P.I. as she grows.</p></div><img src="/beipi-dashboard-peek-v3.png" alt="B.E.I.P.I. greeting her developer"/></section>
    <div className="developer-heading"><div><span>YOUR WORKSPACE</span><h2>Everything behind the curtain.</h2></div><p>We’ll connect each section to live information carefully as the platform grows.</p></div>
    <section className="developer-grid">{areas.map(({title,copy,icon:Icon,status,...area})=>area.href?<a className="developer-area-link" href={area.href} key={title}><span className="developer-icon"><Icon size={22}/></span><h3>{title}</h3><p>{copy}</p><small>{status}</small></a>:<article key={title}><span className="developer-icon"><Icon size={22}/></span><h3>{title}</h3><p>{copy}</p><small>{status}</small></article>)}</section>
    <footer><Heart size={13}/> Private to B.E.I.P.I.’s development team.</footer>
  </main>;
}
