'use client';

import {useEffect,useState} from 'react';

const hexColour=/^#[0-9A-F]{6}$/i;

export default function NoteColourPicker({accountId,value,onChange}:{accountId:string;value:string;onChange:(colour:string)=>void}){
  const key='beipi-note-colours:'+accountId;
  const [saved,setSaved]=useState<string[]>([]);
  const [feedback,setFeedback]=useState('');
  const valid=hexColour.test(value);
  const colour=value.toUpperCase();

  useEffect(()=>{
    setSaved([]);
    try{
      const stored:unknown=JSON.parse(localStorage.getItem(key)||'[]');
      if(Array.isArray(stored)){
        setSaved([...new Set(stored.filter((item):item is string=>typeof item==='string'&&hexColour.test(item)).map(item=>item.toUpperCase()))]);
      }
    }catch{
      // An unreadable palette does not affect the note editor.
    }
  },[key]);

  function updateSaved(next:string[],message:string){
    try{
      localStorage.setItem(key,JSON.stringify(next));
      setSaved(next);
      setFeedback(message);
    }catch{
      setFeedback('This browser could not update your saved colours.');
    }
  }

  return <fieldset className="note-colour-picker">
    <legend>Card colour</legend>
    <div className="hex-colour-field"><div>
      <input type="color" aria-label="Choose card colour" value={valid?colour:'#A679C4'} onChange={event=>onChange(event.target.value.toUpperCase())}/>
      <input aria-label="Card colour hex value" value={value} maxLength={7} pattern="#[0-9A-Fa-f]{6}" onChange={event=>onChange(event.target.value.toUpperCase())} placeholder="#A679C4"/>
    </div></div>
    <div className="note-colour-actions">
      <button type="button" className="outline" disabled={!valid||saved.includes(colour)} onClick={()=>updateSaved([...saved,colour],'Colour saved.')}>Save colour</button>
      {saved.includes(colour)&&<button type="button" className="text-button" onClick={()=>updateSaved(saved.filter(item=>item!==colour),'Saved colour removed.')}>Remove saved colour</button>}
    </div>
    {saved.length>0&&<div className="note-colour-swatches" role="group" aria-label="Saved colours">
      {saved.map(swatch=><button key={swatch} type="button" style={{backgroundColor:swatch}} aria-label={'Use saved colour '+swatch} aria-pressed={colour===swatch} title={swatch} onClick={()=>onChange(swatch)}/>)}
    </div>}
    {feedback&&<small role="status">{feedback}</small>}
  </fieldset>;
}
