"use client";
import {useSyncExternalStore} from 'react';
export type WeatherQuality='light'|'balanced'|'maximum';
const KEY='ezclick-weather-quality',EVENT='ezclick-weather-quality-change';
export const qualityProfiles={
 // Save rendering work with fewer pixels and particles, not choppy motion.
 light:{pixelRatio:1,windFps:30,particleScale:.35,minParticles:60,maxParticles:400,radarFps:30},
 balanced:{pixelRatio:1.5,windFps:30,particleScale:1,minParticles:150,maxParticles:1200,radarFps:30},
 maximum:{pixelRatio:2,windFps:45,particleScale:1.6,minParticles:240,maxParticles:2000,radarFps:45},
} as const;
let sessionChoice:WeatherQuality|null=null;
export function validQuality(value:unknown):value is WeatherQuality{return value==='light'||value==='balanced'||value==='maximum';}
export function getWeatherQuality():WeatherQuality{if(sessionChoice)return sessionChoice;try{const saved=localStorage.getItem(KEY);sessionChoice=validQuality(saved)?saved:'balanced';return sessionChoice;}catch{sessionChoice='balanced';return sessionChoice;}}
function subscribe(notify:()=>void){const storage=(event:StorageEvent)=>{if(event.key===KEY||event.key===null){sessionChoice=null;notify();}};window.addEventListener('storage',storage);window.addEventListener(EVENT,notify);return()=>{window.removeEventListener('storage',storage);window.removeEventListener(EVENT,notify);};}
export function setWeatherQuality(next:WeatherQuality){if(!validQuality(next))return;sessionChoice=next;try{localStorage.setItem(KEY,next);}catch{/* Keep the choice for this session. */}window.dispatchEvent(new Event(EVENT));}
export function useWeatherQuality(){return useSyncExternalStore(subscribe,getWeatherQuality,()=>'balanced' as WeatherQuality);}
