"use client";
import {useId,useRef,useState,type PointerEvent} from 'react';
import {Mic,ChevronRight} from 'lucide-react';
import './voice-route-drawer.css';
export default function VoiceRouteDrawer({suspended=false}:{suspended?:boolean}){
 const [open,setOpen]=useState(false);
 const id=useId();
 const handle=useRef<HTMLButtonElement>(null);
 const drag=useRef<{id:number;x:number;y:number}|null>(null);
 const swiped=useRef(false);
 function start(event:PointerEvent<HTMLButtonElement>){
  if(!event.isPrimary||event.button!==0)return;
  event.stopPropagation();swiped.current=false;
  drag.current={id:event.pointerId,x:event.clientX,y:event.clientY};
  event.currentTarget.setPointerCapture(event.pointerId);
 }
 function end(event:PointerEvent<HTMLButtonElement>){
  const origin=drag.current;if(!origin||origin.id!==event.pointerId)return;
  drag.current=null;
  const dx=event.clientX-origin.x,dy=event.clientY-origin.y;
  if(Math.abs(dx)>24&&Math.abs(dx)>Math.abs(dy)){setOpen(dx<0);swiped.current=true;}
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 }
 return <aside className={`voice-route-drawer ${open?'is-open':''} ${suspended?'is-suspended':''}`} inert={suspended} aria-hidden={suspended} aria-label="Voice route preview" onKeyDown={event=>{if(event.key==='Escape'){setOpen(false);handle.current?.focus();}}}>
  <button ref={handle} className="voice-drawer-handle" type="button" aria-label={open?'Close voice controls':'Open voice controls'} aria-expanded={open} aria-controls={id} onPointerDown={start} onPointerUp={end} onPointerCancel={()=>{drag.current=null;swiped.current=false;}} onLostPointerCapture={()=>{drag.current=null;}} onClick={event=>{const suppress=swiped.current&&event.detail>0;swiped.current=false;if(!suppress)setOpen(value=>!value);}}><span className="voice-handle-surface"><Mic className="voice-handle-mic" size={19}/><ChevronRight className="voice-handle-chevron" size={19}/></span></button>
  <div id={id} className="voice-drawer-content" inert={!open} aria-hidden={!open}>
   <button type="button" className="voice-drawer-mic" disabled aria-label="Voice input is not connected yet" aria-describedby={`${id}-notice`}><Mic size={24}/></button>
  </div>
  <div id={`${id}-notice`} className="voice-drawer-notice" aria-hidden={!open}>Preview · microphone not connected</div>
 </aside>;
}
