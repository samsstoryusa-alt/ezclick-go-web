"use client";
// Particle trail approach adapted from RadrView, MIT, copyright 2026 RadrView Contributors.
// License: public/licenses/radrview.txt. Camera projection and time sampling are EZCLICK adaptations.
import {useEffect,useRef,useState} from 'react';
import type {Map as LibreMap} from 'maplibre-gl';
import {windPair,sampleWind,useWeatherClock,type WindFrame} from './wind-field';
import {WIND_COLORS,windBand} from './weather-palette';
import type {WeatherUnits} from './weather-units';
import {advectWind} from './wind-advection';
export default function WindControls({map,ready,time,frames,status,units}:{map:LibreMap|null;ready:boolean;time:number|null;frames:WindFrame[];status:string;units:WeatherUnits}){
 const now=useWeatherClock();
 const [enabled,setEnabled]=useState(true);
 const [visibility,setVisibility]=useState(.65);
 const strength=useRef(visibility);useEffect(()=>{strength.current=visibility;},[visibility]);
 const selected=useRef(time);useEffect(()=>{selected.current=time;},[time]);
 useEffect(()=>{
  if(!enabled||!map||!ready)return;
  const host=map.getContainer(),canvas=document.createElement('canvas');canvas.className='weather-wind-canvas';canvas.setAttribute('aria-hidden','true');host.appendChild(canvas);
  const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();return;}
  let raf=0,last=0;
  type Particle={lon:number;lat:number;age:number};let particles:Particle[]=[];
  const bins:number[][]=[[],[],[],[]];
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function reset(){ctx!.clearRect(0,0,canvas.width,canvas.height);particles=[];}
  function spawn():Particle{const p=map!.unproject([Math.random()*host.clientWidth,Math.random()*host.clientHeight]);return {lon:p.lng,lat:p.lat,age:Math.random()*100};}
  function tick(now:number){
   raf=requestAnimationFrame(tick);if(now-last<(reduced?500:33))return;const dt=Math.min(60,now-last||33)/33;last=now;
   const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(devicePixelRatio,1.5);
   if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx!.setTransform(dpr,0,0,dpr,0,0);particles=[];}
   if(document.hidden||map!.isMoving()){ctx!.clearRect(0,0,w,h);return;}
   const pair=windPair(frames,selected.current??Date.now());if(!pair){ctx!.clearRect(0,0,w,h);return;}
   // Blend presentation only from regional to close-up views. The GFS field is unchanged.
   const zoom=map!.getZoom(),t=Math.max(0,Math.min(1,(7-zoom)/4)),wide=t*t*(3-2*t);
   const trail=reduced?.88:.88+.055*wide;
   ctx!.globalCompositeOperation='destination-in';ctx!.fillStyle='rgba(0,0,0,'+trail+')';ctx!.fillRect(0,0,w,h);ctx!.globalCompositeOperation='source-over';
   const count=Math.min(1200,Math.max(150,Math.round(w*h/1000*(1+.15*wide))));while(particles.length<count)particles.push(spawn());if(particles.length>count)particles.length=count;
   const step=360/(512*Math.pow(2,zoom))*.14*dt;ctx!.lineWidth=.95+.3*wide;canvas.style.opacity=String(Math.min(1,strength.current*(1+.15*wide)));for(const bin of bins)bin.length=0;
   for(let i=0;i<particles.length;i++){
    const p=particles[i];
    if(p.age++>110+30*wide){particles[i]=spawn();continue;}
    const wind=sampleWind(pair,p.lon,p.lat);if(!wind){particles[i]=spawn();continue;}
    const {u,v}=wind;
    const next=advectWind(p.lon,p.lat,step,(lon,lat)=>sampleWind(pair,lon,lat));if(!next){particles[i]=spawn();continue;}
    const a=map!.project([p.lon,p.lat]);p.lon=next.lon;p.lat=next.lat;const b=map!.project([p.lon,p.lat]);
    if(a.x<0||a.x>w||a.y<0||a.y>h||Math.hypot(b.x-a.x,b.y-a.y)>30){particles[i]=spawn();continue;}bins[windBand(Math.hypot(u,v))].push(a.x,a.y,b.x,b.y);
   }
   for(let band=0;band<bins.length;band++){const bin=bins[band];ctx!.strokeStyle=WIND_COLORS[band];ctx!.beginPath();for(let j=0;j<bin.length;j+=4){ctx!.moveTo(bin[j],bin[j+1]);ctx!.lineTo(bin[j+2],bin[j+3]);}ctx!.stroke();}
  }
  map.on('movestart',reset);raf=requestAnimationFrame(tick);
  return()=>{cancelAnimationFrame(raf);map.off('movestart',reset);canvas.remove();};
 },[map,ready,enabled,frames]);
 return <div className="wind-controls"><button className="radar-toggle" disabled={!ready} aria-pressed={enabled} onClick={()=>setEnabled(v=>!v)}>Wind: {enabled?'On':'Off'}</button>{enabled&&<small>{!frames.length?status:windPair(frames,time??now,now)?status:'No wind data for this time'}</small>}{enabled&&<div className="wind-appearance"><label className="radar-opacity">Wind visibility<input aria-label="Wind visibility" type="range" min="0.15" max="1" step="0.001" value={visibility} onChange={e=>setVisibility(Number(e.target.value))}/></label><div className="wind-speed-legend" aria-label={units==='us'?'Wind speed colors in miles per hour':'Wind speed colors in kilometres per hour'}>{WIND_COLORS.map((color,i)=><span key={color}><i style={{background:color}}/>{(units==='us'?['0–9','9–19','19–31','31+']:['0–15','15–30','30–50','50+'])[i]}</span>)}<b>{units==='us'?'≈ mph':'km/h'}</b></div></div>}</div>;
}
