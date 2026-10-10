export type WeatherConcern='unknown'|'low'|'caution'|'high';
export const weatherConcernColors={unknown:'#bba6ff',low:'#8ee4c2',caution:'#e9b35f',high:'#ee737e'} as const;
type WeatherStatus={available:boolean;level:WeatherConcern};
/** Highest known concern; ties keep the earliest sample along the route. */
export function mostConcerningCheckpoint(points:readonly WeatherStatus[]):number{
 const high=points.findIndex(p=>p.available&&p.level==='high');
 return high>=0?high:points.findIndex(p=>p.available&&p.level==='caution');
}
export function isWeatherWarning(point:WeatherStatus){
 return point.available&&(point.level==='caution'||point.level==='high');
}
/** Retain the original sample index so a marker opens the matching forecast. */
export function weatherWarningMarkers(points:readonly (WeatherStatus&{lon:number;lat:number})[]){
 return {type:'FeatureCollection' as const,features:points.flatMap((point,index)=>isWeatherWarning(point)?[{
  type:'Feature' as const,id:index,
  properties:{index,label:String(index+1),color:weatherConcernColors[point.level]},
  geometry:{type:'Point' as const,coordinates:[point.lon,point.lat]},
 }]:[])};
}
