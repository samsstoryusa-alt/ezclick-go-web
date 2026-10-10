"use client";
import {useEffect,useEffectEvent,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Route,SlidersHorizontal,CloudSun,Undo2,X} from 'lucide-react';
import type {Map as MapLibre} from 'maplibre-gl';
import './weather-route.css';
import {useRoadRoute,DEFAULT_TRUCK,validTruck} from './road-route';
import {useWeatherLanguage} from './weather-language';
import {useWeatherUnits} from './weather-units';
import RouteWeather from './route-weather';
import RouteNavigator from './route-navigator';
import RoutePlaceSearch from './route-place-search';
import type {SearchPlace} from './route-search-data';
import {formatRouteDuration} from './route-duration';
import {readTrip,saveTrip,standaloneWeather,defaultTripPoints,savePointLabel,departureZone} from './weather-trip-storage';
import {useWeatherVehicle} from './weather-vehicle';
import {startPointDrag,movePointDrag,type PointDrag} from './route-point-drag';
import {roadRouteKey,insertRouteVia,MAX_VIA_POINTS} from './route-waypoints';
import RouteViaPoints from './route-via-points';
type Point=[number,number];
type Pair=[Point|null,Point|null];
type RouteEditSnapshot={points:Pair;via:Point[]};
export function WeatherRoute({map,active,citiesOnly=false,onClose,onClear,compactMobile=false,onExpand,mobilePresentation=false,onShowInfo,resumeRequest=0}:{map:MapLibre|null;active:boolean;citiesOnly?:boolean;onClose:()=>void;onClear:()=>void;compactMobile?:boolean;onExpand?:()=>void;mobilePresentation?:boolean;onShowInfo?:()=>void;resumeRequest?:number}){
 const {t}=useWeatherLanguage();
 const desktopPresentation=!mobilePresentation&&standaloneWeather();
 const [restored]=useState(readTrip);
 const [points,setPoints]=useState<Pair>(()=>restored?.points??(typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('demo')==='nashville-jacksonville'?[[-86.7816,36.1627],[-81.6557,30.3322]]:defaultTripPoints())),[selected,select]=useState<number|null>(null),[editing,edit]=useState<number|null>(null),[dragging,setDragging]=useState<number|null>(null);
 const routeHistory=useRef<RouteEditSnapshot[]>([]);
 const [historySize,setHistorySize]=useState(0);
 const [pointsOpen,setPointsOpen]=useState(false);
 const [via,setVia]=useState<Point[]>(()=>restored?.via??[]);
 const [viaError,setViaError]=useState('');
 const [mobileStep,setMobileStep]=useState<0|1|null>(null);
 const [mobileEditing,setMobileEditing]=useState(false);
 const [mobileChoices,setMobileChoices]=useState(false);
 const [autoBuildPoints,setAutoBuildPoints]=useState<string|null>(null);
 const autoBuildStarted=useRef<string|null>(null);
 const [autoWaiting,setAutoWaiting]=useState(false);
 const [autoAttempt,setAutoAttempt]=useState(0);
 const [routeSettings,setRouteSettings]=useState(false);
 const [removing,setRemoving]=useState<number|null>(null),[closing,setClosing]=useState(false);
 const motionTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const current=useRef(points);
 useLayoutEffect(()=>{current.current=points;},[points]);
 const gesture=useRef<PointDrag|null>(null);
 const dragPreview=useRef<Pair|null>(null);
 const suppress=useRef(false);
 const stage=map?.getContainer().parentElement;
 const pinElements=useRef<Array<HTMLButtonElement|null>>([]);
 useLayoutEffect(()=>{
  if(!map||!stage||!active)return;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const displayed:Array<{x:number;y:number}|undefined>=[];
  let lastFrame=performance.now();
  const position=()=>{
   const now=performance.now(),blend=1-Math.exp(-Math.max(1,now-lastFrame)/45);lastFrame=now;
   let settling=false;
   const box=map.getContainer().getBoundingClientRect(),parent=stage.getBoundingClientRect();
   const size=mobilePresentation?22:18+8*Math.max(0,Math.min(1,(map.getZoom()-3)/8));
   (dragPreview.current??current.current).forEach((point,i)=>{
    const el=pinElements.current[i];if(!el||!point)return;
    const p=map.project(point);
    const target={x:box.left-parent.left+p.x-24,y:box.top-parent.top+p.y-24};
    const previous=displayed[i];
    let x=target.x,y=target.y;
    if(mobilePresentation&&!gesture.current?.armed&&!motion.matches&&previous){
     const dx=(previous.x-x)*(1-blend),dy=(previous.y-y)*(1-blend);
     const distance=Math.hypot(dx,dy),limit=Math.min(1,3/Math.max(distance,0.001));
     if(distance>0.1){x+=dx*limit;y+=dy*limit;settling=true;}
    }
    displayed[i]={x,y};
    el.style.transform=`translate3d(${x}px,${y}px,0)`;
    el.style.setProperty('--route-pin-scale',String(size/26));
   });
   if(settling)map.triggerRepaint();
  };
  position();map.on('render',position);map.on('resize',position);
  return()=>{map.off('render',position);map.off('resize',position);};
 },[map,stage,active,mobilePresentation,points]);
 useEffect(()=>{if(!map)return;const close=()=>select(null);map.on('click',close);return()=>{map.off('click',close);};},[map]);
 const cancel=()=>{
  const g=gesture.current;if(g){clearTimeout(g.timer);suppress.current=g.moved||g.cancelled;}
  gesture.current=null;dragPreview.current=null;setDragging(null);map?.triggerRepaint();
 };
 useEffect(()=>{
  if(!active)return;
  // Tear down an external pointer gesture when the route panel is deactivated.
  return()=>{const g=gesture.current;if(g)clearTimeout(g.timer);gesture.current=null;dragPreview.current=null;setDragging(null);select(null);edit(null);};
 },[active]);
 useEffect(()=>()=>{if(gesture.current)clearTimeout(gesture.current.timer);if(motionTimer.current)clearTimeout(motionTimer.current);},[]);
 function rememberRoute(next:Pair,nextVia:Point[]){
  const before={points:current.current,via};
  if(JSON.stringify(before)===JSON.stringify({points:next,via:nextVia}))return;
  // Keep coordinates independent of drag previews; weather/time preferences stay unchanged.
  routeHistory.current=[...routeHistory.current.slice(-19),structuredClone(before)];
  setHistorySize(routeHistory.current.length);
 }
 function change(next:Pair,nextVia:Point[]=via){rememberRoute(next,nextVia);setPointsOpen(false);setPoints(next);setVia(nextVia);select(null);edit(null);}
 function place(){if(!map||selected!==null)return;const i=editing??(!points[0]?0:1),c=map.getCenter();const next=[...points] as Pair;next[i]=[c.lng,c.lat];change(next);}
 function remove(i:number){if(removing!==null)return;setRemoving(i);motionTimer.current=setTimeout(()=>{const next=[...current.current] as Pair;next[i]=null;change(next);setRemoving(null);},matchMedia('(prefers-reduced-motion: reduce)').matches?0:200);}
 function close(){if(mobilePresentation){onClose();return;}setClosing(true);motionTimer.current=setTimeout(()=>{onClose();setClosing(false);},matchMedia('(prefers-reduced-motion: reduce)').matches?0:450);}
 function reposition(i:number){select(null);edit(i);if(points[i])map?.easeTo({center:points[i]!,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:450});}
 const labels=['A','B'];
 const truck=DEFAULT_TRUCK;
 const truckConfirmed=true;
 const {vehicle,setVehicle}=useWeatherVehicle();
 const {route,busy,error,build,cancelBuild,hasPrevious}=useRoadRoute(map,active,points,truck,vehicle,via);
 const voiceBuild=useRef<{turn:string;key:string;finished:boolean}|null>(null);
 const [voiceRevision,setVoiceRevision]=useState(0);
 const [voiceFocusRoute,setVoiceFocusRoute]=useState<typeof route>(null);
 function voiceResult(turn:string,status:'submitted'|'succeeded'|'failed'|'cancelled',message:string){window.dispatchEvent(new CustomEvent('weather-voice-result',{detail:{turn,status,message}}));}
 const restoredBuild=useRef(false);
 const handledResume=useRef(0);
 const [previousVehicle,setPreviousVehicle]=useState(vehicle);
 if(previousVehicle!==vehicle){
  setPreviousVehicle(vehicle);setAutoAttempt(n=>n+1);
  if(active&&!citiesOnly&&points[0]&&points[1]){setAutoBuildPoints(JSON.stringify(points));setAutoWaiting(true);}else{setAutoWaiting(false);}
 }
 const tripKey=roadRouteKey(points,truck,vehicle,via);
 const pointsKey=JSON.stringify(points);
 const latestBuild=useEffectEvent(()=>{setAutoWaiting(false);const voice=voiceBuild.current;void build().finally(()=>{if(voice&&voiceBuild.current===voice){voice.finished=true;setVoiceRevision(n=>n+1);}});});
 useEffect(()=>{
  const voice=voiceBuild.current;if(!voice)return;
  if(voice.key!==tripKey||!active){voiceBuild.current=null;voiceResult(voice.turn,'cancelled',t('The route changed. Please repeat your request.'));return;}
  if(!voice.finished||busy)return;
  voiceBuild.current=null;
  if(route&&!error)setVoiceFocusRoute(route);
  voiceResult(voice.turn,route&&!error?'succeeded':'failed',error||t(route?'Your route is ready.':'Could not build route. Please try again.'));
 },[tripKey,active,voiceRevision,busy,error,route,t]);
 const cancelVoice=useEffectEvent((event:Event)=>{
  const id=(event as CustomEvent).detail?.turn,voice=voiceBuild.current;
  if(!voice||id!==voice.turn)return;
  voiceBuild.current=null;cancelBuild();setAutoBuildPoints(null);setAutoWaiting(false);autoBuildStarted.current=null;
  voiceResult(voice.turn,'cancelled',t('Voice request cancelled.'));
 });
 useEffect(()=>{const receive=(event:Event)=>cancelVoice(event);window.addEventListener('weather-voice-cancel',receive);return()=>window.removeEventListener('weather-voice-cancel',receive);},[]);
 useEffect(()=>{
  if(!active||citiesOnly||!map||!autoBuildPoints||autoBuildPoints!==pointsKey||!truckConfirmed||!validTruck(truck)||!points[0]||!points[1])return;
  const requestKey=autoBuildPoints+tripKey+autoAttempt;
  if(autoBuildStarted.current===requestKey)return;
  const timer=setTimeout(()=>{autoBuildStarted.current=requestKey;latestBuild();},1150);
  return()=>clearTimeout(timer);
 },[mobilePresentation,active,citiesOnly,map,autoBuildPoints,pointsKey,tripKey,truckConfirmed,truck,points,autoAttempt]);
 const mobilePlacementIndex=mobileStep??(!points[0]?0:!points[1]?1:0);
 function chooseMobilePoint(index:0|1){if(busy||autoWaiting)return;setMobileChoices(true);setMobileStep(index);setMobileEditing(true);select(null);edit(null);onShowInfo?.();}
 function setMobilePoint(){
  if(!map)return;
  const marker=stage?.querySelector<HTMLElement>('.weather-center-dot');if(!marker)return;
  const m=marker.getBoundingClientRect(),canvas=map.getContainer().getBoundingClientRect();
  const c=map.unproject([m.left+m.width/2-canvas.left,m.top+m.height/2-canvas.top]);
  const index=mobilePlacementIndex;
  const next:Pair=[...points];next[index]=[c.lng,c.lat];
  change(next);setMobileChoices(false);onShowInfo?.();
  if(next[0]&&next[1]){setMobileStep(null);setMobileEditing(false);autoBuildStarted.current=null;setAutoBuildPoints(JSON.stringify(next));setAutoWaiting(true);}
  else{setMobileStep(next[0]?1:0);setMobileEditing(false);setAutoBuildPoints(null);setAutoWaiting(false);}
 }
 function finishPointDrag(pointerId:number){
  const g=gesture.current;if(!g||g.id!==pointerId)return;
  clearTimeout(g.timer);const next=dragPreview.current;
  suppress.current=g.moved||g.cancelled||(g.armed&&!!g.timer);
  gesture.current=null;dragPreview.current=null;setDragging(null);
  if(g.moved&&!g.cancelled&&next){
   change(next);current.current=next;setMobileChoices(false);setMobileEditing(false);setRouteSettings(false);
   if(next[0]&&next[1]){setMobileStep(null);autoBuildStarted.current=null;setAutoBuildPoints(JSON.stringify(next));setAutoWaiting(true);}
   else{setMobileStep(next[0]?1:0);setAutoBuildPoints(null);setAutoWaiting(false);}
   onShowInfo?.();
  }
  map?.triggerRepaint();
 }
 function chooseSearchPlace(index:0|1,place:SearchPlace){
  const next:Pair=[...current.current];next[index]=place.point;
  change(next);setMobileChoices(false);setMobileEditing(false);setRouteSettings(false);if(next[0]&&next[1])onShowInfo?.();
  map?.easeTo({center:place.point,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:600});
  if(next[0]&&next[1]){setMobileStep(null);autoBuildStarted.current=null;setAutoBuildPoints(JSON.stringify(next));setAutoWaiting(true);}
  else{setMobileStep(next[0]?1:0);setAutoBuildPoints(null);setAutoWaiting(false);}
 }
 function changeVia(next:Point[]){
  rememberRoute(current.current,next);
  setVia(next);setViaError('');setVoiceFocusRoute(null);
  autoBuildStarted.current=null;setAutoBuildPoints(JSON.stringify(points));setAutoWaiting(true);setAutoAttempt(n=>n+1);
  onShowInfo?.();
 }
 function dragVia(point:Point,from:Point,index?:number){
  if(busy||autoWaiting||!route)return;
  try{const next=index===undefined?insertRouteVia(via,point,from,route.coordinates):via.map((p,i)=>i===index?point:p);changeVia(next);}
  catch(e){setViaError(e instanceof Error?e.message:'Could not add intermediate point.');}
 }
 const acceptVoice=useEffectEvent((trip:import('./voice-route-confirm').VoiceTrip)=>{
  if(busy||!map){if(trip.turn)voiceResult(trip.turn,'failed',t(busy?'A route is already being calculated. Please try again.':'The map is not ready. Please try again.'));return;}
  const nextVehicle=trip.vehicle??vehicle;
  setVoiceFocusRoute(null);
  if(nextVehicle!==vehicle)setVehicle(nextVehicle);
  const next:Pair=[trip.origin.point,trip.destination.point];
  const sameEndpoints=JSON.stringify(next)===JSON.stringify(points);
  const nextVia=trip.via?.map(p=>p.point)??(sameEndpoints?via:[]);
  if(nextVia.length>MAX_VIA_POINTS){if(trip.turn)voiceResult(trip.turn,'failed',t('You can add up to five intermediate points.'));return;}
  if(voiceBuild.current)voiceResult(voiceBuild.current.turn,'cancelled',t('A newer route request replaced this request.'));
  voiceBuild.current=trip.turn?{turn:trip.turn,key:roadRouteKey(next,truck,nextVehicle,nextVia),finished:false}:null;
  savePointLabel(trip.origin.point,trip.origin.label);savePointLabel(trip.destination.point,trip.destination.label);
  for(const place of trip.via??[])savePointLabel(place.point,place.label);
  setViaError('');
  saveTrip({departure:trip.departure,departureZone:departureZone()});
  window.dispatchEvent(new Event('weather-voice-departure'));
  restoredBuild.current=true;change(next,nextVia);setMobileChoices(false);setMobileEditing(false);setRouteSettings(false);setMobileStep(null);
  autoBuildStarted.current=null;setAutoBuildPoints(JSON.stringify(next));setAutoWaiting(true);onShowInfo?.();
  if(trip.turn)voiceResult(trip.turn,'submitted',t('Calculating your route…'));
 });
 useEffect(()=>{const receive=(event:Event)=>acceptVoice((event as CustomEvent<import('./voice-route-confirm').VoiceTrip>).detail);window.addEventListener('weather-voice-trip',receive);return()=>window.removeEventListener('weather-voice-trip',receive);},[]);
 const voiceMapCommand=useEffectEvent((event:Event)=>{
  const {action,reply,translate=t}=(event as CustomEvent).detail;
  if(action==='clear_route'){
   clearRoute();reply(translate('Route cleared.'));
  }
  if(action==='show_route'){
   if(!map||!route||busy){reply(translate('Build a route first.'));return;}
   const bounds=route.coordinates.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);
   map.fitBounds([[bounds[0],bounds[1]],[bounds[2],bounds[3]]],{padding:{top:90,bottom:280,left:45,right:45},duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:800});reply(translate('Showing the full route.'));
  }
 });
 useEffect(()=>{const receive=(event:Event)=>voiceMapCommand(event);window.addEventListener('voice-map-action',receive);return()=>window.removeEventListener('voice-map-action',receive);},[]);
 function clearMobileRoute(){
  if(mobileEditing&&mobileStep!==null){setMobileStep(null);setMobileEditing(false);setMobileChoices(false);return;}
  clearRoute();
 }
 function clearRoute(){
  rememberRoute([null,null],[]);
  cancelBuild();
  setAutoBuildPoints(null);setAutoWaiting(false);autoBuildStarted.current=null;restoredBuild.current=true;
  setPoints([null,null]);setVia([]);setViaError('');select(null);edit(null);setPointsOpen(false);
  setMobileChoices(false);setMobileEditing(false);setMobileStep(0);setRouteSettings(false);onClear();
  saveTrip({points:[null,null],via:[],builtKey:null});
 }
 function undoRoute(){
  const previous=routeHistory.current.pop();if(!previous)return;
  setHistorySize(routeHistory.current.length);
  cancelBuild();cancel();
  if(motionTimer.current){clearTimeout(motionTimer.current);motionTimer.current=null;}
  if(voiceBuild.current){voiceResult(voiceBuild.current.turn,'cancelled',t('The route changed. Please repeat your request.'));voiceBuild.current=null;}
  current.current=previous.points;setPoints(previous.points);setVia(previous.via);setViaError('');setVoiceFocusRoute(null);
  select(null);edit(null);setRemoving(null);setClosing(false);setPointsOpen(false);setMobileChoices(false);setMobileEditing(false);setRouteSettings(false);
  const complete=!!previous.points[0]&&!!previous.points[1];
  setMobileStep(complete?null:previous.points[0]?1:0);
  restoredBuild.current=true;autoBuildStarted.current=null;
  setAutoBuildPoints(complete?JSON.stringify(previous.points):null);setAutoWaiting(complete);setAutoAttempt(n=>n+1);
  onShowInfo?.();
 }
 function deleteMobilePoint(){
  if(mobileStep===null||!points[mobileStep]||busy)return;
  const index=mobileStep,next:Pair=[...points];next[index]=null;
  change(next);
  setAutoBuildPoints(null);setAutoWaiting(false);autoBuildStarted.current=null;
  setMobileEditing(false);setMobileStep(index);setMobileChoices(false);onShowInfo?.();
 }
 function retryMobileRoute(){setAutoBuildPoints(pointsKey);setAutoWaiting(true);autoBuildStarted.current=null;setAutoAttempt(n=>n+1);}
 const mobileComplete=!!route||(autoBuildPoints===pointsKey&&!!points[0]&&!!points[1]);
 const mobilePlacing=mobilePresentation&&(mobileStep!==null||!route);
 const mobileNeedsTruck=mobilePresentation&&autoBuildPoints===pointsKey&&!!points[0]&&!!points[1]&&(!truckConfirmed||!validTruck(truck));
 const mobileInitialStage=mobilePresentation&&!route&&!busy&&!autoWaiting&&!mobileEditing&&!mobileNeedsTruck&&!error;
 useEffect(()=>{if(!resumeRequest||handledResume.current===resumeRequest||!map||!active||citiesOnly||!points[0]||!points[1])return;handledResume.current=resumeRequest;restoredBuild.current=true;setMobileStep(null);setMobileEditing(false);setMobileChoices(false);if(!route&&!busy)void build();},[resumeRequest,map,active,citiesOnly,points,route,busy,build]);
 useEffect(()=>{
  if(!map||!active||citiesOnly||restoredBuild.current)return;
  restoredBuild.current=true;
  if((restored?.builtKey||new URLSearchParams(window.location.search).get('demo')==='nashville-jacksonville')&&truckConfirmed)void build();
 },[map,active,citiesOnly,tripKey,truckConfirmed,build,restored]);
 useEffect(()=>{
  if(dragging!==null)return;
  saveTrip({points,via,truck,vehicle,confirmed:truckConfirmed,builtKey:route?.key??(restored?.builtKey===tripKey&&truckConfirmed?tripKey:null)});
 },[points,via,truck,vehicle,truckConfirmed,route,tripKey,dragging,restored]);
 const {units}=useWeatherUnits();

 return <>
 <RouteViaPoints map={map} route={route} via={via} active={active&&!busy&&!autoWaiting} onMove={dragVia}/>
 {stage&&active&&via.length>0&&createPortal(<div className="route-via-list" aria-label="Intermediate route points">{via.map((p,i)=><button key={i} disabled={busy||autoWaiting} title="Remove intermediate point" onClick={()=>changeVia(via.filter((_,n)=>n!==i))}>Via {i+1} · {readTrip()?.pointLabels?.[`${p[0]},${p[1]}`]?.split(',')[0]??`${p[1].toFixed(2)}, ${p[0].toFixed(2)}`} <span aria-hidden="true">×</span></button>)}</div>,stage)}
 <div className={`route-sheet ${citiesOnly?'route-cities-only':''} ${active?'is-open':''} ${closing?'is-closing':''} ${route?'has-route':''} ${mobilePresentation?'mobile-route-workflow':''} ${desktopPresentation?'desktop-route-workflow':''} ${mobilePlacing?'mobile-point-stage':''} ${mobileNeedsTruck?'mobile-truck-stage':''} ${mobileInitialStage?'mobile-initial-stage':''} ${route&&!routeSettings&&selected===null&&editing===null&&!pointsOpen?'route-summary-view':''}`} aria-hidden={!active} inert={!active}>
  <div className="mobile-route-status" role="status">{mobileNeedsTruck?t('Check your truck settings before calculating.'):busy||autoWaiting&&autoBuildPoints===pointsKey?t('Calculating your route…'):error?error:mobilePlacementIndex===1?t('Move the map · tap Set B to confirm'):t('Move the map · tap Set A to confirm')}{error&&!busy&&!autoWaiting&&<button type="button" className="mobile-route-retry" onClick={retryMobileRoute}>{t('Retry route')}</button>}</div>
  <div className="route-navigation"><div className="route-heading"><strong className="route-heading-title"><Route size={18} aria-hidden="true"/><span>{route?t('Your route'):t('Plan your route')}</span></strong>{route&&<button className="route-settings-toggle" aria-expanded={routeSettings} onClick={()=>{onExpand?.();setRouteSettings(v=>!v);}}>{routeSettings?<CloudSun size={16} aria-hidden="true"/>:<SlidersHorizontal size={16} aria-hidden="true"/>}<span>{routeSettings?t('Forecast'):t('Edit route')}</span></button>}<button onClick={close} aria-label="Close route"><X size={17} aria-hidden="true"/></button></div>
  <div className="route-primary-actions">
   {(points[0]||points[1])&&<><button onClick={()=>{setPointsOpen(v=>!v);select(null);edit(null);}} aria-expanded={pointsOpen}>{pointsOpen?t('← Back to route'):t('← Edit points')}</button><button className="route-clear" onClick={clearRoute}>{t('Clear points')}</button></>}
   {historySize>0&&<button className="route-undo-top" onClick={undoRoute}>{t('Undo last change')}</button>}
  </div></div>
  <div className={`route-options-collapse ${pointsOpen?'is-expanded':''}`} inert={!pointsOpen}><div><div className="route-point-choices">{points.map((p,i)=>p&&<button key={i} onClick={()=>{setPointsOpen(false);select(i);edit(null);}}>{t("Point")} {labels[i]} · {i===0?t('Start'):t('Finish')} <span>{t('Edit / delete →')}</span></button>)}</div></div></div>
  <RoutePlaceSearch points={points} open={active&&(citiesOnly||(!busy&&!autoWaiting&&!mobileNeedsTruck&&(!mobilePresentation||!mobileInitialStage||!compactMobile)&&(!route||routeSettings||mobileChoices||pointsOpen)))} disabled={busy||autoWaiting} onChoose={chooseSearchPlace}/>
  {selected!==null?<div className="route-body" inert={mobilePlacing} key={'selected'+selected}><strong>{t("Point")} {labels[selected]} · {selected===0?t('Start'):t('Finish')}</strong><div className="route-actions"><button onClick={()=>reposition(selected)}>{t("Move Point")} {labels[selected]}</button><button onClick={()=>remove(selected)}>{t("Delete Point")} {labels[selected]}</button><button onClick={()=>select(null)}>{t('Back')}</button></div></div>:<div className="route-body" inert={mobilePlacing} key={editing!==null?'edit':!points[0]?'start':!points[1]?'finish':'ready'}>
   <strong>{editing!==null?'Move Point '+labels[editing]:!points[0]?t('Point A · Start'):!points[1]?t('Point B · Finish'):route?t('Your route'):t('Ready to go')}</strong>
   <p>{editing!==null||!points[0]||!points[1]?t('Move the map, then set your point.'):route?t('Driving estimate · no traffic or breaks'):t('Both points are set. Build your route.')}</p>
   {(editing!==null||!points[0]||!points[1])&&<button className="route-place" onClick={place} disabled={!map}>{editing!==null?t('Confirm position'):!points[0]?t('Set Point A'):t('Set Point B')}</button>}
   {editing===null&&points[0]&&points[1]&&<>
    {route&&<div className="route-summary" role="status"><strong>{Math.round(route.distance/(units==='us'?1609.344:1000)).toLocaleString()} {units==='us'?'mi':'km'}</strong><span>·</span><strong>{formatRouteDuration(route.duration)}</strong></div>}
    <button className={`route-place ${busy?'is-building':''}`} onClick={build} disabled={busy||!truckConfirmed||!validTruck(truck)} aria-busy={busy}>{busy?t('Building route…'):hasPrevious?t('Update route'):t('Build route')}</button>
    {route&&!pointsOpen&&<RouteWeather route={route} autoFocusWarning={voiceFocusRoute===route} onAutoFocusHandled={()=>setVoiceFocusRoute(null)} map={map} units={units} active={active} mobilePresentation={mobilePresentation} desktopPresentation={desktopPresentation} compactMobile={!mobilePresentation&&compactMobile&&!routeSettings} onExpand={onExpand}/>}
    {(error||viaError)&&<p className="route-error" role="alert">{error||viaError}</p>}
    <p className="route-disclaimer">Weather planning · follow your navigation and road signs.<br/>Weather colors indicate forecast concern, not road safety.</p>
   </>}
   {editing!==null&&<button onClick={()=>edit(null)}>{t('Cancel move')}</button>}

  </div>}

 </div>
 {stage&&desktopPresentation&&createPortal(<div className={`desktop-route-actions ${active&&route||historySize>0?'is-visible':''}`} inert={!(active&&route)&&!historySize} aria-hidden={!(active&&route)&&!historySize}>
  <button type="button" className="mobile-route-icon mobile-route-undo" aria-label={t("Clear points")} title={t("Clear points")} onClick={clearRoute}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v7m4-7v7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg><span>{t('Clear route')}</span></button>
  <button type="button" className="mobile-route-icon mobile-route-back" disabled={!historySize} aria-label={t('Undo last change')} title={t('Undo last change')} onClick={undoRoute}><Undo2 aria-hidden="true"/><span>Undo</span></button>
  <RouteNavigator destination={points[1]} available={active&&!!route&&!busy&&!routeSettings}/>
  <button type="button" className="mobile-route-icon mobile-route-set" aria-label={routeSettings?t('Show route forecast'):t('Edit route')} aria-pressed={routeSettings} onClick={()=>{setPointsOpen(false);select(null);edit(null);setRouteSettings(v=>!v);}}><SlidersHorizontal size={24}/><span>{routeSettings?t('Forecast'):t('Edit')}</span></button>
 </div>,stage)}
 {stage&&createPortal(<div className={`mobile-route-actions ${mobilePresentation?'is-visible':''}`} inert={!mobilePresentation} aria-hidden={!mobilePresentation}>
  <button className="mobile-route-icon mobile-route-undo" type="button" aria-label={mobileEditing&&mobileStep!==null?'Cancel point edit':'Clear route points'} disabled={!points[0]&&!points[1]&&!(mobileEditing&&mobileStep!==null)} onClick={clearMobileRoute}>{mobileEditing&&mobileStep!==null?<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m11 8-6 6 6 6M6 14h12a8 8 0 0 1 0 16" transform="translate(1 -3)" fill="none" stroke="#a8eaf4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v7m4-7v7" fill="none" stroke="#a8eaf4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}<span>{mobileEditing&&mobileStep!==null?t('Cancel'):t('Clear route')}</span></button>
  <button type="button" className="mobile-route-icon mobile-route-back" disabled={!historySize} aria-label={t('Undo last change')} title={t('Undo last change')} onClick={undoRoute}><Undo2 aria-hidden="true"/><span>Undo</span></button>
  <RouteNavigator showUnavailable destination={points[1]} available={mobilePresentation&&!!route&&!busy&&!autoWaiting&&mobileStep===null&&!mobileChoices}/>
  <div className={`mobile-point-choices ${mobileChoices?'is-open':''}`} inert={!mobileChoices} aria-hidden={!mobileChoices}>
   {([0,1] as const).map(index=><button className={`mobile-route-icon mobile-route-choice ${mobileStep===index?'is-selected':''}`} type="button" key={index} aria-label={`Edit route point ${labels[index]}`} aria-pressed={mobileStep===index} disabled={busy||autoWaiting} onClick={()=>chooseMobilePoint(index)}><span className="mobile-route-letter">{labels[index]}</span><span>{index===0?t('Start'):t('Finish')}</span></button>)}
   <button className={`mobile-route-icon mobile-route-delete ${mobileStep!==null&&points[mobileStep]?'is-visible':''} ${mobileStep===1?'at-b':''}`} type="button" aria-label={`Delete point ${mobileStep===1?'B':'A'} only`} inert={mobileStep===null||!points[mobileStep]} aria-hidden={mobileStep===null||!points[mobileStep]} onClick={deleteMobilePoint}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v7m4-7v7" fill="none" stroke="#e6b2bc" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg><span>{t('Delete')}</span></button>
  </div>
  <button className="mobile-route-icon mobile-route-set" type="button" aria-label={mobileComplete&&mobileStep===null?'Edit route points':mobilePlacementIndex===1?'Set destination B at map center':'Set start A at map center'} aria-expanded={mobileComplete&&mobileStep===null?mobileChoices:undefined} disabled={!map||busy||autoWaiting} onClick={()=>{onShowInfo?.();if(mobileComplete&&mobileStep===null)setMobileChoices(v=>!v);else setMobilePoint();}}><svg viewBox="0 0 32 32" aria-hidden="true"><path className="icon-dark" d="M16 29S5 18 5 12a11 11 0 0 1 22 0c0 6-11 17-11 17Z"/><path d="M16 28S7 18 7 12a9 9 0 0 1 18 0c0 6-9 16-9 16Z" fill="none" stroke="#adf0fa" strokeWidth="1.7"/><circle cx="16" cy="12" r="3" fill="#a8eaf4"/></svg><span>{mobileComplete&&mobileStep===null?t('Edit'):mobilePlacementIndex===1?t('Set B'):t('Set A')}</span></button>
 </div>,stage)}
 {stage&&createPortal(<div className={`route-markers ${active?'is-open':''}`} aria-hidden={!active}>{points.map((p,i)=>{
  if(!p||!map)return null;
  return <button key={i} ref={el=>{pinElements.current[i]=el;}} className={`route-pin ${selected===i?'is-selected':''} ${dragging===i?'is-dragging':''} ${removing===i?'is-removing':''}`} style={{left:0,top:0}} aria-label={'Route point '+labels[i]} tabIndex={active?0:-1}
   onClick={e=>{e.stopPropagation();if(suppress.current){suppress.current=false;return;}if(mobilePresentation){chooseMobilePoint(i as 0|1);}else{select(i);edit(null);}}}
   onContextMenu={e=>e.preventDefault()}
   onPointerDown={e=>{
    if(e.button!==0||!e.isPrimary||gesture.current||busy||autoWaiting)return;
    e.stopPropagation();map.stop();e.currentTarget.setPointerCapture(e.pointerId);suppress.current=false;
    const origin=map.project(p),g=startPointDrag(e.pointerId,i,e.clientX,e.clientY,origin.x,origin.y,e.pointerType);
    gesture.current=g;
    if(g.armed)setDragging(i);
    else g.timer=window.setTimeout(()=>{if(gesture.current===g&&!g.cancelled){g.armed=true;setDragging(i);}},450);
   }}
   onPointerMove={e=>{
    const g=gesture.current;if(!g||g.id!==e.pointerId)return;
    const pixel=movePointDrag(g,e.pointerId,e.clientX,e.clientY);
    if(g.cancelled){clearTimeout(g.timer);suppress.current=true;}
    if(!pixel)return;
    e.preventDefault();e.stopPropagation();suppress.current=true;
    const box=map.getContainer().getBoundingClientRect();
    const c=map.unproject([Math.max(0,Math.min(box.width,pixel[0])),Math.max(0,Math.min(box.height,pixel[1]))]);
    const next:Pair=[...current.current];next[g.index]=[c.lng,c.lat];dragPreview.current=next;map.triggerRepaint();
   }}
   onPointerUp={e=>{finishPointDrag(e.pointerId);}}
   onPointerCancel={e=>{if(gesture.current?.id===e.pointerId)cancel();}} onLostPointerCapture={e=>{if(gesture.current?.id===e.pointerId)cancel();}}><span>{labels[i]}</span></button>;
 })}</div>,stage)}
 </>;
}
