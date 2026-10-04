"use client";
import {useEffect,useMemo,useState,useRef} from 'react';
import {Cloud,CloudRain,CloudSnow,CloudLightning,Sun,CloudFog,HelpCircle,Wind} from 'lucide-react';
import type {Map as LibreMap,ExpressionSpecification} from 'maplibre-gl';
import {tripApi,type RoadRoute,type RoutePoint} from './road-route';
import {type WeatherUnits,temperature} from './weather-units';
type Sample={lon:number;lat:number;fraction:number;mapFraction:number;eta:number};
type Forecast=Sample&{available:boolean;condition:string;level:'unknown'|'low'|'caution'|'high';temperatureC?:number;windMph?:number;gustMph?:number|null;windDirection?:string;precipProbability?:number|null;place?:string;updatedAt?:string};
const colors={unknown:'#8293a4',low:'#88ddec',caution:'#e9b35f',high:'#ee737e'};
function conditionView(p:Forecast){
 if(!p.available)return {Icon:HelpCircle,label:'No forecast'};
 const c=p.condition.toLowerCase();
 if(/thunder|storm/.test(c))return {Icon:CloudLightning,label:'Storms'};
 if(/snow|sleet|ice|freezing/.test(c))return {Icon:CloudSnow,label:'Wintry weather'};
 if(/rain|shower|drizzle/.test(c))return {Icon:CloudRain,label:'Rain'};
 if(/fog|mist|haze/.test(c))return {Icon:CloudFog,label:'Low visibility'};
 if(/cloud|overcast/.test(c))return {Icon:Cloud,label:'Cloudy'};
 if(/clear|sun/.test(c))return {Icon:Sun,label:'Clear'};
 return {Icon:Cloud,label:p.condition};
}
function concern(p:Forecast){
 if(!p.available)return 'Forecast unavailable';
 if((p.windMph??0)>=35||(p.gustMph??0)>=45)return 'Strong wind';
 if(/thunder|storm/i.test(p.condition))return 'Thunderstorms possible';
 if(/freezing|ice|blizzard/i.test(p.condition))return 'Wintry conditions';
 if((p.windMph??0)>=20)return 'Elevated wind';
 if(/fog|mist/i.test(p.condition))return 'Reduced visibility possible';
 if(/heavy rain/i.test(p.condition))return 'Heavy rain possible';
 return p.level==='high'?'Higher weather concern':p.level==='caution'?'Weather caution':null;
}
export function sampleRoute(route:RoadRoute,departure:number,stopMinutes:number):Sample[]{
 const c=route.coordinates,dist=[0],projected=[0];
 const mercator=(p:RoutePoint)=>[p[0]*Math.PI/180,Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))];
 for(let i=1;i<c.length;i++){const r=Math.PI/180,a=c[i-1],b=c[i],dl=(b[0]-a[0])*r,dp=(b[1]-a[1])*r;const h=Math.sin(dp/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dl/2)**2;dist.push(dist[i-1]+6371000*2*Math.asin(Math.sqrt(Math.min(1,h))));const ma=mercator(a),mb=mercator(b);projected.push(projected[i-1]+Math.hypot(mb[0]-ma[0],mb[1]-ma[1]));}
 const total=dist[dist.length-1],count=Math.min(16,Math.max(3,Math.ceil(route.distance/80000)+1));let j=1;
 return Array.from({length:count},(_,i)=>{const fraction=i/(count-1),d=total*fraction;while(j<dist.length-1&&dist[j]<d)j++;const t=(d-dist[j-1])/(dist[j]-dist[j-1]||1),a=c[j-1],b=c[j];return{lon:a[0]+(b[0]-a[0])*t,lat:a[1]+(b[1]-a[1])*t,fraction,mapFraction:i===0?0:i===count-1?1:(projected[j-1]+(projected[j]-projected[j-1])*t)/(projected[projected.length-1]||1),eta:departure+((route.elapsedSeconds?route.elapsedSeconds[j-1]+(route.elapsedSeconds[j]-route.elapsedSeconds[j-1])*t:route.duration*fraction)+fraction*stopMinutes*60)*1000};});
}
export default function RouteWeather({route,map,units,active}:{route:RoadRoute;map:LibreMap|null;units:WeatherUnits;active:boolean}){
 const cardsRef=useRef<HTMLDivElement>(null);
 const [page,setPage]=useState({key:'',index:0});
 const touchStart=useRef<number|null>(null);
 const [selected,setSelected]=useState<{key:string;index:number}|null>(null);
 const [timingOpen,setTimingOpen]=useState(false),[infoOpen,setInfoOpen]=useState(false);
 const [departure,setDeparture]=useState(''),[stops,setStops]=useState(0),[attempt,retry]=useState(0),[now,setNow]=useState(Date.now),[result,setResult]=useState<{key:string;points:Forecast[];checkedAt:number}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const depart=departure?new Date(departure).getTime():now;
 const valid=Number.isFinite(depart)&&depart>=now-3600000&&depart<now+6*86400000&&Number.isFinite(stops)&&stops>=0&&stops<=4320;
 const key=JSON.stringify([route.key,depart,stops,attempt]);
 const points=useMemo(()=>sampleRoute(route,depart,stops),[route,depart,stops]);
 const forecasts=result?.key===key?result.points:null;
 useEffect(()=>{const t=setInterval(()=>{setNow(Date.now());retry(n=>n+1);},300000);return()=>clearInterval(t);},[]);
 useEffect(()=>{if(!active||!valid)return;const controller=new AbortController();const deadline=setTimeout(()=>controller.abort(),90000);const delay=setTimeout(()=>{setLoading(true);setError('');fetch(tripApi()+'/weather',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({points}),signal:controller.signal}).then(async r=>{const v=await r.json() as {error?:string;points:Forecast[];checkedAt:number};if(!r.ok)throw new Error(v.error||'Forecast unavailable');if(!Array.isArray(v.points)||v.points.length!==points.length)throw new Error('Incomplete forecast');return v;}).then(v=>{if(!controller.signal.aborted)setResult({key,points:v.points,checkedAt:v.checkedAt});}).catch(e=>{if(!controller.signal.aborted)setError(e.message);else if(!disposed)setError('Forecast timed out. Try again.');}).finally(()=>{if(!disposed)setLoading(false);clearTimeout(deadline);});},450);let disposed=false;return()=>{disposed=true;clearTimeout(delay);clearTimeout(deadline);controller.abort();};},[key,active,valid,points]);
 useEffect(()=>{if(!map||!active)return;let painted:unknown=null;const apply=()=>{const source=map.getSource('ezclick-trip-route');if(!map.getLayer('ezclick-trip-line')||!source||source===painted)return;const stops:unknown[]=[];for(const p of forecasts??points.map(p=>({...p,level:'unknown' as const})))stops.push(p.mapFraction,colors[p.level]);const gradient=['interpolate',['linear'],['line-progress'],...stops] as ExpressionSpecification;if(JSON.stringify(map.getPaintProperty('ezclick-trip-line','line-gradient'))!==JSON.stringify(gradient))map.setPaintProperty('ezclick-trip-line','line-gradient',gradient);painted=source;};apply();map.on('style.load',apply);map.on('render',apply);return()=>{map.off('style.load',apply);map.off('render',apply);};},[map,active,forecasts,points]);
 const pageIndex=page.key===key?Math.min(page.index,(forecasts?.length??1)-1):0;
 const turnPage=(direction:number)=>{const index=Math.max(0,Math.min((forecasts?.length??1)-1,pageIndex+direction));setPage({key,index});setSelected({key,index});};
 useEffect(()=>{
  const el=cardsRef.current;if(!el||!forecasts)return;
  let last=0,total=0;
  const wheel=(e:WheelEvent)=>{if(e.ctrlKey||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;e.preventDefault();e.stopPropagation();const now=performance.now();if(now-last<550)return;total+=e.deltaY;if(Math.abs(total)<25)return;const direction=Math.sign(total);total=0;last=now;const index=Math.max(0,Math.min(forecasts.length-1,pageIndex+direction));setPage({key,index});setSelected({key,index});};
  el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);
 },[forecasts,key,pageIndex]);
 useEffect(()=>{if(!forecasts)return;const frame=requestAnimationFrame(()=>cardsRef.current?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));return()=>cancelAnimationFrame(frame);},[forecasts,pageIndex]);
 useEffect(()=>{
  if(!map||!active||!forecasts||selected?.key!==key)return;
  const id='ezclick-trip-selected',i=selected.index,p=forecasts[i];if(!p)return;
  const start=i===0?0:(forecasts[i-1].mapFraction+p.mapFraction)/2,end=i===forecasts.length-1?1:(p.mapFraction+forecasts[i+1].mapFraction)/2;
  const outline=id+'-outline',ends=id+'-ends',halo=ends+'-halo',glow=id+'-glow',motion=matchMedia('(prefers-reduced-motion: reduce)');
  const gradient=['case',['all',['>=',['line-progress'],start],['<=',['line-progress'],end]],colors[p.level],'rgba(0,0,0,0)'] as ExpressionSpecification;
  // Use the same Mercator distance as line-progress so rings meet the highlight exactly.
  const xy=route.coordinates.map(([lon,lat])=>[lon*Math.PI/180,Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))]);
  const distances=[0];for(let n=1;n<xy.length;n++)distances.push(distances[n-1]+Math.hypot(xy[n][0]-xy[n-1][0],xy[n][1]-xy[n-1][1]));
  const boundary=(fraction:number)=>{const target=fraction*distances[distances.length-1];let n=1;while(n<distances.length-1&&distances[n]<target)n++;const t=(target-distances[n-1])/(distances[n]-distances[n-1]||1),a=xy[n-1],b=xy[n];return[(a[0]+(b[0]-a[0])*t)*180/Math.PI,(2*Math.atan(Math.exp(a[1]+(b[1]-a[1])*t))-Math.PI/2)*180/Math.PI];};
  const edgeData={type:'FeatureCollection' as const,features:[start,end].map(f=>({type:'Feature' as const,properties:{},geometry:{type:'Point' as const,coordinates:boundary(f)}}))};
  let frame=0,began=performance.now();
  const add=()=>{if(!map.getSource('ezclick-trip-route'))return;
   if(!map.getLayer(outline))map.addLayer({id:outline,source:'ezclick-trip-route',type:'line',layout:{'line-cap':'round','line-join':'round'},paint:{'line-width':10,'line-opacity':0,'line-gradient':['case',['all',['>=',['line-progress'],start],['<=',['line-progress'],end]],'#04101f','rgba(0,0,0,0)']}});
   for(const [layer,width,blur] of [[glow,15,5],[id,5,0]] as const){if(!map.getLayer(layer))map.addLayer({id:layer,source:'ezclick-trip-route',type:'line',layout:{'line-cap':'round','line-join':'round'},paint:{'line-width':width,'line-blur':blur,'line-opacity':0,'line-opacity-transition':{duration:0,delay:0},'line-gradient':gradient}});}
   if(!map.getSource(ends))map.addSource(ends,{type:'geojson',data:edgeData});
   if(!map.getLayer(halo))map.addLayer({id:halo,type:'circle',source:ends,paint:{'circle-radius':13,'circle-color':colors[p.level],'circle-blur':.8,'circle-opacity':0}});
   if(!map.getLayer(ends))map.addLayer({id:ends,type:'circle',source:ends,paint:{'circle-radius':5,'circle-color':'#091b2b','circle-stroke-width':2,'circle-stroke-color':colors[p.level],'circle-opacity':0,'circle-stroke-opacity':0}});
  };
  const paint=(now:number)=>{add();const elapsed=Math.max(0,now-began),fade=motion.matches?1:Math.min(1,elapsed/650),pulse=motion.matches?.65:(1-Math.cos(elapsed/3200*Math.PI*2))/2;
   if(map.getLayer(id))map.setPaintProperty(id,'line-opacity',fade*(.75+.25*pulse));
   if(map.getLayer(glow))map.setPaintProperty(glow,'line-opacity',fade*(.12+.25*pulse));
   if(map.getLayer(outline))map.setPaintProperty(outline,'line-opacity',fade*.95);
   if(map.getLayer(halo))map.setPaintProperty(halo,'circle-opacity',fade*(.3+.25*pulse));
   if(map.getLayer(ends)){map.setPaintProperty(ends,'circle-opacity',fade);map.setPaintProperty(ends,'circle-stroke-opacity',fade);}
   if(!motion.matches)frame=requestAnimationFrame(paint);
  };
  const restart=()=>{cancelAnimationFrame(frame);began=performance.now();paint(began);};
  restart();map.on('style.load',restart);motion.addEventListener('change',restart);
  return()=>{cancelAnimationFrame(frame);map.off('style.load',restart);motion.removeEventListener('change',restart);for(const layer of [ends,halo,id,glow,outline])if(map.getLayer(layer))map.removeLayer(layer);if(map.getSource(ends))map.removeSource(ends);};
 },[map,active,forecasts,selected,key,route]);
 // Frame the checkpoint in the uncovered map, after the expanded card has laid out.
 useEffect(()=>{
  if(!map||!active||selected?.key!==key)return;
  const p=forecasts?.[selected.index];if(!p)return;
  let frame=0;
  // Allow panel layout and its ResizeObserver to settle before starting the flight.
  frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{
   const canvas=map.getContainer().getBoundingClientRect();
   const panel=cardsRef.current?.closest('.weather-left-stack')?.getBoundingClientRect();
   const mobile=canvas.width<=640;
   const covered=panel?(mobile?Math.max(0,canvas.bottom-panel.top):Math.max(0,panel.right-canvas.left)):0;
   const offset:[number,number]=mobile?[0,-Math.min(covered,canvas.height*.65)/2]:[Math.min(covered,canvas.width*.6)/2,0];
   // Target about 12 miles across 100px; the scale control rounds its displayed label.
   const overviewZoom=Math.log2(40075016.686*Math.cos(p.lat*Math.PI/180)*100/(512*12*1609.344));
   map.flyTo({center:[p.lon,p.lat],zoom:Math.max(map.getMinZoom(),Math.min(map.getMaxZoom(),overviewZoom)),offset,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:1500});
  });});
  return()=>cancelAnimationFrame(frame);
 },[map,active,forecasts,selected,key]);
 const speed=(mph:number)=>`${Math.round(mph*(units==='us'?1:1.609344))} ${units==='us'?'mph':'km/h'}`;
 const time=(ms:number)=>new Date(ms).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
 return <section className="route-weather" aria-label="Weather along your route">
 <div className="route-weather-title"><strong>Weather ahead</strong><span>At estimated arrival</span></div>
 <button className="route-timing-toggle" aria-expanded={timingOpen} onClick={()=>setTimingOpen(v=>!v)}>{departure?'Departure: '+time(depart):'Leave now'}{stops?' + '+stops+' min breaks':''} <span>Change</span></button><div className={`route-options-collapse ${timingOpen?'is-expanded':''}`} inert={!timingOpen}><div><div className="route-timing"><label>Departure · your local time<input aria-label="Departure time" type="datetime-local" value={departure} onChange={e=>setDeparture(e.target.value)}/></label><button onClick={()=>{setDeparture('');setNow(Date.now());}}>Leave now</button><label>Planned breaks · minutes<input aria-label="Planned break minutes" type="number" min="0" max="4320" step="30" value={stops} onChange={e=>setStops(Number(e.target.value))}/></label></div>
</div></div>
 {!valid&&<p role="alert">Choose a departure within six days and valid break minutes.</p>}
 <div className="route-weather-legend"><span style={{color:colors.low}}>Lower concern</span><span style={{color:colors.caution}}>Caution</span><span style={{color:colors.high}}>Higher concern</span><span style={{color:colors.unknown}}>No data</span></div>
 {loading&&<p role="status">Checking forecast along your route…</p>}
 {error&&<p role="alert">{error} <button onClick={()=>retry(n=>n+1)}>Retry</button></p>}
 {forecasts&&<><div ref={cardsRef} className="route-weather-cards" tabIndex={0} role="region" aria-label="Route forecast checkpoints, scroll to change card" onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();turnPage(e.key==='ArrowDown'?1:-1);}}} onTouchStart={e=>{touchStart.current=e.touches[0].clientY;}} onTouchEnd={e=>{if(touchStart.current!==null){const delta=touchStart.current-e.changedTouches[0].clientY;if(Math.abs(delta)>35)turnPage(delta>0?1:-1);touchStart.current=null;}}}>{forecasts.map((p,i)=>{if(i!==pageIndex)return null;const {Icon,label}=conditionView(p),opened=selected?.key===key&&selected.index===i;return <button className="route-weather-card" key={i} aria-expanded={opened} style={{borderLeftColor:colors[p.level]}} onClick={()=>setSelected({key,index:i})}><span className="forecast-stage">{i===0?'A · Departure':i===forecasts.length-1?'B · Arrival':'Along the route'}</span><span className="forecast-place">{p.place?'Near '+p.place:'Location unavailable'}</span><span className="forecast-when"><time dateTime={new Date(p.eta).toISOString()}>{new Date(p.eta).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</time><span>{new Date(p.eta).toLocaleDateString([],{month:'short',day:'numeric'})}</span></span><span className="forecast-distance">{Math.round(p.fraction*route.distance/(units==='us'?1609.344:1000)).toLocaleString()} {units==='us'?'mi':'km'} <small>from start</small></span><span className="forecast-condition"><Icon size={23} strokeWidth={1.5} aria-hidden="true"/><strong>{label}</strong><span>{p.available&&p.precipProbability!=null?`${p.precipProbability}% chance`:'Chance unavailable'}</span></span><span className="forecast-wind"><Wind size={18} aria-hidden="true"/><strong>{p.available&&p.windMph!=null?speed(p.windMph):'Wind unavailable'}</strong><span>{p.windDirection}</span></span><span className="forecast-gust">{p.available&&p.gustMph!=null?'Gusts '+speed(p.gustMph):'Gust data unavailable'}</span>{concern(p)&&<span className="forecast-concern" style={{color:colors[p.level]}}>{concern(p)}</span>}{opened&&<span className="forecast-extra">{p.condition}{p.available&&p.temperatureC!=null?` · ${temperature(p.temperatureC,units)}°${units==='us'?'F':'C'}`:''}</span>}</button>;})}<div className="forecast-pagination"><button aria-label="Previous weather checkpoint" disabled={pageIndex===0} onClick={()=>turnPage(-1)}>↑ Previous</button><span aria-live="polite">{pageIndex+1} / {forecasts.length}</span><button aria-label="Next weather checkpoint" disabled={pageIndex===forecasts.length-1} onClick={()=>turnPage(1)}>Next ↓</button></div></div>

 <p>{forecasts.filter(p=>p.available).length}/{forecasts.length} checkpoints · times in your local timezone</p></>}
 <button className="route-about-toggle" aria-expanded={infoOpen} onClick={()=>setInfoOpen(v=>!v)}>About this forecast</button><div className={`route-options-collapse ${infoOpen?'is-expanded':''}`} inert={!infoOpen}><div><p className="route-weather-note">NOAA/NWS hourly forecast at sampled locations. Between-point colors are approximate. Arrival uses estimated road travel times; breaks are spread across the trip. Selected sections represent nearby forecast samples, not exact hazard boundaries. Wind is forecast sustained speed; gusts are shown only when supplied. Concern colors are not truck rollover thresholds. No live traffic, hours-of-service calculation or road-closure verification.</p></div></div>
 <a href="https://www.weather.gov/" target="_blank" rel="noreferrer">NOAA / National Weather Service</a>
 </section>;
}
