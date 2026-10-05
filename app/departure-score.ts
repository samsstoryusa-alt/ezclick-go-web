export type RiskPoint={available:boolean;level:string};
export function summarizeDeparture(points:RiskPoint[],expected:number){
 const known=points.filter(p=>p.available&&['low','caution','high'].includes(p.level));
 return {complete:points.length===expected&&known.length===expected&&expected>0,high:known.filter(p=>p.level==='high').length,caution:known.filter(p=>p.level==='caution').length,total:expected};
}
export function betterDeparture(a:ReturnType<typeof summarizeDeparture>,b:ReturnType<typeof summarizeDeparture>){return a.complete&&b.complete&&a.high<=b.high&&a.caution<=b.caution&&(a.high<b.high||a.caution<b.caution);}
