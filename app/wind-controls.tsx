"use client";
import {useWeatherLanguage} from './weather-language';
// Particle trail approach adapted from RadrView, MIT, copyright 2026 RadrView Contributors.
// License: public/licenses/radrview.txt. Camera projection and time sampling are EZCLICK adaptations.
import {useEffect,useRef,useState} from 'react';
import type {Map as LibreMap} from 'maplibre-gl';
import {windPair,sampleWind,useWeatherClock,type WindFrame} from './wind-field';
import {WIND_COLORS,windBand} from './weather-palette';
import type {WeatherUnits} from './weather-units';
import {createWindVisibility} from './wind-visibility';
import {weatherPerf} from './weather-perf';
import {qualityProfiles,useWeatherQuality} from './weather-quality';
import {advectWind} from './wind-advection';
export default function WindControls({map,ready,time,frames,status,units}:{map:LibreMap|null;ready:boolean;time:number|null;frames:WindFrame[];status:string;units:WeatherUnits}){
 const {t,dir}=useWeatherLanguage();
 const now=useWeatherClock();
 const quality=useWeatherQuality(),profile=qualityProfiles[quality];
 const [enabled,setEnabled]=useState(true);
 useEffect(()=>{const receive=(event:Event)=>{const {action,reply,translate=t}=(event as CustomEvent).detail;if(ready&&['wind_on','wind_off'].includes(action)){setEnabled(action==='wind_on');reply(translate(action==='wind_on'?'Wind layer on.':'Wind layer off.'));}};window.addEventListener('voice-map-action',receive);return()=>window.removeEventListener('voice-map-action',receive);},[ready,t]);
 const [visibility,setVisibility]=useState(.65);
 const strength=useRef(visibility);useEffect(()=>{strength.current=visibility;},[visibility]);
 const selected=useRef(time);useEffect(()=>{selected.current=time;},[time]);
 useEffect(()=>{
  if(!enabled||!map||!ready)return;
  const host=map.getContainer(),canvas=document.createElement('canvas');canvas.className='weather-wind-canvas';canvas.setAttribute('aria-hidden','true');host.appendChild(canvas);
  const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();return;}
  const report=weatherPerf(canvas);
  let raf=0,last=0,lastDraw=0;
  type Particle={lon:number;lat:number;age:number};let particles:Particle[]=[];
  const bins:number[][]=[[],[],[],[]];
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const visibilityState=createWindVisibility(reduced);
  canvas.style.transition='none';canvas.style.opacity='0';
  function spawn(reuse?:Particle):Particle{const p=map!.unproject([Math.random()*host.clientWidth,Math.random()*host.clientHeight]);const particle=reuse??{lon:0,lat:0,age:0};particle.lon=p.lng;particle.lat=p.lat;particle.age=Math.random()*100;return particle;}
  function tick(now:number){
   raf=requestAnimationFrame(tick);const interval=reduced?500:1000/profile.windFps;if(lastDraw&&now-lastDraw+.01<interval)return;const dt=Math.min(150,now-last||33)/33;last=now;lastDraw=lastDraw?lastDraw+Math.floor((now-lastDraw+.01)/interval)*interval:now;
   const started=performance.now(),moving=map!.isMoving()||!!host.dataset.globeRotating;
   try {
   const motion=visibilityState(now,moving);
   canvas.style.opacity=String(strength.current*motion.opacity);
   // Freeze only the fading wind overlay. Rain keeps its independent playback.
   if(!motion.draw)return;
   if(motion.reset){ctx!.clearRect(0,0,canvas.width,canvas.height);particles=[];}
   const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(devicePixelRatio,profile.pixelRatio);
   if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx!.setTransform(dpr,0,0,dpr,0,0);particles=[];}
   if(document.hidden){ctx!.clearRect(0,0,w,h);return;}
   const pair=windPair(frames,selected.current??Date.now());if(!pair){ctx!.clearRect(0,0,w,h);return;}
   // Blend presentation only from regional to close-up views. The GFS field is unchanged.
   const zoom=map!.getZoom(),t=Math.max(0,Math.min(1,(7-zoom)/4)),wide=t*t*(3-2*t);
   const trail=reduced?.88:.88+.055*wide;
   ctx!.globalCompositeOperation='destination-in';ctx!.fillStyle='rgba(0,0,0,'+trail+')';ctx!.fillRect(0,0,w,h);ctx!.globalCompositeOperation='source-over';
   const count=Math.min(profile.maxParticles,Math.max(profile.minParticles,Math.round(w*h/1000*(1+.15*wide)*profile.particleScale)));while(particles.length<count)particles.push(spawn());if(particles.length>count)particles.length=count;
   const step=360/(512*Math.pow(2,zoom))*.14*dt;ctx!.lineWidth=.95+.3*wide;canvas.style.opacity=String(Math.min(1,strength.current*(1+.15*wide)*motion.opacity));for(const bin of bins)bin.length=0;
   for(let i=0;i<particles.length;i++){
    const p=particles[i];
    if(p.age++>110+30*wide){particles[i]=spawn(p);continue;}
    const wind=sampleWind(pair,p.lon,p.lat);if(!wind){particles[i]=spawn(p);continue;}
    const {u,v}=wind;
    const next=advectWind(p.lon,p.lat,step,(lon,lat)=>sampleWind(pair,lon,lat));if(!next){particles[i]=spawn(p);continue;}
    const a=map!.project([p.lon,p.lat]);p.lon=next.lon;p.lat=next.lat;const b=map!.project([p.lon,p.lat]);
    if(a.x<0||a.x>w||a.y<0||a.y>h||Math.hypot(b.x-a.x,b.y-a.y)>30){particles[i]=spawn(p);continue;}const bin=bins[windBand(Math.hypot(u,v))];
    bin.push(a.x,a.y,b.x,b.y);
   }
   for(let band=0;band<bins.length;band++){const bin=bins[band];ctx!.strokeStyle=WIND_COLORS[band];ctx!.beginPath();for(let j=0;j<bin.length;j+=4){ctx!.moveTo(bin[j],bin[j+1]);ctx!.lineTo(bin[j+2],bin[j+3]);}ctx!.stroke();}
   } finally {report?.(started,moving);}
  }
  raf=requestAnimationFrame(tick);
  return()=>{cancelAnimationFrame(raf);canvas.remove();};
 },[map,ready,enabled,frames,profile]);
 return <div className="wind-controls"><button type="button" dir={dir} className="radar-toggle weather-wind-toggle" disabled={!ready} aria-label={t('Wind layer')} aria-pressed={enabled} onClick={()=>setEnabled(v=>!v)}>{t('Wind')}: {t(enabled?'On':'Off')}</button>{enabled&&<small dir={dir}>{t(!frames.length?status:windPair(frames,time??now,now)?status:'No wind data for this time')}</small>}{enabled&&<div className="wind-appearance"><label className="radar-opacity" dir={dir}>{t('Wind visibility')}<input dir="ltr" aria-label={t('Wind visibility')} type="range" min="0.15" max="1" step="0.001" value={visibility} onChange={e=>setVisibility(Number(e.target.value))}/></label><div className="wind-speed-legend" dir="ltr" aria-label={t(units==='us'?'Wind speed colors in miles per hour':'Wind speed colors in kilometres per hour')}>{WIND_COLORS.map((color,i)=><span key={color}><i style={{background:color}}/>{(units==='us'?['0–9','9–19','19–31','31+']:['0–15','15–30','30–50','50+'])[i]}</span>)}<b>{units==='us'?'≈ mph':'km/h'}</b></div></div>}</div>;
}
