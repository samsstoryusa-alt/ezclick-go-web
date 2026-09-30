'use client';
import {useEffect,useRef,type RefObject} from 'react';
import {clips,shots,frameAt,frameUrl} from './journey';

export function JourneyCanvas({time,enabled}:{time:RefObject<number>;enabled:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  if(!enabled)return;
  const surface=canvas.current!,ctx=surface.getContext('2d',{alpha:false});if(!ctx)return;
  const phoneQuery=window.matchMedia('(max-width: 800px)'),mobile=phoneQuery.matches;
  const layer=document.createElement('canvas'),layerCtx=layer.getContext('2d');
  const previous=document.createElement('canvas'),previousCtx=previous.getContext('2d');
  let renderedTime=time.current,lastTick=performance.now(),blendStart=-Infinity;
  const dispose=(image:ImageBitmap|HTMLImageElement)=>{if('close' in image)image.close();};
  const capacity=mobile?20:32,ahead=mobile?12:22;
  const cache=new Map<string,ImageBitmap|HTMLImageElement>();
  const pending=new Map<string,AbortController>();
  const failures=new Map<string,number>();
  let stopped=false,raf=0,wanted=frameAt(time.current),lastTime=time.current,direction=1,shown='',lastDrawn={clip:-1,index:-1};
  const key=(c:number,i:number)=>`${c}:${i}`;
  const order=shots.filter(s=>!s.hold).map(s=>s.clip);
  const neighbor=(offset:number)=>order[order.indexOf(wanted.clip)+offset]??-1;
  const trim=()=>{
   if(cache.size<=capacity)return;
   const entries=[...cache.keys()].sort((a,b)=>{
    const distance=(k:string)=>{const [c,i]=k.split(':').map(Number);if(c===neighbor(1)&&direction>0)return clips[wanted.clip].frames-wanted.index+i; if(c===neighbor(-1)&&direction<0)return wanted.index+clips[c].frames-i; return c!==wanted.clip?10000:Math.abs(i-wanted.index)+(direction*(i-wanted.index)<-4?20:0);};
    return distance(b)-distance(a);
   });
   for(const k of entries){if(cache.size<=capacity)break;if(k===shown||k===key(wanted.clip,wanted.index))continue;const removed=cache.get(k);if(removed)dispose(removed);cache.delete(k);}
  };
  const paint=()=>{
   if(document.documentElement.dataset.mobileDetailOpen)return;
   let index=wanted.index,img=cache.get(key(wanted.clip,index));
   // A ready intermediate frame may bridge a cache miss, never reverse the motion.
   if(!img){for(let d=1;d<=4;d++){const candidate=wanted.index-d*direction;
    if(lastDrawn.clip===wanted.clip&&(candidate-lastDrawn.index)*direction<0)continue;
    const ready=cache.get(key(wanted.clip,candidate));if(ready){img=ready;index=candidate;break;}
   }}
   if(!img&&phoneQuery.matches){
    const ready=[...cache.keys()].map(k=>k.split(':').map(Number)).filter(([c,i])=>c===wanted.clip&&(i-wanted.index)*direction<=0&&(lastDrawn.clip!==c||(i-lastDrawn.index)*direction>=0)).sort((a,b)=>Math.abs(a[1]-wanted.index)-Math.abs(b[1]-wanted.index))[0];
    if(ready){index=ready[1];img=cache.get(key(ready[0],index));}
   }
   const k=key(wanted.clip,index),now=performance.now();
   if(!img||(shown===k&&blendStart===-Infinity))return;
   // Retain the outgoing image while crossing any source-clip boundary, in either direction.
   if(mobile&&previousCtx&&lastDrawn.clip>=0&&lastDrawn.clip!==wanted.clip){
    previous.width=surface.width;previous.height=surface.height;
    previousCtx.drawImage(surface,0,0);blendStart=now;
   }
   if(phoneQuery.matches&&layerCtx){
    const ratio=Math.min(window.devicePixelRatio||1,1.5),w=Math.round(surface.clientWidth*ratio),h=Math.round(surface.clientHeight*ratio);
    if(!w||!h)return;
    if(surface.width!==w||surface.height!==h){surface.width=w;surface.height=h;layer.width=w;layer.height=h;}
    const iw=img.width,ih=img.height,cover=Math.max(w/iw,h/ih)*1.08;
    ctx.save();ctx.filter=`blur(${12*ratio}px)`;ctx.drawImage(img,(w-iw*cover)/2,(h-ih*cover)/2,iw*cover,ih*cover);ctx.restore();
    ctx.fillStyle='rgba(3,9,22,.28)';ctx.fillRect(0,0,w,h);
    const focus=[.68,.55,.5,.5,.55,.6,.58,.5,.5,.5,.5,.5,.54,.5,.5,.5][wanted.clip]??.5;
    const scale=Math.max(w/iw,h*.42/ih),dw=iw*scale,dh=ih*scale,y=h*.47-dh/2;
    layerCtx.clearRect(0,0,w,h);layerCtx.globalCompositeOperation='source-over';layerCtx.drawImage(img,(w-dw)*focus,y,dw,dh);
    const fade=layerCtx.createLinearGradient(0,y,0,y+dh);fade.addColorStop(0,'transparent');fade.addColorStop(.2,'#000');fade.addColorStop(.8,'#000');fade.addColorStop(1,'transparent');
    layerCtx.globalCompositeOperation='destination-in';layerCtx.fillStyle=fade;layerCtx.fillRect(0,0,w,h);layerCtx.globalCompositeOperation='source-over';ctx.drawImage(layer,0,0);
   }else{
    if(surface.width!==img.width||surface.height!==img.height){surface.width=img.width;surface.height=img.height;}
    ctx.drawImage(img,0,0);
   }

   if(mobile&&now-blendStart<240){
    const progress=Math.max(0,Math.min(1,(now-blendStart)/240));
    ctx.save();ctx.globalAlpha=1-progress*progress*(3-2*progress);
    ctx.drawImage(previous,0,0,surface.width,surface.height);ctx.restore();
   }
   if(now-blendStart>=240)blendStart=-Infinity;
   shown=k;lastDrawn={clip:wanted.clip,index};surface.style.opacity='1';surface.dataset.frame=k;
  };
  const load=(c:number,i:number)=>{
   if(c<0||c>=clips.length||i<0||i>=clips[c].frames||pending.size>=6)return;
   const k=key(c,i);if(cache.has(k)||pending.has(k)||(failures.get(k)??0)>performance.now())return;
   const controller=new AbortController();pending.set(k,controller);
   fetch(frameUrl(c,i),{signal:controller.signal,cache:'force-cache'})
    .then(response=>{if(!response.ok)throw new Error('Frame unavailable');return response.blob();})
    .then(async blob=>{
     if(typeof createImageBitmap==='function'){try{return await createImageBitmap(blob);}catch{/* Fall back to the native image decoder on mobile browsers. */}}
     const url=URL.createObjectURL(blob);try{const image=new Image();image.src=url;await image.decode();return image;}finally{URL.revokeObjectURL(url);}
    })
    .then(bitmap=>{if(stopped||controller.signal.aborted){dispose(bitmap);return;}cache.set(k,bitmap);paint();trim();})
    .catch(()=>{if(!controller.signal.aborted)failures.set(k,performance.now()+4000);})
    .finally(()=>{if(pending.get(k)===controller)pending.delete(k);});
  };
  const tick=()=>{
   const now=performance.now(),elapsed=Math.min(64,now-lastTick);lastTick=now;
   if(!document.hidden&&!document.documentElement.dataset.mobileDetailOpen){
    // Ease the film only; native touch scrolling and section layout remain unmodified.
    renderedTime=mobile?renderedTime+(time.current-renderedTime)*(1-Math.exp(-elapsed/140)):time.current;
    if(Math.abs(time.current-renderedTime)<.002)renderedTime=time.current;
    const t=renderedTime;direction=t===lastTime?direction:t>lastTime?1:-1;lastTime=t;wanted=frameAt(t);
    // Free request slots immediately after a chapter jump or fast scroll.
    for(const [k,controller] of pending){const [c,i]=k.split(':').map(Number);const boundary=(c===neighbor(1)&&wanted.index>clips[wanted.clip].frames-8&&i<3)||(c===neighbor(-1)&&wanted.index<8&&i>clips[c].frames-4);if(!boundary&&(c!==wanted.clip||(!phoneQuery.matches&&Math.abs(i-wanted.index)>ahead+8))){controller.abort();pending.delete(k);}}
    load(wanted.clip,wanted.index);paint();
    for(let j=1;j<=ahead;j++)load(wanted.clip,wanted.index+j*direction);
    if(wanted.index>clips[wanted.clip].frames-8)for(let j=0;j<3;j++)load(neighbor(1),j);
    if(neighbor(-1)>=0&&wanted.index<8)for(let j=1;j<=3;j++)load(neighbor(-1),clips[neighbor(-1)].frames-j);
    for(let j=1;j<=4;j++)load(wanted.clip,wanted.index-j*direction);
   }
   raf=requestAnimationFrame(tick);
  };
  const resize=()=>{shown='';paint();};window.addEventListener('resize',resize);phoneQuery.addEventListener('change',resize);
  tick();return()=>{window.removeEventListener('resize',resize);phoneQuery.removeEventListener('change',resize);stopped=true;cancelAnimationFrame(raf);pending.forEach(c=>c.abort());cache.forEach(dispose);cache.clear();};
 },[enabled,time]);
 return <canvas ref={canvas} className="journey-canvas" aria-hidden="true"/>;
}
