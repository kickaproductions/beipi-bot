import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'B.E.I.P.I · Your streamer companion',description:'A little less to remember. Your private space for stream checklists, reminders and ideas.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
