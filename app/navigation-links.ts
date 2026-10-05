export type NavigationPoint=[number,number];
export function navigationLink(provider:'google'|'truckerpath',platform:'ios'|'android'|'web',start:NavigationPoint,end:NavigationPoint){
 const coordinate=(p:NavigationPoint)=>{if(!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>90)throw new Error('Invalid navigation coordinates');return `${p[1]},${p[0]}`;};
 const a=coordinate(start),b=coordinate(end);
 if(provider==='google'){const q=new URLSearchParams({api:'1',origin:a,destination:b,travelmode:'driving'});return `https://www.google.com/maps/dir/?${q}`;}
 if(platform==='web')return null;
 const q=new URLSearchParams(platform==='android'?{s_addr:a,d_addr:b}:{saddr:a,daddr:b});return `truckerpath://cal_route?${q}`;
}
