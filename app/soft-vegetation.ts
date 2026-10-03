import {VectorTile} from '@mapbox/vector-tile';
import {PbfReader} from 'pbf';
import type {Map as LibreMap} from 'maplibre-gl';
import type * as MapLibre from 'maplibre-gl';

let sequence=0;
// Feather only vegetation. Neighbour geometry supplies the blur halo across tile edges.
export function installSoftVegetation(map:LibreMap,lib:typeof MapLibre){
 const protocol=`ezvegetation${++sequence}`;
 const cache=new Map<string,Promise<VectorTile>>();
 const lifetime=new AbortController();
 const catalog=fetch('https://tiles.openfreemap.org/planet',{signal:lifetime.signal}).then(r=>{if(!r.ok)throw Error('Vegetation tiles unavailable');return r.json();}).then(v=>(v as {tiles:string[]}).tiles[0]);
 // A rejection is handled again by each tile request; avoid an unhandled eager rejection.
 void catalog.catch(()=>{});
 function tile(z:number,x:number,y:number){
  const n=2**z;x=((x%n)+n)%n;
  const key=`${z}/${x}/${y}`;
  let value=cache.get(key);
  if(!value){
   value=catalog.then(async template=>{
    const url=template.replace('{z}',String(z)).replace('{x}',String(x)).replace('{y}',String(y));
    const r=await fetch(url,{signal:AbortSignal.any([lifetime.signal,AbortSignal.timeout(15000)])});
    if(!r.ok)throw Error('Vegetation tile unavailable');
    return new VectorTile(new PbfReader(await r.arrayBuffer()));
   });
   cache.set(key,value);void value.catch(()=>cache.delete(key));
   if(cache.size>72)cache.delete(cache.keys().next().value!);
  }
  return value;
 }
 lib.addProtocol(protocol,async(request,controller)=>{
  const match=request.url.match(/\/([0-9]+)\/([0-9]+)\/([0-9]+)$/);
  if(!match)throw Error('Invalid vegetation tile');
  const [z,x,y]=match.slice(1).map(Number),size=512,pad=32;
  const raw=document.createElement('canvas');raw.width=raw.height=size+pad*2;
  const ctx=raw.getContext('2d')!;ctx.fillStyle='#274b52';
  const neighbours=await Promise.all(Array.from({length:9},async(_,i)=>{
   const dx=i%3-1,dy=Math.floor(i/3)-1;
   return {dx,dy,data:y+dy<0||y+dy>=2**z?null:await tile(z,x+dx,y+dy)};
  }));
  controller.signal.throwIfAborted();
  for(const {dx,dy,data} of neighbours){
   if(!data)continue;
   ctx.save();ctx.beginPath();ctx.rect(pad+dx*size,pad+dy*size,size,size);ctx.clip();
   for(const name of z>=10?['park','landcover']:['park']){
    const layer=data.layers[name];if(!layer)continue;
    for(let i=0;i<layer.length;i++){
     const f=layer.feature(i);if(f.type!==3||(name==='landcover'&&f.properties.class!=='wood'))continue;
     ctx.beginPath();
     for(const ring of f.loadGeometry()){
      for(const [j,p] of ring.entries()){
       const px=pad+dx*size+p.x/layer.extent*size,py=pad+dy*size+p.y/layer.extent*size;
       if(j===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
      }
      ctx.closePath();
     }
     ctx.fill('evenodd');
    }
   }
   ctx.restore();
  }
  const out=document.createElement('canvas');out.width=out.height=size;
  const result=out.getContext('2d')!;result.filter='blur(7px)';result.drawImage(raw,-pad,-pad);
  controller.signal.throwIfAborted();
  const bitmap=await createImageBitmap(out);raw.width=out.width=1;
  if(controller.signal.aborted){bitmap.close();controller.signal.throwIfAborted();}
  return {data:bitmap};
 });
 map.addSource('soft-vegetation',{type:'raster',tiles:[`${protocol}://tiles/{z}/{x}/{y}`],tileSize:512,maxzoom:14});
 map.addLayer({id:'soft-vegetation',type:'raster',source:'soft-vegetation',paint:{'raster-opacity':0.42,'raster-fade-duration':200,'raster-resampling':'linear'}},'water');
 return ()=>{lifetime.abort();cache.clear();lib.removeProtocol(protocol);};
}
