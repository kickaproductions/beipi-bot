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
function InlinePreview({text}:{text:string}){return <>{text.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*)/g).map((chunk,index)=>chunk.startsWith('**')&&chunk.endsWith('**')?<strong key={index}>{chunk.slice(2,-2)}</strong>:chunk.startsWith('__')&&chunk.endsWith('__')?<u key={index}>{chunk.slice(2,-2)}</u>:chunk.startsWith('*')&&chunk.endsWith('*')?<em key={index}>{chunk.slice(1,-1)}</em>:chunk)}</>}
function TemplatePreview({text}:{text:string}){return <div className="live-preview-copy">{text.split('\n').map((line,index)=>line.startsWith('# ')?<h3 key={index}><InlinePreview text={line.slice(2)}/></h3>:<div key={index}>{line?<InlinePreview text={line}/>:<br/>}</div>)}</div>}
export default function LiveMessageTemplate({label,value,onChange,help}:{label:string;value:string;onChange:(value:string)=>void;help:string}){
 const area=useRef<HTMLTextAreaElement>(null),[choice,setChoice]=useState(''),[emojiOpen,setEmojiOpen]=useState(false);
 function insert(token:string){if(!token)return;const start=area.current?.selectionStart??value.length,end=area.current?.selectionEnd??value.length;const next=value.slice(0,start)+token+value.slice(end);if(next.length<=1800)onChange(next);setChoice('');requestAnimationFrame(()=>{area.current?.focus();area.current?.setSelectionRange(start+token.length,start+token.length)})}
 function format(prefix:string,suffix=prefix,placeholder='text'){const start=area.current?.selectionStart??value.length,end=area.current?.selectionEnd??value.length,selected=value.slice(start,end)||placeholder;const next=value.slice(0,start)+prefix+selected+suffix+value.slice(end);if(next.length<=1800)onChange(next);requestAnimationFrame(()=>{area.current?.focus();area.current?.setSelectionRange(start+prefix.length,start+prefix.length+selected.length)})}
 function heading(){const start=area.current?.selectionStart??value.length,lineStart=value.lastIndexOf('\n',Math.max(0,start-1))+1,next=value.slice(0,lineStart)+'# '+value.slice(lineStart);if(next.length<=1800)onChange(next);requestAnimationFrame(()=>{area.current?.focus();area.current?.setSelectionRange(start+2,start+2)})}
 function emoji(symbol:string){insert(symbol);setEmojiOpen(false)}
 const preview=value.replace(/\{([a-z_]+)\}/g,(match,key)=>sample[key]||match);
 return <div className="live-template"><div className="live-template-heading"><label htmlFor={label.replace(/\s/g,'-').toLowerCase()}>{label}</label><span>{value.length}/1800</span></div><div className="variable-picker"><Braces size={15}/><select aria-label="Insert a message variable" value={choice} onChange={e=>{setChoice(e.target.value);insert(e.target.value)}}><option value="">Insert a variable…</option>{variables.map(variable=><option key={variable.value} value={variable.value}>{variable.label} — {variable.value}</option>)}</select></div><div className="format-toolbar live-format-toolbar" aria-label="Live message formatting"><button type="button" onClick={heading} title="Heading">H</button><button type="button" onClick={()=>format('**','**','bold text')} title="Bold"><strong>B</strong></button><button type="button" onClick={()=>format('*','*','italic text')} title="Italic"><em>I</em></button><button type="button" onClick={()=>format('__','__','underlined text')} title="Underline"><u>U</u></button><div className="emoji-tool"><button type="button" onClick={()=>setEmojiOpen(!emojiOpen)} aria-expanded={emojiOpen} title="Add emoji">😊</button>{emojiOpen&&<div className="emoji-picker">{['💜','✨','🎉','👋','✅','📣','🎮','🎥','🌸','🦖','❤️','🔥','😂','👀','⭐','🎁','📌','📅','🔔','🫶'].map(symbol=><button type="button" key={symbol} onClick={()=>emoji(symbol)}>{symbol}</button>)}</div>}</div></div><textarea id={label.replace(/\s/g,'-').toLowerCase()} ref={area} required maxLength={1800} rows={7} value={value} onChange={e=>onChange(e.target.value)}/><small>{help} Variables inside braces are filled automatically when the stream begins.</small><div className="live-template-preview"><div><Eye size={14}/><strong>Example</strong></div><TemplatePreview text={preview}/></div></div>
}
