import {validTruck,type TruckProfile,type RoutePoint} from './road-route';

export const TRIP_STORAGE_KEY='ezclick-weather-trip-v1';
export type TripPoints=[RoutePoint|null,RoutePoint|null];
type SavedTrip={version:1;points:TripPoints;truck?:TruckProfile;confirmed:boolean;builtKey:string|null;departure:string;departureZone?:string;stops:number};
export const defaultTripPoints=():TripPoints=>[null,null];
export function standaloneWeather(){return typeof document!=='undefined'&&document.documentElement.dataset.weatherStandalone==='true';}
function point(p:unknown):p is RoutePoint|null{return p===null||(Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=85);}
export function departureZone(){return Intl.DateTimeFormat().resolvedOptions().timeZone;}
export function normalizeDeparture(value:unknown){
 if(typeof value!=='string'||value.length>=40||!value)return '';
 const instant=Date.parse(value);return Number.isFinite(instant)?new Date(instant).toISOString():'';
}
function validZone(value:unknown):value is string{try{if(typeof value!=='string'||value.length>80)return false;new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}}
export function readTrip():SavedTrip|null{
 if(!standaloneWeather())return null;
 try{
  const value=localStorage.getItem(TRIP_STORAGE_KEY);if(!value)return null;
  const v=JSON.parse(value);
  if(!v||v.version!==1||!Array.isArray(v.points)||v.points.length!==2||!v.points.every(point))return null;
  const truck=v.truck&&typeof v.truck==='object'&&validTruck(v.truck)&&typeof v.truck.hazmat==='boolean'?v.truck:undefined;
  const departure=normalizeDeparture(v.departure);
  const zone=validZone(v.departureZone)?v.departureZone:departureZone();
  // Legacy wall-clock values have no recoverable original zone. Anchor once in
  // the current device zone, then persist the instant before any later travel.
  if(departure&&v.departure!==departure){try{localStorage.setItem(TRIP_STORAGE_KEY,JSON.stringify({...v,departure,departureZone:zone}));}catch{/* Storage may be unavailable. */}}
  return {version:1,points:v.points,truck,confirmed:!!truck&&v.confirmed===true,builtKey:typeof v.builtKey==='string'?v.builtKey:null,
   departure,departureZone:zone,
   stops:Number.isFinite(v.stops)&&v.stops>=0&&v.stops<=4320?v.stops:0};
 }catch{return null;}
}
export function saveTrip(patch:Partial<Omit<SavedTrip,'version'>>){
 if(!standaloneWeather())return;
 try{localStorage.setItem(TRIP_STORAGE_KEY,JSON.stringify({...{points:defaultTripPoints(),confirmed:false,builtKey:null,departure:'',stops:0},...readTrip(),...patch,...(patch.departure!==undefined?{departure:normalizeDeparture(patch.departure)}:{}),version:1}));}catch{/* Storage can be blocked or full; the current trip remains usable. */}
}

// A past departure becomes rolling "leave now"; future plans keep their instant.
export function currentDeparture(value:string,now:number):string{
 const instant=Date.parse(value);
 return value&&Number.isFinite(instant)&&instant>now?value:'';
}
