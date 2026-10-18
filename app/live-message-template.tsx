'use client';
import {useRef,useState,type MouseEvent} from 'react';
import {Eye,Sparkles} from 'lucide-react';

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

function InlinePreview({text}:{text:string}){
 const pieces=[];let cursor=0,key=0;
 while(cursor<text.length){
  const rest=text.slice(cursor);let match:RegExpMatchArray|null=null;let kind='';
  const patterns:[string,RegExp][]=[['bold-italic',/^\*\*\*(.+?)\*\*\*/],['bold',/^\*\*(.+?)\*\*/],['underline',/^__(.+?)__/],['italic',/^\*(.+?)\*/]];
  for(const [type,pattern] of patterns){const found=rest.match(pattern);if(found){match=found;kind=type;break}}
  if(match){const content=<InlinePreview text={match[1]}/>,item=kind==='bold-italic'?<strong key={key++}><em>{content}</em></strong>:kind==='bold'?<strong key={key++}>{content}</strong>:kind==='underline'?<span key={key++} style={{textDecoration:'underline',textUnderlineOffset:2}}>{content}</span>:<em key={key++}>{content}</em>;pieces.push(item);cursor+=match[0].length;continue}
  const nextMarkers=[rest.indexOf('***',1),rest.indexOf('**',1),rest.indexOf('__',1),rest.indexOf('*',1)].filter(position=>position>0);const length=nextMarkers.length?Math.min(...nextMarkers):rest.length;pieces.push(rest.slice(0,length));cursor+=length;
 }
 return <>{pieces}</>;
}
function TemplatePreview({text}:{text:string}){return <div className="live-preview-copy" style={{display:'block',fontFamily:'Arial, Helvetica Neue, sans-serif',fontSize:14,lineHeight:1.5,letterSpacing:0,textTransform:'none',marginTop:13,whiteSpace:'normal'}}>{text.split(/\r?\n/).map((line,index)=>line.startsWith('# ')?<div key={index} style={{display:'block',fontSize:19,lineHeight:1.3,fontWeight:700,margin:'5px 0 7px'}}><InlinePreview text={line.slice(2)}/></div>:line?<div key={index} style={{display:'block',minHeight:'1.5em'}}><InlinePreview text={line}/></div>:<div key={index} aria-hidden="true" style={{display:'block',height:12}}>&nbsp;</div>)}</div>}
export default function LiveMessageTemplate({label,value,onChange,help}:{label:string;value:string;onChange:(value:string)=>void;help:string}){
 const area=useRef<HTMLTextAreaElement>(null),selection=useRef({start:0,end:0}),[choice,setChoice]=useState(''),[emojiOpen,setEmojiOpen]=useState(false);
 function rememberSelection(){const editor=area.current;if(editor)selection.current={start:editor.selectionStart,end:editor.selectionEnd}}
 function keepSelection(event:MouseEvent<HTMLButtonElement>){event.preventDefault()}
 function restoreSelection(start:number,end:number){requestAnimationFrame(()=>{area.current?.focus();area.current?.setSelectionRange(start,end);selection.current={start,end}})}
 function insert(token:string){if(!token)return;const {start,end}=selection.current,position=Math.min(start,value.length),finish=Math.min(end,value.length),next=value.slice(0,position)+token+value.slice(finish);if(next.length<=1800){onChange(next);restoreSelection(position+token.length,position+token.length)}setChoice('')}
 function format(prefix:string,suffix=prefix,placeholder='text'){const {start,end}=selection.current,position=Math.min(start,value.length),finish=Math.min(end,value.length),selected=value.slice(position,finish)||placeholder,next=value.slice(0,position)+prefix+selected+suffix+value.slice(finish);if(next.length<=1800){onChange(next);restoreSelection(position+prefix.length,position+prefix.length+selected.length)}}
 function heading(){const position=Math.min(selection.current.start,value.length),lineStart=value.lastIndexOf('\n',Math.max(0,position-1))+1,alreadyHeading=value.slice(lineStart,lineStart+2)==='# ',next=alreadyHeading?value.slice(0,lineStart)+value.slice(lineStart+2):value.slice(0,lineStart)+'# '+value.slice(lineStart),offset=alreadyHeading?-2:2;if(next.length<=1800){onChange(next);restoreSelection(Math.max(lineStart,position+offset),Math.max(lineStart,position+offset))}}
 function emoji(symbol:string){insert(symbol);setEmojiOpen(false)}
 const preview=value.replace(/\{([a-z_]+)\}/g,(match,key)=>sample[key]||match);
 return <div className="live-template"><div className="live-template-heading"><label htmlFor={label.replace(/\s/g,'-').toLowerCase()}>{label}</label><span>{value.length}/1800</span></div><div className="variable-picker"><Sparkles size={15}/><select aria-label="Add an automatic detail" value={choice} onFocus={rememberSelection} onChange={e=>{setChoice(e.target.value);insert(e.target.value)}}><option value="">Add a detail…</option>{variables.map(variable=><option key={variable.value} value={variable.value}>{variable.label}</option>)}</select></div><div className="format-toolbar" aria-label="Live message formatting"><button type="button" onMouseDown={keepSelection} onClick={heading} title="Heading" aria-label="Toggle heading">H</button><button type="button" onMouseDown={keepSelection} onClick={()=>format('**','**','bold text')} title="Bold" aria-label="Bold selected text"><strong>B</strong></button><button type="button" onMouseDown={keepSelection} onClick={()=>format('*','*','italic text')} title="Italic" aria-label="Italicise selected text"><em>I</em></button><button type="button" onMouseDown={keepSelection} onClick={()=>format('__','__','underlined text')} title="Underline" aria-label="Underline selected text"><u>U</u></button><div className="emoji-tool"><button type="button" onMouseDown={keepSelection} onClick={()=>setEmojiOpen(!emojiOpen)} aria-expanded={emojiOpen} title="Add emoji" aria-label="Add emoji">😊</button>{emojiOpen&&<div className="emoji-picker">{['💜','✨','🎉','👋','✅','📣','🎮','🎥','🌸','🦖','❤️','🔥','😂','👀','⭐','🎁','📌','📅','🔔','🫶'].map(symbol=><button type="button" key={symbol} onMouseDown={keepSelection} onClick={()=>emoji(symbol)}>{symbol}</button>)}</div>}</div></div><textarea id={label.replace(/\s/g,'-').toLowerCase()} ref={area} required maxLength={1800} rows={7} value={value} onFocus={rememberSelection} onBlur={rememberSelection} onSelect={rememberSelection} onKeyUp={rememberSelection} onClick={rememberSelection} onChange={e=>{onChange(e.target.value);selection.current={start:e.target.selectionStart,end:e.target.selectionEnd}}}/><small>{help} Select text first, then choose B, I or U. B.E.I.P.I. fills in any added details when the stream begins.</small><div className="live-template-preview"><div><Eye size={14}/><strong>Example</strong></div><TemplatePreview text={preview}/></div></div>
}
