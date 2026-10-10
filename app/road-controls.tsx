"use client";
import {useEffect,useRef,useSyncExternalStore} from 'react';
import type {Map as LibreMap,VisibilitySpecification,FilterSpecification} from 'maplibre-gl';
const subscribe=(fn:()=>void)=>{window.addEventListener('ezclick-roads',fn);window.addEventListener('storage',fn);return()=>{window.removeEventListener('ezclick-roads',fn);window.removeEventListener('storage',fn);};};
let fallback=true;
const snapshot=()=>{try{return localStorage.getItem('ezclick-highways-only')!=='false';}catch{return fallback;}};
type Paint=Parameters<LibreMap['getPaintProperty']>[1];
export default function RoadControls({map,ready}:{map:LibreMap|null;ready:boolean}){
 const highways=useSyncExternalStore(subscribe,snapshot,()=>true);
 const apply=useRef<(value:boolean)=>void>(()=>{});
 useEffect(()=>{
  if(!map||!ready)return;
  let hideTimer=0;
  const visibility=new Map<string,VisibilitySpecification>();
  const duration=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:350;
  const motorwayFilters=new Map<string,FilterSpecification|undefined>();
  const changes:{id:string;property:Paint;value:Parameters<LibreMap['setPaintProperty']>[2];transition:Parameters<LibreMap['setPaintProperty']>[2]}[]=[];
  for(const layer of map.getStyle().layers??[]){
   if(!('source-layer' in layer))continue;
   const source=layer['source-layer'];
   if(source!=='transportation'&&source!=='transportation_name')continue;
   // Low-zoom tiles promote US/state highways to motorway; network identifies actual Interstates.
   if(layer.id.includes('motorway')){motorwayFilters.set(layer.id,layer.filter);continue;}
   if(layer.id==='highway-shield-us-interstate')continue;
   if(!/^(highway|road|tunnel)/.test(layer.id))continue;
   const properties:Paint[]=layer.type==='line'?['line-opacity']:layer.type==='fill'?['fill-opacity']:layer.type==='symbol'?['text-opacity','icon-opacity']:[];
   if(properties.length)visibility.set(layer.id,map.getLayoutProperty(layer.id,'visibility')??'visible');
   for(const property of properties){
    changes.push({id:layer.id,property,value:map.getPaintProperty(layer.id,property)??1,transition:map.getPaintProperty(layer.id,(property+'-transition') as Paint)});
    map.setPaintProperty(layer.id,(property+'-transition') as Paint,{duration,delay:0});
   }
  }
  apply.current=value=>{
   for(const [id,filter] of motorwayFilters)if(map.getLayer(id))map.setFilter(id,value?(['all',filter??true,['==',['get','network'],'us-interstate']] as FilterSpecification):filter);
   window.clearTimeout(hideTimer);
   if(!value)for(const [id,original] of visibility)if(map.getLayer(id))map.setLayoutProperty(id,'visibility',original);
   for(const item of changes)if(map.getLayer(item.id))map.setPaintProperty(item.id,item.property,value?0:item.value);
   if(value)hideTimer=window.setTimeout(()=>{for(const id of visibility.keys())if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none');map.triggerRepaint();},duration);
   map.triggerRepaint();
  };
  return()=>{window.clearTimeout(hideTimer);apply.current=()=>{};for(const [id,filter] of motorwayFilters)if(map.getLayer(id))map.setFilter(id,filter);for(const [id,original] of visibility)if(map.getLayer(id))map.setLayoutProperty(id,'visibility',original);for(const item of changes)if(map.getLayer(item.id)){map.setPaintProperty(item.id,item.property,item.value);map.setPaintProperty(item.id,(item.property+'-transition') as Paint,item.transition);}};
 },[map,ready]);
 useEffect(()=>{apply.current(highways);},[highways,map,ready]);
 function toggle(){fallback=!highways;try{localStorage.setItem('ezclick-highways-only',String(fallback));}catch{}window.dispatchEvent(new Event('ezclick-roads'));}
 return <button type="button" disabled={!ready} className="map-icon-button roads-toggle" aria-label="Show highways only" data-tooltip={highways?"Show all roads":"Interstates only"} aria-pressed={highways} onClick={toggle}><svg viewBox="0 0 32 32" aria-hidden="true"><path className="icon-shadow" d="M5 7 11 4l11 3v10c0 6-6 11-11 14C11 28 5 23 5 17Z"/><path className="icon-dark" d="M5 5 11 2l11 3v10c0 6-6 11-11 14C11 26 5 21 5 15Z"/><path d="m6 6 10-3 10 3v9c0 5-5 10-10 13C11 25 6 20 6 15Z" fill="#24607a" stroke="#9ae9f6" strokeWidth="1.4" strokeLinejoin="round"/><path className="icon-light" d="m6 6 10-3 10 3v5H6Z"/><path d="M11 8h10" stroke="#24607a" strokeWidth="1.4" strokeLinecap="round"/><path d="m12 22 2-8m6 8-2-8M16 15v2m0 3v2" fill="none" stroke="#d1f7ff" strokeWidth="1.5" strokeLinecap="round"/></svg><span>{highways?'HWY':'Roads'}</span></button>;
}
