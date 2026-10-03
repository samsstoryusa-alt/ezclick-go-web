"use client";
import {useEffect, useRef, useState} from 'react';
import type {Map as LibreMap} from 'maplibre-gl';
import {createRadarPlayer} from './radar-player';
import {styleRain} from './weather-palette';
import {typeCatalog,typeMask,nearestTypeFrame} from './precip-types';
const SERVICE='https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity_time/ImageServer';
const MAX_FRAMES=25;
type RadarFrame={objectid:number;idp_validtime:number};

export default function RadarControls({map,ready,onTimeChange}:{map:LibreMap|null;ready:boolean;onTimeChange:(time:number|null)=>void}) {
  const [enabled,setEnabled]=useState(true);
  const [frames,setFrames]=useState<number[]>([]);
  const [typeTimes,setTypeTimes]=useState<(number|null)[]>([]);
  const [index,setIndex]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [opacity,setOpacity]=useState(0.65);
  const [status,setStatus]=useState('Loading radar history…');
  const [failed,setFailed]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const [clock,setClock]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),30000);return()=>clearInterval(timer);},[]);
  const player=useRef<ReturnType<typeof createRadarPlayer>|null>(null);
  const timeline=useRef<HTMLInputElement|null>(null);
  useEffect(() => {
    if(!map || !ready || !enabled)return;
    const controller=new AbortController();let disposed=false;
    const cache=new Map<string,{image:HTMLCanvasElement;typeTime:number|null}>();
    let busy=false,visibleTimes:number[]=[];const retired=new Set<HTMLCanvasElement>();
    async function load() {
      if(busy||document.hidden)return;busy=true;
      const images:HTMLCanvasElement[]=[];const keep=new Set<string>();
      try {
        const typesPromise=typeCatalog(controller.signal);
        const query=new URLSearchParams({f:'json',where:"idp_subset='CONUS'",outFields:'objectid,idp_validtime',returnGeometry:'false',orderByFields:'idp_validtime ASC',resultRecordCount:'1000'});
        const response=await fetch(`${SERVICE}/query?${query}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});
        if(!response.ok)throw new Error('Radar catalog unavailable');
        const catalog=await response.json() as {error?:unknown;features?:{attributes:RadarFrame}[]};
        if(catalog.error)throw new Error('Radar catalog unavailable');
        const available=(catalog.features??[]).map(f=>f.attributes).filter(f=>Number.isFinite(f.objectid)&&Number.isFinite(f.idp_validtime));
        const chosen=available.length<=MAX_FRAMES?available:Array.from({length:MAX_FRAMES},(_,i)=>available[Math.round(i*(available.length-1)/(MAX_FRAMES-1))]);
        if(!chosen.length)throw new Error('No radar frames');
        const types=await typesPromise,matchedTimes:(number|null)[]=[];
        for(const [i,frame] of chosen.entries()) {
          const match=nearestTypeFrame(types,frame.idp_validtime),key=frame.objectid+':'+(match?.time??'none');keep.add(key);
          const saved=cache.get(key);
          if(saved&&saved.typeTime){images.push(saved.image);matchedTimes.push(saved.typeTime);continue;}
          // Select the exact continental-US raster; time + 1s excludes a latest
          // frame whose valid start and end are the same instant.
          const mosaicRule=JSON.stringify({mosaicMethod:'esriMosaicLockRaster',lockRasterIds:[frame.objectid],mosaicOperation:'MT_FIRST'});
          const params=new URLSearchParams({f:'image',bbox:'-130,22,-60,52',bboxSR:'4326',imageSR:'3857',size:'1536,900',format:'png32',adjustAspectRatio:'false',transparent:'true',mosaicRule,interpolation:'RSP_BilinearInterpolation'});
          const result=await fetch(`${SERVICE}/exportImage?${params}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});
          if(!result.ok || !result.headers.get('content-type')?.startsWith('image/'))throw new Error('Radar image unavailable');
          const bitmap=await createImageBitmap(await result.blob());
          if(disposed){bitmap.close();return;}
          const mask=await typeMask(match,controller.signal);
          if(disposed){bitmap.close();mask?.close();return;}
          try {const image=styleRain(bitmap,mask),typeTime=mask?match!.time:null;images.push(image);matchedTimes.push(typeTime);const previous=cache.get(key);if(previous)retired.add(previous.image);cache.set(key,{image,typeTime});} finally {bitmap.close();mask?.close();}
          if(!player.current)setStatus(`Loading radar ${i+1}/${chosen.length}…`);
        }
        if(disposed)return;
        let nextIndex=chosen.length-1;
        if(player.current){
          const old=player.current.position(),oldTime=visibleTimes[Math.floor(old)];
          if(old<visibleTimes.length-1.05)nextIndex=chosen.reduce((best,f,i)=>Math.abs(f.idp_validtime-oldTime)<Math.abs(chosen[best].idp_validtime-oldTime)?i:best,0);
          player.current.replace(images,nextIndex);
        }else {player.current=createRadarPlayer(map!,images,value=>{setIndex(value);if(timeline.current)timeline.current.value=String(value);},value=>{if(timeline.current)timeline.current.value=String(value);});player.current.play(images.length>1);setPlaying(images.length>1);}
        for(const [key,value] of cache)if(!keep.has(key)){value.image.width=1;value.image.height=1;cache.delete(key);}
        for(const image of retired){image.width=1;image.height=1;}retired.clear();
        visibleTimes=chosen.map(f=>f.idp_validtime);
        setTypeTimes(matchedTimes);setFrames(visibleTimes);setIndex(nextIndex);setStatus('');setFailed(false);
      }catch{if(!disposed){setFailed(true);setStatus(player.current?'Update unavailable · showing saved frames':'Radar is temporarily unavailable. Try again.');}}finally{busy=false;}
    }
    void load();const refresh=setInterval(()=>void load(),120000);
    const visible=()=>{if(!document.hidden)void load();};document.addEventListener('visibilitychange',visible);
    return()=>{disposed=true;controller.abort();clearInterval(refresh);document.removeEventListener('visibilitychange',visible);player.current?.dispose();player.current=null;for(const image of retired){image.width=1;image.height=1;}for(const {image} of cache.values()){image.width=1;image.height=1;}};
  },[map,ready,enabled,attempt]);
  useEffect(()=>{player.current?.opacity(opacity);},[opacity,frames]);
  const base=Math.min(frames.length-1,Math.floor(index));
  const time = frames.length?frames[base]+((frames[Math.min(base+1,frames.length-1)]-frames[base])*(index-Math.floor(index))):0;
  const age=frames.length?Math.max(0,Math.floor((clock-frames[frames.length-1])/60000)):0;
  useEffect(()=>{onTimeChange(enabled&&frames.length?time:null);},[enabled,frames.length,time,onTimeChange]);
  const formatTime = (value:number) => new Date(value).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  return <div className="weather-radar-controls">
    <button type="button" className="radar-toggle" disabled={!ready} aria-pressed={enabled} onClick={() => {setEnabled(v => !v);setPlaying(false);setFrames([]);setFailed(false);setStatus('Loading radar history…');}}>Precipitation: {enabled ? 'On' : 'Off'}</button>
    {enabled && <section className="radar-player" aria-label="Precipitation settings">
      {status && <p role={failed ? 'alert' : 'status'}>{status}</p>}
      {failed && <button type="button" onClick={() => {setFailed(false);setFrames([]);setPlaying(false);setStatus('Loading radar history…');setAttempt(v => v+1);}}>Retry radar</button>}
      {!!frames.length && <>
        <label className="radar-opacity">Layer strength<input aria-label="Radar layer strength" type="range" min="0.3" max="0.9" step="0.001" value={opacity} onChange={e => setOpacity(Number(e.target.value))}/></label>
        <div className="precip-type-legend" aria-label="Precipitation types"><span><i style={{background:'#4bc982'}}/>Rain</span><span><i style={{background:'#c0a5f7'}}/>Snow</span></div>
        <p className="precip-type-note">{typeTimes[Math.floor(index)]?'Rain & snow only':'Classification unavailable · precipitation hidden'}</p>
        <div className="radar-legend"><span>Weaker</span><i/><span>Stronger</span></div>
      </>}
      <small title="Only classified rain and snow are shown. Hail and unclassified echoes are hidden; mixed and freezing rain are not distinguished."><a href="https://www.nssl.noaa.gov/projects/mrms/" target="_blank" rel="noreferrer">NOAA / MRMS</a></small>
    </section>}
    {enabled && !!frames.length && <section className="radar-player radar-timeline" aria-label="Precipitation timeline">        <div className="radar-player-heading"><strong>{age>20?'Delayed radar':'Weather history · US'} · latest {age} min ago</strong><time dateTime={new Date(time).toISOString()}>{new Date(time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} local</time></div>
        <div className="radar-player-row"><button type="button" disabled={frames.length<2} aria-label={playing ? 'Pause radar animation' : 'Play radar animation'} onClick={() => {player.current?.play(!playing);setPlaying(!playing);}}>{playing ? 'Pause' : 'Play'}</button><input ref={timeline} aria-label="Radar frame" type="range" step="0.001" min={0} max={frames.length-1} defaultValue={index} onChange={e => {setPlaying(false);player.current?.seek(Number(e.target.value));}}/><button type="button" onClick={() => {setPlaying(false);player.current?.seek(frames.length-1);}}>Latest</button></div>
        <div className="radar-history-span"><span>{formatTime(frames[0])}</span><span>{Math.round((frames[frames.length-1]-frames[0])/60000)} min history</span><span>{formatTime(frames[frames.length-1])}</span></div>
</section>}
  </div>;
}
