import {useEffect,useState} from 'react';
import {withAbortTimeout} from './abort-timeout';
import {typeServiceBase} from './precip-types';
import type {WindFrame} from './wind-math';
export {sampleWind,windPair} from './wind-math';
export type {WindFrame} from './wind-math';
export function useWeatherClock(){const [now,setNow]=useState(()=>Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);return now;}
export function useWindFields(ready:boolean){
 const [frames,setFrames]=useState<WindFrame[]>([]),[status,setStatus]=useState('Loading NOAA wind…');
 useEffect(()=>{
  if(!ready)return;const controller=new AbortController();let busy=false;const cache=new Map<string,WindFrame>();
  async function load(){
   if(busy||document.hidden)return;busy=true;
   try{
    const data=await withAbortTimeout(controller.signal,10000,async signal=>{const r=await fetch(typeServiceBase()+'/wind/frames',{signal});if(!r.ok)throw Error();return await r.json() as {frames:Omit<WindFrame,'values'>[]};});
    const chosen=(data.frames??[]).filter(f=>Number.isFinite(f.time)&&Number.isFinite(f.run)&&f.time>=Date.now()-5*3600000&&f.time<=Date.now()+26*3600000&&f.run>=Date.now()-18*3600000&&f.nx===720&&f.ny===361&&f.dx===.5&&f.dy===-.5&&f.lon0===-180&&f.lat0===90&&/^\/wind\/\d{13}_\d{13}\.bin$/.test(f.url));
    const loaded=await Promise.all(chosen.map(async f=>{
     if(cache.has(f.url))return cache.get(f.url)!;
     try{return await withAbortTimeout(controller.signal,20000,async signal=>{const response=await fetch(typeServiceBase()+f.url,{signal});if(!response.ok)return null;const bytes=await response.arrayBuffer();if(bytes.byteLength!==f.nx*f.ny*4)return null;const field={...f,values:new Int16Array(bytes)};cache.set(f.url,field);return field;});}catch{return null;}
    }));
    if(controller.signal.aborted)return;
    const valid=loaded.filter((f):f is WindFrame=>f!==null).sort((a,b)=>a.time-b.time);if(!valid.length)throw Error();
    for(const key of cache.keys())if(!chosen.some(f=>f.url===key))cache.delete(key);
    setFrames(valid);setStatus('NOAA GFS · 10 m · 0.5° grid');
   }catch{if(!controller.signal.aborted)setStatus('Wind update unavailable');}finally{busy=false;}
  }
  void load();const timer=setInterval(()=>void load(),120000);const visible=()=>{if(!document.hidden)void load();};document.addEventListener('visibilitychange',visible);
  return()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[ready]);
 return {frames,status};
}
