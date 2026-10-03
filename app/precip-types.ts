export type TypeFrame={time:number;url:string};
export function nearestTypeFrame(frames:TypeFrame[],time:number):TypeFrame|null{
 let best:TypeFrame|null=null;for(const frame of frames){if(Number.isFinite(frame.time)&&Math.abs(frame.time-time)<=240000&&(!best||Math.abs(frame.time-time)<Math.abs(best.time-time)))best=frame;}return best;
}
// Local preview uses a private SSH tunnel. Production needs a same-origin proxy.
export function typeServiceBase(){return ['127.0.0.1','localhost'].includes(window.location.hostname)?'http://127.0.0.1:8766':'/weather-types';}
export async function typeCatalog(signal:AbortSignal):Promise<TypeFrame[]>{
 try{const response=await fetch(typeServiceBase()+'/frames',{signal:AbortSignal.any([signal,AbortSignal.timeout(5000)])});if(!response.ok)return [];const data=await response.json() as {frames?:TypeFrame[]};return Array.isArray(data.frames)?data.frames.filter((f:TypeFrame)=>Number.isFinite(f.time)&&/^\/mask\/\d{13}\.png$/.test(f.url)):[];}catch{return [];}
}
export async function typeMask(frame:TypeFrame|null,signal:AbortSignal){
 if(!frame)return null;
 try{const response=await fetch(typeServiceBase()+frame.url,{signal:AbortSignal.any([signal,AbortSignal.timeout(7000)])});if(!response.ok)return null;return await createImageBitmap(await response.blob());}catch{return null;}
}
