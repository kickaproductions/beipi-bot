'use client';

import {useMemo,useState,type FormEvent} from 'react';
import {CalendarDays,Check,ChevronLeft,ChevronRight,Clock,Plus,Sparkles,Trash2,Trophy,Users} from 'lucide-react';

export type CrewItem={id:string;kind:string;title:string;note:string;due:string|null;done:boolean;createdAt:string};

type Props={
 items:CrewItem[];
 busy:boolean;
 onCreate:(item:{kind:string;title:string;note?:string;due?:string|null})=>Promise<boolean>;
 onToggle:(item:CrewItem)=>Promise<void>;
 onDelete:(id:string)=>Promise<void>;
 onSaved:(message:string)=>void;
};

const achievements:Record<string,string[]>={
 Twitch:['First stream','Affiliate','Partner'],
 YouTube:['First livestream','YouTube Partner Program','100,000 subscribers'],
 Kick:['First stream','Subscriptions enabled','Verified','Partner'],
 TikTok:['First LIVE','LIVE access','LIVE Subscription enabled'],
 Other:['First stream','First subscriber','Community milestone']
};
const weekdays=['MON','TUE','WED','THU','FRI','SAT','SUN'];

function dayKey(value:Date|string|null){if(!value)return '';const date=typeof value==='string'?new Date(value):value;return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
function dateLabel(value:string|null){return value?new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'No date'}

export default function MyCrew({items,busy,onCreate,onToggle,onDelete,onSaved}:Props){
 const [month,setMonth]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)});
 const [taskOpen,setTaskOpen]=useState(false),[milestoneOpen,setMilestoneOpen]=useState(false),[scheduleOpen,setScheduleOpen]=useState(false);
 const [platform,setPlatform]=useState('Twitch');
 const tasks=items.filter(item=>item.kind==='crew-task');
 const milestones=items.filter(item=>item.kind==='crew-milestone').sort((a,b)=>(a.due||'').localeCompare(b.due||''));
 const streams=items.filter(item=>item.kind==='crew-stream').sort((a,b)=>(a.due||'').localeCompare(b.due||''));
 const calendarDays=useMemo(()=>{
  const year=month.getFullYear(),index=month.getMonth(),first=(new Date(year,index,1).getDay()+6)%7,total=new Date(year,index+1,0).getDate();
  return [...Array(first).fill(null),...Array.from({length:total},(_,i)=>new Date(year,index,i+1))];
 },[month]);
 async function addTask(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=new FormData(e.currentTarget);const date=String(form.get('date')||'');if(await onCreate({kind:'crew-task',title:String(form.get('title')),due:date?new Date(date+'T12:00:00').toISOString():null})){e.currentTarget.reset();setTaskOpen(false);onSaved('Added to the crew list.')}}
 async function addMilestone(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=new FormData(e.currentTarget);const date=String(form.get('date'));if(await onCreate({kind:'crew-milestone',title:`${platform} · ${String(form.get('achievement'))}`,note:platform,due:new Date(date+'T12:00:00').toISOString()})){e.currentTarget.reset();setMilestoneOpen(false);onSaved('Milestone saved. That one deserves celebrating!')}}
 async function addStream(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=new FormData(e.currentTarget);const date=String(form.get('date')),time=String(form.get('time'));if(await onCreate({kind:'crew-stream',title:String(form.get('title')),note:String(form.get('platform')),due:new Date(`${date}T${time}`).toISOString()})){e.currentTarget.reset();setScheduleOpen(false);onSaved('Stream added to the crew calendar.')}}
 const eventsFor=(date:Date)=>[...streams,...milestones].filter(item=>dayKey(item.due)===dayKey(date));
 return <div className="crew-workspace">
  <section className="crew-welcome">
   <div><span className="eyebrow">CREATOR + MODERATOR SPACE</span><h2>Your people, on the same page.</h2><p>Keep plans, milestones and the little jobs your crew shares in one calm place.</p></div>
   <span className="crew-access"><Users size={16}/> Private to approved crew</span>
  </section>
  <div className="crew-grid crew-grid-top">
   <section className="card crew-calendar">
    <header><div><span className="crew-card-icon"><CalendarDays size={18}/></span><div><h2>Calendar</h2><p>Streams and milestones together.</p></div></div><div className="crew-month-controls"><button aria-label="Previous month" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft size={17}/></button><strong>{month.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</strong><button aria-label="Next month" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight size={17}/></button></div></header>
    <div className="crew-calendar-grid">{weekdays.map(day=><span className="crew-weekday" key={day}>{day}</span>)}{calendarDays.map((date,index)=>date?<div className={'crew-day '+(dayKey(date)===dayKey(new Date())?'today':'')} key={dayKey(date)}><b>{date.getDate()}</b><div>{eventsFor(date).slice(0,2).map(event=><span className={event.kind==='crew-milestone'?'milestone':'stream'} title={event.title} key={event.id}>{event.kind==='crew-milestone'?<Trophy size={10}/>:<Clock size={10}/>} {event.title.replace(/^.* · /,'')}</span>)}</div></div>:<span className="crew-day blank" key={'blank-'+index}/>)}</div>
   </section>
   <section className="card crew-milestones">
    <header><div><span className="crew-card-icon gold"><Trophy size={18}/></span><div><h2>Milestones</h2><p>Dates worth remembering.</p></div></div><button className="crew-add" onClick={()=>setMilestoneOpen(!milestoneOpen)}><Plus size={15}/> Add</button></header>
    {milestoneOpen&&<form className="crew-quick-form" onSubmit={addMilestone}><select value={platform} onChange={e=>setPlatform(e.target.value)} aria-label="Platform">{Object.keys(achievements).map(name=><option key={name}>{name}</option>)}</select><select name="achievement" aria-label="Achievement">{achievements[platform].map(name=><option key={name}>{name}</option>)}</select><input name="date" type="date" required aria-label="Milestone date"/><button className="primary" disabled={busy}>Save milestone</button></form>}
    <div className="crew-list">{milestones.length?milestones.slice(0,5).map(item=><article key={item.id}><span className="crew-list-mark gold"><Sparkles size={15}/></span><div><strong>{item.title}</strong><small>{dateLabel(item.due)}</small></div><button aria-label={'Delete '+item.title} onClick={()=>void onDelete(item.id)}><Trash2 size={15}/></button></article>):<div className="crew-mini-empty"><Trophy size={22}/><p>Add a first stream, Affiliate date or another proud moment.</p></div>}</div>
   </section>
  </div>
  <div className="crew-grid">
   <section className="card crew-tasks">
    <header><div><span className="crew-card-icon mint"><Check size={18}/></span><div><h2>Crew list</h2><p>Small jobs, visible to everyone helping.</p></div></div><button className="crew-add" onClick={()=>setTaskOpen(!taskOpen)}><Plus size={15}/> Add</button></header>
    {taskOpen&&<form className="crew-quick-form task" onSubmit={addTask}><input name="title" required maxLength={120} placeholder="What needs doing?" autoFocus/><input name="date" type="date" aria-label="Due date"/><button className="primary" disabled={busy}>Add task</button></form>}
    <div className="crew-list">{tasks.length?tasks.slice(0,6).map(item=><article className={item.done?'done':''} key={item.id}><button className="crew-check" aria-label={(item.done?'Reopen ':'Complete ')+item.title} onClick={()=>void onToggle(item)}>{item.done&&<Check size={13}/>}</button><div><strong>{item.title}</strong><small>{item.due?'Due '+dateLabel(item.due):'No deadline'}</small></div><button aria-label={'Delete '+item.title} onClick={()=>void onDelete(item.id)}><Trash2 size={15}/></button></article>):<div className="crew-mini-empty"><Check size={22}/><p>Nothing waiting. A rare and beautiful sight.</p></div>}</div>
   </section>
   <section className="card crew-schedule">
    <header><div><span className="crew-card-icon lavender"><Clock size={18}/></span><div><h2>Next streams</h2><p>A quick plan, not a complicated timetable.</p></div></div><button className="crew-add" onClick={()=>setScheduleOpen(!scheduleOpen)}><Plus size={15}/> Schedule</button></header>
    {scheduleOpen&&<form className="crew-quick-form schedule" onSubmit={addStream}><input name="title" required maxLength={120} placeholder="Stream title or game" autoFocus/><select name="platform" defaultValue="Twitch" aria-label="Platform"><option>Twitch</option><option>YouTube</option><option>Kick</option><option>TikTok</option><option>Multi-platform</option></select><input name="date" type="date" required aria-label="Stream date"/><input name="time" type="time" required aria-label="Start time"/><button className="primary" disabled={busy}>Save stream</button></form>}
    <div className="crew-list schedule-list">{streams.length?streams.slice(0,5).map(item=><article key={item.id}><span className="crew-date"><b>{item.due?new Date(item.due).getDate():'—'}</b><small>{item.due?new Date(item.due).toLocaleDateString(undefined,{month:'short'}):''}</small></span><div><strong>{item.title}</strong><small>{item.note} · {item.due?new Date(item.due).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'Time not set'}</small></div><button aria-label={'Delete '+item.title} onClick={()=>void onDelete(item.id)}><Trash2 size={15}/></button></article>):<div className="crew-mini-empty"><CalendarDays size={22}/><p>No streams scheduled yet. Add one when you’re ready.</p></div>}</div>
   </section>
  </div>
 </div>;
}
