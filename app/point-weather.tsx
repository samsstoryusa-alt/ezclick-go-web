"use client";
import {useWeatherLanguage} from './weather-language';
import {useEffect, useState} from 'react';
import type {Map as LibreMap} from 'maplibre-gl';
import PointPlace from './point-place';
import {temperature,windSpeed,type WeatherUnits} from './weather-units';
import {windPair,sampleWind,useWeatherClock,type WindFrame} from './wind-field';
import {sampleHourly,type HourlyWeather} from './weather-time';

type Current = {temperature_2m:number; wind_speed_10m:number; wind_direction_10m:number; weather_code:number; time:number};
type Reading = {current:Current; timezone_abbreviation:string;hourly:HourlyWeather};
const directions=['N','NE','E','SE','S','SW','W','NW'];
function condition(code:number) {
  if(code===0)return 'Clear';
  if(code<=3)return 'Cloudy';
  if(code===45||code===48)return 'Fog';
  if([56,57,66,67].includes(code))return 'Freezing rain';
  if([71,73,75,77,85,86].includes(code))return 'Snow';
  if(code>=95)return 'Thunderstorm';
  if(code>=51)return 'Rain';
  return 'Weather';
}
export default function PointWeather({map,ready,time,windFrames,units,onToggleUnits}:{map:LibreMap|null;ready:boolean;time:number|null;windFrames:WindFrame[];units:WeatherUnits;onToggleUnits:()=>void}) {
  const {t,locale,dir}=useWeatherLanguage();
  const now=useWeatherClock();
  const [reading,setReading]=useState<Reading|null>(null);
  const [status,setStatus]=useState('Loading…');
  const [busy,setBusy]=useState(true);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!map||!ready)return;
    let disposed=false, timer=0, version=0;
    let controller:AbortController|undefined;
    const cache=new Map<string,{at:number;value:Reading}>();
    const cancel=()=>{version++;window.clearTimeout(timer);controller?.abort();};
    const load=async()=>{
      cancel();const ticket=version;
      const canvas=map.getCanvas();
      const point=map.unproject([canvas.clientWidth/2,canvas.clientHeight/2]);
      const lat=Math.max(-90,Math.min(90,point.lat)).toFixed(2);
      const lon=(((point.lng+180)%360+360)%360-180).toFixed(2);
      const key=lat+','+lon;
      const saved=cache.get(key);
      setBusy(true);setStatus('Updating…');
      if(saved&&Date.now()-saved.at<300000){setReading(saved.value);setBusy(false);setStatus('');return;}
      controller=new AbortController();const request=controller;
      const timeout=window.setTimeout(()=>request.abort(),12000);
      try {
        const query=new URLSearchParams({latitude:lat,longitude:lon,current:'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m',hourly:'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m',past_days:'1',forecast_days:'2',timeformat:'unixtime',timezone:'auto',temperature_unit:'celsius',wind_speed_unit:'kmh'});
        const response=await fetch('https://api.open-meteo.com/v1/forecast?'+query,{signal:request.signal});
        if(!response.ok)throw new Error('Weather unavailable');
        const value=await response.json() as Reading;
        if(!value.current||![value.current.temperature_2m,value.current.wind_speed_10m,value.current.wind_direction_10m,value.current.weather_code].every(v=>typeof v==='number'&&Number.isFinite(v))||typeof value.current.time!=='number')throw new Error('Incomplete weather');
        if(disposed||ticket!==version)return;
        if(cache.size>=60)cache.delete(cache.keys().next().value!);
        cache.set(key,{at:Date.now(),value});setReading(value);setBusy(false);setStatus('');
      } catch {if(!disposed&&ticket===version){setReading(null);setBusy(false);setStatus('Weather unavailable');}}
      finally {window.clearTimeout(timeout);}
    };
    const moving=()=>{cancel();setBusy(true);setStatus('Move map to select');};
    const settled=()=>{window.clearTimeout(timer);timer=window.setTimeout(()=>void load(),500);};
    map.on('movestart',moving);map.on('moveend',settled);
    settled();
    const refresh=window.setInterval(()=>{if(!map.isMoving())settled();},300000);
    return()=>{disposed=true;cancel();window.clearInterval(refresh);map.off('movestart',moving);map.off('moveend',settled);};
  },[map,ready,attempt]);
  const sampled=reading?.hourly&&time!==null?sampleHourly(reading.hourly,time):null;
  const current=time===null?reading?.current:sampled&&sampled.temperature!==null&&sampled.code!==null?{temperature_2m:sampled.temperature,wind_speed_10m:sampled.speed,wind_direction_10m:sampled.direction,weather_code:sampled.code,time:time/1000}:null;
  const label=current?condition(current.weather_code):'Weather';
  const center=map?.getCenter();
  const wind=center?sampleWind(windPair(windFrames,time??now,now),center.lng,center.lat):null;
  return <section className="point-weather" aria-label={t('Current weather at map center')} aria-busy={busy}>
    <PointPlace map={map} ready={ready}/><div className="point-weather-heading"><strong dir={dir}>{t(time===null?'Now':'Selected time')}</strong><small dir={dir}>{status?t(status):current?new Date(current.time*1000).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'})+' '+t('local'):t('No data for this time')}</small></div>
    <div className={`point-weather-values ${busy?'is-updating':''}`} aria-live="polite">
      <div className="point-weather-row"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4a5 5 0 0 0-9 4M3 3l1 1M10 1v2M1 9h2M17 3l-1 1M7 19h11a4 4 0 0 0 0-8 6 6 0 0 0-11-1 4.5 4.5 0 0 0 0 9Z"/></svg><span dir={dir}>{t(label)}</span><strong dir="ltr">{current?`${temperature(current.temperature_2m,units)} °${units==='us'?'F':'C'}`:'—'}</strong></div>
      <div className="point-weather-row"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 8h14a3 3 0 1 0-3-3M2 12h18a2 2 0 1 1-2 2M2 16h8a3 3 0 1 1-3 3"/></svg><span dir={dir}>{t('Wind')}</span><strong dir="ltr">{wind?`${windSpeed(wind.speed,units)} ${units==='us'?'mph':'km/h'} · ${directions[Math.round(wind.direction/45)%8]}`:'—'}</strong></div>
    </div>
    <div className="weather-units-row"><span dir={dir}>{t('Units')}</span><button type="button" dir="ltr" className="weather-units-toggle" aria-label={t('US units: Fahrenheit and miles per hour')} aria-pressed={units==='us'} onClick={onToggleUnits}><span className={units==='metric'?'is-selected':''}>°C · km/h</span><span className={units==='us'?'is-selected':''}>°F · mph</span></button></div>
    <div className="point-weather-credit"><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a><a href="https://www.ncei.noaa.gov/products/weather-climate-models/global-forecast" target="_blank" rel="noreferrer">{t('Wind: NOAA GFS')}</a><span dir={dir}>{t('Model estimate')}</span>{!busy&&!reading&&<button dir={dir} onClick={()=>setAttempt(n=>n+1)}>{t('Retry')}</button>}</div>
  </section>;
}
