"use client";
import {useId,useRef,useState,type CSSProperties,type PointerEvent} from 'react';
import {Mic,ChevronRight} from 'lucide-react';
import './voice-route-drawer.css';
export default function VoiceRouteDrawer({suspended=false}:{suspended?:boolean}){
 const [open,setOpen]=useState(false);
 const [offset,setOffset]=useState<number|null>(null);
 const drawer=useRef<HTMLElement>(null);
 const id=useId();
 const handle=useRef<HTMLButtonElement>(null);
 const drag=useRef<{id:number;x:number;y:number;offset:number;current:number;moved:boolean}|null>(null);
 const swiped=useRef(false);
 function start(event:PointerEvent<HTMLButtonElement>){
  if(!event.isPrimary||event.button!==0)return;
  event.stopPropagation();swiped.current=false;
  const current=drawer.current?new DOMMatrixReadOnly(getComputedStyle(drawer.current).transform).m41:(open?0:64);
  const initial=Math.max(0,Math.min(64,current));
  drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,offset:initial,current:initial,moved:false};
  setOffset(initial);
  event.currentTarget.setPointerCapture(event.pointerId);
 }
 function move(event:PointerEvent<HTMLButtonElement>){
  const origin=drag.current;if(!origin||origin.id!==event.pointerId)return;
  event.stopPropagation();
  const dx=event.clientX-origin.x,dy=event.clientY-origin.y;
  if(Math.hypot(dx,dy)>4)origin.moved=true;
  origin.current=Math.max(0,Math.min(64,origin.offset+dx));
  setOffset(origin.current);
 }
 function cancel(){drag.current=null;setOffset(null);swiped.current=true;}
 function end(event:PointerEvent<HTMLButtonElement>){
  const origin=drag.current;if(!origin||origin.id!==event.pointerId)return;
  move(event);drag.current=null;
  if(origin.moved){setOpen(origin.current<32);swiped.current=true;}
  setOffset(null);
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 }
 return <aside ref={drawer} style={offset===null?undefined:{"--voice-offset":`${offset}px`,"--voice-progress":1-offset/64} as CSSProperties} className={`voice-route-drawer ${open?'is-open':''} ${suspended?'is-suspended':''} ${offset!==null?'is-dragging':''}`} inert={suspended} aria-hidden={suspended} aria-label="Voice route preview" onKeyDown={event=>{if(event.key==='Escape'){cancel();setOpen(false);handle.current?.focus();}}}>
  <button ref={handle} className="voice-drawer-handle" type="button" aria-label={open?'Close voice controls':'Open voice controls'} aria-expanded={open} aria-controls={id} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} onLostPointerCapture={()=>{if(drag.current)cancel();}} onClick={event=>{const suppress=swiped.current&&event.detail>0;swiped.current=false;if(!suppress)setOpen(value=>!value);}}><span className="voice-handle-surface"><Mic className="voice-handle-mic" size={19}/><ChevronRight className="voice-handle-chevron" size={19}/></span></button>
  <div id={id} className="voice-drawer-content" inert={!open} aria-hidden={!open}>
   <button type="button" className="voice-drawer-mic" disabled aria-label="Voice input is not connected yet" aria-describedby={`${id}-notice`}><Mic size={24}/></button>
  </div>
  <div id={`${id}-notice`} className="voice-drawer-notice" aria-hidden={!open}>Preview · microphone not connected</div>
 </aside>;
}
