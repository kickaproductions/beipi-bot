'use client';
import {useEffect} from 'react';

const wrappers:Record<string,{prefix:string;suffix:string;placeholder:string}>={
 b:{prefix:'**',suffix:'**',placeholder:'bold text'},
 i:{prefix:'*',suffix:'*',placeholder:'italic text'},
 u:{prefix:'__',suffix:'__',placeholder:'underlined text'}
};

export default function TextShortcuts(){
 useEffect(()=>{
  function handle(event:KeyboardEvent){
   if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
   if(event.key.toLowerCase()==='z')return;
   const editor=event.target;if(!(editor instanceof HTMLTextAreaElement)||editor.disabled||editor.readOnly)return;
   const wrapper=wrappers[event.key.toLowerCase()];if(!wrapper)return;
   event.preventDefault();
   const start=editor.selectionStart,end=editor.selectionEnd,selected=editor.value.slice(start,end)||wrapper.placeholder;
   const replacement=wrapper.prefix+selected+wrapper.suffix;
   editor.focus();editor.setSelectionRange(start,end);
   if(!document.execCommand('insertText',false,replacement)){
    editor.setRangeText(replacement,start,end,'end');
    editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:replacement}));
   }
   requestAnimationFrame(()=>editor.setSelectionRange(start+wrapper.prefix.length,start+wrapper.prefix.length+selected.length));
  }
  document.addEventListener('keydown',handle);
  return()=>document.removeEventListener('keydown',handle);
 },[]);
 return null;
}
