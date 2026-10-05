"use client";
import {useEffect,useEffectEvent,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Route,SlidersHorizontal,CloudSun,X} from 'lucide-react';
import type {Map as MapLibre} from 'maplibre-gl';
import './weather-route.css';
import {useRoadRoute,DEFAULT_TRUCK,validTruck} from './road-route';
import {useWeatherLanguage} from './weather-language';
import {useWeatherUnits} from './weather-units';
import RouteWeather from './route-weather';
import RouteNavigator from './route-navigator';
import {readTrip,saveTrip,standaloneWeather,defaultTripPoints} from './weather-trip-storage';
type Point=[number,number];
type Pair=[Point|null,Point|null];
function TruckWheel({enabled,label,value,min,max,step,factor,format,onChange}:{enabled:boolean;label:string;value:number;min:number;max:number;step:number;factor:number;format?:(n:number)=>string;onChange:(n:number)=>void}){
 const {t}=useWeatherLanguage();
 const ref=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const touched=useRef(false);
 const count=Math.round((max-min)/step)+1,index=Math.max(0,Math.min(count-1,Math.round((value/factor-min)/step)));
 const display=(n:number)=>format?format(n):n.toLocaleString('en-US',{maximumFractionDigits:2});
 const alignWheel=useEffectEvent(()=>{if(enabled&&ref.current)ref.current.scrollTop=index*32;});
 useEffect(()=>{touched.current=false;const frame=requestAnimationFrame(()=>alignWheel());return()=>cancelAnimationFrame(frame);},[enabled]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 const go=(i:number)=>{touched.current=true;const next=Math.max(0,Math.min(count-1,i));onChange((min+next*step)*factor);ref.current?.scrollTo({top:next*32,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
 return <div className="truck-field"><span>{t(label)}</span><div className="truck-wheel-wrap"><div ref={ref} className="truck-wheel" role="spinbutton" tabIndex={0} aria-label={t(label)} aria-valuemin={min} aria-valuemax={max} aria-valuenow={Number((value/factor).toFixed(4))} aria-valuetext={display(value/factor)} onPointerDown={()=>{touched.current=true;}} onWheel={()=>{touched.current=true;}} onKeyDown={e=>{if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();go(e.key==='Home'?0:e.key==='End'?count-1:index+(e.key==='ArrowUp'?1:-1));}}} onScroll={()=>{if(!touched.current)return;const i=Math.max(0,Math.min(count-1,Math.round((ref.current?.scrollTop??0)/32)));onChange((min+i*step)*factor);}}>
 {Array.from({length:count},(_,i)=><div className={`truck-wheel-option ${i===index?'is-selected':''}`} key={i} onClick={()=>go(i)}>{display(min+i*step)}</div>)}
 </div></div></div>;
}
export function WeatherRoute({map,active,onClose,compactMobile=false,onExpand,mobilePresentation=false,onShowInfo}:{map:MapLibre|null;active:boolean;onClose:()=>void;compactMobile?:boolean;onExpand?:()=>void;mobilePresentation?:boolean;onShowInfo?:()=>void}){
 const {t}=useWeatherLanguage();
 const desktopPresentation=!mobilePresentation&&standaloneWeather();
 const [restored]=useState(readTrip);
 const [points,setPoints]=useState<Pair>(()=>restored?.points??(standaloneWeather()?defaultTripPoints():typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('demo')==='nashville-jacksonville'?[[-86.7816,36.1627],[-81.6557,30.3322]]:[null,null])),[selected,select]=useState<number|null>(null),[editing,edit]=useState<number|null>(null),[undo,setUndo]=useState<Pair|null>(null),[dragging,setDragging]=useState<number|null>(null);
 const [pointsOpen,setPointsOpen]=useState(false);
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
 const gesture=useRef<{id:number;index:number;x:number;y:number;armed:boolean;timer:number;before:Pair;moved:boolean}|null>(null);
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
   current.current.forEach((point,i)=>{
    const el=pinElements.current[i];if(!el||!point)return;
    const p=map.project(point);
    const target={x:box.left-parent.left+p.x-24,y:box.top-parent.top+p.y-24};
    const previous=displayed[i];
    let x=target.x,y=target.y;
    if(mobilePresentation&&!motion.matches&&previous){
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
 useEffect(()=>{if(!undo||mobilePresentation)return;const t=setTimeout(()=>setUndo(null),8000);return()=>clearTimeout(t);},[undo,mobilePresentation]);
 useEffect(()=>{if(!map)return;const close=()=>select(null);map.on('click',close);return()=>{map.off('click',close);};},[map]);
 const cancel=()=>{const g=gesture.current;if(g){clearTimeout(g.timer);setPoints(g.before);}gesture.current=null;setDragging(null);};
 useEffect(()=>{
  if(!active)return;
  // Tear down an external pointer gesture when the route panel is deactivated.
  return()=>{const g=gesture.current;if(g){clearTimeout(g.timer);setPoints(g.before);}gesture.current=null;setDragging(null);select(null);edit(null);};
 },[active]);
 useEffect(()=>()=>{if(gesture.current)clearTimeout(gesture.current.timer);if(motionTimer.current)clearTimeout(motionTimer.current);},[]);
 function change(next:Pair){setPointsOpen(false);setUndo(current.current);setPoints(next);select(null);edit(null);}
 function place(){if(!map||selected!==null)return;const i=editing??(!points[0]?0:1),c=map.getCenter();const next=[...points] as Pair;next[i]=[c.lng,c.lat];change(next);}
 function remove(i:number){if(removing!==null)return;setRemoving(i);motionTimer.current=setTimeout(()=>{const next=[...current.current] as Pair;next[i]=null;change(next);setRemoving(null);},matchMedia('(prefers-reduced-motion: reduce)').matches?0:200);}
 function close(){if(mobilePresentation){onClose();return;}setClosing(true);motionTimer.current=setTimeout(()=>{onClose();setClosing(false);},matchMedia('(prefers-reduced-motion: reduce)').matches?0:450);}
 function reposition(i:number){select(null);edit(i);if(points[i])map?.easeTo({center:points[i]!,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:450});}
 const labels=['A','B'];
 const [truck,setTruck]=useState(()=>restored?.truck??DEFAULT_TRUCK);
 const [truckConfirmed,confirmTruck]=useState(restored?.confirmed??false);
 const [truckOpen,setTruckOpen]=useState(false);
 const {route,busy,error,build,coverage,hasPrevious}=useRoadRoute(map,active,points,truck);
 const restoredBuild=useRef(false);
 const tripKey=JSON.stringify({points,truck});
 const pointsKey=JSON.stringify(points);
 const latestBuild=useEffectEvent(()=>{setAutoWaiting(false);void build();});
 useEffect(()=>{
  if(!mobilePresentation||!active||!map||!autoBuildPoints||autoBuildPoints!==pointsKey||!truckConfirmed||!validTruck(truck)||!points[0]||!points[1])return;
  const requestKey=autoBuildPoints+tripKey+autoAttempt;
  if(autoBuildStarted.current===requestKey)return;
  const timer=setTimeout(()=>{autoBuildStarted.current=requestKey;latestBuild();},1150);
  return()=>clearTimeout(timer);
 },[mobilePresentation,active,map,autoBuildPoints,pointsKey,tripKey,truckConfirmed,truck,points,autoAttempt]);
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
 function clearMobileRoute(){
  if(mobileEditing&&mobileStep!==null){setMobileStep(null);setMobileEditing(false);setMobileChoices(false);return;}
  setAutoBuildPoints(null);setAutoWaiting(false);autoBuildStarted.current=null;restoredBuild.current=true;
  setPoints([null,null]);setUndo(null);select(null);edit(null);setPointsOpen(false);
  setMobileChoices(false);setMobileEditing(false);setMobileStep(0);onShowInfo?.();
  saveTrip({points:[null,null],builtKey:null});
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
 useEffect(()=>{
  if(!map||!active||restoredBuild.current)return;
  restoredBuild.current=true;
  if(restored?.builtKey===tripKey&&truckConfirmed)void build();
 },[map,active,tripKey,truckConfirmed,build,restored]);
 useEffect(()=>{
  if(dragging!==null)return;
  saveTrip({points,truck,confirmed:truckConfirmed,builtKey:route?.key??(restored?.builtKey===tripKey&&truckConfirmed?tripKey:null)});
 },[points,truck,truckConfirmed,route,tripKey,dragging,restored]);
 const {units}=useWeatherUnits();
 const needsTruckCheck=active&&!!points[0]&&!!points[1]&&!truckConfirmed&&editing===null&&selected===null;
 return <>
 <div className={`route-sheet ${active?'is-open':''} ${closing?'is-closing':''} ${route?'has-route':''} ${mobilePresentation?'mobile-route-workflow':''} ${desktopPresentation?'desktop-route-workflow':''} ${mobilePlacing?'mobile-point-stage':''} ${mobileNeedsTruck?'mobile-truck-stage':''} ${mobileInitialStage?'mobile-initial-stage':''} ${route&&!routeSettings&&selected===null&&editing===null&&!pointsOpen?'route-summary-view':''}`} aria-hidden={!active} inert={!active}>
  <div className="mobile-route-status" role="status">{mobileNeedsTruck?t('Check your truck settings before calculating.'):busy||autoWaiting&&autoBuildPoints===pointsKey?t('Calculating your route…'):error?error:mobilePlacementIndex===1?t('Move the map · tap Set B to confirm'):t('Move the map · tap Set A to confirm')}{error&&!busy&&!autoWaiting&&<button type="button" className="mobile-route-retry" onClick={retryMobileRoute}>{t('Retry route')}</button>}</div>
  <div className="route-navigation"><div className="route-heading"><strong className="route-heading-title"><Route size={18} aria-hidden="true"/><span>{route?t('Your route'):t('Plan your route')}</span></strong>{route&&<button className="route-settings-toggle" aria-expanded={routeSettings} onClick={()=>{onExpand?.();setRouteSettings(v=>!v);}}>{routeSettings?<CloudSun size={16} aria-hidden="true"/>:<SlidersHorizontal size={16} aria-hidden="true"/>}<span>{routeSettings?t('Forecast'):t('Edit route')}</span></button>}<button onClick={close} aria-label="Close route"><X size={17} aria-hidden="true"/></button></div>
  <div className="route-primary-actions">
   {(points[0]||points[1])&&<><button onClick={()=>{setPointsOpen(v=>!v);select(null);edit(null);}} aria-expanded={pointsOpen}>{pointsOpen?t('← Back to route'):t('← Edit points')}</button><button className="route-clear" onClick={()=>change([null,null])}>{t('Clear points')}</button></>}
   {undo&&<button className="route-undo-top" onClick={()=>{setPoints(undo);setUndo(null);select(null);edit(null);setPointsOpen(false);}}>{t('Undo last change')}</button>}
  </div></div>
  <div className={`route-options-collapse ${pointsOpen?'is-expanded':''}`} inert={!pointsOpen}><div><div className="route-point-choices">{points.map((p,i)=>p&&<button key={i} onClick={()=>{setPointsOpen(false);select(i);edit(null);}}>{t("Point")} {labels[i]} · {i===0?t('Start'):t('Finish')} <span>{t('Edit / delete →')}</span></button>)}</div></div></div>
  <div className={`truck-profile ${truckOpen?'is-expanded':''}`}>
   <button className="truck-profile-toggle" aria-expanded={truckOpen} aria-controls="truck-profile-content" onClick={()=>setTruckOpen(v=>!v)}><svg className="truck-settings-icon" aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 7h6m4 0h6M4 17h10m4 0h2"/><circle cx="12" cy="7" r="2"/><circle cx="16" cy="17" r="2"/></svg><span className="truck-settings-title">{t('Truck settings')}</span><span className="truck-settings-chevron" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg></span></button>
   <div className="truck-profile-collapse" id="truck-profile-content" inert={!truckOpen} aria-hidden={!truckOpen}><div className="truck-profile-inner"><p>{t('Scroll to adjust your loaded truck.')}</p><div className="truck-fields">
   {([{key:'height',label:'Height · ft / in',factor:0.3048,min:8,max:16,step:1/12,format:(n:number)=>{const inches=Math.round(n*12);return `${Math.floor(inches/12)}′ ${inches%12}″`;}},{key:'width',label:'Width · ft',factor:0.3048,min:5,max:12,step:0.5},{key:'length',label:'Total length · ft',factor:0.3048,min:10,max:100,step:1},{key:'weight',label:'Loaded weight · lb',factor:0.00045359237,min:1000,max:150000,step:1000},{key:'axle_load',label:'Axle load · lb',factor:0.00045359237,min:1000,max:40000,step:1000},{key:'axle_count',label:'Axles',factor:1,min:2,max:12,step:1}] as const).map(f=><TruckWheel enabled={active&&truckOpen} {...f} key={f.key} format={'format' in f?f.format:undefined} value={truck[f.key]} onChange={v=>{if(Math.abs(v-truck[f.key])>0.000001){confirmTruck(false);setTruck(t=>({...t,[f.key]:v}));}}}/>)}
   </div><label className="truck-check"><input type="checkbox" checked={truck.hazmat} onChange={e=>{confirmTruck(false);setTruck(t=>({...t,hazmat:e.target.checked}));}}/>{t('Hazardous cargo')}</label></div></div></div>
  {coverage==='colorado'&&<p style={{fontSize:10,textAlign:'center',color:'#a9c5d4'}}>Colorado routes available. US coverage is being prepared.</p>}
  <label className={`truck-check truck-confirm ${truckConfirmed?'is-confirmed':''} ${needsTruckCheck?'needs-attention':''}`}><input type="checkbox" checked={truckConfirmed} aria-describedby={needsTruckCheck?'truck-check-hint':undefined} onChange={e=>confirmTruck(e.target.checked)}/>{t('I checked my truck settings')}</label>
  {selected!==null?<div className="route-body" inert={mobilePlacing} key={'selected'+selected}><strong>{t("Point")} {labels[selected]} · {selected===0?t('Start'):t('Finish')}</strong><div className="route-actions"><button onClick={()=>reposition(selected)}>{t("Move Point")} {labels[selected]}</button><button onClick={()=>remove(selected)}>{t("Delete Point")} {labels[selected]}</button><button onClick={()=>select(null)}>{t('Back')}</button></div></div>:<div className="route-body" inert={mobilePlacing} key={editing!==null?'edit':!points[0]?'start':!points[1]?'finish':'ready'}>
   <strong>{editing!==null?'Move Point '+labels[editing]:!points[0]?t('Point A · Start'):!points[1]?t('Point B · Finish'):route?t('Your route'):t('Ready to go')}</strong>
   <p>{editing!==null||!points[0]||!points[1]?t('Move the map, then set your point.'):route?t('Driving estimate · no traffic or breaks'):t('Both points are set. Build your route.')}</p>
   {(editing!==null||!points[0]||!points[1])&&<button className="route-place" onClick={place} disabled={!map}>{editing!==null?t('Confirm position'):!points[0]?t('Set Point A'):t('Set Point B')}</button>}
   {editing===null&&points[0]&&points[1]&&<>
    {route&&<div className="route-summary" role="status"><strong>{Math.round(route.distance/(units==='us'?1609.344:1000)).toLocaleString()} {units==='us'?'mi':'km'}</strong><span>·</span><strong>{Math.floor(Math.round(route.duration/60)/60)}h {Math.round(route.duration/60)%60}m</strong></div>}
    {needsTruckCheck&&<p id="truck-check-hint" className="truck-check-hint" role="status">Check the box above to enable Build route.</p>}
    <button aria-describedby={needsTruckCheck?'truck-check-hint':undefined} className={`route-place ${busy?'is-building':''}`} onClick={build} disabled={busy||!truckConfirmed||!validTruck(truck)} aria-busy={busy}>{busy?t('Building route…'):hasPrevious?t('Update route'):t('Build route')}</button>
    {route&&!pointsOpen&&<RouteWeather route={route} map={map} units={units} active={active} mobilePresentation={mobilePresentation} desktopPresentation={desktopPresentation} compactMobile={!mobilePresentation&&compactMobile&&!routeSettings} onExpand={onExpand}/>}
    {error&&<p className="route-error" role="alert">{error}</p>}
    <p className="route-disclaimer">Mapped truck restrictions. Check road signs.<br/>Weather colors indicate forecast concern, not road safety.</p>
   </>}
   {editing!==null&&<button onClick={()=>edit(null)}>{t('Cancel move')}</button>}

  </div>}

 </div>
 {stage&&desktopPresentation&&createPortal(<div className={`desktop-route-actions ${active&&route?'is-visible':''}`} inert={!active||!route} aria-hidden={!active||!route}>
  <button type="button" className="mobile-route-icon mobile-route-undo" aria-label="Clear route points" onClick={()=>{change([null,null]);setRouteSettings(false);}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v7m4-7v7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg><span>{t('Clear route')}</span></button>
  <RouteNavigator available={active&&!!route&&!busy&&!routeSettings}/>
  <button type="button" className="mobile-route-icon mobile-route-set" aria-label={routeSettings?t('Show route forecast'):t('Edit route')} aria-pressed={routeSettings} onClick={()=>{setPointsOpen(false);select(null);edit(null);setRouteSettings(v=>!v);}}><SlidersHorizontal size={24}/><span>{routeSettings?t('Forecast'):t('Edit')}</span></button>
 </div>,stage)}
 {stage&&createPortal(<div className={`mobile-route-actions ${mobilePresentation?'is-visible':''}`} inert={!mobilePresentation} aria-hidden={!mobilePresentation}>
  <button className="mobile-route-icon mobile-route-undo" type="button" aria-label={mobileEditing&&mobileStep!==null?'Cancel point edit':'Clear route points'} disabled={!points[0]&&!points[1]&&!(mobileEditing&&mobileStep!==null)} onClick={clearMobileRoute}>{mobileEditing&&mobileStep!==null?<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m11 8-6 6 6 6M6 14h12a8 8 0 0 1 0 16" transform="translate(1 -3)" fill="none" stroke="#a8eaf4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v7m4-7v7" fill="none" stroke="#a8eaf4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}<span>{mobileEditing&&mobileStep!==null?t('Cancel'):t('Clear route')}</span></button>
  <RouteNavigator available={mobilePresentation&&active&&!!route&&!busy&&!autoWaiting&&mobileStep===null&&!mobileChoices}/>
  <div className={`mobile-point-choices ${mobileChoices?'is-open':''}`} inert={!mobileChoices} aria-hidden={!mobileChoices}>
   {([0,1] as const).map(index=><button className={`mobile-route-icon mobile-route-choice ${mobileStep===index?'is-selected':''}`} type="button" key={index} aria-label={`Edit route point ${labels[index]}`} aria-pressed={mobileStep===index} disabled={busy||autoWaiting} onClick={()=>chooseMobilePoint(index)}><span className="mobile-route-letter">{labels[index]}</span><span>{index===0?t('Start'):t('Finish')}</span></button>)}
   <button className={`mobile-route-icon mobile-route-delete ${mobileStep!==null&&points[mobileStep]?'is-visible':''} ${mobileStep===1?'at-b':''}`} type="button" aria-label={`Delete point ${mobileStep===1?'B':'A'} only`} inert={mobileStep===null||!points[mobileStep]} aria-hidden={mobileStep===null||!points[mobileStep]} onClick={deleteMobilePoint}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v7m4-7v7" fill="none" stroke="#e6b2bc" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg><span>{t('Delete')}</span></button>
  </div>
  <button className="mobile-route-icon mobile-route-set" type="button" aria-label={mobileComplete&&mobileStep===null?'Edit route points':mobilePlacementIndex===1?'Set destination B at map center':'Set start A at map center'} aria-expanded={mobileComplete&&mobileStep===null?mobileChoices:undefined} disabled={!map||busy||autoWaiting} onClick={()=>{if(mobileComplete&&mobileStep===null)setMobileChoices(v=>!v);else setMobilePoint();}}><svg viewBox="0 0 32 32" aria-hidden="true"><path className="icon-dark" d="M16 29S5 18 5 12a11 11 0 0 1 22 0c0 6-11 17-11 17Z"/><path d="M16 28S7 18 7 12a9 9 0 0 1 18 0c0 6-9 16-9 16Z" fill="none" stroke="#adf0fa" strokeWidth="1.7"/><circle cx="16" cy="12" r="3" fill="#a8eaf4"/></svg><span>{mobileComplete&&mobileStep===null?t('Edit'):mobilePlacementIndex===1?t('Set B'):t('Set A')}</span></button>
 </div>,stage)}
 {stage&&createPortal(<div className={`route-markers ${active?'is-open':''}`} aria-hidden={!active}>{points.map((p,i)=>{
  if(!p||!map)return null;
  return <button key={i} ref={el=>{pinElements.current[i]=el;}} className={`route-pin ${selected===i?'is-selected':''} ${dragging===i?'is-dragging':''} ${removing===i?'is-removing':''}`} style={{left:0,top:0}} aria-label={'Route point '+labels[i]} tabIndex={active?0:-1}
   onClick={e=>{e.stopPropagation();if(suppress.current){suppress.current=false;return;}if(mobilePresentation){chooseMobilePoint(i as 0|1);}else{select(i);edit(null);}}}
   onPointerDown={e=>{if(mobilePresentation||e.button!==0||gesture.current)return;e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);suppress.current=false;const g={id:e.pointerId,index:i,x:e.clientX,y:e.clientY,armed:e.pointerType==='mouse',timer:0,before:current.current,moved:false};gesture.current=g;if(g.armed)setDragging(i);else g.timer=window.setTimeout(()=>{if(gesture.current===g){g.armed=true;setDragging(i);}},450);}}
   onPointerMove={e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;const distance=Math.hypot(e.clientX-g.x,e.clientY-g.y);if(!g.armed){if(distance>9){clearTimeout(g.timer);suppress.current=true;}return;}if(distance<3&&!g.moved)return;g.moved=true;suppress.current=true;const r=map.getContainer().getBoundingClientRect(),c=map.unproject([e.clientX-r.left,e.clientY-r.top]);const next=[...current.current] as Pair;next[i]=[c.lng,c.lat];setPoints(next);}}
   onPointerUp={e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;clearTimeout(g.timer);if(g.moved)setUndo(g.before);gesture.current=null;setDragging(null);}}
   onPointerCancel={cancel} onLostPointerCapture={()=>{if(gesture.current)cancel();}}><span>{labels[i]}</span></button>;
 })}</div>,stage)}
 </>;
}
