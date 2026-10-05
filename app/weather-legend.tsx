"use client";
import {useWeatherLanguage} from './weather-language';
import {useEffect} from 'react';
import type {Map as LibreMap} from 'maplibre-gl';
import {WeatherSymbol} from './forecast-condition';
import {WIND_COLORS} from './weather-palette';
import type {WeatherUnits} from './weather-units';
import './weather-legend.css';
export function WindGradient({units}:{units:WeatherUnits}){return <><i style={{background:`linear-gradient(90deg,${WIND_COLORS.join(',')})`}} aria-hidden="true"/><span className="legend-speed-values" dir="ltr">{(units==='us'?['0','9','19','31+ mph']:['0','15','30','50+ km/h']).map(v=><span key={v}>{v}</span>)}</span></>;}
export default function WeatherLegend({open,onClose,map,units}:{open:boolean;onClose:()=>void;map:LibreMap|null;units:WeatherUnits}){
 const {t,dir}=useWeatherLanguage();
 useEffect(()=>{if(!open)return;const close=()=>onClose();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){onClose();document.getElementById('weather-legend-toggle')?.focus();}};map?.on('click',close);document.addEventListener('keydown',key);return()=>{map?.off('click',close);document.removeEventListener('keydown',key);};},[open,onClose,map]);
 return <section id="weather-legend" aria-label={t('Weather legend')} aria-hidden={!open} inert={!open} className={`weather-legend-panel ${open?'is-open':''}`}><header dir={dir}><strong>{t('Legend')}</strong><button type="button" dir={dir} aria-label={t('Close legend')} onClick={onClose}>×</button></header>{(['rain','snow','wind'] as const).map(kind=><div className="weather-legend-row" key={kind}><WeatherSymbol kind={kind} size={28}/><div><div className="legend-row-title" dir={dir}><strong>{t(kind==='rain'?'Rain':kind==='snow'?'Snow':'Wind')}</strong>{kind!=='wind'&&<small dir="ltr">{t('Light → Heavy')}</small>}</div>{kind==='wind'?<WindGradient units={units}/>:<i className={`legend-${kind}-bar`} aria-hidden="true"/>}</div></div>)}</section>;
}
