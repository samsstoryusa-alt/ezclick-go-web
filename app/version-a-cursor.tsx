"use client";
import {useEffect,useRef,useState} from 'react';
type Mode='halo'|'ring'|'card';
export function CursorPreview(){
 const [mode,setMode]=useState<Mode>('halo');const [open,setOpen]=useState(false);
 const follower=useRef<HTMLDivElement>(null),dot=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const root=document.querySelector<HTMLElement>('.version-a');if(!root)return;
  const media=matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  let frame=0,x=0,y=0,tx=0,ty=0,visible=false;
  const hide=()=>{visible=false;cancelAnimationFrame(frame);frame=0;root.removeAttribute('data-cursor-visible');};
  const sync=()=>{hide();root.dataset.cursorMode=media.matches?mode:'card';};sync();
  const paint=()=>{x+=(tx-x)*.18;y+=(ty-y)*.18;if(follower.current)follower.current.style.transform=`translate3d(${x}px,${y}px,0)`;if(visible&&(Math.abs(tx-x)>.1||Math.abs(ty-y)>.1))frame=requestAnimationFrame(paint);else frame=0;};
  const move=(event:PointerEvent)=>{
   if(!media.matches||event.pointerType!=='mouse'||mode==='card'){hide();return;}
   const target=event.target instanceof Element?event.target:null;
   if(!target?.closest('.version-a')||target.closest('input,textarea,select,[contenteditable="true"],.va-cursor-picker')){hide();return;}
   tx=event.clientX;ty=event.clientY;
   if(!visible){x=tx;y=ty;}visible=true;root.dataset.cursorVisible='true';
   root.dataset.cursorActive=target.closest('a,button,[role="tab"],.rich-panel')?'true':'false';
   if(dot.current)dot.current.style.transform=`translate3d(${tx}px,${ty}px,0)`;
   if(!frame)frame=requestAnimationFrame(paint);
  };
  window.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerleave',hide);window.addEventListener('blur',hide);window.addEventListener('scroll',hide,{passive:true});document.addEventListener('visibilitychange',hide);media.addEventListener('change',sync);
  return()=>{hide();delete root.dataset.cursorMode;delete root.dataset.cursorActive;window.removeEventListener('pointermove',move);document.removeEventListener('pointerleave',hide);window.removeEventListener('blur',hide);window.removeEventListener('scroll',hide);document.removeEventListener('visibilitychange',hide);media.removeEventListener('change',sync);};
 },[mode]);
 return <><div ref={follower} className="va-cursor-follower" aria-hidden="true"><span/></div><div ref={dot} className="va-cursor-dot" aria-hidden="true"><span/></div><aside className="va-cursor-picker" aria-label="Cursor preview"><button className="va-cursor-toggle" aria-expanded={open} aria-controls="va-cursor-options" onClick={()=>setOpen(!open)}>Cursor style <span aria-hidden="true">{open?'−':'+'}</span></button>{open&&<div id="va-cursor-options"><small>LOCAL DESIGN PREVIEW</small>{([['halo','Arrow + glow'],['ring','Dot + ring'],['card','Card light only']] as const).map(([value,label])=><button key={value} aria-pressed={mode===value} onClick={()=>setMode(value)}>{label}<span aria-hidden="true">{mode===value?'✓':''}</span></button>)}</div>}</aside></>;
}
