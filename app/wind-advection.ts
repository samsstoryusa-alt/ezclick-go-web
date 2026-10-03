// Integrate curved wind paths without the outward drift of a single Euler step.
type Vector = {u:number;v:number};
type Sampler = (lon:number,lat:number)=>Vector|null;
export function advectWind(lon:number,lat:number,step:number,sample:Sampler){
 const velocity=(x:number,y:number)=>{const v=sample(x,y);return v?{x:v.u/Math.max(.15,Math.cos(y*Math.PI/180)),y:v.v}:null;};
 const first=velocity(lon,lat);if(!first)return null;
 // Keep intermediate samples well inside the half-degree weather grid.
 const steps=Math.max(1,Math.min(24,Math.ceil(Math.hypot(first.x,first.y)*step/.04)));
 const h=step/steps;
 for(let i=0;i<steps;i++){
  const a=velocity(lon,lat);if(!a)return null;
  const b=velocity(lon+a.x*h/2,lat+a.y*h/2);if(!b)return null;
  const c=velocity(lon+b.x*h/2,lat+b.y*h/2);if(!c)return null;
  const d=velocity(lon+c.x*h,lat+c.y*h);if(!d)return null;
  lon+=h*(a.x+2*b.x+2*c.x+d.x)/6;
  lat+=h*(a.y+2*b.y+2*c.y+d.y)/6;
 }
 return {lon,lat};
}