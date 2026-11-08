'use client';

type Role={id:string;name:string;color:number};

export default function LiveRolePicker({roles,selected,onChange,disabled=false}:{roles:Role[];selected:string[];onChange:(ids:string[])=>void;disabled?:boolean}){
 const toggle=(id:string,checked:boolean)=>onChange(checked?[...new Set([...selected,id])]:selected.filter(value=>value!==id));
 return <fieldset className="live-role-picker" disabled={disabled}>
  <legend>Roles to notify <span>(optional)</span></legend>
  <p>Select as many roles as you want B.E.I.P.I. to mention.</p>
  {roles.length?<div>{roles.map(role=><label key={role.id}><input type="checkbox" checked={selected.includes(role.id)} onChange={event=>toggle(role.id,event.target.checked)}/><span className="live-role-colour" style={{backgroundColor:role.color?`#${role.color.toString(16).padStart(6,'0')}`:'#8c7c96'}}/><strong>@{role.name}</strong></label>)}</div>:<small>No mentionable roles were found for this server.</small>}
  {selected.length>0&&<small>{selected.length} {selected.length===1?'role':'roles'} selected</small>}
 </fieldset>
}
