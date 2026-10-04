"use client";
import {useEffect,useRef} from 'react';

export function WeatherCenterMarker(){
 const marker=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const el=marker.current,canvas=el?.parentElement?.querySelector<HTMLElement>('.weather-map-canvas');
  if(!el||!canvas)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let pointer:number|null=null,lastX=0,lastY=0,x=0,y=0,vx=0,vy=0,tx=0,ty=0,frame=0,last=0;
  const paint=()=>{el.style.setProperty('--marker-x',`${x}px`);el.style.setProperty('--marker-y',`${y}px`);};
  const tick=(now:number)=>{
   const dt=Math.min(2,(now-last)/16.667||1);last=now;
   vx=(vx+(tx-x)*.12*dt)*Math.pow(.72,dt);vy=(vy+(ty-y)*.12*dt)*Math.pow(.72,dt);
   x+=vx*dt;y+=vy*dt;paint();
   if(Math.abs(tx-x)+Math.abs(ty-y)+Math.abs(vx)+Math.abs(vy)>.015)frame=requestAnimationFrame(tick);
   else{frame=0;x=tx;y=ty;paint();}
  };
  const start=()=>{if(!frame){last=performance.now();frame=requestAnimationFrame(tick);}};
  const down=(e:globalThis.PointerEvent)=>{if(reduced.matches||pointer!==null||e.button!==0)return;pointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;};
  const move=(e:globalThis.PointerEvent)=>{if(e.pointerId!==pointer)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;tx=Math.tanh(dx/12)*2.5;ty=Math.tanh(dy/12)*2.5;start();};
  const release=()=>{pointer=null;tx=ty=0;start();};
  const end=(e:globalThis.PointerEvent)=>{if(e.pointerId===pointer)release();};
  const preference=()=>{if(reduced.matches){pointer=null;cancelAnimationFrame(frame);frame=0;x=y=vx=vy=tx=ty=0;paint();}};
  canvas.addEventListener('pointerdown',down,{passive:true});window.addEventListener('pointermove',move,{passive:true});
  window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);window.addEventListener('blur',release);reduced.addEventListener('change',preference);
  return()=>{cancelAnimationFrame(frame);canvas.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);window.removeEventListener('blur',release);reduced.removeEventListener('change',preference);};
 },[]);
 return <div ref={marker} className="weather-center-dot" aria-hidden="true"/>;
}
