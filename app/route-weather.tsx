"use client";
import './route-mobile-carousel.css';
import './route-desktop.css';
import {useEffect,useMemo,useState,useRef,useCallback} from 'react';
import {Wind,Clock3,ChevronDown,CheckCircle2,TriangleAlert,CircleAlert,CircleDashed} from 'lucide-react';
import {forecastCondition,WeatherSymbol} from './forecast-condition';
import RouteForecastHint from './route-forecast-hint';
import {weatherRequest,validForecastResponse} from './weather-request';
import {useWeatherLanguage} from './weather-language';
import DeparturePicker from './departure-picker';
import {readTrip,saveTrip} from './weather-trip-storage';
import type {Map as LibreMap,ExpressionSpecification} from 'maplibre-gl';
import {tripApi,type RoadRoute,type RoutePoint} from './road-route';
import {type WeatherUnits,temperature} from './weather-units';
type Sample={lon:number;lat:number;fraction:number;mapFraction:number;eta:number};
type Forecast=Sample&{available:boolean;condition:string;level:'unknown'|'low'|'caution'|'high';temperatureC?:number;windMph?:number;gustMph?:number|null;windDirection?:string;precipProbability?:number|null;place?:string;updatedAt?:string};
const colors={unknown:'#8293a4',low:'#88ddec',caution:'#e9b35f',high:'#ee737e'};
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
export default function RouteWeather({route,map,units,active,compactMobile=false,mobilePresentation=false,desktopPresentation=false,onExpand}:{route:RoadRoute;map:LibreMap|null;units:WeatherUnits;active:boolean;compactMobile?:boolean;mobilePresentation?:boolean;desktopPresentation?:boolean;onExpand?:()=>void}){
 const {locale,dir,t}=useWeatherLanguage();
 const compactPresentation=mobilePresentation||desktopPresentation;
 const [allSections,setAllSections]=useState(false);
 const cardsRef=useRef<HTMLDivElement>(null);
 const sectionRef=useRef<HTMLElement>(null);
 useEffect(()=>{
  if(!compactMobile)return;
  const body=sectionRef.current?.closest<HTMLElement>('.route-body');
  if(body)body.scrollTop=0;
 },[compactMobile]);
 const [mobileHint,setMobileHint]=useState<{index:number;routeKey:string;open:boolean}|null>(null);
 const [warningFilter,setWarningFilter]=useState<string|null>(null);
 const [selected,setSelected]=useState<{key:string;routeKey:string;index:number}|null>(null);
 const [timingOpen,setTimingOpen]=useState(false),[infoOpen,setInfoOpen]=useState(false);
 const [departure,setDeparture]=useState(()=>readTrip()?.departure??''),[stops,setStops]=useState(()=>readTrip()?.stops??0),[attempt,retry]=useState(0),[now,setNow]=useState(Date.now),[result,setResult]=useState<{key:string;points:Forecast[];checkedAt:number}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>{saveTrip({departure,stops});},[departure,stops]);
 const depart=departure?new Date(departure).getTime():now;
 const valid=Number.isFinite(depart)&&depart>=now-3600000&&depart<now+6*86400000&&Number.isFinite(stops)&&stops>=0&&stops<=4320;
 const key=JSON.stringify([route.key,depart,stops,attempt]);
 const points=useMemo(()=>sampleRoute(route,depart,stops),[route,depart,stops]);
 const forecasts=result?.key===key?result.points:null;
 const displayedForecasts=forecasts??result?.points;
 useEffect(()=>{const t=setInterval(()=>{setNow(Date.now());retry(n=>n+1);},300000);return()=>clearInterval(t);},[]);
 useEffect(()=>{if(!active||!valid)return;const controller=new AbortController();const deadline=setTimeout(()=>controller.abort(),90000);const delay=setTimeout(()=>{setLoading(true);setError('');weatherRequest(tripApi()+'/weather',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({points}),signal:controller.signal}).then(v=>{if(!validForecastResponse(v,points.length))throw new Error('Incomplete forecast. Please try again.');const checked=v as {points:Forecast[];checkedAt:number};return {...checked,points:checked.points.map((p,i)=>({...p,...points[i]}))};}).then(v=>{if(!controller.signal.aborted)setResult({key,points:v.points,checkedAt:v.checkedAt});}).catch(e=>{if(!controller.signal.aborted&&!disposed)setError(e instanceof Error?e.message:'Forecast unavailable. Please try again.');else if(!disposed)setError('Forecast timed out. Try again.');}).finally(()=>{if(!disposed)setLoading(false);clearTimeout(deadline);});},450);let disposed=false;return()=>{disposed=true;clearTimeout(delay);clearTimeout(deadline);controller.abort();};},[key,active,valid,points]);
 useEffect(()=>{if(!map||!active)return;let painted:unknown=null;const apply=()=>{const source=map.getSource('ezclick-trip-route');if(!map.getLayer('ezclick-trip-line')||!source||source===painted)return;const stops:unknown[]=[];for(const p of forecasts??points.map(p=>({...p,level:'unknown' as const})))stops.push(p.mapFraction,colors[p.level]);const gradient=['interpolate',['linear'],['line-progress'],...stops] as ExpressionSpecification;if(JSON.stringify(map.getPaintProperty('ezclick-trip-line','line-gradient'))!==JSON.stringify(gradient))map.setPaintProperty('ezclick-trip-line','line-gradient',gradient);painted=source;};apply();map.on('style.load',apply);map.on('render',apply);return()=>{map.off('style.load',apply);map.off('render',apply);};},[map,active,forecasts,points]);
 const warningsOnly=warningFilter===key;
 const warningIndices=forecasts?.flatMap((p,i)=>p.level==='caution'||p.level==='high'?[i]:[])??[];
 const selectedIndex=compactPresentation?Math.min(selected?.routeKey===route.key?selected.index:0,Math.max(0,(displayedForecasts?.length??1)-1)):selected?.key===key?selected.index:-1;
 const hintIndex=selectedIndex>=0?selectedIndex:(warningIndices[0]??-1);
 const selectCheckpoint=useCallback((index:number,showHint=false)=>{if(compactMobile&&!compactPresentation)onExpand?.();if(compactPresentation)setMobileHint(previous=>showHint?{index,routeKey:route.key,open:true}:previous?{...previous,open:false}:null);setSelected({key,routeKey:route.key,index});},[compactMobile,compactPresentation,onExpand,key,route.key]);
 const jumpToCheckpoint=(index:number)=>{setWarningFilter(null);selectCheckpoint(index);};
 const nextWarning=()=>{const index=warningIndices.find(i=>i>selectedIndex)??warningIndices[0];if(index!==undefined)selectCheckpoint(index);};
 useEffect(()=>{
  if(selected?.key!==key||compactMobile||compactPresentation)return;
  const frame=window.setTimeout(()=>{
   const list=cardsRef.current,card=list?.querySelector<HTMLElement>(`[data-checkpoint="${selected.index}"]`);
   if(!list||!card)return;
   const scroller=matchMedia('(max-width:767px),(max-width:950px) and (max-height:500px)').matches?list.closest<HTMLElement>('.route-body')??list:list;
   const r=card.getBoundingClientRect(),v=scroller.getBoundingClientRect();
   if(r.top<v.top||r.bottom>v.bottom)scroller.scrollTo({top:scroller.scrollTop+r.top-v.top-5,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  },matchMedia('(max-width:767px) and (orientation:portrait)').matches&&!matchMedia('(prefers-reduced-motion: reduce)').matches?480:0);
  return()=>clearTimeout(frame);
 },[selected,key,warningsOnly,compactMobile,compactPresentation]);
 useEffect(()=>{
  if(!map||!active||!compactPresentation)return;
  const closeOnMap=(event:import('maplibre-gl').MapMouseEvent)=>{
   const layer='ezclick-weather-checkpoints-dots';
   if(map.getLayer(layer)&&map.queryRenderedFeatures(event.point,{layers:[layer]}).length)return;
   setMobileHint(previous=>previous?.open?{...previous,open:false}:previous);
  };
  map.on('click',closeOnMap);return()=>{map.off('click',closeOnMap);};
 },[map,active,compactPresentation]);
 // Keep the map layers alive while selection and parent callbacks change.
 const markerState=useRef({selectCheckpoint,selectedIndex});
 useEffect(()=>{
  markerState.current={selectCheckpoint,selectedIndex};
  if(!map?.getSource('ezclick-weather-checkpoints')||!forecasts)return;
  forecasts.forEach((_,i)=>map.setFeatureState({source:'ezclick-weather-checkpoints',id:i},{chosen:i===selectedIndex}));
 },[map,forecasts,selectCheckpoint,selectedIndex]);
 // Checkpoint markers use the same samples as the cards; no inferred hazard boundaries.
 useEffect(()=>{
  if(!map||!active||!forecasts)return;
  const source='ezclick-weather-checkpoints',dots=source+'-dots',labels=source+'-labels',aura=source+'-aura';
  const chosen=['boolean',['feature-state','chosen'],false] as ExpressionSpecification;
  const data={type:'FeatureCollection' as const,features:forecasts.map((p,i)=>({type:'Feature' as const,id:i,properties:{index:i,label:String(i+1),color:colors[p.level]},geometry:{type:'Point' as const,coordinates:[p.lon,p.lat]}}))};
  const apply=()=>{if(map.getLayer(labels)||!map.getLayer('ezclick-trip-line'))return;
   if(!map.getSource(source))map.addSource(source,{type:'geojson',data});
   if(!map.getLayer(aura))map.addLayer({id:aura,type:'circle',source,paint:{'circle-radius':25,'circle-color':['get','color'],'circle-blur':.75,'circle-opacity':['case',chosen,.38,0]}});
   if(!map.getLayer(dots))map.addLayer({id:dots,type:'circle',source,paint:{'circle-radius':['case',chosen,12,9],'circle-color':'#102636','circle-stroke-color':['get','color'],'circle-stroke-width':['case',chosen,3,2]}});
   if(!map.getLayer(labels))map.addLayer({id:labels,type:'symbol',source,layout:{'text-field':['get','label'],'text-size':11,'text-allow-overlap':true,'text-ignore-placement':true},paint:{'text-color':'#effaff'}});
   forecasts.forEach((_,i)=>map.setFeatureState({source,id:i},{chosen:i===markerState.current.selectedIndex}));
  };
  const click=(e:import('maplibre-gl').MapMouseEvent)=>{const features=map.queryRenderedFeatures(e.point,{layers:[dots]});const index=Number(features[0]?.properties?.index);if(Number.isInteger(index)&&index>=0&&index<forecasts.length){setWarningFilter(null);markerState.current.selectCheckpoint(index,true);}};
  const enter=()=>{map.getCanvas().style.cursor='pointer';};const leave=()=>{map.getCanvas().style.cursor='';};
  apply();map.on('style.load',apply);map.on('render',apply);map.on('click',dots,click);map.on('mouseenter',dots,enter);map.on('mouseleave',dots,leave);
  return()=>{map.off('style.load',apply);map.off('render',apply);map.off('click',dots,click);map.off('mouseenter',dots,enter);map.off('mouseleave',dots,leave);leave();for(const layer of [labels,dots,aura])if(map.getLayer(layer))map.removeLayer(layer);if(map.getSource(source))map.removeSource(source);};
 },[map,active,forecasts]);
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
   const before=map.getLayer('ezclick-weather-checkpoints-dots')?'ezclick-weather-checkpoints-dots':undefined;
   if(!map.getLayer(outline))map.addLayer({id:outline,source:'ezclick-trip-route',type:'line',layout:{'line-cap':'round','line-join':'round'},paint:{'line-width':10,'line-opacity':0,'line-gradient':['case',['all',['>=',['line-progress'],start],['<=',['line-progress'],end]],'#04101f','rgba(0,0,0,0)']}},before);
   for(const [layer,width,blur] of [[glow,15,5],[id,5,0]] as const){if(!map.getLayer(layer))map.addLayer({id:layer,source:'ezclick-trip-route',type:'line',layout:{'line-cap':'round','line-join':'round'},paint:{'line-width':width,'line-blur':blur,'line-opacity':0,'line-opacity-transition':{duration:0,delay:0},'line-gradient':gradient}},before);}
   if(!map.getSource(ends))map.addSource(ends,{type:'geojson',data:edgeData});
   if(!map.getLayer(halo))map.addLayer({id:halo,type:'circle',source:ends,paint:{'circle-radius':13,'circle-color':colors[p.level],'circle-blur':.8,'circle-opacity':0}},before);
   if(!map.getLayer(ends))map.addLayer({id:ends,type:'circle',source:ends,paint:{'circle-radius':5,'circle-color':'#091b2b','circle-stroke-width':2,'circle-stroke-color':colors[p.level],'circle-opacity':0,'circle-stroke-opacity':0}},before);
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
   const mobile=mobilePresentation||(canvas.width<=767&&canvas.height>canvas.width);
   const covered=panel?(mobile?Math.max(0,canvas.bottom-panel.top):Math.max(0,panel.right-canvas.left)):0;
   const padding=map.getPadding();
   const offset:[number,number]=mobile?[0,-Math.max(0,covered-(padding.bottom??0))/2]:[Math.max(0,covered-(padding.left??0))/2,0];
   if(mobile&&canvas.height>canvas.width){
    const stage=map.getContainer().parentElement;
    const hintHeight=stage?.querySelector<HTMLElement>('.route-forecast-hint')?.offsetHeight||110;
    const controls=stage?.querySelector('.mobile-route-actions')?.getBoundingClientRect();
    const bottom=Math.min(panel?panel.top-canvas.top:canvas.height,controls?controls.top-canvas.top:canvas.height);
    const center=(canvas.height+(padding.top??0)-(padding.bottom??0))/2;
    // Leave room above the checkpoint for the hint, rather than pinning it over the point.
    const desired=Math.min(bottom-24,Math.max(center+offset[1],64+hintHeight+30));
    if(bottom-24>=64+hintHeight+30)offset[1]=desired-center;
   }
   // Mobile keeps a wider overview (50-mile scale); desktop retains its closer view.
   const scaleMiles=mobile?60:12;
   const overviewZoom=Math.log2(40075016.686*Math.cos(p.lat*Math.PI/180)*100/(512*scaleMiles*1609.344));
   map.flyTo({center:[p.lon,p.lat],zoom:Math.max(map.getMinZoom(),Math.min(map.getMaxZoom(),overviewZoom)),offset,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:1500});
  });});
  return()=>cancelAnimationFrame(frame);
 },[map,active,forecasts,selected,key,mobilePresentation]);
 const mobileRail=useRef<HTMLDivElement>(null);
 const railDrag=useRef<{id:number;x:number;y:number;left:number;lastX:number;lastTime:number;velocity:number;mouse:boolean;axis:'pending'|'x'|'y'}|null>(null);
 useEffect(()=>{
  if(!compactPresentation)return;
  const rail=mobileRail.current,frame=rail?.parentElement;if(!rail||!frame)return;
  let settle:ReturnType<typeof setTimeout>|undefined;
  const measure=()=>{const max=Math.max(0,rail.scrollWidth-rail.clientWidth),left=Math.max(0,Math.min(max,rail.scrollLeft));frame.classList.toggle('has-more-left',left>2);frame.classList.toggle('has-more-right',max-left>2);};
  const scroll=()=>{measure();frame.classList.add('is-scrolling');clearTimeout(settle);settle=setTimeout(()=>frame.classList.remove('is-scrolling'),160);};
  const initial=requestAnimationFrame(measure),observer=new ResizeObserver(measure);observer.observe(rail);rail.addEventListener('scroll',scroll,{passive:true});
  return()=>{cancelAnimationFrame(initial);clearTimeout(settle);observer.disconnect();rail.removeEventListener('scroll',scroll);frame.classList.remove('is-scrolling','has-more-left','has-more-right');};
 },[compactPresentation,displayedForecasts?.length,key]);
 const railSuppressClick=useRef(false);
 const railMomentum=useRef(0);
 const stopRailMomentum=()=>{cancelAnimationFrame(railMomentum.current);railMomentum.current=0;};
 useEffect(()=>()=>{cancelAnimationFrame(railMomentum.current);},[]);
 useEffect(()=>{cancelAnimationFrame(railMomentum.current);railMomentum.current=0;},[key,selectedIndex]);
 function coastRail(rail:HTMLDivElement,velocity:number){
  stopRailMomentum();if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  let last=performance.now(),v=Math.max(-2.5,Math.min(2.5,velocity));
  const tick=(now:number)=>{const dt=Math.min(32,now-last);last=now;const before=rail.scrollLeft;v*=Math.exp(-dt/220);rail.scrollLeft+=v*dt;if(Math.abs(v)>.025&&Math.abs(rail.scrollLeft-before)>.1)railMomentum.current=requestAnimationFrame(tick);else railMomentum.current=0;};
  if(Math.abs(v)>.05)railMomentum.current=requestAnimationFrame(tick);
 }

 const swipe=useRef<{id:number;x:number;y:number;axis:'pending'|'x'|'y'}|null>(null);
 const mobileIndex=Math.min(Math.max(0,selectedIndex),Math.max(0,(displayedForecasts?.length??1)-1));
 useEffect(()=>{
  if(!compactPresentation)return;
  const rail=mobileRail.current,button=rail?.querySelector<HTMLElement>(`[data-mobile-point="${mobileIndex}"]`);
  if(!rail||!button)return;
  const left=button.offsetLeft,right=left+button.offsetWidth;
  if(left<rail.scrollLeft||right>rail.scrollLeft+rail.clientWidth)rail.scrollTo({left:Math.max(0,left-(rail.clientWidth-button.offsetWidth)/2),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 },[compactPresentation,mobileIndex,displayedForecasts?.length]);
 const speed=(mph:number)=>`${Math.round(mph*(units==='us'?1:1.609344))} ${units==='us'?'mph':'km/h'}`;
 const time=(ms:number)=>new Date(ms).toLocaleString(locale,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
 return <section ref={sectionRef} className={`route-weather ${compactMobile?'is-mobile-compact':''} ${compactPresentation?'has-mobile-carousel':''} ${desktopPresentation?'has-desktop-carousel':''} ${desktopPresentation&&allSections?'is-all-sections':''} ${timingOpen?'is-timing-open':''}`} aria-label={t("Weather along your route")}>
 {!compactPresentation&&active&&map&&forecasts&&hintIndex>=0&&<RouteForecastHint key={`${key}:${hintIndex}`} map={map} units={units} point={forecasts[hintIndex]} index={hintIndex} onSelect={()=>jumpToCheckpoint(hintIndex)}/>}
 {compactPresentation&&map&&mobileHint&&displayedForecasts?.[mobileHint.index]&&<RouteForecastHint map={map} units={units} point={displayedForecasts[mobileHint.index]} index={mobileHint.index} distance={`${Math.round(displayedForecasts[mobileHint.index].fraction*route.distance/(units==='us'?1609.344:1000)).toLocaleString(locale)} ${units==='us'?'mi':'km'} ${t('from start')}`} compact={mobilePresentation} controlled={desktopPresentation} open={active&&!!forecasts&&mobileHint.open&&mobileHint.routeKey===route.key} onSelect={()=>setMobileHint(previous=>previous?{...previous,open:false}:null)}/>}
 <div dir={dir} className="route-weather-title"><strong>{t("Weather ahead")}</strong><span>{t("At estimated arrival")}</span></div>
 <button type="button" dir={dir} className="route-timing-toggle" aria-label={t("Change departure")} aria-expanded={timingOpen&&(!compactMobile||compactPresentation)} onClick={()=>{if(!compactPresentation)onExpand?.();setTimingOpen(v=>compactPresentation?!v:compactMobile||!v);}}><span className="route-departure-icon"><Clock3 size={18} aria-hidden="true"/></span><span className="route-departure-copy"><strong>{t("Change departure")}</strong><small>{departure?time(depart):t("Leave now · your local time")}{stops?' · '+stops+' '+t('min breaks'):''}</small></span><ChevronDown className="route-departure-chevron" size={16} aria-hidden="true"/></button><div className={`route-options-collapse ${timingOpen&&(!compactMobile||compactPresentation)?'is-expanded':''}`} inert={!timingOpen||(compactMobile&&!compactPresentation)}><div><div dir={dir} className="route-timing"><DeparturePicker value={departure} onChange={value=>{setDeparture(value);setNow(Date.now());setTimingOpen(false);}}/><label>{t("Planned breaks · minutes")}<input aria-label={t("Planned break minutes")} type="number" min="0" max="4320" step="30" value={stops} onChange={e=>setStops(Number(e.target.value))}/></label></div>
</div></div>
 {!compactPresentation&&!valid&&<p role="alert">{t("Choose a departure within six days and valid break minutes.")}</p>}
 {compactPresentation&&<div className="route-mobile-carousel" aria-label={t("Route checkpoint forecast")} inert={timingOpen||(desktopPresentation&&allSections)} aria-hidden={timingOpen||(desktopPresentation&&allSections)}>
 <div dir={dir} className="mobile-forecast-status" role="status">{valid&&!error&&forecasts?<span className="mobile-route-totals"><strong>{Math.round(route.distance/(units==='us'?1609.344:1000))} {units==='us'?'mi':'km'}</strong><span aria-hidden="true">·</span><strong>{Math.floor(route.duration/3600)}h {Math.round(route.duration/60)%60}m</strong><small>{mobileIndex+1} / {forecasts.length}</small></span>:<span title={error?t(error):undefined}>{!valid?t("Check departure and breaks"):error?(result?t("Saved forecast · update unavailable"):t(error)):t("Checking route weather…")}</span>}{error&&<button type="button" onClick={()=>retry(n=>n+1)}>{t("Retry")}</button>}</div>
 <div className="mobile-forecast-viewport" tabIndex={forecasts?0:-1} role="region" aria-label={t("Swipe left or right to change checkpoint")} aria-busy={!forecasts}
 onKeyDown={e=>{if(!forecasts)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();selectCheckpoint(Math.max(0,Math.min(forecasts.length-1,mobileIndex+(e.key==='ArrowRight'?1:-1))));}}}
 onPointerDown={e=>{e.stopPropagation();if(!forecasts||e.button!==0)return;swipe.current={id:e.pointerId,x:e.clientX,y:e.clientY,axis:'pending'};e.currentTarget.setPointerCapture(e.pointerId);}}
 onPointerMove={e=>{e.stopPropagation();const g=swipe.current;if(!g||g.id!==e.pointerId)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(g.axis==='pending'&&Math.hypot(dx,dy)>10)g.axis=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';}}
 onPointerUp={e=>{e.stopPropagation();const g=swipe.current;swipe.current=null;if(!g||g.id!==e.pointerId||g.axis!=='x'||!forecasts)return;const dx=e.clientX-g.x;if(Math.abs(dx)>=35)selectCheckpoint(Math.max(0,Math.min(forecasts.length-1,mobileIndex+(dx<0?1:-1))));}}
 onPointerCancel={()=>{swipe.current=null;}} onLostPointerCapture={()=>{swipe.current=null;}} onTouchStart={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()}>
 {!displayedForecasts&&<div dir={dir} className="mobile-forecast-placeholder">{!valid?t("Update departure time in Change departure"):error?t("Forecast unavailable"):t("Loading your route forecast…")}</div>}
 {displayedForecasts?.map((p,i)=>{const {kind,label}=forecastCondition(p),current=i===mobileIndex;return <article dir={dir} key={i} className={`mobile-forecast-card ${current?'is-current':''} ${!forecasts?'is-refreshing':''}`} style={{borderLeftColor:colors[p.level],transform:`translateX(${i<mobileIndex?-12:i>mobileIndex?12:0}px)`}} aria-hidden={!current} inert={!current||!forecasts}>
 <div className="mobile-forecast-place"><WeatherSymbol kind={kind} size={32}/><div><strong title={p.place||t("Location unavailable")}>{p.place||t("Location unavailable")}</strong><span className="mobile-forecast-arrival"><small>{t("Arrival")}</small><time className="mobile-arrival-date" dateTime={new Date(p.eta).toISOString()}>{new Date(p.eta).toLocaleDateString(locale,{month:'short',day:'numeric'})}</time><time className="mobile-arrival-time" dateTime={new Date(p.eta).toISOString()}>{new Date(p.eta).toLocaleTimeString(locale,{hour:'numeric',minute:'2-digit'})}</time><small>{t("your time")}</small></span></div><b>{p.available&&p.temperatureC!=null?`${temperature(p.temperatureC,units)}°${units==='us'?'F':'C'}`:'—'}</b></div>
 <div className="mobile-forecast-condition" title={p.condition}>{t(label)}</div>
 <div className="mobile-forecast-wind"><span className="mobile-forecast-wind-reading"><Wind size={14} aria-hidden="true"/><span>{p.available&&p.windMph!=null?speed(p.windMph)+' · '+p.windDirection:t("Wind unavailable")}</span></span><span>{p.available&&p.precipProbability!=null?`${p.precipProbability}% ${t('precip.')}`:t("Precip. —")}</span></div>
 </article>;})}
 </div>
 <div dir="ltr" className="mobile-checkpoint-rail-frame">{desktopPresentation&&<button type="button" className="desktop-rail-arrow previous" aria-label={t("Previous checkpoint")} disabled={!forecasts||mobileIndex===0} onClick={()=>selectCheckpoint(mobileIndex-1,true)}>‹</button>}<div ref={mobileRail} className="mobile-checkpoint-rail" role="group" aria-label={t("Choose any route checkpoint")}
 onPointerDown={e=>{e.stopPropagation();stopRailMomentum();railSuppressClick.current=false;if(e.button!==0)return;railDrag.current={id:e.pointerId,x:e.clientX,y:e.clientY,left:e.currentTarget.scrollLeft,lastX:e.clientX,lastTime:performance.now(),velocity:0,mouse:e.pointerType==='mouse',axis:'pending'};}}
 onPointerMove={e=>{e.stopPropagation();const g=railDrag.current;if(!g||g.id!==e.pointerId)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(g.axis==='pending'&&Math.hypot(dx,dy)>8)g.axis=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';if(g.axis!=='x')return;railSuppressClick.current=true;if(!g.mouse)return;e.preventDefault();if(!e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.setPointerCapture(e.pointerId);const now=performance.now(),dt=now-g.lastTime;if(dt>0){g.velocity=g.velocity*.25+((g.lastX-e.clientX)/Math.max(8,dt))*.75;g.lastX=e.clientX;g.lastTime=now;}e.currentTarget.scrollLeft=g.left-dx;}}
 onPointerUp={e=>{e.stopPropagation();const g=railDrag.current;railDrag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(g&&g.id===e.pointerId&&g.mouse&&g.axis==='x'&&performance.now()-g.lastTime<100)coastRail(e.currentTarget,g.velocity);}}
 onPointerCancel={e=>{e.stopPropagation();railDrag.current=null;}} onLostPointerCapture={()=>{railDrag.current=null;}}
 onClickCapture={e=>{if(railSuppressClick.current){railSuppressClick.current=false;if(e.detail>0){e.preventDefault();e.stopPropagation();}}}}
 onDragStart={e=>e.preventDefault()} onWheel={e=>{stopRailMomentum();e.stopPropagation();}} onTouchStart={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()}>
 {(displayedForecasts??points.map(p=>({...p,level:'unknown' as const,place:''}))).map((p,i)=><button type="button" key={i} data-mobile-point={i} disabled={!forecasts} aria-pressed={i===mobileIndex} aria-label={`${t('Checkpoint')} ${i+1}${p.place?': '+p.place:''}`} onClick={()=>selectCheckpoint(i,true)}><i style={{background:colors[p.level]}}/>{i+1}</button>)}
 </div>{desktopPresentation&&<button type="button" className="desktop-rail-arrow next" aria-label={t("Next checkpoint")} disabled={!forecasts||mobileIndex>=(forecasts.length-1)} onClick={()=>selectCheckpoint(mobileIndex+1,true)}>›</button>}</div></div>}
 {desktopPresentation&&<div dir={dir} className="desktop-forecast-tools" inert={timingOpen} aria-hidden={timingOpen}><button type="button" aria-pressed={!allSections} onClick={()=>setAllSections(false)}>{t("All")}</button><button type="button" disabled={!forecasts||!warningIndices.length} onClick={()=>{setAllSections(false);nextWarning();}}>{t("Next warning →")}</button><button type="button" aria-expanded={allSections} onClick={()=>{setWarningFilter(null);setAllSections(v=>!v);}}>{t("All sections")}</button></div>}
 <button type="button" dir={dir} className="route-mobile-brief" onClick={onExpand} aria-label={t("Show route forecast details")}><span>{error?t("Forecast needs attention"):!forecasts?t("Checking route weather…"):warningIndices.length?`${warningIndices.length} ${t('checkpoints need attention')}`:forecasts.some(p=>!p.available)?t("Some forecasts unavailable"):t("Lower concern at sampled points")}</span><strong>{t("Details →")}</strong></button>
 <div dir={dir} className="route-forecast-details" inert={desktopPresentation?(!allSections||timingOpen):compactMobile||compactPresentation} aria-hidden={desktopPresentation?(!allSections||timingOpen):compactMobile||compactPresentation}><div>
 <div className="route-weather-legend"><span style={{color:colors.low}}><CheckCircle2 aria-hidden="true"/>{t("Lower concern")}</span><span style={{color:colors.caution}}><TriangleAlert aria-hidden="true"/>{t("Caution")}</span><span style={{color:colors.high}}><CircleAlert aria-hidden="true"/>{t("Higher concern")}</span><span style={{color:colors.unknown}}><CircleDashed aria-hidden="true"/>{t("No data")}</span></div>
 <p className="forecast-refresh-status" role="status">{!valid?t("Choose a valid departure to update the forecast"):error&&result?t("Previous forecast · update unavailable"):loading||(!forecasts&&result)?t("Checking forecast along your route…"):''}</p>
 {error&&<p role="alert">{t(error)} <button onClick={()=>retry(n=>n+1)}>{t("Retry")}</button></p>}
 {displayedForecasts&&<div className={`forecast-results ${!forecasts?'is-refreshing':''}`} aria-busy={!forecasts} inert={!forecasts}>
 <div dir="ltr" className="forecast-overview" role="group" aria-label={t("Jump to a route checkpoint")}>{displayedForecasts.map((p,i)=><button key={i} className="forecast-stop" aria-pressed={selected?.key===key&&selected.index===i} aria-label={`${t('Checkpoint')} ${i+1}: ${p.place||t("Location unavailable")}, ${p.level==='high'?t("higher concern"):p.level==='caution'?t("caution"):p.level==='unknown'?t("no forecast"):t("lower concern")}`} title={`${i+1} · ${p.place||t("Location unavailable")} · ${t(forecastCondition(p).label)}`} onClick={()=>jumpToCheckpoint(i)}><span style={{background:colors[p.level]}}/>{i+1}</button>)}</div>
 <div className="forecast-tools" role="group" aria-label={t("Filter route forecasts")}><button aria-pressed={!warningsOnly} onClick={()=>setWarningFilter(null)}>{t('All')} {displayedForecasts.length}</button><button disabled={!warningIndices.length} onClick={nextWarning}>{t("Next warning →")}</button></div>
 <div ref={cardsRef} className="route-weather-cards forecast-stack" tabIndex={0} role="region" aria-label={t("Route forecast checkpoints")} onWheel={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()}>
 {displayedForecasts.map((p,i)=>{if(warningsOnly&&!warningIndices.includes(i))return null;const {kind,label}=forecastCondition(p),opened=selectedIndex===i;return <button type="button" className={`route-weather-card forecast-stack-card${opened?' is-selected':''}`} data-checkpoint={i} key={i} aria-expanded={opened} style={{borderLeftColor:colors[p.level]}} onClick={()=>selectCheckpoint(i)}>
 <span className="forecast-stage">{i+1} / {displayedForecasts.length} · {i===0?t("Departure"):i===displayedForecasts.length-1?t("Arrival"):p.level==='high'?t("Higher concern"):p.level==='caution'?t("Caution"):p.level==='unknown'?t("No data"):t("Along the route")}</span>
 <span className="forecast-place">{p.place?t('Near')+' '+p.place:t("Location unavailable")}</span>
 <span className="forecast-summary"><WeatherSymbol kind={kind} size={20}/><strong>{t(label)}</strong><span aria-hidden="true">{opened?'⌄':'›'}</span></span>
 <span className="forecast-meta">{Math.round(p.fraction*route.distance/(units==='us'?1609.344:1000)).toLocaleString(locale)} {units==='us'?'mi':'km'} · <time dateTime={new Date(p.eta).toISOString()}>{new Date(p.eta).toLocaleTimeString(locale,{hour:'numeric',minute:'2-digit'})}</time> · {new Date(p.eta).toLocaleDateString(locale,{month:'short',day:'numeric'})}</span>
 {opened&&<span className="forecast-expanded-details"><span>{p.available&&p.precipProbability!=null?`${p.precipProbability}% ${t('precipitation chance')}`:t("Precipitation chance unavailable")}</span><span><Wind size={16} aria-hidden="true"/> {p.available&&p.windMph!=null?speed(p.windMph):t("Wind unavailable")} {p.windDirection}</span><span>{p.available&&p.gustMph!=null?t('Gusts')+' '+speed(p.gustMph):t("Gust data unavailable")}</span>{concern(p)&&<strong style={{color:colors[p.level]}}>{t(concern(p)??'')}</strong>}<span>{p.condition}{p.available&&p.temperatureC!=null?` · ${temperature(p.temperatureC,units)}°${units==='us'?'F':'C'}`:''}</span><span className="forecast-map-link">{t("Show this section on map ↗")}</span></span>}
 </button>;})}
 {warningsOnly&&!warningIndices.length&&<p className="forecast-empty" role="status">{t("No caution or higher-concern checkpoints in this forecast. Missing forecasts remain under All.")}</p>}
 </div>
 <p className="forecast-count" aria-live="polite">{warningsOnly?warningIndices.length:displayedForecasts.length} {t('checkpoints shown')} · {displayedForecasts.filter(p=>!p.available).length} {t('unavailable')} · {t('Local times')}</p></div>}

 <button className="route-about-toggle" aria-expanded={infoOpen} onClick={()=>setInfoOpen(v=>!v)}>{t("About this forecast")}</button><div className={`route-options-collapse ${infoOpen?'is-expanded':''}`} inert={!infoOpen}><div><p className="route-weather-note">{t("NOAA/NWS hourly forecast at sampled locations. Between-point colors are approximate. Arrival uses estimated road travel times; breaks are spread across the trip. Selected sections represent nearby forecast samples, not exact hazard boundaries. Wind is forecast sustained speed; gusts are shown only when supplied. Concern colors are not truck rollover thresholds. No live traffic, hours-of-service calculation or road-closure verification.")}</p></div></div>
 <a href="https://www.weather.gov/" target="_blank" rel="noreferrer">{t("NOAA / National Weather Service")}</a>
 </div></div>
 </section>;
}
