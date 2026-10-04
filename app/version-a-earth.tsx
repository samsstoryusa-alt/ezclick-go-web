"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {JourneyCanvas} from './journey-canvas';
import {shots} from './journey';
const flight=shots.find(s=>s.clip===9&&!s.hold)!;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export function EarthScroll({children}:{children:ReactNode}){
 const root=useRef<HTMLDivElement>(null),time=useRef(flight.start);
 const [enabled,setEnabled]=useState(false);
 useEffect(()=>{
  const el=root.current!;const reduced=matchMedia('(prefers-reduced-motion: reduce)');let raf=0,progress=0,target=0,near=false;
  const paint=()=>{progress+=(target-progress)*.12;if(Math.abs(target-progress)<.0001)progress=target;
   time.current=flight.start+clamp(progress/.78)*(flight.end-flight.start-.001);
   for(const [name,start,length] of [['brand',.25,.18],['heading',.36,.18],['platforms',.7,.18]] as const){const v=clamp((progress-start)/length);el.style.setProperty('--'+name,String(v));el.style.setProperty('--'+name+'-y',`${(1-v)*30}px`);}
   el.style.setProperty('--earth-shade',String(.65*(1-clamp(progress/.2))));
   raf=Math.abs(target-progress)>.0001?requestAnimationFrame(paint):0;
  };
  const update=()=>{const r=el.getBoundingClientRect();target=reduced.matches?1:clamp(-r.top/Math.max(1,el.offsetHeight-innerHeight));if(!raf)raf=requestAnimationFrame(paint);};
  const observer=new IntersectionObserver(entries=>{near=entries[0].isIntersecting;setEnabled(near&&!reduced.matches);if(near)update();},{rootMargin:'400px'});observer.observe(el);
  const preference=()=>{setEnabled(near&&!reduced.matches);update();};
  addEventListener('scroll',update,{passive:true});addEventListener('resize',update);reduced.addEventListener('change',preference);update();
  return()=>{observer.disconnect();cancelAnimationFrame(raf);removeEventListener('scroll',update);removeEventListener('resize',update);reduced.removeEventListener('change',preference);};
 },[]);
 return <div ref={root} className="va-earth-scroll"><div className="va-earth-pin"><img className="va-earth-poster" src="/media/journey/09/0128.webp" alt="" loading="lazy"/><JourneyCanvas time={time} enabled={enabled}/><div className="va-earth-shade"/>{children}</div></div>;
}
