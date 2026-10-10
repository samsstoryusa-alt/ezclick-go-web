import {weatherRequest} from './weather-request';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Map as LibreMap} from 'maplibre-gl';
import {roadRouteKey,validViaPoints} from './route-waypoints';
export const tripApi=()=>document.documentElement.dataset.weatherStandalone !== 'true' && ['localhost','127.0.0.1'].includes(window.location.hostname)?'http://127.0.0.1:8767':'/trip-api';
export type VehicleType="truck"|"car";
export type RoutePoint=[number,number];
export type RoadRoute={key:string;distance:number;duration:number;coordinates:RoutePoint[];elapsedSeconds?:number[]};
export type TruckProfile={height:number;width:number;length:number;weight:number;axle_load:number;axle_count:number;hazmat:boolean};
export const DEFAULT_TRUCK:TruckProfile={height:4.1148,width:2.5908,length:21.9456,weight:36.2873896,axle_load:9.0718474,axle_count:5,hazmat:false};
export function validTruck(p:TruckProfile){return Number.isFinite(p.height)&&p.height>=1&&p.height<=10&&Number.isFinite(p.width)&&p.width>=1&&p.width<=10&&Number.isFinite(p.length)&&p.length>=2&&p.length<=50&&Number.isFinite(p.weight)&&p.weight>0&&p.weight<=150&&Number.isFinite(p.axle_load)&&p.axle_load>0&&p.axle_load<=p.weight&&Number.isInteger(p.axle_count)&&p.axle_count>=2&&p.axle_count<=20;}
export async function loadRoadRoute(a:RoutePoint,b:RoutePoint,signal:AbortSignal,truck:TruckProfile=DEFAULT_TRUCK,vehicle:VehicleType="truck",via:RoutePoint[]=[]){
 if(vehicle==='truck'&&!validTruck(truck))throw new Error('Check your truck dimensions and weight.');
 if(!validViaPoints(via))throw new Error('Check your intermediate points (maximum five).');
 const normalize=(p:RoutePoint)=>({lon:(((p[0]+180)%360)+360)%360-180,lat:p[1],type:'break',search_cutoff:2000});
 const locations=[a,...via,b].map(normalize);
 const data=await weatherRequest(tripApi()+'/route',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(vehicle==='car'?{locations,vehicle}:{locations,truck,vehicle}),signal}) as {code?:string;error_code?:number;error?:string;routes?:{distance:number;duration:number;elapsedSeconds?:number[];geometry?:{type?:string;coordinates:unknown}}[]};
 if(data.code==='NoSegment'||data.error_code===171)throw new Error('Move your points closer to a road accessible to this vehicle.');
 if(data.code==='NoRoute'||data.error_code===442)throw new Error('No route found for this vehicle.');
 const route=data.routes?.[0];
 if(data.code!=='Ok'||!route||!Number.isFinite(route.distance)||route.distance<0||!Number.isFinite(route.duration)||route.duration<0||route.geometry?.type!=='LineString'||!Array.isArray(route.geometry.coordinates)||route.geometry.coordinates.length<2||!route.geometry.coordinates.every((p:unknown)=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])))throw new Error('Could not read this vehicle route. Please try again.');
 return {distance:route.distance as number,duration:route.duration as number,coordinates:route.geometry.coordinates as RoutePoint[],elapsedSeconds:route.elapsedSeconds?.length===route.geometry.coordinates.length&&route.elapsedSeconds.every((v,i,a)=>Number.isFinite(v)&&v>=0&&(i===0||v>=a[i-1]))?route.elapsedSeconds:undefined};
}
export function useRoadRoute(map:LibreMap|null,active:boolean,points:[RoutePoint|null,RoutePoint|null],truck:TruckProfile,vehicle:VehicleType="truck",via:RoutePoint[]=[]){
 const [coverage,setCoverage]=useState<'colorado'|'contiguous-us'|null>(null);
 useEffect(()=>{if(!active)return;let disposed=false,controller:AbortController|null=null;const refresh=async()=>{controller?.abort();controller=new AbortController();const timer=setTimeout(()=>controller?.abort(),6000);try{const r=await fetch(tripApi()+'/health',{signal:controller.signal});const v:unknown=await r.json();if(!disposed&&r.ok&&v&&typeof v==='object'&&'coverage' in v&&(v.coverage==='colorado'||v.coverage==='contiguous-us'))setCoverage(v.coverage);}catch{}finally{clearTimeout(timer);}};void refresh();const poll=setInterval(refresh,60000);return()=>{disposed=true;controller?.abort();clearInterval(poll);};},[active]);
 const [saved,setSaved]=useState<RoadRoute|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const key=roadRouteKey(points,truck,vehicle,via),latest=useRef({key,active});
 const [previous,setPrevious]=useState({key,active});
 // Reset render state with its inputs; an obsolete error/loading flag never flashes.
 if(previous.key!==key||previous.active!==active){setPrevious({key,active});setBusy(false);setError('');if(!points[0]&&!points[1])setSaved(null);}
 const request=useRef<AbortController|null>(null),lastStarted=useRef(0);
 function cancelBuild(){const controller=request.current;request.current=null;controller?.abort();setBusy(false);setError('');}
 const route=saved?.key===key?saved:null;
 useLayoutEffect(()=>{
  latest.current={key,active};
  // A committed input change/unmount invalidates the request before another result can apply.
  return()=>{request.current?.abort();request.current=null;};
 },[key,active]);
 async function build(){
  if(!points[0]||!points[1]||request.current||!active)return;
  if(Math.hypot(points[0][0]-points[1][0],points[0][1]-points[1][1])<0.0001){setError('Choose two different points.');return;}
  if(Date.now()-lastStarted.current<1100)return;
  lastStarted.current=Date.now();const controller=new AbortController();request.current=controller;setBusy(true);setError('');
  const timer=setTimeout(()=>controller.abort(),45000);
  try{const result=await loadRoadRoute(points[0],points[1],controller.signal,truck,vehicle,via);if(request.current===controller&&!controller.signal.aborted&&latest.current.key===key&&latest.current.active)setSaved({...result,key});}
  catch(e){if(request.current===controller&&latest.current.key===key&&latest.current.active)setError(controller.signal.aborted?'Route took too long. Try again.':e instanceof Error?e.message:'Could not build route.');}
  finally{clearTimeout(timer);if(request.current===controller){request.current=null;setBusy(false);}}
 }
 useEffect(()=>{
  if(!map||!route||!active)return;
  const source='ezclick-trip-route',ids=['ezclick-trip-glow','ezclick-trip-line'];
  const draw=()=>{
   if(map.getSource(source))return;
   map.addSource(source,{type:'geojson',lineMetrics:true,data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:route.coordinates}},attribution:'Routes: <a href="https://valhalla.github.io/">Valhalla</a> / <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'});
   map.addLayer({id:ids[0],source,type:'line',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#61d9ed','line-width':11,'line-blur':5,'line-opacity':0.3}});
   map.addLayer({id:ids[1],source,type:'line',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#9aecfa','line-width':3.5,'line-opacity':0.95}});
  };
  draw();map.on('style.load',draw);
  const frame=requestAnimationFrame(()=>{
   const bounds=route.coordinates.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);
   const rect=map.getContainer().getBoundingClientRect();
   const panel=map.getContainer().parentElement?.querySelector('.weather-left-stack')?.getBoundingClientRect();
   const mobile=rect.width<640;
   // MapLibre adds these bounds margins to the persistent inset for the sheet.
   const reserved=mobile&&panel?Math.min(rect.height*.65,Math.max(40,rect.bottom-panel.top+20)):40;
   const inset=map.getPadding();
   const bottom=Math.max(20,reserved-(inset.bottom??0));
   const left=mobile?35:Math.max(35,Math.min(rect.width*.4,(panel?panel.right-rect.left:350)+30)-(inset.left??0));
   const right=mobile?65:100;
   map.fitBounds([[bounds[0],bounds[1]],[bounds[2],bounds[3]]],{padding:{top:50,right,bottom,left},maxZoom:12,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:800});
  });
  return()=>{cancelAnimationFrame(frame);map.off('style.load',draw);for(const id of ['ezclick-trip-selected','ezclick-trip-selected-glow','ezclick-trip-selected-outline',...ids.slice().reverse()])if(map.getLayer(id))map.removeLayer(id);if(map.getSource(source))map.removeSource(source);};
 },[map,route,active]);
 return {route,busy,error,build,cancelBuild,coverage,hasPrevious:!!saved};
}
