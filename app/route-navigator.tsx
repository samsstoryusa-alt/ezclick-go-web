"use client";
import {useEffect,useId,useState} from 'react';
import './route-navigator.css';
import {destinationGeoUrl} from './route-navigation-link';
import type {RoutePoint} from './road-route';
import {useWeatherLanguage} from './weather-language';
export default function RouteNavigator({available,destination}:{available:boolean;destination:RoutePoint|null}){
 const {t}=useWeatherLanguage();
 const noticeId=useId();
 const [notice,setNotice]=useState(false);
 useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(false),6000);return()=>window.clearTimeout(timer);},[notice]);
 const launch=()=>{
  if(!available)return;
  setNotice(true);
  const url=destinationGeoUrl(destination);
  if(url&&/Android/i.test(navigator.userAgent))window.location.assign(url);
 };
 return <div className={`route-navigator ${available?'is-available':''}`} inert={!available} aria-hidden={!available}><button type="button" className="mobile-route-icon mobile-route-navigate" aria-label={t("Navigate")} title={t("Navigate")} aria-describedby={notice?noticeId:undefined} onClick={launch}><svg viewBox="0 0 32 32" aria-hidden="true"><path className="icon-shadow" d="M3 13h16l9 6v9H3Z"/><path className="icon-dark" d="M3 8h16v17H3Zm16 6h6l5 7v4H19Z"/><path className="icon-light" d="M4 8h14v12H4Zm16 7h4l4 6h-8Z"/><path className="icon-mid" d="M4 20h14v5H4Zm16 2h9v3h-9Z"/><circle cx="9" cy="25" r="3" fill="#102536" stroke="#a8eaf4" strokeWidth="1.5"/><circle cx="24" cy="25" r="3" fill="#102536" stroke="#a8eaf4" strokeWidth="1.5"/></svg><span>{t('Navigate button')}</span></button><div id={noticeId} role="status" className={`navigator-availability ${notice&&available?'is-open':''}`} aria-hidden={!notice||!available}>{t("Android test: open destination B in a navigation app. The app calculates its own route.")}</div></div>;
}
