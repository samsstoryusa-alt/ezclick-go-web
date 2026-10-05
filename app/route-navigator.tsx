"use client";
import {useId,useState} from 'react';
import './route-navigator.css';
import {useWeatherLanguage} from './weather-language';
export default function RouteNavigator({available}:{available:boolean}){
 const {t}=useWeatherLanguage();
 const noticeId=useId();
 const [notice,setNotice]=useState(false);
 return <div className={`route-navigator ${available?'is-available':''}`} inert={!available} aria-hidden={!available}><button type="button" className="mobile-route-icon mobile-route-navigate" aria-label="Open in navigator" aria-describedby={notice?noticeId:undefined} onClick={()=>setNotice(v=>!v)}><svg viewBox="0 0 32 32" aria-hidden="true"><path className="icon-shadow" d="M3 13h16l9 6v9H3Z"/><path className="icon-dark" d="M3 8h16v17H3Zm16 6h6l5 7v4H19Z"/><path className="icon-light" d="M4 8h14v12H4Zm16 7h4l4 6h-8Z"/><path className="icon-mid" d="M4 20h14v5H4Zm16 2h9v3h-9Z"/><circle cx="9" cy="25" r="3" fill="#102536" stroke="#a8eaf4" strokeWidth="1.5"/><circle cx="24" cy="25" r="3" fill="#102536" stroke="#a8eaf4" strokeWidth="1.5"/></svg><span>{t('Navigate')}</span></button><div id={noticeId} role="status" className={`navigator-availability ${notice&&available?'is-open':''}`} aria-hidden={!notice||!available}>Navigation handoff will be available in the mobile app.</div></div>;
}
