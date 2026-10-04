import {RouteMapSnapshot} from './route-map-snapshot';
import geography from './load-geography.json';
import roadRoutes from './load-road-routes.json';
const routes=roadRoutes as Record<string,{coordinates:number[][];distanceMeters:number}>;
const cities=geography.cities as Record<string,number[]>;
function project([lon,lat]:number[]){return [lon,-Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))*180/Math.PI];}
export function LoadMiniMap({origin,destination}:{origin:string;destination:string}){
 const road=routes[`${origin} → ${destination}`];
 const points=road.coordinates.map(project),a=points[0],b=points[points.length-1];
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=Math.min(360/Math.max(maxX-minX,2.2),170/Math.max(maxY-minY,1.2));
 const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
 const fit=(p:number[])=>[(p[0]-cx)*scale+300,(p[1]-cy)*scale+165];
 const aa=fit(a),bb=fit(b);
 const routePath=points.map((point,i)=>{const p=fit(point);return `${i?'L':'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`;}).join(' ');
 const nearby=Object.entries(cities).filter(([name])=>name!==origin&&name!==destination).map(([name,c])=>({name,p:fit(project(c))})).filter(({p})=>p[0]>100&&p[0]<500&&p[1]>45&&p[1]<285&&Math.hypot(p[0]-aa[0],p[1]-aa[1])>110&&Math.hypot(p[0]-bb[0],p[1]-bb[1])>110);
 const context:typeof nearby=[];for(const city of nearby){if(context.every(c=>Math.hypot(c.p[0]-city.p[0],c.p[1]-city.p[1])>150))context.push(city);if(context.length===3)break;}
 return <RouteMapSnapshot origin={origin} destination={destination} coordinates={road.coordinates}><svg className="load-geographic-map" viewBox="0 0 600 330" role="img" aria-label={`Map, north up. A: ${origin}. B: ${destination}. Road route preview; not truck-specific navigation.`}>
  {geography.polygons.map((ring,i)=><path key={i} className="mini-state" d={ring.map((c,j)=>{const p=fit(project(c));return `${j?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`;}).join(' ')+'Z'}/>)}
  {context.map(({name,p})=><g key={name} className="mini-context"><circle cx={p[0]} cy={p[1]} r="3"/><text x={p[0]} y={p[1]+22} textAnchor="middle">{name.split(',')[0]}</text></g>)}
  <path className="mini-connection-glow" d={routePath}/><path className="mini-connection" d={routePath}/>
  {[{p:aa,name:origin,label:'A',above:aa[1]<=bb[1]},{p:bb,name:destination,label:'B',above:bb[1]<aa[1]}].map(({p,name,label,above})=><g key={label} className="mini-endpoint"><circle cx={p[0]} cy={p[1]} r="13"/><text className="mini-marker-letter" x={p[0]} y={p[1]+5} textAnchor="middle">{label}</text><text className="mini-city-label" x={p[0]} y={p[1]+(above?-28:40)} textAnchor={p[0]<220?'start':p[0]>380?'end':'middle'}>{name.split(',')[0]}</text></g>)}
  <text x="574" y="29" className="mini-north" textAnchor="middle">N ↑</text>
 </svg></RouteMapSnapshot>;
}
