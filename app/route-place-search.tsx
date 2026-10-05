"use client";
import {useEffect,useId,useState} from 'react';
import {readTrip,savePointLabel,pointLabelKey} from './weather-trip-storage';
import type {RoutePoint} from './road-route';
import {useWeatherLanguage} from './weather-language';
import {parsePlaces,parseZipPlaces,type SearchPlace} from './route-search-data';
import './route-place-search.css';
const cache=new Map<string,SearchPlace[]>();
let lastRequest=0;
export default function RoutePlaceSearch({open,points,disabled,onChoose}:{open:boolean;points:[RoutePoint|null,RoutePoint|null];disabled:boolean;onChoose:(index:0|1,place:SearchPlace)=>void}){
 const {t}=useWeatherLanguage(),id=useId();
 const [focus,setFocus]=useState<0|1|null>(null),[query,setQuery]=useState(''),[results,setResults]=useState<SearchPlace[]>([]),[status,setStatus]=useState(''),[pending,setPending]=useState(false),[highlight,setHighlight]=useState(-1);
 const [chosen,setChosen]=useState<Array<SearchPlace|null>>([null,null]);
 const [labels,setLabels]=useState<Record<string,string>>(()=>readTrip()?.pointLabels??{});
 const expanded=open&&focus!==null;
 useEffect(()=>{
  if(!expanded)return;
  const text=query.trim();let live=true;const controller=new AbortController();let timeout=0;
  if(text.length<3)return;
  const timer=window.setTimeout(async()=>{
   try{
    let places=cache.get(text.toLowerCase());
    if(!places){
     lastRequest=Date.now();timeout=window.setTimeout(()=>controller.abort(),10000);
     const params=new URLSearchParams({q:text,limit:'6',countrycode:'US',bbox:'-125,24,-66,50',lang:'en'});
     const zip=/^\d{5}$/.test(text);
     const response=await fetch(zip?'https://api.zippopotam.us/us/'+text:'https://photon.komoot.io/api/?'+params,{signal:controller.signal});
     if(zip&&response.status===404)places=[];
     else{if(!response.ok)throw new Error('search');const data:unknown=await response.json();places=zip?parseZipPlaces(data,text):parsePlaces(data);}
     if(live){if(cache.size>=60)cache.delete(cache.keys().next().value!);cache.set(text.toLowerCase(),places);}
    }
    if(live){setResults(places);setStatus(places.length?'':'No matches. Add a state or ZIP.');setPending(false);}
   }catch{if(live){setResults([]);setStatus('Search unavailable. Try again or set points on the map.');setPending(false);}}
   finally{clearTimeout(timeout);}
  },Math.max(650,1200-(Date.now()-lastRequest)));
  return()=>{live=false;clearTimeout(timer);clearTimeout(timeout);controller.abort();};
 },[query,expanded,focus]);
 const select=(place:SearchPlace)=>{if(focus===null||pending||disabled)return;const index=focus;savePointLabel(place.point,place.label);setLabels(old=>({...old,[pointLabelKey(place.point)]:place.label}));setChosen(old=>old.map((v,i)=>i===index?place:v));setFocus(null);setQuery('');onChoose(index,place);};
 const shown=(index:0|1)=>{const p=points[index],c=chosen[index];return p?(c&&c.point[0]===p[0]&&c.point[1]===p[1]?c.label:labels[pointLabelKey(p)]||t(index===0?'Point A · Start':'Point B · Finish')):'';};
 return <div className={`route-search-collapse ${open?'is-open':''}`} inert={!open} aria-hidden={!open}><div><section className={`route-place-search ${expanded?'is-searching':''}`} aria-label={t('Search route')}>
 {([0,1] as const).map(index=><label className="route-search-field" key={index}><b>{index===0?'A':'B'}</b><input type="text" role="combobox" autoComplete="off" maxLength={160} disabled={disabled} aria-label={t(index===0?'From':'To')} aria-expanded={expanded&&focus===index} aria-controls={id} aria-autocomplete="list" aria-activedescendant={focus===index&&highlight>=0?`${id}-${highlight}`:undefined} placeholder={t(index===0?'From · city, ZIP or address':'To · city, ZIP or address')} value={focus===index?query:shown(index)} onFocus={()=>{if(focus!==index){setFocus(index);setQuery('');setResults([]);setStatus('Type at least 3 characters');setPending(false);setHighlight(-1);}}} onChange={e=>{setQuery(e.target.value);const enough=e.target.value.trim().length>=3;setPending(enough);setStatus(enough?'Searching…':'Type at least 3 characters');if(!enough)setResults([]);setHighlight(-1);}} onKeyDown={e=>{if(e.key==='Escape'){setFocus(null);e.currentTarget.blur();}if(!pending&&results.length&&(e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault();setHighlight(h=>(h+(e.key==='ArrowDown'?1:-1)+results.length)%results.length);}if(e.key==='Enter'){e.preventDefault();if(!pending&&highlight>=0&&results[highlight])select(results[highlight]);}}}/></label>)}
 <div className={`route-search-results-collapse ${expanded?'is-open':''}`} inert={!expanded} aria-hidden={!expanded}><div><div className="route-search-results" aria-busy={pending}>
 <div id={id} role="listbox" aria-label={t('Search results')} className={pending?'is-pending':''}>{results.map((place,index)=><button type="button" role="option" id={`${id}-${index}`} aria-selected={highlight===index} disabled={pending||disabled} key={place.id} onClick={()=>select(place)}><strong>{place.name}</strong><small>{place.detail}</small></button>)}</div>
 <p role="status">{t(status)}</p></div><div className="route-search-footer">{/^\d{5}$/.test(query.trim())?<a href="https://api.zippopotam.us/" target="_blank" rel="noreferrer">Zippopotam.us · GeoNames</a>:<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap · Photon</a>}<button type="button" onClick={()=>setFocus(null)}>{t('Close')}</button></div></div></div>
 </section></div></div>;
}
