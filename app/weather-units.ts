import {useSyncExternalStore} from 'react';
export type WeatherUnits='metric'|'us';
const KEY='ezclick-weather-units';
let fallback:WeatherUnits='metric';
function snapshot():WeatherUnits{try{const saved=localStorage.getItem(KEY);return saved==='us'||saved==='metric'?saved:fallback;}catch{return fallback;}}
function subscribe(notify:()=>void){window.addEventListener('storage',notify);window.addEventListener('ezclick-weather-units',notify);return()=>{window.removeEventListener('storage',notify);window.removeEventListener('ezclick-weather-units',notify);};}
export function useWeatherUnits(){
 const units=useSyncExternalStore(subscribe,snapshot,()=>'metric' as WeatherUnits);
 function toggle(){const next=snapshot()==='metric'?'us':'metric';fallback=next;try{localStorage.setItem(KEY,next);}catch{/* Keep the choice for this session if storage is blocked. */}window.dispatchEvent(new Event('ezclick-weather-units'));}
 return {units,toggle};
}
export function temperature(celsius:number,units:WeatherUnits){return Math.round(units==='us'?celsius*9/5+32:celsius);}
export function windSpeed(kmh:number,units:WeatherUnits){return Math.round(units==='us'?kmh/1.609344:kmh);}
