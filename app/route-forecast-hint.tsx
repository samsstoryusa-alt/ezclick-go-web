import {useWeatherLanguage} from './weather-language';
import './route-mobile-hint.css';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Map as LibreMap} from 'maplibre-gl';
import {forecastCondition,WeatherSymbol} from './forecast-condition';
import {weatherConcernColors} from './route-weather-display';
import {temperature,type WeatherUnits} from './weather-units';
type ForecastHint={lon:number;lat:number;eta:number;available:boolean;condition:string;temperatureC?:number;windDirection?:string;windMph?:number;gustMph?:number|null;place?:string;level:'unknown'|'low'|'caution'|'high'};
export function ForecastHintContent({point,index,units,distance}:{point:ForecastHint;index:number;units:WeatherUnits;distance?:string}){
 const {language,locale,dir,t}=useWeatherLanguage();
 const {kind,label}=forecastCondition(point);
 const speed=point.available&&point.windMph!=null?`${Math.round(point.windMph*(units==='us'?1:1.609344))} ${units==='us'?'mph':'km/h'}${point.windDirection?' · '+point.windDirection:''}`:t("Unavailable");
 const weather=point.available?(language==='en'?(point.condition||t("Forecast unavailable")):t(label)):t("Forecast unavailable");
 return <><span dir={dir} className="hint-heading"><WeatherSymbol kind={kind} size={32} color={weatherConcernColors[point.level]}/><span><strong title={point.place}>{point.place||`${t('Checkpoint')} ${index+1}`}</strong><span className="hint-time">{t('Arrival')} · <time dateTime={new Date(point.eta).toISOString()}>{new Date(point.eta).toLocaleTimeString(locale,{hour:'numeric',minute:'2-digit'})}</time> <small>{t('your time')}</small></span></span></span><span dir={dir} className="hint-weather"><span className="hint-condition" title={point.condition||weather}>{weather}</span>{point.available&&point.temperatureC!=null&&<b>{temperature(point.temperatureC,units)}°{units==='us'?'F':'C'}</b>}</span><span dir={dir} className="hint-wind"><WeatherSymbol kind="wind" size={14}/>{t('Wind')} <b>{speed}</b>{distance&&<small className="hint-distance">{distance}</small>}</span></>;
}
export default function RouteForecastHint({map,point,index,units,onSelect,compact=false,controlled=false,open=true,distance}:{map:LibreMap;units:WeatherUnits;point:ForecastHint;index:number;onSelect:()=>void;compact?:boolean;controlled?:boolean;open?:boolean;distance?:string}){
 const {dir,t}=useWeatherLanguage();
 const ref=useRef<HTMLButtonElement>(null);
 const [entered,setEntered]=useState(false);
 useEffect(()=>{const frame=requestAnimationFrame(()=>setEntered(true));return()=>cancelAnimationFrame(frame);},[]);
 const {label}=forecastCondition(point);
 const stage=map.getContainer().parentElement;
 useEffect(()=>{
  const el=ref.current;if(!el||!stage)return;
  const position=()=>{
   const panelElement=stage.querySelector<HTMLElement>('.weather-left-stack');
   const box=map.getContainer().getBoundingClientRect(),parent=stage.getBoundingClientRect(),panel=panelElement&&getComputedStyle(panelElement).visibility!=='hidden'?panelElement.getBoundingClientRect():undefined;
   const p=map.project([point.lon,point.lat]),widePanel=panel&&panel.width>box.width*.7;
   const left=panel&&!widePanel?Math.max(8,panel.right-box.left+10):8,right=box.width-(compact?8:66);
   const controls=compact?stage.querySelector<HTMLElement>('.mobile-route-actions'):null;
   const controlsBox=controls&&getComputedStyle(controls).visibility!=='hidden'?controls.getBoundingClientRect():null;
   const top=compact?64:8,bottom=Math.min(widePanel?panel.top-box.top-8:box.height-10,controlsBox&&controlsBox.height>0?controlsBox.top-box.top-8:Infinity);
   const width=Math.min(compact?210:244,Math.max(120,right-left));
   el.style.width=width+'px';
   // Measure the real height even when the previous map position hid the hint.
   el.hidden=false;
   const height=el.offsetHeight;
   // A selected point behind controls still has a forecast: clamp its card
   // into the free map area instead of hiding it until the user zooms.
   const outside=(compact||controlled?p.x<0||p.x>box.width||p.y<0||p.y>box.height:p.x<left||p.x>right||p.y<top||p.y>bottom)||bottom-top<height+20;
   if(compact){el.dataset.inView=String(!outside);}else el.hidden=outside;
   if(outside)return;
   const x=Math.max(left,Math.min(right-width,p.x-width/2));
   const above=compact||p.y-height-18>=top;
   const y=Math.max(top,Math.min(bottom-height,above?p.y-height-18:p.y+18));
   el.dataset.side=above?'above':'below';
   el.dataset.pinned=String((compact||controlled)&&(p.y-height-18<top||p.y>bottom||p.x<left||p.x>right));
   el.style.setProperty('--hint-tail',Math.max(12,Math.min(width-12,p.x-x))+'px');
   el.style.transform=`translate3d(${box.left-parent.left+x}px,${box.top-parent.top+y}px,0)`;
  };
  position();map.on('render',position);const observer=new ResizeObserver(position);observer.observe(stage);
  for(const element of stage.querySelectorAll('.weather-left-stack,.mobile-route-actions'))observer.observe(element);
  return()=>{map.off('render',position);observer.disconnect();};
 },[map,point,stage,compact,controlled,open]);
 if(!stage)return null;
 return createPortal(<button dir={dir} ref={ref} type="button" className={`route-forecast-hint hint-${point.level} ${compact?'is-mobile-hint':''} ${controlled?'is-controlled-hint':''} ${open&&entered?'is-visible':''}`} inert={(compact||controlled)&&!open} aria-hidden={(compact||controlled)&&!open} onClick={e=>{e.stopPropagation();onSelect();}} aria-label={`${t('Forecast checkpoint')} ${index+1}: ${point.condition||t(label)}, ${t('near')} ${point.place||t('selected location')}. ${compact||controlled?t('Close forecast'):t('Open details')}`}>
  <ForecastHintContent point={point} index={index} units={units} distance={distance}/>
 </button>,stage);
}
