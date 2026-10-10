// GFS renderer's existing mm/h knots. Only recolor the known rain ramp;
// retain snow and unrecognised mixed precipitation colors unchanged.
export const RAIN_LEVELS=[0,.2,1,3,8,20,50];
const original=[[45,139,169],[43,166,178],[55,190,148],[92,201,106],[219,193,75],[226,131,67],[204,81,92]];
export const RAIN_COLORS=[[116,220,155],[57,199,94],[16,135,66],[246,222,45],[255,151,33],[239,61,45],[162,24,47]];
export const RAIN_GRADIENT='linear-gradient(90deg,'+RAIN_COLORS.map(c=>`rgb(${c.join(',')})`).join(',')+')';
export function contrastRain(r:number,g:number,b:number):number[]{
 let error=Infinity,segment=0,mix=0;
 for(let i=0;i<original.length-1;i++){
  const a=original[i],d=original[i+1].map((v,j)=>v-a[j]),p=[r-a[0],g-a[1],b-a[2]];
  const t=Math.max(0,Math.min(1,p.reduce((n,v,j)=>n+v*d[j],0)/d.reduce((n,v)=>n+v*v,0)));
  const e=p.reduce((n,v,j)=>n+(v-t*d[j])**2,0);
  if(e<error){error=e;segment=i;mix=t;}
 }
 if(error>18**2)return [r,g,b];
 return RAIN_COLORS[segment].map((v,j)=>Math.round(v+(RAIN_COLORS[segment+1][j]-v)*mix));
}
