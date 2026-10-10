import type {RoutePoint,TruckProfile,VehicleType} from './road-route';

export const MAX_VIA_POINTS=5;
export function validViaPoints(value:unknown):value is RoutePoint[]{
 return Array.isArray(value)&&value.length<=MAX_VIA_POINTS&&value.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=85);
}
export function roadRouteKey(points:[RoutePoint|null,RoutePoint|null],truck:TruckProfile,vehicle:VehicleType,via:RoutePoint[]=[]){
 return JSON.stringify({points,truck,vehicle,...(via.length?{via}:{})});
}
// Position along the actual road geometry, including bends, not the A–B chord.
export function routePosition(point:RoutePoint,coordinates:RoutePoint[]){
 let best=Infinity,position=0;
 const scale=Math.cos(point[1]*Math.PI/180);
 for(let i=1;i<coordinates.length;i++){
  const a=coordinates[i-1],b=coordinates[i],x=(b[0]-a[0])*scale,y=b[1]-a[1];
  const u=(point[0]-a[0])*scale,v=point[1]-a[1];
  const t=Math.max(0,Math.min(1,(u*x+v*y)/(x*x+y*y||1)));
  const distance=(u-x*t)**2+(v-y*t)**2;
  if(distance<best){best=distance;position=i-1+t;}
 }
 return position;
}
export function insertRouteVia(via:RoutePoint[],point:RoutePoint,from:RoutePoint,coordinates:RoutePoint[]){
 if(via.length>=MAX_VIA_POINTS)throw Error('You can add up to five intermediate points.');
 const position=routePosition(from,coordinates);
 const index=via.findIndex(p=>routePosition(p,coordinates)>position);
 const next=[...via];next.splice(index<0?next.length:index,0,point);return next;
}
