import {useEffect,useLayoutEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import type {Map as LibreMap} from 'maplibre-gl';
import type {RoadRoute,RoutePoint} from './road-route';
import {startPointDrag,movePointDrag,type PointDrag} from './route-point-drag';

type Props={map:LibreMap|null;route:RoadRoute|null;via:RoutePoint[];active:boolean;onMove:(point:RoutePoint,from:RoutePoint,index?:number)=>void};
export default function RouteViaPoints({map,route,via,active,onMove}:Props){
 const latest=useRef({via,onMove});
 useLayoutEffect(()=>{latest.current={via,onMove};},[via,onMove]);
 const pins=useRef<Array<HTMLButtonElement|null>>([]);
 const stage=map?.getContainer().parentElement;
 useEffect(()=>{
  if(!map||!stage||!active||!route)return;
  const canvas=map.getCanvas();
  let drag:(PointDrag&{from:RoutePoint;point:RoutePoint;viaIndex?:number;pan:boolean;rotate:boolean;captured:boolean})|null=null;
  let suppressUntil=0;
  const ghost=document.createElement('div');ghost.className='route-via-ghost';ghost.textContent='+';ghost.setAttribute('aria-hidden','true');stage.appendChild(ghost);
  const pixel=(e:PointerEvent)=>{const box=canvas.getBoundingClientRect();return[e.clientX-box.left,e.clientY-box.top] as [number,number];};
  const position=()=>{
   const box=map.getContainer().getBoundingClientRect(),parent=stage.getBoundingClientRect();
   latest.current.via.forEach((p,i)=>{const el=pins.current[i];if(!el)return;const q=map.project(p);el.style.transform=`translate3d(${box.left-parent.left+q.x-24}px,${box.top-parent.top+q.y-24}px,0)`;});
   if(drag?.moved){const p=map.project(drag.point);ghost.style.transform=`translate3d(${box.left-parent.left+p.x-18}px,${box.top-parent.top+p.y-18}px,0)`;}
  };
  const arm=()=>{if(!drag||drag.cancelled)return;drag.armed=true;map.stop();map.dragPan.disable();map.dragRotate.disable();canvas.setPointerCapture(drag.id);drag.captured=true;canvas.style.cursor='grabbing';};
  const finish=(commit=false)=>{
   if(!drag)return;const g=drag;drag=null;clearTimeout(g.timer);
   ghost.classList.remove('is-visible');canvas.style.cursor='';
   if(g.pan)map.dragPan.enable();if(g.rotate)map.dragRotate.enable();
   if(g.captured&&canvas.hasPointerCapture(g.id))canvas.releasePointerCapture(g.id);
   if(g.moved)suppressUntil=Date.now()+500;
   if(commit&&g.moved&&!g.cancelled)latest.current.onMove(g.point,g.from,g.viaIndex);
  };
  const down=(e:PointerEvent)=>{
   if(drag||!e.isPrimary||e.button!==0)return;
   const pin=(e.target as Element).closest<HTMLButtonElement>('[data-route-via]');
   if(e.target!==canvas&&!pin)return;
   const p=pixel(e),index=pin?Number(pin.dataset.routeVia):undefined;
   let from=index===undefined?undefined:latest.current.via[index];
   if(!from){
    const layers=['ezclick-weather-checkpoints-dots','ezclick-trip-selected-ends','ezclick-trip-line'].filter(id=>map.getLayer(id));
    if(!layers.length)return;
    const features=map.queryRenderedFeatures([[p[0]-6,p[1]-6],[p[0]+6,p[1]+6]],{layers});
    if(!features.length)return;
    const feature=features.find(f=>f.geometry.type==='Point');
    if(feature?.geometry.type==='Point')from=feature.geometry.coordinates.slice(0,2) as RoutePoint;
    else{const c=map.unproject(p);from=[c.lng,c.lat];}
   }
   const origin=map.project(from);
   drag={...startPointDrag(e.pointerId,index??-1,e.clientX,e.clientY,origin.x,origin.y,e.pointerType),from,point:from,viaIndex:index,pan:map.dragPan.isEnabled(),rotate:map.dragRotate.isEnabled(),captured:false};
   if(drag.armed){arm();e.stopPropagation();}
   else drag.timer=window.setTimeout(arm,450);
  };
  const move=(e:PointerEvent)=>{
   if(!drag||drag.id!==e.pointerId)return;
   const p=movePointDrag(drag,e.pointerId,e.clientX,e.clientY);
   if(drag.cancelled){finish();return;}if(!p)return;
   e.preventDefault();e.stopPropagation();
   const box=map.getContainer().getBoundingClientRect();
   const c=map.unproject([Math.max(0,Math.min(box.width,p[0])),Math.max(0,Math.min(box.height,p[1]))]);
   drag.point=[c.lng,c.lat];ghost.classList.add('is-visible');position();
  };
  const up=(e:PointerEvent)=>{if(drag?.id===e.pointerId){if(drag.moved){e.preventDefault();e.stopPropagation();}finish(true);}};
  const cancel=(e:PointerEvent)=>{if(drag?.id===e.pointerId)finish();};
  const click=(e:MouseEvent)=>{if(Date.now()<suppressUntil&&(e.target===canvas||(e.target as Element).closest('[data-route-via]'))){e.preventDefault();e.stopPropagation();}};
  const blur=()=>finish();
  stage.addEventListener('pointerdown',down,true);stage.addEventListener('pointermove',move,{capture:true,passive:false});
  stage.addEventListener('pointerup',up,true);stage.addEventListener('pointercancel',cancel,true);stage.addEventListener('lostpointercapture',cancel,true);
  stage.addEventListener('click',click,true);window.addEventListener('blur',blur);
  position();map.on('render',position);
  return()=>{finish();ghost.remove();map.off('render',position);stage.removeEventListener('pointerdown',down,true);stage.removeEventListener('pointermove',move,true);stage.removeEventListener('pointerup',up,true);stage.removeEventListener('pointercancel',cancel,true);stage.removeEventListener('lostpointercapture',cancel,true);stage.removeEventListener('click',click,true);window.removeEventListener('blur',blur);};
 },[map,stage,active,route]);
 return stage&&active&&route?createPortal(<div className="route-via-markers">{via.map((_,i)=><button type="button" key={i} data-route-via={i} ref={el=>{pins.current[i]=el;}} className="route-via-pin" aria-label={`Drag intermediate point ${i+1}`} title={`Drag via ${i+1} to change the route`} onContextMenu={e=>e.preventDefault()}><span>{i+1}</span></button>)}</div>,stage):null;
}
