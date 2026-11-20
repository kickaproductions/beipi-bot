'use client';

import {useState, type FormEvent} from 'react';
import './profile-picture.css';

type Source='twitch'|'discord'|'upload'|'initials';
const IMAGE_TYPES=['image/png','image/jpeg','image/webp'];

async function preparePicture(file:File){
  if(!IMAGE_TYPES.includes(file.type)||file.size>5*1024*1024){
    throw new Error('Choose a PNG, JPEG or WebP image up to 5 MB.');
  }
  const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('This image could not be opened.');});
  try{
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=128;
    const context=canvas.getContext('2d');
    if(!context)throw new Error('This browser could not prepare the image.');
    const side=Math.min(bitmap.width,bitmap.height);
    context.fillStyle='#d0b8e3';
    context.fillRect(0,0,128,128);
    context.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,128,128);
    return canvas.toDataURL('image/jpeg',0.86);
  }finally{
    bitmap.close();
  }
}

export function ProfileAvatar({avatarUrl,name,className}:{avatarUrl:string|null;name:string;className:string}){
  const [failedUrl,setFailedUrl]=useState<string|null>(null);
  return <div className={className} aria-hidden="true">
    {avatarUrl&&avatarUrl!==failedUrl
      ? <img className="profile-avatar-image" src={avatarUrl} alt="" referrerPolicy="no-referrer" onError={()=>setFailedUrl(avatarUrl)}/>
      : name.slice(0,1).toUpperCase()}
  </div>;
}

export function ProfilePicturePicker({twitch,discord,onSave}:{twitch:boolean;discord:boolean;onSave:(url:string|null)=>void}){
  const [source,setSource]=useState<Source|''>('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!source)return;
    const form=event.currentTarget;
    setBusy(true);
    setError('');
    try{
      let image:string|undefined;
      if(source==='upload'){
        const file=new FormData(form).get('picture');
        if(!(file instanceof File)||!file.size)throw new Error('Choose a picture to upload.');
        image=await preparePicture(file);
      }
      const response=await fetch('/api/account/avatar',{
        method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({source,image})
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Could not save your profile picture.');
      onSave(data.avatarUrl);
    }catch(value){
      setError(value instanceof Error?value.message:'Could not save your profile picture.');
    }finally{
      setBusy(false);
    }
  }

  return <form className="setting-row profile-picture-setting" onSubmit={save}>
    <div><strong>Profile picture</strong><p>Use a connected account’s picture or upload your own.</p></div>
    <div className="profile-picture-controls">
      <div>
        <select aria-label="Profile picture source" value={source} disabled={busy} onChange={event=>{setSource(event.target.value as Source|'');setError('');}}>
          <option value="" disabled>Choose a source</option>
          <option value="initials">Use my initial</option>
          <option value="twitch" disabled={!twitch}>{twitch?'Twitch profile picture':'Twitch picture unavailable'}</option>
          <option value="discord" disabled={!discord}>{discord?'Discord profile picture':'Discord picture unavailable'}</option>
          <option value="upload">Upload a picture</option>
        </select>
        <button type="submit" className="outline" disabled={busy||!source}>{busy?'Saving…':'Save picture'}</button>
      </div>
      {source==='upload'&&<label className="profile-picture-file">
        <span>PNG, JPEG or WebP up to 5 MB</span>
        <input name="picture" type="file" accept="image/png,image/jpeg,image/webp" required disabled={busy}/>
      </label>}
      {error&&<small role="alert">{error}</small>}
    </div>
  </form>;
}
