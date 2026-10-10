"use client";
import {useWeatherLanguage} from './weather-language';
import {withAbortTimeout} from './abort-timeout';
import {qualityProfiles,useWeatherQuality} from './weather-quality';
import {WindGradient} from './weather-legend';
import type {WeatherUnits} from './weather-units';
import {createPrecipMotion} from './precip-motion';
import {useEffect,useRef,useState} from 'react';
import type {Map as LibreMap} from 'maplibre-gl';
import {createRadarPlayer,blendRadar} from './radar-player';
import {typeServiceBase} from './precip-types';
import {enhancePrecipitation} from './precip-appearance';
import {RAIN_GRADIENT} from './rain-intensity-palette';
import {forecastWindow,type ForecastFrame} from './forecast-time';

export default function RadarControls({map,ready,onTimeChange,units,cloudObservations=false}:{cloudObservations?:boolean;units:WeatherUnits;map:LibreMap|null;ready:boolean;onTimeChange:(time:number|null)=>void}) {
 const {t,locale,dir}=useWeatherLanguage();
 const quality=useWeatherQuality(),qualityFps=useRef(qualityProfiles[quality].radarFps as number);
 useEffect(()=>{qualityFps.current=qualityProfiles[quality].radarFps;},[quality]);
 const motionPreview=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('motion')==='1';
 const [motionReady,setMotionReady]=useState(false);
 const [contentVisible,setContentVisible]=useState(true);
 const [enabled,setEnabled]=useState(true),[frames,setFrames]=useState<number[]>([]);
 useEffect(()=>{const receive=(event:Event)=>{const {action,reply,translate=t}=(event as CustomEvent).detail;if(ready&&['weather_on','weather_off'].includes(action)){setEnabled(action==='weather_on');if(action==='weather_on')setContentVisible(true);reply(translate(action==='weather_on'?'Precipitation layer on.':'Precipitation layer off.'));}};window.addEventListener('voice-map-action',receive);return()=>window.removeEventListener('voice-map-action',receive);},[ready,t]);
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
   if(disposed||busy||document.hidden)return;busy=true;
   const loadingController=new AbortController(),pending=new Map<string,ImageBitmap>();
   const next:HTMLCanvasElement[]=[];
   let finished=false,motion:Awaited<ReturnType<typeof createPrecipMotion>>=null;
   // Each refresh owns its new resources until the complete forecast is accepted.
   // A failed batch must never add partial or late decodes to the shared cache.
   const discardAttempt=()=>{
    if(finished)return;finished=true;loadingController.abort();
    for(const bitmap of pending.values())bitmap.close();pending.clear();
    for(const image of next){image.width=1;image.height=1;}
    motion?.dispose();motion=null;
   };
   controller.signal.addEventListener('abort',discardAttempt,{once:true});
   try{
    const data=await withAbortTimeout(loadingController.signal,15000,async signal=>{const response=await fetch(typeServiceBase()+'/forecast/frames',{signal});if(!response.ok)throw Error('Forecast unavailable');return await response.json() as {frames:ForecastFrame[]};});
    if(finished||disposed)return;
    const now=Date.now(),window=forecastWindow(data.frames,now);
    if(!window)throw Error('A complete fresh 24-hour forecast is not available yet');
    const keep=new Set(window.source.map(f=>f.url)),sources=[...keep];
    // Small bounded batches avoid flooding mobile connections.
    for(let i=0;i<sources.length;i+=4){
     await Promise.all(sources.slice(i,i+4).map(async url=>{
      if(cache.has(url))return;
      await withAbortTimeout(loadingController.signal,20000,async signal=>{
       const r=await fetch(typeServiceBase()+url,{signal});if(!r.ok)throw Error('Forecast image unavailable');
       const bitmap=await createImageBitmap(await r.blob());
       if(finished||disposed||signal.aborted){bitmap.close();throw Error('Forecast image unavailable');}
       if(bitmap.width!==1024||bitmap.height!==600){bitmap.close();throw Error('Invalid forecast image');}
       const styled=document.createElement('canvas');styled.width=bitmap.width;styled.height=bitmap.height;
       const c=styled.getContext('2d');if(!c){bitmap.close();throw Error('Forecast canvas unavailable');}
       c.drawImage(bitmap,0,0);bitmap.close();enhancePrecipitation(styled);
       const colored=await createImageBitmap(styled);styled.width=1;styled.height=1;
       if(finished||disposed||signal.aborted){colored.close();throw Error('Forecast image unavailable');}
       pending.set(url,colored);
      });
     }));
     if(finished||disposed)return;
     if(!player.current)setStatus('Loading forecast '+Math.min(i+4,sources.length)+'/'+sources.length+'…');
    }
    for(const stamp of window.times){
     const b=window.source.findIndex(f=>f.time>=stamp),a=window.source[b].time===stamp?b:b-1;
     const canvas=document.createElement('canvas');next.push(canvas);canvas.width=1024;canvas.height=600;
     const ctx=canvas.getContext('2d');if(!ctx)throw Error('Forecast canvas unavailable');
     const mix=a===b?0:(stamp-window.source[a].time)/(window.source[b].time-window.source[a].time);
     const first=window.source[a].url,second=window.source[b].url;
     blendRadar(ctx,(pending.get(first)??cache.get(first))!,(pending.get(second)??cache.get(second))!,mix);
    }
    if(finished||disposed)return;
    if(motionPreview){
     if(!player.current)setStatus('Preparing smooth motion preview…');
     try{motion=await createPrecipMotion(next,loadingController.signal);}catch{motion=null;}
     if(finished||disposed){motion?.dispose();motion=null;return;}
     setMotionReady(!!motion);
    }
    let nextIndex=0;
    if(player.current){
     const old=player.current.position(),a=Math.floor(old),b=Math.min(a+1,visibleTimes.length-1);
     const selected=visibleTimes[a]+(visibleTimes[b]-visibleTimes[a])*(old-a);
     const after=window.times.findIndex(t=>t>=selected);
     nextIndex=after<=0?0:after-1+(selected-window.times[after-1])/(window.times[after]-window.times[after-1]);
     if(after<0)nextIndex=window.times.length-1;
     player.current.replace(next,nextIndex,motion);
    }else{
     player.current=createRadarPlayer(map!,next,v=>{setIndex(v);if(timeline.current)timeline.current.value=String(v);},v=>{if(timeline.current)timeline.current.value=String(v);},motion,()=>qualityFps.current);
     player.current.seek(0);player.current.play(true);setPlaying(true);
    }
    motion=null; // The player now owns the accepted motion renderer and canvases.
    for(const image of active){image.width=1;image.height=1;}
    active=next;visibleTimes=window.times;
    for(const [key,value] of pending)cache.set(key,value);pending.clear();finished=true;
    for(const [key,value] of cache)if(!keep.has(key)){value.close();cache.delete(key);}
    setFrames(window.times);setIndex(nextIndex);setRun(window.source[0].run);setStatus('');setFailed(false);
   }catch(error){
    discardAttempt();
    if(!disposed){setFailed(true);setStatus(player.current?'Update unavailable · showing saved forecast':error instanceof Error?error.message:'Forecast unavailable');}
   }finally{discardAttempt();controller.signal.removeEventListener('abort',discardAttempt);busy=false;}
  }
  void load();const timer=setInterval(()=>void load(),120000);
  const visible=()=>{if(!document.hidden)void load();};document.addEventListener('visibilitychange',visible);
  return()=>{disposed=true;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);player.current?.dispose();player.current=null;for(const image of active){image.width=1;image.height=1;}for(const bitmap of cache.values())bitmap.close();cache.clear();};
 },[map,ready,enabled,attempt,motionPreview]);
 useEffect(()=>{player.current?.opacity(opacity);},[opacity,frames]);
 const a=Math.max(0,Math.min(frames.length-1,Math.floor(index))),b=Math.min(a+1,frames.length-1);
 const time=frames.length?frames[a]+(frames[b]-frames[a])*(index-a):0;
 useEffect(()=>{onTimeChange(enabled&&frames.length?time:null);},[enabled,frames.length,time,onTimeChange]);
 const reset=()=>{setPlaying(false);setFrames([]);setFailed(false);setStatus('Loading 24-hour forecast…');};
 useEffect(()=>{if(enabled)return;const timer=setTimeout(()=>{setContentVisible(false);setFrames([]);setPlaying(false);setFailed(false);setStatus('Loading 24-hour forecast…');},350);return()=>clearTimeout(timer);},[enabled]);
 const loadingProgress=status.match(/^Loading forecast (\d+\/\d+…)$/);
 const statusLabel=loadingProgress?t('Loading forecast')+' '+loadingProgress[1]:t(status);
 const stale=run>0&&clock-run>18*3600000;
 return <div className={`weather-radar-controls ${enabled?'is-weather-enabled':'is-weather-disabled'}`}>
  <button type="button" dir={dir} className="radar-toggle weather-precip-toggle" disabled={!ready} aria-label={t('Weather precipitation layer')} aria-pressed={enabled} onClick={()=>{if(!enabled){reset();setContentVisible(true);}setEnabled(v=>!v);}}><span className="weather-layer-label-full">{t('Precipitation')}</span><span className="weather-layer-label-short">{t('Weather')}</span>: {t(enabled?'On':'Off')}</button>
  {contentVisible&&<section inert={!enabled} aria-hidden={!enabled} className="radar-player" aria-label={t('Precipitation settings')}>
   {status&&<p dir={dir} role={failed?'alert':'status'}>{statusLabel}</p>}
   {failed&&<button type="button" dir={dir} onClick={()=>{reset();setAttempt(v=>v+1);}}>{t('Retry forecast')}</button>}
   {!!frames.length&&<>
    <label className="radar-opacity" dir={dir}>{t('Layer strength')}<input dir="ltr" aria-label={t('Radar layer strength')} type="range" min=".3" max=".9" step=".001" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></label>
    <div className="precip-type-legend" aria-label={t('Precipitation types')}><span><i style={{background:'#4bc982'}}/>{t('Rain')}</span><span><i style={{background:'#c0a5f7'}}/>{t('Snow')}</span></div>
    <p className="precip-type-note" dir={dir}>{t(motionPreview?(motionReady?'Motion preview · Gulf region':'Standard blend · motion unavailable'):'Forecast · US region · rain & snow')}</p>
    <div className="radar-legend" dir="ltr"><span dir={dir}>{t('Weaker')}</span><i/><span dir={dir}>{t('Stronger')}</span></div>
   </>}
   <small><a href="https://www.ncei.noaa.gov/products/weather-climate-models/global-forecast" target="_blank" rel="noreferrer">{t('NOAA GFS · model forecast')}</a></small>
  </section>}
  {contentVisible&&!!frames.length&&<section inert={!enabled} aria-hidden={!enabled} className="radar-player radar-timeline" aria-label={t('Weather forecast timeline')}>
   <div className="radar-player-heading" dir={dir}><strong>{t(stale?'Outdated forecast':'Weather Forecast')} · {t('24h')}</strong><time dateTime={new Date(time).toISOString()}>{new Date(time).toLocaleString(locale,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})} {t('local')}</time></div>
   <div className="radar-player-row" dir="ltr"><button type="button" dir={dir} aria-label={t(playing?'Pause forecast animation':'Play forecast animation')} onClick={()=>{player.current?.play(!playing);setPlaying(!playing);}}>{t(playing?'Pause':'Play')}</button><input dir="ltr" ref={timeline} aria-label={t('Forecast time')} type="range" step=".001" min={0} max={frames.length-1} defaultValue={index} onChange={e=>{setPlaying(false);player.current?.seek(Number(e.target.value));}}/><button type="button" dir={dir} onClick={()=>{setPlaying(false);player.current?.seek(0);}}>{t('Now')}</button></div>
   {cloudObservations&&<small className="cloud-forecast-time-note" dir={dir}>{t("This timeline controls weather and wind. Clouds show separate recorded observations.")}</small>}
   <div className="radar-history-span" dir="ltr"><span dir={dir}>{t('Now')}</span><span dir={dir}>{t('+6h')}</span><span dir={dir}>{t('+12h')}</span><span dir={dir}>{t('+18h')}</span><span dir={dir}>{t('+24h')}</span></div>
   <div className="mobile-precip-intensity" aria-label={t('Precipitation intensity from light to heavy')}><div className="precip-intensity-bars"><span><span dir={dir}>{t('Rain')}<small dir="ltr">{t('Light → Heavy')}</small></span><i className="precip-rain-gradient" style={{background:RAIN_GRADIENT}} aria-hidden="true"/></span><span><span dir={dir}>{t('Wind')}</span><WindGradient units={units}/></span></div></div>
  </section>}
 </div>;
}
