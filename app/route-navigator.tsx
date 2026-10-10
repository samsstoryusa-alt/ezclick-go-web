"use client";
import {useEffect,useId,useRef,useState,type KeyboardEvent} from 'react';
import './route-navigator.css';
import {destinationNavigationOptions} from './route-navigation-link';
import type {RoutePoint} from './road-route';
import {useWeatherLanguage} from './weather-language';
export default function RouteNavigator({available,destination,showUnavailable=false}:{available:boolean;destination:RoutePoint|null;showUnavailable?:boolean}){
 const {t}=useWeatherLanguage();
 const menuId=useId();
 const root=useRef<HTMLDivElement>(null);
 const menu=useRef<HTMLDivElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 const context=`${available}:${destination?.[0]}:${destination?.[1]}`;
 const [state,setState]=useState({context,open:false});
 if(state.context!==context)setState({context,open:false});
 const options=destinationNavigationOptions(destination,typeof navigator==='undefined'?{}:navigator);
 const canNavigate=available&&options.length>0;
 const open=canNavigate&&state.context===context&&state.open;
 const close=()=>setState({context,open:false});
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setState({context,open:false});};
  const frame=requestAnimationFrame(()=>menu.current?.querySelector<HTMLAnchorElement>('[role="menuitem"]')?.focus());
  document.addEventListener('pointerdown',outside);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('pointerdown',outside);};
 },[open,context]);
 function menuKey(event:KeyboardEvent<HTMLDivElement>){
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();trigger.current?.focus();return;}
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  event.preventDefault();
  const items=Array.from(menu.current?.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]')??[]);
  const current=items.indexOf(document.activeElement as HTMLAnchorElement);
  const index=event.key==='Home'?0:event.key==='End'?items.length-1:(current+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
  items[index]?.focus();
 }
 const icon=<><svg viewBox="0 0 32 32" aria-hidden="true"><path className="icon-shadow" d="M3 13h16l9 6v9H3Z"/><path className="icon-dark" d="M3 8h16v17H3Zm16 6h6l5 7v4H19Z"/><path className="icon-light" d="M4 8h14v12H4Zm16 7h4l4 6h-8Z"/><path className="icon-mid" d="M4 20h14v5H4Zm16 2h9v3h-9Z"/><circle cx="9" cy="25" r="3" fill="#102536" stroke="#a8eaf4" strokeWidth="1.5"/><circle cx="24" cy="25" r="3" fill="#102536" stroke="#a8eaf4" strokeWidth="1.5"/></svg><span>{t('Navigate button')}</span></>;
 return <div ref={root} className={`route-navigator ${available||showUnavailable?'is-available':''}`} inert={!available&&!showUnavailable} aria-hidden={!available&&!showUnavailable}
  onBlur={event=>{if(event.relatedTarget instanceof Node&&!event.currentTarget.contains(event.relatedTarget))close();}}>
  <button ref={trigger} type="button" className="mobile-route-icon mobile-route-navigate" disabled={!canNavigate} aria-label={t('Navigate')} title={t('Navigate')} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId}
   onClick={()=>setState({context,open:!open})} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();setState({context,open:true});}}}>{icon}</button>
  <div ref={menu} id={menuId} role="menu" aria-label={t('Choose navigation app')} className={`route-navigator-menu ${open?'is-open':''}`} inert={!open} aria-hidden={!open} onKeyDown={menuKey}>
   <strong>{t('Choose navigation app')}</strong>
   {canNavigate&&options.map(option=><a key={option.id} role="menuitem" tabIndex={open?0:-1} href={option.url} target={option.target} rel="noopener noreferrer" onClick={close}><b>{option.label}</b>{option.id==='trucker-path'&&<small>{t('Trucker Path must be installed.')}</small>}</a>)}
   <p>{t('Only destination B is sent. Check the route and vehicle settings in your navigator.')}</p>
  </div>
 </div>;
}
