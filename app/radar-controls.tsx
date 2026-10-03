"use client";
import {useEffect,useRef,useState} from 'react';
import type {Map as LibreMap} from 'maplibre-gl';
import {createRadarPlayer,blendRadar} from './radar-player';
import {typeServiceBase} from './precip-types';
import {forecastWindow,type ForecastFrame} from './forecast-time';

export default function RadarControls({map,ready,onTimeChange}:{map:LibreMap|null;ready:boolean;onTimeChange:(time:number|null)=>void}) {
 const [enabled,setEnabled]=useState(true),[frames,setFrames]=useState<number[]>([]);
 const [index,setIndex]=useState(0),[playing,setPlaying]=useState(false),[opacity,setOpacity]=useState(.65);
 const [status,setStatus]=useState('Loading 24-hour forecast…'),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 const [run,setRun]=useState(0),[clock,setClock]=useState(()=>Date.now());
 const player=useRef<ReturnType<typeof createRadarPlayer>|null>(null),timeline=useRef<HTMLInputElement|null>(null);
 useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),30000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  if(!map||!ready||!enabled)return;
  const controller=new AbortController();let disposed=false,busy=false,visibleTimes:number[]=[];
  let active:HTMLCanvasElement[]=[];
  const cache=new Map<string,ImageBitmap>();
  async function load(){
   if(busy||document.hidden)return;busy=true;
   const next:HTMLCanvasElement[]=[];
   try{
    const response=await fetch(typeServiceBase()+'/forecast/frames',{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
    if(!response.ok)throw Error('Forecast unavailable');
    const data=await response.json() as {frames:ForecastFrame[]};
    const now=Date.now(),window=forecastWindow(data.frames,now);
    if(!window)throw Error('A complete fresh 24-hour forecast is not available yet');
    const keep=new Set(window.source.map(f=>f.url));
    // Small bounded batches avoid flooding mobile connections.
    for(let i=0;i<window.source.length;i+=4){
     await Promise.all(window.source.slice(i,i+4).map(async f=>{
      if(cache.has(f.url))return;
      const r=await fetch(typeServiceBase()+f.url,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});
      if(!r.ok)throw Error('Forecast image unavailable');
      const bitmap=await createImageBitmap(await r.blob());
      if(disposed){bitmap.close();return;}
      if(bitmap.width!==1024||bitmap.height!==600){bitmap.close();throw Error('Invalid forecast image');}
      cache.set(f.url,bitmap);
     }));
     if(disposed)return;
     if(!player.current)setStatus('Loading forecast '+Math.min(i+4,window.source.length)+'/'+window.source.length+'…');
    }
    for(const stamp of window.times){
     const b=window.source.findIndex(f=>f.time>=stamp),a=window.source[b].time===stamp?b:b-1;
     const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=600;
     const ctx=canvas.getContext('2d');if(!ctx)throw Error('Forecast canvas unavailable');
     const mix=a===b?0:(stamp-window.source[a].time)/(window.source[b].time-window.source[a].time);
     blendRadar(ctx,cache.get(window.source[a].url)!,cache.get(window.source[b].url)!,mix);next.push(canvas);
    }
    if(disposed)return;
    let nextIndex=0;
    if(player.current){
     const old=player.current.position(),a=Math.floor(old),b=Math.min(a+1,visibleTimes.length-1);
     const selected=visibleTimes[a]+(visibleTimes[b]-visibleTimes[a])*(old-a);
     const after=window.times.findIndex(t=>t>=selected);
     nextIndex=after<=0?0:after-1+(selected-window.times[after-1])/(window.times[after]-window.times[after-1]);
     if(after<0)nextIndex=window.times.length-1;
     player.current.replace(next,nextIndex);
    }else{
     player.current=createRadarPlayer(map!,next,v=>{setIndex(v);if(timeline.current)timeline.current.value=String(v);},v=>{if(timeline.current)timeline.current.value=String(v);});
     player.current.seek(0);player.current.play(true);setPlaying(true);
    }
    for(const image of active){image.width=1;image.height=1;}
    active=next;visibleTimes=window.times;
    for(const [key,value] of cache)if(!keep.has(key)){value.close();cache.delete(key);}
    setFrames(window.times);setIndex(nextIndex);setRun(window.source[0].run);setStatus('');setFailed(false);
   }catch(error){
    for(const image of next)if(!active.includes(image)){image.width=1;image.height=1;}
    if(!disposed){setFailed(true);setStatus(player.current?'Update unavailable · showing saved forecast':error instanceof Error?error.message:'Forecast unavailable');}
   }finally{busy=false;}
  }
  void load();const timer=setInterval(()=>void load(),120000);
  const visible=()=>{if(!document.hidden)void load();};document.addEventListener('visibilitychange',visible);
  return()=>{disposed=true;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);player.current?.dispose();player.current=null;for(const image of active){image.width=1;image.height=1;}for(const bitmap of cache.values())bitmap.close();};
 },[map,ready,enabled,attempt]);
 useEffect(()=>{player.current?.opacity(opacity);},[opacity,frames]);
 const a=Math.max(0,Math.min(frames.length-1,Math.floor(index))),b=Math.min(a+1,frames.length-1);
 const time=frames.length?frames[a]+(frames[b]-frames[a])*(index-a):0;
 useEffect(()=>{onTimeChange(enabled&&frames.length?time:null);},[enabled,frames.length,time,onTimeChange]);
 const reset=()=>{setPlaying(false);setFrames([]);setFailed(false);setStatus('Loading 24-hour forecast…');};
 const stale=run>0&&clock-run>18*3600000;
 return <div className="weather-radar-controls">
  <button type="button" className="radar-toggle" disabled={!ready} aria-pressed={enabled} onClick={()=>{setEnabled(v=>!v);reset();}}>Precipitation: {enabled?'On':'Off'}</button>
  {enabled&&<section className="radar-player" aria-label="Precipitation settings">
   {status&&<p role={failed?'alert':'status'}>{status}</p>}
   {failed&&<button type="button" onClick={()=>{reset();setAttempt(v=>v+1);}}>Retry forecast</button>}
   {!!frames.length&&<>
    <label className="radar-opacity">Layer strength<input aria-label="Radar layer strength" type="range" min=".3" max=".9" step=".001" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></label>
    <div className="precip-type-legend" aria-label="Precipitation types"><span><i style={{background:'#4bc982'}}/>Rain</span><span><i style={{background:'#c0a5f7'}}/>Snow</span></div>
    <p className="precip-type-note">Forecast · US region · rain & snow</p>
    <div className="radar-legend"><span>Weaker</span><i/><span>Stronger</span></div>
   </>}
   <small><a href="https://www.ncei.noaa.gov/products/weather-climate-models/global-forecast" target="_blank" rel="noreferrer">NOAA GFS · model forecast</a></small>
  </section>}
  {enabled&&!!frames.length&&<section className="radar-player radar-timeline" aria-label="Weather forecast timeline">
   <div className="radar-player-heading"><strong>{stale?'Outdated forecast':'Weather Forecast'} · 24h</strong><time dateTime={new Date(time).toISOString()}>{new Date(time).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})} local</time></div>
   <div className="radar-player-row"><button type="button" aria-label={playing?'Pause forecast animation':'Play forecast animation'} onClick={()=>{player.current?.play(!playing);setPlaying(!playing);}}>{playing?'Pause':'Play'}</button><input ref={timeline} aria-label="Forecast time" type="range" step=".001" min={0} max={frames.length-1} defaultValue={index} onChange={e=>{setPlaying(false);player.current?.seek(Number(e.target.value));}}/><button type="button" onClick={()=>{setPlaying(false);player.current?.seek(0);}}>Now</button></div>
   <div className="radar-history-span"><span>Now</span><span>+6h</span><span>+12h</span><span>+18h</span><span>+24h</span></div>
  </section>}
 </div>;
}

