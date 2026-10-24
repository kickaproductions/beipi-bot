import type { Metadata } from 'next';
import './globals.css';
import TextShortcuts from './text-shortcuts';
export const metadata:Metadata={title:'B.E.I.P.I · Your streamer companion',description:'A little less to remember. Your private space for stream checklists, reminders and ideas.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to main content</a><div id="main-content" tabIndex={-1}><TextShortcuts/>{children}<footer className="site-legal-footer"><span>© 2026 B.E.I.P.I. Bot</span><nav aria-label="Legal information"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a><a href="/nda">Beta NDA</a></nav></footer></div></body></html>}
