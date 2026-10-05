"use client";
import {useCallback,useSyncExternalStore} from 'react';
import {languages,translateWeather,type WeatherLanguage} from './weather-translations';
export {languages,type WeatherLanguage} from './weather-translations';
const KEY='ezclick-weather-language';
const EVENT='ezclick-weather-language-change';
let sessionChoice:WeatherLanguage|null=null;
function supported(value:string|null):value is WeatherLanguage{return languages.some(item=>item.code===value);}
export function detectWeatherLanguage(preferences:readonly string[]):WeatherLanguage{
 for(const preference of preferences){const base=preference.toLowerCase().split(/[-_]/)[0];if(supported(base))return base;}
 return 'en';
}
function snapshot():WeatherLanguage{
 if(sessionChoice)return sessionChoice;
 try{const value=localStorage.getItem(KEY);if(supported(value))return value;}catch{/* Private browsing can disable storage. */}
 return typeof navigator==='undefined'?'en':detectWeatherLanguage(navigator.languages?.length?navigator.languages:[navigator.language]);
}
function subscribe(notify:()=>void){
 const storage=(event:StorageEvent)=>{if(event.key===KEY||event.key===null){sessionChoice=null;notify();}};
 window.addEventListener('storage',storage);window.addEventListener(EVENT,notify);
 return()=>{window.removeEventListener('storage',storage);window.removeEventListener(EVENT,notify);};
}
export function useWeatherLanguage(){
 const language=useSyncExternalStore(subscribe,snapshot,()=>'en' as WeatherLanguage);
 const item=languages.find(item=>item.code===language)??languages[0];
 const setLanguage=useCallback((next:WeatherLanguage)=>{if(!supported(next))return;sessionChoice=next;try{localStorage.setItem(KEY,next);}catch{/* Retain the choice in this session. */}window.dispatchEvent(new Event(EVENT));},[]);
 const t=useCallback((text:string)=>translateWeather(text,language),[language]);
 return {language,locale:item.locale,dir:item.dir,t,setLanguage};
}
