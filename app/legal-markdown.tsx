import type {ReactNode} from 'react';
function inline(input:string){
 const escaped=input.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 return escaped.replace(/\\\[/g,'[').replace(/\\\]/g,']').replace(/\\\./g,'.').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
}
export default function LegalMarkdown({source}:{source:string}){
 const lines=source.replace(/\r/g,'').split('\n');
 const blocks:ReactNode[]=[];let items:string[]=[];let para:string[]=[];
 const flushItems=()=>{if(items.length){blocks.push(<ul key={'l'+blocks.length}>{items.map((x,i)=><li key={i} dangerouslySetInnerHTML={{__html:inline(x)}} />)}</ul>);items=[];}};
 const flushPara=()=>{if(para.length){blocks.push(<p key={'p'+blocks.length} dangerouslySetInnerHTML={{__html:inline(para.join(' ').replace(/  +/g,' '))}}/>);para=[];}};
 for(const line of lines){
  const t=line.trim();
  if(!t){flushPara();flushItems();continue;}
  if(t.startsWith('# ')){flushPara();flushItems();continue;}
  if(t.startsWith('### ')){flushPara();flushItems();blocks.push(<h3 key={'h'+blocks.length} dangerouslySetInnerHTML={{__html:inline(t.slice(4))}}/>);continue;}
  if(t.startsWith('## ')){flushPara();flushItems();blocks.push(<h2 key={'h'+blocks.length} dangerouslySetInnerHTML={{__html:inline(t.slice(3))}}/>);continue;}
  if(t.startsWith('* ')){flushPara();items.push(t.slice(2));continue;}
  flushItems();para.push(t);
 }
 flushPara();flushItems();
 return <>{blocks}</>;
}
