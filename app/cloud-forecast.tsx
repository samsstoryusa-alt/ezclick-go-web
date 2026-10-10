"use client";
import {useEffect,useRef,useState} from 'react';
import type {ImageSource,Map as LibreMap} from 'maplibre-gl';
import {withAbortTimeout} from './abort-timeout';
import {blendRadar} from './radar-player';
import {cloudForecastPosition,type CloudFrame} from './cloud-forecast-time';
import './cloud-satellite.css';
const id='ezclick-forecast-clouds';
const coordinates:[[number,number],[number,number],[number,number],[number,number]]=[[-130,52],[-60,52],[-60,22],[-130,22]];
export default function CloudForecast({map,ready,enabled,time,onClose}:{map:LibreMap|null;ready:boolean;enabled:boolean;time:number|null;onClose:()=>void}){
 const [opacity,setOpacity]=useState(.65),[status,setStatus]=useState('Loading cloud forecast…'),[run,setRun]=useState<number|null>(null);
 const latest=useRef(time),alpha=useRef(opacity),paint=useRef<(()=>void)|null>(null);
 useEffect(()=>{latest.current=time;paint.current?.();},[time]);
 useEffect(()=>{alpha.current=opacity;if(map?.getLayer(id))map.setPaintProperty(id,'raster-opacity',opacity);},[map,opacity]);
 useEffect(()=>{
  if(!map||!ready||!enabled)return;
  const controller=new AbortController();let stopped=false,busy=false;
  let frames:CloudFrame[]=[],images:ImageBitmap[]=[];
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=600;const ctx=canvas.getContext('2d');if(!ctx)return;
  function draw(){
   if(stopped||!frames.length)return;
   const position=cloudForecastPosition(frames,latest.current,Date.now());
   if(!position){if(map!.getLayer(id))map!.setLayoutProperty(id,'visibility','none');setStatus(latest.current===null?'Enable the precipitation timeline':'Cloud forecast unavailable for this time');return;}
   blendRadar(ctx!,images[position.a],images[position.b],position.mix);
   if(!map!.getSource(id)){
    map!.addSource(id,{type:'image',coordinates});
    const before=map!.getStyle().layers?.find(l=>l.type==='symbol'||l.id.startsWith('ezclick-trip-'))?.id;
    map!.addLayer({id,type:'raster',source:id,paint:{'raster-opacity':alpha.current,'raster-fade-duration':0}},before);
   }
   (map!.getSource(id) as ImageSource).updateImage({image:canvas});map!.setLayoutProperty(id,'visibility','visible');map!.triggerRepaint();
   setStatus('Forecast · linked to the bottom timeline');
  }
  paint.current=draw;
  async function load(){
   if(stopped||busy||document.hidden)return;busy=true;const pending:ImageBitmap[]=[];
   try{
    const data=await withAbortTimeout(controller.signal,15000,async signal=>{const r=await fetch('/cloud-preview/catalog.json',{signal,cache:'no-store'});if(!r.ok)throw Error('Cloud forecast unavailable');return r.json();}) as {frames:CloudFrame[]};
    const next=data.frames;
    if(!Array.isArray(next)||next.length<2||next.length>40||next.some((f,i)=>!/^\/cloud-preview\/\d{13}_\d{13}\.png$/.test(f.url)||!Number.isFinite(f.time)||!Number.isFinite(f.run)||f.run!==next[0].run||(i>0&&f.time-next[i-1].time!==3600000)))throw Error('Invalid cloud forecast');
    if(Date.now()-next[0].run>18*3600000||next[0].run>Date.now())throw Error('Cloud forecast needs a fresh model run');
    if(frames.length&&frames[0].url===next[0].url&&frames.at(-1)!.url===next.at(-1)!.url){draw();return;}
    for(let i=0;i<next.length;i+=3){
     await Promise.allSettled(next.slice(i,i+3).map(async f=>{
      const blob=await withAbortTimeout(controller.signal,15000,async signal=>{const r=await fetch(f.url,{signal});if(!r.ok)throw Error('Cloud image unavailable');return r.blob();});
      const image=await createImageBitmap(blob);if(stopped){image.close();return;}
      if(image.width!==1024||image.height!==600){image.close();throw Error('Invalid cloud image');}
      pending[next.indexOf(f)]=image;
     })).then(results=>{if(results.some(r=>r.status==='rejected'))throw Error('Cloud frames could not load');});
     if(stopped)return;setStatus(`Loading cloud forecast ${Math.min(i+3,next.length)}/${next.length}…`);
    }
    images.forEach(i=>i.close());images=pending.splice(0);frames=next;setRun(next[0].run);draw();
   }catch(error){if(!stopped){if(map!.getLayer(id))map!.setLayoutProperty(id,'visibility','none');setStatus(error instanceof Error?error.message:'Cloud forecast unavailable');}}
   finally{pending.forEach(i=>i?.close());busy=false;}
  }
  void load();const timer=setInterval(()=>void load(),5*60000);
  return()=>{stopped=true;controller.abort();clearInterval(timer);paint.current=null;images.forEach(i=>i.close());if(map.getLayer(id))map.removeLayer(id);if(map.getSource(id))map.removeSource(id);canvas.width=1;canvas.height=1;};
 },[map,ready,enabled]);
 return <aside className={`cloud-observation ${enabled?'is-open':''}`} inert={!enabled} aria-hidden={!enabled} aria-label="Cloud forecast"><div><strong>Clouds · Forecast</strong><button type="button" onClick={onClose} aria-label="Turn clouds off">×</button></div><small>{time?new Date(time).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}):'Waiting for the weather timeline'}</small><small role="status">{status}</small><label>Opacity <input aria-label="Cloud opacity" type="range" min="0" max="1" step=".05" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></label><small>NOAA GFS · total cloud cover{run?<><br/>Model: {new Date(run).toLocaleString()}</>:null}<br/>Forecast, not a satellite image or fog map.</small></aside>;
}
