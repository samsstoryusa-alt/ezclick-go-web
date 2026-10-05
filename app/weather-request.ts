/** Shared transport: never render an HTML proxy error or a browser fetch exception. */
export async function weatherRequest(url:string,options:RequestInit={}):Promise<Record<string,unknown>>{
 let response:Response;
 try{response=await fetch(url,options);}catch(error){
  if(options.signal?.aborted)throw error;
  throw new Error('Could not connect. Check your internet connection and try again.');
 }
 if(!response.ok){
  if(response.status===429)throw new Error('Too many requests. Wait a moment, then try again.');
  if(response.status>=500)throw new Error('Service is temporarily unavailable. Please try again.');
  const body:unknown=await response.json().catch(()=>null);
  throw new Error(body&&typeof body==='object'&&'error' in body&&typeof body.error==='string'&&body.error.length<=240?body.error:'The request could not be completed. Please try again.');
 }
 const data:unknown=await response.json().catch(()=>null);
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Could not read the response. Please try again.');
 return data as Record<string,unknown>;
}
export function validForecastResponse(value:Record<string,unknown>,count:number){
 return Number.isFinite(value.checkedAt)&&Array.isArray(value.points)&&value.points.length===count&&value.points.every(p=>
  p&&typeof p==='object'&&typeof p.available==='boolean'&&typeof p.condition==='string'&&
  (p.available?['low','caution','high'].includes(p.level):p.level==='unknown')&&
  (!p.available||(Number.isFinite(p.temperatureC)&&Number.isFinite(p.windMph)&&p.windMph>=0))&&
  ['place','windDirection','updatedAt'].every(k=>p[k]===undefined||typeof p[k]==='string')&&
  ['gustMph','precipProbability'].every(k=>p[k]==null||Number.isFinite(p[k])));
}
