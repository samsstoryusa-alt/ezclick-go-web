import {useEffect,useRef,useState,type ReactNode} from 'react';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import roadRoutes from './load-road-routes.json';
import {applyMapPalette} from './map-night-palette';

// Share snapshots between the hero, product card and expanded preview.
const cache=new Map<string,Promise<string>>();
const readyImages=new Map<string,string>();
export function prepareRouteSnapshot(origin:string,destination:string){
 const key=`${origin} → ${destination}`;
 const route=(roadRoutes as Record<string,{coordinates:number[][]}>)[key];
 return route?snapshot(key,route.coordinates):Promise.reject(new Error("Route unavailable"));
}
function snapshot(key:string,coordinates:number[][]):Promise<string>{
 const existing=cache.get(key);if(existing)return existing;
 const pending=(async()=>{
  const lib=await import('maplibre-gl');lib.setWorkerUrl(workerUrl);
  const host=document.createElement('div');
  host.setAttribute('aria-hidden','true');
  Object.assign(host.style,{position:'fixed',left:'-10000px',top:'0',width:'600px',height:'330px',pointerEvents:'none'});
  document.body.appendChild(host);
  const map=new lib.Map({container:host,style:'https://tiles.openfreemap.org/styles/positron',interactive:false,attributionControl:false,fadeDuration:0,pixelRatio:2,canvasContextAttributes:{preserveDrawingBuffer:true}});
  try{return await new Promise<string>((resolve,reject)=>{
   const timer=window.setTimeout(()=>reject(new Error('Map snapshot timed out')),25000);
   map.once('load',()=>{
    try{
     map.addSource('relief',{type:'raster-dem',url:'https://tiles.mapterhorn.com/tilejson.json',tileSize:512,encoding:'terrarium'});
     const before=map.getStyle().layers?.find(layer=>layer.type==='line'||layer.type==='symbol')?.id;
     map.addLayer({id:'terrain-shading',type:'hillshade',source:'relief'},before);
     applyMapPalette(map);
     const bounds=new lib.LngLatBounds();coordinates.forEach(p=>bounds.extend([p[0],p[1]]));
     map.fitBounds(bounds,{padding:{top:55,bottom:55,left:55,right:55},duration:0,maxZoom:9});
     map.addSource('trip-line',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates}}});
     map.addLayer({id:'trip-outline',type:'line',source:'trip-line',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#061625','line-width':8}});
     map.addLayer({id:'trip-glow',type:'line',source:'trip-line',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#80e0ec','line-width':12,'line-blur':6,'line-opacity':.4}});
     map.addLayer({id:'trip-core',type:'line',source:'trip-line',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#b7f3ee','line-width':3}});
     map.addSource('trip-points',{type:'geojson',data:{type:'FeatureCollection',features:[coordinates[0],coordinates[coordinates.length-1]].map((p,i)=>({type:'Feature',properties:{letter:i?'B':'A'},geometry:{type:'Point',coordinates:p}}))}});
     map.addLayer({id:'trip-markers',type:'circle',source:'trip-points',paint:{'circle-radius':12,'circle-color':'#153449','circle-stroke-color':'#b7f3ee','circle-stroke-width':2}});
     map.addLayer({id:'trip-letters',type:'symbol',source:'trip-points',layout:{'text-field':['get','letter'],'text-font':['Noto Sans Regular'],'text-size':13,'text-allow-overlap':true},paint:{'text-color':'#ffffff'}});
     map.once('idle',()=>{window.clearTimeout(timer);try{resolve(map.getCanvas().toDataURL('image/png'));}catch(error){reject(error);}});
    }catch(error){window.clearTimeout(timer);reject(error);}
   });
  });}finally{map.remove();host.remove();}
 })();
 const decoded=pending.then(async url=>{const image=new Image();image.src=url;await image.decode();readyImages.set(key,url);return url;});
 cache.set(key,decoded);decoded.catch(()=>cache.delete(key));return decoded;
}
export function RouteMapSnapshot({origin,destination,coordinates,children}:{origin:string;destination:string;coordinates:number[][];children:ReactNode}){
 const host=useRef<HTMLDivElement>(null),[image,setImage]=useState<{key:string;url:string}|null>(null);
 const key=`${origin} → ${destination}`;
 useEffect(()=>{
  let cancelled=false;const node=host.current;if(!node)return;
  const observer=new IntersectionObserver(entries=>{if(!entries.some(entry=>entry.isIntersecting))return;observer.disconnect();
   snapshot(key,coordinates).then(url=>{if(!cancelled)setImage({key,url});}).catch(()=>{/* Retain the geographic route illustration if tiles are unavailable. */});
  },{rootMargin:'100px'});
  observer.observe(node);return()=>{cancelled=true;observer.disconnect();};
 },[key,coordinates]);
 const ready=readyImages.get(key)??(image?.key===key?image.url:null);
 return <div ref={host} className="route-map-snapshot">{ready?<img src={ready} width="1200" height="660" alt={`EZCLICK night map. A: ${origin}. B: ${destination}. Road route preview.`}/>:children}</div>;
}
