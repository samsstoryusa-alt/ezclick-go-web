import {useEffect,useRef,useState} from 'react';
import {Clock3} from 'lucide-react';
import {tripApi} from './road-route';
import {summarizeDeparture,betterDeparture,type RiskPoint} from './departure-score';
type Point={lon:number;lat:number;eta:number};
type Option={hours:number;departure:number;summary:ReturnType<typeof summarizeDeparture>|null};
export default function DepartureOptions({points,baseDeparture,onApply}:{points:Point[];baseDeparture:number;onApply:(time:number)=>void}){
 const [options,setOptions]=useState<Option[]|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[checked,setChecked]=useState(0),[clock,setClock]=useState(Date.now);
 const request=useRef<AbortController|null>(null);
 useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),30000);return()=>{clearInterval(timer);request.current?.abort();request.current=null;};},[]);
 const compare=async()=>{
  request.current?.abort();const controller=new AbortController();request.current=controller;
  const began=Date.now(),deadline=setTimeout(()=>controller.abort(),90000);
  setBusy(true);setOptions(null);setMessage('');
  const results=await Promise.all([0,1,2].map(async hours=>{
   const departure=began+hours*3600000;
   try{
    const samples=points.map(p=>({...p,eta:departure+p.eta-baseDeparture}));
    const response=await fetch(tripApi()+'/weather',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({points:samples}),signal:controller.signal});
    const body=await response.json() as {points?:RiskPoint[]};
    if(!response.ok||!Array.isArray(body.points)||body.points.some(p=>!p||typeof p.available!=='boolean'))throw new Error('Unavailable');
    return {hours,departure,summary:summarizeDeparture(body.points,points.length)};
   }catch{return {hours,departure,summary:null};}
  }));
  clearTimeout(deadline);if(request.current!==controller)return;
  if(controller.signal.aborted){setMessage('Comparison timed out. Please try again.');setBusy(false);return;}
  setOptions(results);setChecked(began);setClock(Date.now());setBusy(false);
 };
 const complete=options?.every(o=>o.summary?.complete);
 const candidates=complete?options!.slice(1).filter(o=>betterDeparture(o.summary!,options![0].summary!)):[];
 const best=candidates.sort((a,b)=>a.summary!.high-b.summary!.high||a.summary!.caution-b.summary!.caution||a.hours-b.hours)[0];
 const stale=!!checked&&clock-checked>300000;
 const format=(t:number)=>new Date(t).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
 return <section className={`departure-options ${busy||options||message?'is-open':''}`} aria-label="Compare departure times">
 <button className="departure-compare" onClick={()=>void compare()} disabled={busy}><Clock3 size={16} aria-hidden="true"/><span>{busy?'Comparing forecasts…':options?'Refresh comparison':'Compare departure times'}</span></button>
 {(busy||options||message)&&<button className="departure-close" onClick={()=>{request.current?.abort();request.current=null;setBusy(false);setOptions(null);setMessage('');}}>Close</button>}
 <p className="departure-note">Same route · now, +1h, +2h · your local time</p>
 <div aria-live="polite">{message&&<p>{message}</p>}{options&&<>
 <p className="departure-verdict">{stale?'Forecast comparison expired. Refresh before choosing.':!complete?'Not enough forecast data to recommend a departure time.':best?`Leaving ${best.hours} hour${best.hours===1?'':'s'} later has fewer warning checkpoints in this comparison.`:'No clear weather improvement from delaying by 1 or 2 hours.'}</p>
 <div className="departure-choices">{options.map(o=><div key={o.hours} className={`departure-choice ${best===o&&!stale?'is-recommended':''}`}>
 <strong>{o.hours?`+${o.hours}h`:'Now'}{best===o&&!stale&&<small>Lower concern</small>}</strong><time dateTime={new Date(o.departure).toISOString()}>{new Date(o.departure).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</time>
 <span>{o.summary?.complete?`${o.summary.high} high · ${o.summary.caution} caution / ${o.summary.total} points`:'Forecast incomplete'}</span>
 <button disabled={busy||stale||!o.summary?.complete} onClick={()=>{if(Date.now()-checked>300000){setClock(Date.now());return;}onApply(o.hours===0?Date.now():o.departure);setMessage('');setOptions(null);}}>Choose</button>
 </div>)}</div><p className="departure-note">Compared at {format(checked)}. Sampled forecast concern, not a guarantee of road conditions. Delaying also shifts arrival time.</p>
 </>}</div></section>;
}

