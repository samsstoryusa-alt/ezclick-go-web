import {Cloud,CloudRain,CloudSnow,Sun,CloudFog,HelpCircle,Wind,Snowflake,OctagonX} from 'lucide-react';
export type WeatherKind='unknown'|'clear'|'cloud'|'rain'|'snow'|'ice'|'storm'|'fog'|'wind';
export function forecastCondition(p:{available:boolean;condition:string;windMph?:number;gustMph?:number|null}):{kind:WeatherKind;label:string}{
 if(!p.available)return {kind:'unknown',label:'No forecast'};
 const c=p.condition.toLowerCase();
 if(/thunder|\bt-?storms?\b/.test(c))return {kind:'storm',label:'Thunderstorms'};
 if(/freezing rain|freezing drizzle|ice pellets|\bsleet\b|\bice\b/.test(c))return {kind:'ice',label:'Ice / freezing rain'};
 if(/blizzard|winter storm/.test(c))return {kind:'snow',label:'Winter storm'};
 if(/snow|flurr/.test(c))return {kind:'snow',label:'Snow'};
 if(/rain|shower|drizzle/.test(c))return {kind:'rain',label:'Rain'};
 if(/fog|mist|haze/.test(c))return {kind:'fog',label:'Low visibility'};
 if((p.windMph??0)>=20||(p.gustMph??0)>=45)return {kind:'wind',label:(p.windMph??0)>=35||(p.gustMph??0)>=45?'Strong wind':'Elevated wind'};
 if(/cloud|overcast/.test(c))return {kind:'cloud',label:'Cloudy'};
 if(/clear|sun/.test(c))return {kind:'clear',label:'Clear'};
 return {kind:'cloud',label:p.condition};
}
const symbols={unknown:HelpCircle,clear:Sun,cloud:Cloud,rain:CloudRain,snow:CloudSnow,ice:Snowflake,storm:Cloud,fog:CloudFog,wind:Wind,closure:OctagonX};
// Closure is deliberately a separate icon; forecastCondition never infers a closure.
export function WeatherSymbol({kind,size=24,color}:{kind:WeatherKind|'closure';size?:number;color?:string}){
 if(kind==='storm')return <span className="forecast-symbol forecast-symbol--storm" aria-hidden="true"><svg style={{color}} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><g className="storm-scene"><path className="storm-cloud" d="M7 16H6a4 4 0 0 1-.8-7.92 6 6 0 0 1 11.7-1.3A4.5 4.5 0 0 1 19 15.8"/><path className="storm-bolt" d="m14.2 11-4 6h5l-3 5"/><path className="storm-drop storm-drop-one" d="m5 18-1 2"/><path className="storm-drop storm-drop-two" d="m19 18-1 2"/></g></svg></span>;
 if(kind==='rain')return <span className="forecast-symbol forecast-symbol--rain" aria-hidden="true"><svg style={{color}} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path className="rain-cloud" d="M7 15H6a4 4 0 0 1-.8-7.92 6 6 0 0 1 11.7-1.3A4.5 4.5 0 0 1 19 14.8"/><path className="rain-drop rain-drop-one" d="m8 16-1 3"/><path className="rain-drop rain-drop-two" d="m13 16-1 3"/><path className="rain-drop rain-drop-three" d="m18 16-1 3"/></svg></span>;
 if(kind==='snow')return <span className="forecast-symbol forecast-symbol--snow" aria-hidden="true"><svg style={{color}} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path className="snow-cloud" d="M7 14H6a4 4 0 0 1-.8-7.92 6 6 0 0 1 11.7-1.3A4.5 4.5 0 0 1 19 13.8"/><path className="snow-flake snow-flake-one" d="M7 16v3m-1.3-2.25 2.6 1.5m-2.6 0 2.6-1.5"/><path className="snow-flake snow-flake-two" d="M12 16v3m-1.3-2.25 2.6 1.5m-2.6 0 2.6-1.5"/><path className="snow-flake snow-flake-three" d="M17 16v3m-1.3-2.25 2.6 1.5m-2.6 0 2.6-1.5"/></svg></span>;
 if(kind==='wind')return <span className="forecast-symbol forecast-symbol--wind" aria-hidden="true"><svg style={{color}} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path className="wind-stream wind-stream-one" d="M3 8h10a3 3 0 1 0-3-3"/><path className="wind-stream wind-stream-two" d="M2 12h17a2.5 2.5 0 1 0-2.5-2.5"/><path className="wind-stream wind-stream-three" d="M4 16h9a3 3 0 1 1-3 3"/></svg></span>;
 const Icon=symbols[kind];
 return <span className={`forecast-symbol forecast-symbol--${kind}`} aria-hidden="true"><Icon size={size} style={{color}}/></span>;
}
