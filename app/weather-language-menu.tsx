"use client";
import {useState,useId} from 'react';
import {useWeatherLanguage,languages} from './weather-language';
import './weather-language.css';
export default function WeatherLanguageMenu(){
 const {language,dir,t,setLanguage}=useWeatherLanguage();
 const [expanded,setExpanded]=useState(false);
 const id=useId();
 return <div className="weather-language-menu" dir={dir}>
  <button type="button" className="weather-language-toggle" aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(value=>!value)}><span>{t('Language')}</span><span lang={language}>{languages.find(item=>item.code===language)?.label}</span><span aria-hidden="true">⌄</span></button>
  <div id={id} className={`weather-language-collapse ${expanded?'is-expanded':''}`} inert={!expanded} aria-hidden={!expanded}><div><div className="weather-language-list" role="group" aria-label={t('Language')}>
   {languages.map(item=><button type="button" key={item.code} lang={item.code} dir="ltr" aria-pressed={item.code===language} onClick={()=>setLanguage(item.code)}><bdi dir={item.dir}>{item.label}</bdi><span aria-hidden="true">{item.code===language?'✓':''}</span></button>)}
  </div></div></div>
 </div>;
}
