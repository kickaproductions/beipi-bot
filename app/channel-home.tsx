'use client';
import {ChevronDown,ChevronRight,Clock3,Hash,ImagePlus,Plus,Trash2} from 'lucide-react';
import type {SavedDraft} from './discord-schema';

export default function ChannelHome({drafts,loading,busy,onNew,onEdit,onRemove}:{drafts:SavedDraft[];loading:boolean;busy:boolean;onNew:()=>void;onEdit:(draft:SavedDraft)=>void;onRemove:(draft:SavedDraft)=>void}){
 const saved=drafts.filter(draft=>draft.payload.type==='channel');
 return <div className="reaction-role-home channel-home">
  <button className="card reaction-home-header" onClick={onNew}><span className="stat-icon lavender"><Plus size={20}/></span><span><strong>New</strong><small>Create a channel or prepare a message for one.</small></span><ChevronRight size={20}/></button>
  <details className="card reaction-home-accordion"><summary><span className="stat-icon gold"><Clock3 size={20}/></span><span><strong>Drafts</strong><small>Continue something you started earlier.</small></span><span className="reaction-count">{saved.length}</span><ChevronDown size={20}/></summary><div className="reaction-home-content">{loading?<p className="loading">Finding your saved drafts…</p>:saved.length?<div className="rows">{saved.map(record=><article className="saved-discord" key={record.id}><span className="stat-icon lavender">{record.payload.bannerId?<ImagePlus size={18}/>:<Hash size={18}/>}</span><div><strong>{record.payload.title}</strong><p>{record.payload.server} · #{record.payload.channel}</p><small>{record.payload.mode==='new'?'New channel':'Existing channel'} · {record.payload.bannerId?'Banner & message':'Message'} · {new Date(record.updatedAt).toLocaleDateString()}</small></div><button className="outline" disabled={busy} onClick={()=>onEdit(record)}>Edit</button><button className="icon-button" aria-label={'Delete '+record.payload.title} disabled={busy} onClick={()=>onRemove(record)}><Trash2 size={16}/></button></article>)}</div>:<div className="empty compact"><Clock3 size={24}/><h3>No drafts waiting.</h3><p>Anything you save for later will appear here.</p></div>}</div></details>
 </div>
}
