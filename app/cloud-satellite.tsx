"use client";
import {useEffect,useRef,useState} from 'react';
import type {Map as LibreMap,ImageSource} from 'maplibre-gl';
import {withAbortTimeout} from './abort-timeout';
import {cloudHistory,cloudPosition} from './cloud-timeline';
import {blendRadar} from './radar-player';
import './cloud-satellite.css';
const service='https://nowcoast.noaa.gov/geoserver/observations/satellite/ows';
const id='ezclick-observed-clouds';
const coordinates:[[number,number],[number,number],[number,number],[number,number]]=[[-130,52],[-60,52],[-60,22],[-130,22]];
const mercator=(lat:number)=>6378137*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
export default function CloudSatellite({map,ready,enabled,onClose}:{map:LibreMap|null;ready:boolean;enabled:boolean;onClose:()=>void}){
 const [opacity,setOpacity]=useState(.65),[stamp,setStamp]=useState<number|null>(null),[status,setStatus]=useState('Loading satellite…');
 const [playing,setPlaying]=useState(()=>!matchMedia('(prefers-reduced-motion: reduce)').matches),[count,setCount]=useState(0);
 const opacityRef=useRef(opacity),playingRef=useRef(playing),control=useRef<((play:boolean)=>void)|null>(null);
 useEffect(()=>{opacityRef.current=opacity;if(map?.getLayer(id))map.setPaintProperty(id,'raster-opacity',opacity);},[map,opacity]);
 useEffect(()=>{playingRef.current=playing;control.current?.(playing);},[playing]);
 useEffect(()=>{
  if(!map||!ready||!enabled)return;
  const abort=new AbortController();let disposed=false,busy=false,raf=0,last=0,elapsed=0,shown=-1;
  let frames:HTMLCanvasElement[]=[],times:number[]=[];
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=640;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const release=(items:HTMLCanvasElement[])=>items.forEach(c=>{c.width=1;c.height=1;});
  const source=()=>map.getSource(id) as ImageSource|undefined;
  function draw(){
   if(!frames.length)return;
   const p=cloudPosition(elapsed,frames.length);blendRadar(ctx!,frames[p.a],frames[p.b],p.mix);
   // Explicit image updates invalidate MapLibre's draped terrain tile cache.
   source()?.updateImage({image:canvas});
   if(shown!==p.a){shown=p.a;setStamp(times[p.a]);}map!.triggerRepaint();
  }
  function tick(now:number){
   if(disposed||document.hidden||!playingRef.current||frames.length<2){raf=0;return;}
   if(!last)last=now;
   if(now-last>=1000/24){elapsed+=Math.min(now-last,100);last=now;draw();}
   raf=requestAnimationFrame(tick);
  }
  function play(value:boolean){
   cancelAnimationFrame(raf);raf=0;last=0;
   if(value&&!document.hidden&&frames.length>1)raf=requestAnimationFrame(tick);
  }
  control.current=play;
  async function update(){
   if(disposed||busy||document.hidden)return;busy=true;setStatus('Updating satellite…');const next:HTMLCanvasElement[]=[];
   try{
    const xmlText=await withAbortTimeout(abort.signal,20000,async signal=>{const response=await fetch(service+'?service=WMS&request=GetCapabilities&version=1.3.0',{signal});if(!response.ok)throw Error('Satellite unavailable');return response.text();});
    const xml=new DOMParser().parseFromString(xmlText,'application/xml');
    const layer=[...xml.getElementsByTagName('Layer')].find(l=>l.querySelector(':scope > Name')?.textContent==='goes_longwave_imagery');
    const dimension=layer?.querySelector('Dimension[name="time"]');
    const selected=cloudHistory(dimension?.textContent||dimension?.getAttribute('default')||'');
    if(times.join()===selected.join()){setStatus('Past hour · observed, not forecast');return;}
    const bbox=[-130*Math.PI*6378137/180,mercator(22),-60*Math.PI*6378137/180,mercator(52)].join(',');
    for(const date of selected){
     const query=new URLSearchParams({service:'WMS',request:'GetMap',version:'1.1.1',layers:'goes_longwave_imagery',styles:'',format:'image/png',transparent:'true',width:'1024',height:'640',srs:'EPSG:3857',bbox,time:new Date(date).toISOString()});
     const blob=await withAbortTimeout(abort.signal,20000,async signal=>{const r=await fetch(service+'?'+query,{signal});if(!r.ok||!r.headers.get('content-type')?.includes('image/'))throw Error('Satellite image unavailable');return r.blob();});
     const bitmap=await createImageBitmap(blob);if(disposed){bitmap.close();return;}
     const frame=document.createElement('canvas');frame.width=1024;frame.height=640;next.push(frame);
     const c=frame.getContext('2d');if(!c){bitmap.close();throw Error('Image unavailable');}c.drawImage(bitmap,0,0,1024,640);bitmap.close();
     const pixels=c.getImageData(0,0,1024,640);
     // IR display enhancement, not a quantitative cloud/fog mask.
     for(let i=0;i<pixels.data.length;i+=4){const brightness=pixels.data[i];pixels.data[i+3]=Math.round(pixels.data[i+3]*Math.pow(Math.max(0,(brightness-65)/190),1.25));pixels.data[i]=228;pixels.data[i+1]=239;pixels.data[i+2]=248;}
     c.putImageData(pixels,0,0);setStatus(`Loading observations ${next.length}/${selected.length}…`);
    }
    if(disposed)return;
    play(false);release(frames);frames=next.splice(0);times=selected;shown=-1;elapsed=playingRef.current?0:(times.length-1)*1800;draw();
    if(!source()){
     map!.addSource(id,{type:'image',coordinates});
     source()?.updateImage({image:canvas});
     const before=map!.getStyle().layers?.find(l=>l.type==='symbol'||l.id.startsWith('ezclick-trip-'))?.id;
     map!.addLayer({id,type:'raster',source:id,paint:{'raster-opacity':opacityRef.current,'raster-fade-duration':0}},before);
    }
    setCount(times.length);setStatus(times.length>1?'Past hour · observed, not forecast':'One observation available');play(playingRef.current);
   }catch(error){if(!disposed){setStatus(error instanceof Error&&error.name!=='AbortError'?error.message:'Satellite unavailable');if(!times.length||Date.now()-times.at(-1)!>90*60000){play(false);release(frames);frames=[];times=[];setCount(0);setStamp(null);if(map!.getLayer(id))map!.removeLayer(id);if(source())map!.removeSource(id);}}}
   finally{release(next);busy=false;}
  }
  void update();const timer=setInterval(()=>void update(),5*60000);
  const visible=()=>{play(playingRef.current);if(!document.hidden)void update();};document.addEventListener('visibilitychange',visible);
  return()=>{disposed=true;abort.abort();play(false);control.current=null;clearInterval(timer);document.removeEventListener('visibilitychange',visible);if(map.getLayer(id))map.removeLayer(id);if(source())map.removeSource(id);release(frames);canvas.width=1;canvas.height=1;};
 },[map,ready,enabled]);
 return <aside className={`cloud-observation ${enabled?'is-open':''}`} inert={!enabled} aria-hidden={!enabled} aria-label="Cloud observations"><div><strong>Clouds · Satellite</strong><button type="button" onClick={onClose} aria-label="Turn clouds off">×</button></div><small>{stamp?new Date(stamp).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}):'Waiting for observations'}</small><small role="status">{status}</small><button className="cloud-play" type="button" disabled={count<2} aria-label={playing?'Pause cloud animation':'Play cloud animation'} onClick={()=>setPlaying(v=>!v)}>{playing?'Ⅱ Pause':'▶ Play'} · {count} frames</button><label>Opacity <input aria-label="Cloud opacity" type="range" min="0" max="1" step="0.05" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></label><small>NOAA GOES · infrared · US coverage<br/>Low clouds and fog may be missed.</small></aside>;
}
