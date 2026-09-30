'use client';
import {useEffect,useRef} from 'react';
export function AmbientInteractions(){
 const ring=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const query=matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  let frame=0,magnet:HTMLElement|null=null,latest:PointerEvent|null=null;
  const resetMagnet=()=>{magnet?.style.removeProperty('translate');magnet=null;};
  const hide=()=>{if(ring.current)ring.current.dataset.visible='false';resetMagnet();};
  const paint=()=>{
   frame=0;const e=latest,el=ring.current;if(!e||!el)return;
   const target=e.target instanceof Element?e.target:null;
   if(!query.matches||e.pointerType!=='mouse'||!target||document.querySelector('dialog[open]')||target.closest('.brand-intro,input,select')){hide();return;}
   el.style.transform=`translate3d(${e.clientX}px,${e.clientY}px,0)`;
   const scroll=target.closest<HTMLElement>('.card-content');
   const label=target.closest('.expand-card')?'Explore ↗':scroll&&scroll.scrollHeight>scroll.clientHeight+8?'Scroll ↕':'';
   if(el.textContent!==label)el.textContent=label;
   el.dataset.visible=String(!!label);
   const button=target.closest<HTMLElement>('.nav-cta,.expand-card,.primary');
   if(button!==magnet){resetMagnet();magnet=button??null;}
   if(magnet){const r=magnet.getBoundingClientRect();magnet.style.translate=`${Math.max(-4,Math.min(4,(e.clientX-r.left-r.width/2)*.07))}px ${Math.max(-3,Math.min(3,(e.clientY-r.top-r.height/2)*.09))}px`;}
  };
  const move=(e:PointerEvent)=>{latest=e;if(!frame)frame=requestAnimationFrame(paint);};
  const key=()=>hide();
  document.addEventListener('pointermove',move,{passive:true});document.documentElement.addEventListener('pointerleave',hide);document.addEventListener('pointerdown',hide);window.addEventListener('blur',hide);window.addEventListener('scroll',hide,{passive:true});document.addEventListener('keydown',key);query.addEventListener('change',hide);
  return()=>{cancelAnimationFrame(frame);hide();document.removeEventListener('pointermove',move);document.documentElement.removeEventListener('pointerleave',hide);document.removeEventListener('pointerdown',hide);window.removeEventListener('blur',hide);window.removeEventListener('scroll',hide);document.removeEventListener('keydown',key);query.removeEventListener('change',hide);};
 },[]);
 return <div ref={ring} className="cursor-tip" aria-hidden="true"/>;
}
