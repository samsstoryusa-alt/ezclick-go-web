import {validTruck,type TruckProfile,type RoutePoint} from './road-route';

export const TRIP_STORAGE_KEY='ezclick-weather-trip-v1';
export type TripPoints=[RoutePoint|null,RoutePoint|null];
type SavedTrip={version:1;points:TripPoints;truck?:TruckProfile;confirmed:boolean;builtKey:string|null;departure:string;stops:number};
export const defaultTripPoints=():TripPoints=>[[-86.7816,36.1627],[-81.6557,30.3322]];
export function standaloneWeather(){return typeof document!=='undefined'&&document.documentElement.dataset.weatherStandalone==='true';}
function point(p:unknown):p is RoutePoint|null{return p===null||(Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=85);}
export function readTrip():SavedTrip|null{
 if(!standaloneWeather())return null;
 try{
  const value=localStorage.getItem(TRIP_STORAGE_KEY);if(!value)return null;
  const v=JSON.parse(value);
  if(!v||v.version!==1||!Array.isArray(v.points)||v.points.length!==2||!v.points.every(point))return null;
  const truck=v.truck&&typeof v.truck==='object'&&validTruck(v.truck)&&typeof v.truck.hazmat==='boolean'?v.truck:undefined;
  return {version:1,points:v.points,truck,confirmed:!!truck&&v.confirmed===true,builtKey:typeof v.builtKey==='string'?v.builtKey:null,
   departure:typeof v.departure==='string'&&v.departure.length<40&&(v.departure===''||Number.isFinite(Date.parse(v.departure)))?v.departure:'',
   stops:Number.isFinite(v.stops)&&v.stops>=0&&v.stops<=4320?v.stops:0};
 }catch{return null;}
}
export function saveTrip(patch:Partial<Omit<SavedTrip,'version'>>){
 if(!standaloneWeather())return;
 try{localStorage.setItem(TRIP_STORAGE_KEY,JSON.stringify({...{points:defaultTripPoints(),confirmed:false,builtKey:null,departure:'',stops:0},...readTrip(),...patch,version:1}));}catch{/* Storage can be blocked or full; the current trip remains usable. */}
}
