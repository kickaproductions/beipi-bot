import {redirect} from 'next/navigation';
import {ArrowLeft,BarChart3,Bug,Code2,Heart,Link2,MessageSquareText,Server,ShieldCheck,Users} from 'lucide-react';
import {createClient} from '@/lib/supabase/server';

export const metadata={title:'Developer Portal · B.E.I.P.I.'};
export const dynamic='force-dynamic';

const areas=[
  {title:'Accounts',copy:'View registered B.E.I.P.I. accounts and access levels.',icon:Users,status:'Ready for data'},
  {title:'Connections',copy:'See connection health across Twitch, Discord, Google and Kick.',icon:Link2,status:'Foundation ready'},
  {title:'Discord servers',copy:'Monitor installed communities and server setup health.',icon:Server,status:'Coming next'},
  {title:'Analytics',copy:'Understand account growth, platform mix and traffic sources.',icon:BarChart3,status:'Coming next'},
  {title:'Tester feedback',copy:'A private home for Founding Tester reports and suggestions.',icon:MessageSquareText,status:'Coming next'},
  {title:'System health',copy:'Keep an eye on connection errors and B.E.I.P.I. services.',icon:Bug,status:'Coming next'},
];

export default async function DeveloperPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/account');
  const {data:profile}=await supabase.from('profiles').select('display_name,role,founding_tester,lifetime_free').eq('id',user.id).maybeSingle();
  if(profile?.role!=='developer')redirect('/dashboard');
  const {data:assurance}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if(assurance?.currentLevel!=='aal2')redirect('/account/security?next=/developer');
  const name=profile.display_name||user.user_metadata?.full_name||'Captain';
  return <main className="developer-shell">
    <header className="developer-topbar"><a href="/dashboard"><ArrowLeft size={16}/> Back to dashboard</a><span><ShieldCheck size={15}/> Developer access</span></header>
    <section className="developer-hero"><div><span className="developer-kicker"><Code2 size={15}/> B.E.I.P.I. CONTROL DECK</span><h1>Welcome aboard, {name}.</h1><p>Your private space for building, testing and keeping an eye on B.E.I.P.I. as she grows.</p></div><img src="/beipi-dashboard-peek-v3.png" alt="B.E.I.P.I. greeting her developer"/></section>
    <section className="developer-summary"><article><strong>Developer</strong><span>Account role</span></article><article><strong>{profile.founding_tester?'Founding Tester':'Standard'}</strong><span>Tester access</span></article><article><strong>{profile.lifetime_free?'Free forever':'Standard plan'}</strong><span>Launch plan</span></article></section>
    <div className="developer-heading"><div><span>YOUR WORKSPACE</span><h2>Everything behind the curtain.</h2></div><p>We’ll connect each section to live information carefully as the platform grows.</p></div>
    <section className="developer-grid">{areas.map(({title,copy,icon:Icon,status})=><article key={title}><span className="developer-icon"><Icon size={22}/></span><h3>{title}</h3><p>{copy}</p><small>{status}</small></article>)}</section>
    <footer><Heart size={13}/> Private to B.E.I.P.I.’s development team.</footer>
  </main>;
}
