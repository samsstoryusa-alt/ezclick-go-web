"use client";
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import type {Map as MapLibre} from 'maplibre-gl';
import './weather-route.css';
import {useRoadRoute,DEFAULT_TRUCK,validTruck} from './road-route';
import {useWeatherUnits} from './weather-units';
import RouteWeather from './route-weather';
type Point=[number,number];
type Pair=[Point|null,Point|null];
function TruckWheel({enabled,label,value,min,max,step,factor,format,onChange}:{enabled:boolean;label:string;value:number;min:number;max:number;step:number;factor:number;format?:(n:number)=>string;onChange:(n:number)=>void}){
 const ref=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const touched=useRef(false);
 const count=Math.round((max-min)/step)+1,index=Math.max(0,Math.min(count-1,Math.round((value/factor-min)/step)));
 const display=(n:number)=>format?format(n):n.toLocaleString('en-US',{maximumFractionDigits:2});
 useEffect(()=>{touched.current=false;const frame=requestAnimationFrame(()=>{if(enabled&&ref.current)ref.current.scrollTop=index*32;});return()=>cancelAnimationFrame(frame);},[enabled]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 const go=(i:number)=>{touched.current=true;const next=Math.max(0,Math.min(count-1,i));onChange((min+next*step)*factor);ref.current?.scrollTo({top:next*32,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
 return <div className="truck-field"><span>{label}</span><div className="truck-wheel-wrap"><div ref={ref} className="truck-wheel" role="spinbutton" tabIndex={0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={Number((value/factor).toFixed(4))} aria-valuetext={display(value/factor)} onPointerDown={()=>{touched.current=true;}} onWheel={()=>{touched.current=true;}} onKeyDown={e=>{if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();go(e.key==='Home'?0:e.key==='End'?count-1:index+(e.key==='ArrowUp'?1:-1));}}} onScroll={()=>{if(!touched.current)return;const i=Math.max(0,Math.min(count-1,Math.round((ref.current?.scrollTop??0)/32)));onChange((min+i*step)*factor);}}>
 {Array.from({length:count},(_,i)=><div className={`truck-wheel-option ${i===index?'is-selected':''}`} key={i} onClick={()=>go(i)}>{display(min+i*step)}</div>)}
 </div></div></div>;
}
export function WeatherRoute({map,active,onClose}:{map:MapLibre|null;active:boolean;onClose:()=>void}){
 const [points,setPoints]=useState<Pair>([null,null]),[selected,select]=useState<number|null>(null),[editing,edit]=useState<number|null>(null),[undo,setUndo]=useState<Pair|null>(null),[dragging,setDragging]=useState<number|null>(null),[,redraw]=useState(0);
 const [pointsOpen,setPointsOpen]=useState(false);
 const [removing,setRemoving]=useState<number|null>(null),[closing,setClosing]=useState(false);
 const motionTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const current=useRef(points);current.current=points;
 const gesture=useRef<{id:number;index:number;x:number;y:number;armed:boolean;timer:number;before:Pair;moved:boolean}|null>(null);
 const suppress=useRef(false);
 const stage=map?.getContainer().parentElement;
 useEffect(()=>{if(!map||!active)return;const update=()=>redraw(n=>n+1);map.on('move',update);map.on('resize',update);return()=>{map.off('move',update);map.off('resize',update);};},[map,active]);
 useEffect(()=>{if(!undo)return;const t=setTimeout(()=>setUndo(null),8000);return()=>clearTimeout(t);},[undo]);
 useEffect(()=>{if(!map)return;const close=()=>select(null);map.on('click',close);return()=>{map.off('click',close);};},[map]);
 const cancel=()=>{const g=gesture.current;if(g){clearTimeout(g.timer);setPoints(g.before);}gesture.current=null;setDragging(null);};
 useEffect(()=>{if(!active){cancel();select(null);edit(null);}},[active]);
 useEffect(()=>()=>{if(gesture.current)clearTimeout(gesture.current.timer);if(motionTimer.current)clearTimeout(motionTimer.current);},[]);
 function change(next:Pair){setPointsOpen(false);setUndo(current.current);setPoints(next);select(null);edit(null);}
 function place(){if(!map||selected!==null)return;const i=editing??(!points[0]?0:1),c=map.getCenter();const next=[...points] as Pair;next[i]=[c.lng,c.lat];change(next);}
 function remove(i:number){if(removing!==null)return;setRemoving(i);motionTimer.current=setTimeout(()=>{const next=[...current.current] as Pair;next[i]=null;change(next);setRemoving(null);},matchMedia('(prefers-reduced-motion: reduce)').matches?0:200);}
 function close(){setClosing(true);motionTimer.current=setTimeout(()=>{onClose();setClosing(false);},matchMedia('(prefers-reduced-motion: reduce)').matches?0:450);}
 function reposition(i:number){select(null);edit(i);if(points[i])map?.easeTo({center:points[i]!,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:450});}
 const labels=['A','B'];
 const [truck,setTruck]=useState(DEFAULT_TRUCK);
 const [truckConfirmed,confirmTruck]=useState(false);
 const [truckOpen,setTruckOpen]=useState(false);
 const {route,busy,error,build,coverage,hasPrevious}=useRoadRoute(map,active,points,truck);
 const {units}=useWeatherUnits();
 const needsTruckCheck=active&&!!points[0]&&!!points[1]&&!truckConfirmed&&editing===null&&selected===null;
 const zoomProgress=Math.max(0,Math.min(1,((map?.getZoom()??7)-3)/8));
 const pinSize=18+8*zoomProgress;
 return <>
 <div className={`route-sheet ${active?'is-open':''} ${closing?'is-closing':''} ${route?'has-route':''}`} aria-hidden={!active} inert={!active}>
  <div className="route-navigation"><div className="route-heading"><strong>Plan your route</strong><button onClick={close} aria-label="Close route">×</button></div>
  <div className="route-primary-actions">
   {(points[0]||points[1])&&<><button onClick={()=>{setPointsOpen(v=>!v);select(null);edit(null);}} aria-expanded={pointsOpen}>{pointsOpen?'← Back to route':'← Edit points'}</button><button className="route-clear" onClick={()=>change([null,null])}>Clear points</button></>}
   {undo&&<button className="route-undo-top" onClick={()=>{setPoints(undo);setUndo(null);select(null);edit(null);setPointsOpen(false);}}>Undo last change</button>}
  </div></div>
  <div className={`route-options-collapse ${pointsOpen?'is-expanded':''}`} inert={!pointsOpen}><div><div className="route-point-choices">{points.map((p,i)=>p&&<button key={i} onClick={()=>{setPointsOpen(false);select(i);edit(null);}}>Point {labels[i]} · {i===0?'Start':'Finish'} <span>Edit / delete →</span></button>)}</div></div></div>
  <div className={`truck-profile ${truckOpen?'is-expanded':''}`}>
   <button className="truck-profile-toggle" aria-expanded={truckOpen} aria-controls="truck-profile-content" onClick={()=>setTruckOpen(v=>!v)}><svg className="truck-settings-icon" aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 7h6m4 0h6M4 17h10m4 0h2"/><circle cx="12" cy="7" r="2"/><circle cx="16" cy="17" r="2"/></svg><span className="truck-settings-title">Truck settings</span><span className="truck-settings-chevron" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg></span></button>
   <div className="truck-profile-collapse" id="truck-profile-content" inert={!truckOpen} aria-hidden={!truckOpen}><div className="truck-profile-inner"><p>Scroll to adjust your loaded truck.</p><div className="truck-fields">
   {([{key:'height',label:'Height · ft / in',factor:0.3048,min:8,max:16,step:1/12,format:(n:number)=>{const inches=Math.round(n*12);return `${Math.floor(inches/12)}′ ${inches%12}″`;}},{key:'width',label:'Width · ft',factor:0.3048,min:5,max:12,step:0.5},{key:'length',label:'Total length · ft',factor:0.3048,min:10,max:100,step:1},{key:'weight',label:'Loaded weight · lb',factor:0.00045359237,min:1000,max:150000,step:1000},{key:'axle_load',label:'Axle load · lb',factor:0.00045359237,min:1000,max:40000,step:1000},{key:'axle_count',label:'Axles',factor:1,min:2,max:12,step:1}] as const).map(f=><TruckWheel enabled={active&&truckOpen} {...f} key={f.key} format={'format' in f?f.format:undefined} value={truck[f.key]} onChange={v=>{if(Math.abs(v-truck[f.key])>0.000001){confirmTruck(false);setTruck(t=>({...t,[f.key]:v}));}}}/>)}
   </div><label className="truck-check"><input type="checkbox" checked={truck.hazmat} onChange={e=>{confirmTruck(false);setTruck(t=>({...t,hazmat:e.target.checked}));}}/>Hazardous cargo</label></div></div></div>
  {coverage==='colorado'&&<p style={{fontSize:10,textAlign:'center',color:'#a9c5d4'}}>Colorado routes available. US coverage is being prepared.</p>}
  <label className={`truck-check truck-confirm ${truckConfirmed?'is-confirmed':''} ${needsTruckCheck?'needs-attention':''}`}><input type="checkbox" checked={truckConfirmed} aria-describedby={needsTruckCheck?'truck-check-hint':undefined} onChange={e=>confirmTruck(e.target.checked)}/>I checked my truck settings</label>
  {selected!==null?<div className="route-body" key={'selected'+selected}><strong>Point {labels[selected]} · {selected===0?'Start':'Finish'}</strong><div className="route-actions"><button onClick={()=>reposition(selected)}>Move Point {labels[selected]}</button><button onClick={()=>remove(selected)}>Delete Point {labels[selected]}</button><button onClick={()=>select(null)}>Back</button></div></div>:<div className="route-body" key={editing!==null?'edit':!points[0]?'start':!points[1]?'finish':'ready'}>
   <strong>{editing!==null?'Move Point '+labels[editing]:!points[0]?'Point A · Start':!points[1]?'Point B · Finish':route?'Your route':'Ready to go'}</strong>
   <p>{editing!==null||!points[0]||!points[1]?'Move the map, then set your point.':route?'Driving estimate · no traffic or breaks':'Both points are set. Build your route.'}</p>
   {(editing!==null||!points[0]||!points[1])&&<button className="route-place" onClick={place} disabled={!map}>{editing!==null?'Confirm position':!points[0]?'Set Point A':'Set Point B'}</button>}
   {editing===null&&points[0]&&points[1]&&<>
    {route&&<div className="route-summary" role="status"><strong>{Math.round(route.distance/(units==='us'?1609.344:1000)).toLocaleString()} {units==='us'?'mi':'km'}</strong><span>·</span><strong>{Math.floor(Math.round(route.duration/60)/60)}h {Math.round(route.duration/60)%60}m</strong></div>}
    {needsTruckCheck&&<p id="truck-check-hint" className="truck-check-hint" role="status">Check the box above to enable Build route.</p>}
    <button aria-describedby={needsTruckCheck?'truck-check-hint':undefined} className={`route-place ${busy?'is-building':''}`} onClick={build} disabled={busy||!truckConfirmed||!validTruck(truck)} aria-busy={busy}>{busy?'Building route…':hasPrevious?'Update route':'Build route'}</button>
    {route&&!pointsOpen&&<RouteWeather route={route} map={map} units={units} active={active}/>}
    {error&&<p className="route-error" role="alert">{error}</p>}
    <p className="route-disclaimer">Mapped truck restrictions. Check road signs.<br/>Weather colors indicate forecast concern, not road safety.</p>
   </>}
   {editing!==null&&<button onClick={()=>edit(null)}>Cancel move</button>}

  </div>}

 </div>
 {stage&&createPortal(<div className={`route-markers ${active?'is-open':''}`} aria-hidden={!active}>{points.map((p,i)=>{
  if(!p||!map)return null;const pos=map.project(p);
  return <button key={i} className={`route-pin ${selected===i?'is-selected':''} ${dragging===i?'is-dragging':''} ${removing===i?'is-removing':''}`} style={{left:pos.x,top:pos.y,'--route-pin-scale':pinSize/26} as CSSProperties} aria-label={'Route point '+labels[i]} tabIndex={active?0:-1}
   onClick={e=>{e.stopPropagation();if(suppress.current){suppress.current=false;return;}select(i);edit(null);}}
   onPointerDown={e=>{if(e.button!==0||gesture.current)return;e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);suppress.current=false;const g={id:e.pointerId,index:i,x:e.clientX,y:e.clientY,armed:e.pointerType==='mouse',timer:0,before:current.current,moved:false};gesture.current=g;if(g.armed)setDragging(i);else g.timer=window.setTimeout(()=>{if(gesture.current===g){g.armed=true;setDragging(i);}},450);}}
   onPointerMove={e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;const distance=Math.hypot(e.clientX-g.x,e.clientY-g.y);if(!g.armed){if(distance>9){clearTimeout(g.timer);suppress.current=true;}return;}if(distance<3&&!g.moved)return;g.moved=true;suppress.current=true;const r=map.getContainer().getBoundingClientRect(),c=map.unproject([e.clientX-r.left,e.clientY-r.top]);const next=[...current.current] as Pair;next[i]=[c.lng,c.lat];setPoints(next);}}
   onPointerUp={e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;clearTimeout(g.timer);if(g.moved)setUndo(g.before);gesture.current=null;setDragging(null);}}
   onPointerCancel={cancel} onLostPointerCapture={()=>{if(gesture.current)cancel();}}><span>{labels[i]}</span></button>;
 })}</div>,stage)}
 </>;
}
