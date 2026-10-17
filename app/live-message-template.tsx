'use client';
import {useRef,useState} from 'react';
import {Braces,Eye} from 'lucide-react';

const variables=[
 {value:'{streamer}',label:'Streamer name'},
 {value:'{title}',label:'Stream title'},
 {value:'{game}',label:'Game or category'},
 {value:'{platform}',label:'Streaming platform'},
 {value:'{url}',label:'Stream link'},
 {value:'{server}',label:'Discord server'},
 {value:'{random_item}',label:'Random item'},
 {value:'{random_animal}',label:'Random animal'},
 {value:'{random_dinosaur}',label:'Random dinosaur'},
 {value:'{random_companion}',label:'Random animal, item or dinosaur'}
];
const sample:Record<string,string>={streamer:'Kickaa',title:'Chaos, quests and questionable decisions',game:'Fortnite',platform:'Twitch',url:'https://twitch.tv/kickaa',server:'The Kickaaverse',random_item:'battle spoon',random_animal:'platypus',random_dinosaur:'tiny triceratops',random_companion:'emotional-support potato'};
export default function LiveMessageTemplate({label,value,onChange,help}:{label:string;value:string;onChange:(value:string)=>void;help:string}){
 const area=useRef<HTMLTextAreaElement>(null),[choice,setChoice]=useState('');
 function insert(token:string){if(!token)return;const start=area.current?.selectionStart??value.length,end=area.current?.selectionEnd??value.length;const next=value.slice(0,start)+token+value.slice(end);if(next.length<=1800)onChange(next);setChoice('');requestAnimationFrame(()=>{area.current?.focus();area.current?.setSelectionRange(start+token.length,start+token.length)})}
 const preview=value.replace(/\{([a-z_]+)\}/g,(match,key)=>sample[key]||match);
 return <div className="live-template"><div className="live-template-heading"><label htmlFor={label.replace(/\s/g,'-').toLowerCase()}>{label}</label><span>{value.length}/1800</span></div><div className="variable-picker"><Braces size={15}/><select aria-label="Insert a message variable" value={choice} onChange={e=>{setChoice(e.target.value);insert(e.target.value)}}><option value="">Insert a variable…</option>{variables.map(variable=><option key={variable.value} value={variable.value}>{variable.label} — {variable.value}</option>)}</select></div><textarea id={label.replace(/\s/g,'-').toLowerCase()} ref={area} required maxLength={1800} rows={7} value={value} onChange={e=>onChange(e.target.value)}/><small>{help} Variables inside braces are filled automatically when the stream begins.</small><div className="live-template-preview"><div><Eye size={14}/><strong>Example</strong></div><p>{preview}</p></div></div>
}
