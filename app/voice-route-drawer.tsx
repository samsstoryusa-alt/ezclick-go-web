"use client";
import {useEffect,useRef,useState} from 'react';

import VoiceRouteConfirm,{type VoiceTrip} from './voice-route-confirm';
import {Mic} from 'lucide-react';
import './voice-route-drawer.css';
export default function VoiceRouteDrawer({suspended=false,onConfirm,onVisibilityChange}:{suspended?:boolean;onVisibilityChange?:(visible:boolean)=>void;onConfirm:(trip:VoiceTrip)=>void}){

 const [panel,setPanel]=useState(false),[mounted,setMounted]=useState(false);
 const panelRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const surface=panelRef.current,stage=surface?.closest<HTMLElement>('.weather-map-stage');
  if(!surface||!stage)return;
  let frame=0;
  const measure=()=>{
   frame=0;const box=stage.getBoundingClientRect();
   const visibleRect=(selector:string)=>Array.from(stage.querySelectorAll<HTMLElement>(selector)).map(el=>el.getBoundingClientRect()).find(rect=>rect.width>0&&rect.height>0);
   const clear=visibleRect('.mobile-route-undo'),navigate=visibleRect('.mobile-route-back')??visibleRect('.mobile-route-navigate');
   const left=Math.max(12,clear?clear.right-box.left+10:12);
   const right=Math.max(12,navigate?box.right-navigate.left+10:12);
   surface.style.left=`${left}px`;surface.style.right=`${right}px`;
   surface.style.bottom=`${Math.max(12,clear?box.bottom-clear.bottom:12)}px`;
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
  const resize=new ResizeObserver(schedule);resize.observe(stage);
  const mutations=new MutationObserver(schedule);mutations.observe(stage,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',schedule);schedule();
  return()=>{resize.disconnect();mutations.disconnect();window.removeEventListener('resize',schedule);cancelAnimationFrame(frame);};
 },[]);
 useEffect(()=>{onVisibilityChange?.(panel&&!suspended);},[panel,suspended,onVisibilityChange]);
 function closePanel(){setPanel(false);panelRef.current?.querySelector('iframe')?.contentWindow?.postMessage({type:'voice-close'},location.origin);}
 useEffect(()=>{if(suspended)panelRef.current?.querySelector('iframe')?.contentWindow?.postMessage({type:'voice-close'},location.origin);},[suspended]);

 return <><div ref={panelRef} className={`voice-route-panel-wrap ${panel&&!suspended?'is-open':''}`} inert={!panel||suspended} aria-hidden={!panel||suspended}>{mounted&&<VoiceRouteConfirm active={panel&&!suspended} onConfirm={onConfirm} onClose={closePanel}/>}</div>
 <button type="button" className="voice-direct-launch" hidden={suspended||panel} aria-label="Start voice input" onClick={()=>{setMounted(true);setPanel(true);}}><Mic size={25}/></button></>;
}
