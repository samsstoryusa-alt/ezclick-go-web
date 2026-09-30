'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,ArrowUpRight,MapPin,ChevronDown} from 'lucide-react';
import {Select as SortSelect} from 'radix-ui';
import {LoadMiniMap} from './load-mini-map';
import equipment from './find-load-data.json';
import {money} from './demo-model';
export type LoadSelection={equipment:number;load:number};
export const initialLoadSelection:LoadSelection={equipment:1,load:0};
export function loadEstimate(load:{rate:number;miles:number;tolls:number}){
 const fuel=Math.round(load.miles/6.5*3.8),maintenance=Math.round(load.rate*.015),dispatch=Math.round(load.rate*.03);
 return {fuel,maintenance,dispatch,net:load.rate-fuel-maintenance-dispatch-load.tolls};
}
export function FindLoadDemo({selection,onSelect}:{selection:LoadSelection;onSelect:(value:LoadSelection)=>void}){
 const [shown,setShown]=useState(selection),[fading,setFading]=useState(false);
 const first=useRef(true),summary=useRef<HTMLDivElement>(null),returnToSummary=useRef(false);
 const [sort,setSort]=useState('rate');
 useEffect(()=>{
  if(!returnToSummary.current||fading)return;
  returnToSummary.current=false;
  const el=summary.current,scroller=el?.closest<HTMLElement>('.card-content, .dialog-content, .feature-dialog');
  if(el&&scroller)scroller.scrollBy({top:el.getBoundingClientRect().top-scroller.getBoundingClientRect().top-20,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 },[shown,fading]);
 useEffect(()=>{
  if(first.current){first.current=false;return;}
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){setShown(selection);return;}
  setFading(true);
  const timer=setTimeout(()=>{setShown(selection);setFading(false);},180);
  return()=>clearTimeout(timer);
 },[selection.equipment,selection.load]);
 const trailer=equipment[shown.equipment],load=trailer.loads[shown.load],cost=loadEstimate(load),[origin,destination]=load.route.split(' → ');
 const more=trailer.loads.map((item,index)=>({item,index})).slice(3).sort((a,b)=>{const value=(x:typeof load)=>sort==='net'?loadEstimate(x).net:sort==='rpm'?x.rate/x.miles:x.rate;return value(b.item)-value(a.item);});
 return <div className="find-demo">
  <div className="find-picker-heading"><span>Choose your trailer</span><small>Try the load board</small></div>
  <div className="trailer-picker" role="group" aria-label="Trailer type">
   {equipment.map((item,i)=><button type="button" key={item.name} aria-pressed={selection.equipment===i} onClick={()=>{if(selection.equipment!==i)onSelect({equipment:i,load:0});}}>
    <img src={item.image} width="180" height="100" alt="" draggable="false"/><span>{item.name}</span><small>{item.description}</small><Check className="trailer-check" size={13} aria-hidden="true"/>
   </button>)}
  </div>
  <div className="find-demo-label"><span className="top-match-heading"><strong>Top matches for your truck</strong><small>Balanced by rate, mileage &amp; deadhead.</small></span><small>Demo loads</small></div>
  <div className="find-changing" data-fading={fading} aria-busy={fading}>
   <div className="load-choices" role="group" aria-label={`${trailer.name} demo loads`}>
    {trailer.loads.slice(0,3).map((item,i)=>{const estimate=loadEstimate(item);return <button type="button" key={i} aria-pressed={selection.equipment===shown.equipment&&selection.load===i} onClick={()=>{if(selection.load!==i||selection.equipment!==shown.equipment)onSelect({equipment:shown.equipment,load:i});}} disabled={fading}>
     <span className="load-choice-title"><strong>{item.route}</strong><ArrowUpRight size={17} aria-hidden="true"/></span>
     <span className="load-choice-cargo">{item.cargo}</span><span className="load-selected-badge" data-selected={selection.equipment===shown.equipment&&selection.load===i}>{selection.equipment===shown.equipment&&selection.load===i?'Selected':'View estimate'}</span>
     <span className="load-choice-rate"><strong>{money(item.rate)}</strong><span>${(item.rate/item.miles).toFixed(2)} / all mi</span></span>
     <span className="load-choice-miles">{item.loaded} loaded mi · {item.dh} mi deadhead</span>
     <span className="load-choice-net">Est. trip net <b>{money(estimate.net)}</b></span>
    </button>})}
   </div>
   <div ref={summary} className="find-selected" aria-live="polite" aria-atomic="true">
    <figure className="load-route-illustration">
     <div className="route-label"><MapPin size={14}/><span>Selected route</span><small>{load.id}</small></div>
     <LoadMiniMap origin={origin} destination={destination}/>
     <div className="route-endpoints"><span><small>A · PICKUP</small><strong>{origin}</strong></span><span><small>B · DELIVERY</small><strong>{destination}</strong></span></div>
     <figcaption>Road preview · Not truck-specific</figcaption>
     <a className="mini-map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
    </figure>
    <section className="load-cost-summary" aria-label="Selected load estimate">
     <h4>Know what you keep</h4><div className="load-profit-hero"><span>ESTIMATED TRIP NET</span><strong>{money(cost.net)}</strong><small>After the trip costs below</small></div>
     <div><span>Gross rate</span><strong>{money(load.rate)}</strong></div>
     <div><span>Fuel estimate</span><strong>−{money(cost.fuel)}</strong></div>
     <div><span>Maintenance · 1.5%</span><strong>−{money(cost.maintenance)}</strong></div>
     <div><span>Dispatch · 3%</span><strong>−{money(cost.dispatch)}</strong></div>
     <div><span>Tolls</span><strong>{load.tolls?'−':''}{money(load.tolls)}</strong></div>

    </section>
   </div>
   <section className="more-loads" aria-label="More demo loads">
    <div className="more-loads-heading"><div><h4>More loads</h4><small>{trailer.name} · 6 more options</small></div><div className="load-sort"><span>Sort by</span><SortSelect.Root value={sort} onValueChange={setSort}><SortSelect.Trigger className="load-sort-trigger" aria-label="Sort more loads"><SortSelect.Value/><SortSelect.Icon><ChevronDown size={14}/></SortSelect.Icon></SortSelect.Trigger><SortSelect.Content position="popper" align="end" sideOffset={8} className="load-sort-menu"><SortSelect.Viewport>{[['rate','Highest rate first'],['net','Highest trip net'],['rpm','Highest $/mile']].map(([value,label])=><SortSelect.Item key={value} value={value} className="load-sort-option"><SortSelect.ItemText>{label}</SortSelect.ItemText><SortSelect.ItemIndicator><Check size={14}/></SortSelect.ItemIndicator></SortSelect.Item>)}</SortSelect.Viewport></SortSelect.Content></SortSelect.Root></div></div>
    <div className="more-load-list" role="group" aria-label="Select another load">
     {more.map(({item,index})=><button type="button" key={item.id} disabled={fading} aria-pressed={selection.equipment===shown.equipment&&selection.load===index} onClick={()=>{returnToSummary.current=true;if(selection.load===index&&selection.equipment===shown.equipment){returnToSummary.current=false;return;}onSelect({equipment:shown.equipment,load:index});}}>
      <span className="more-load-route"><strong>{item.route}</strong><small>{item.cargo}</small><span className="load-selected-badge more-selected-badge" data-selected={selection.equipment===shown.equipment&&selection.load===index}>Selected</span></span>
      <span><small>Rate</small><strong>{money(item.rate)}</strong></span>
      <span><small>$/all mi</small><strong>${(item.rate/item.miles).toFixed(2)}</strong></span>
      <span><small>Total miles</small><strong>{item.miles} mi</strong></span>
      <span><small>Deadhead</small><strong>{item.dh} mi</strong></span>
      <span className="more-load-net"><small>Est. trip net</small><strong>{money(loadEstimate(item).net)}</strong></span>
     </button>)}
    </div>
   </section>
  </div>
  <p className="demo-footnote">Illustrative demo loads, not live availability. Top matches balance rate, all-mile RPM and deadhead share. Estimate uses 6.5 MPG and $3.80/gal, including deadhead. Before fixed costs, insurance, taxes and any additional equipment costs.</p>
 </div>;
}
