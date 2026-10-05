import {useEffect,useRef,useState} from 'react';
function Wheel({label,items,index,onChange}:{label:string;items:string[];index:number;onChange:(n:number)=>void}){
 const ref=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{const el=ref.current;if(el&&Math.abs(el.scrollTop-index*32)>1)el.scrollTo({top:index*32,behavior:'instant'});},[index]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 useEffect(()=>{
  const el=ref.current;if(!el)return;
  const isolate=(event:Event)=>event.stopPropagation();
  const wheel=(event:WheelEvent)=>{
   event.stopPropagation();
   if((event.deltaY<0&&el.scrollTop<=0)||(event.deltaY>0&&el.scrollTop+el.clientHeight>=el.scrollHeight-1))event.preventDefault();
  };
  el.addEventListener('wheel',wheel,{passive:false});
  for(const type of ['pointerdown','touchstart','touchmove'])el.addEventListener(type,isolate,{passive:true});
  return()=>{el.removeEventListener('wheel',wheel);for(const type of ['pointerdown','touchstart','touchmove'])el.removeEventListener(type,isolate);};
 },[]);

 const choose=(n:number)=>{const next=Math.max(0,Math.min(items.length-1,n));onChange(next);ref.current?.scrollTo({top:next*32,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
 return <div className="departure-inline-column"><span>{label}</span><div className="departure-inline-wheel-frame"><div ref={ref} className="departure-inline-wheel" tabIndex={0} role="spinbutton" aria-label={label} aria-valuemin={0} aria-valuemax={items.length-1} aria-valuenow={index} aria-valuetext={items[index]} onKeyDown={e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();choose(e.key==='Home'?0:e.key==='End'?items.length-1:index+(e.key==='ArrowDown'?1:-1));}}} onScroll={()=>{if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{const n=Math.max(0,Math.min(items.length-1,Math.round((ref.current?.scrollTop??0)/32)));if(n!==index)onChange(n);},180);}}>{items.map((text,n)=><button type="button" tabIndex={-1} className={n===index?'is-chosen':''} key={n} onClick={()=>choose(n)}>{text}</button>)}</div></div></div>;
}
function InlinePicker({value,onChange}:{value:string;onChange:(v:string)=>void}){
 const [today]=useState(()=>{const d=new Date();d.setHours(0,0,0,0);return d;}),[draft,setDraft]=useState(()=>value?new Date(value):new Date()),[error,setError]=useState('');
 const days=Array.from({length:7},(_,i)=>{const d=new Date(today);d.setDate(d.getDate()+i);return d;});
 const day=Math.max(0,days.findIndex(d=>d.toDateString()===draft.toDateString()));
 const update=(part:'day'|'hour'|'minute',n:number)=>{const d=new Date(draft);if(part==='day')d.setFullYear(days[n].getFullYear(),days[n].getMonth(),days[n].getDate());else if(part==='hour')d.setHours(n);else d.setMinutes(n);d.setSeconds(0,0);setDraft(d);setError('');};
 return <div className="departure-inline"><div className="departure-inline-wheels"><Wheel label="Date" items={days.map((d,i)=>i===0?'Today':i===1?'Tomorrow':d.toLocaleDateString([],{month:'short',day:'numeric'}))} index={day} onChange={n=>update('day',n)}/><Wheel label="Hour · 24h" items={Array.from({length:24},(_,n)=>String(n).padStart(2,'0'))} index={draft.getHours()} onChange={n=>update('hour',n)}/><Wheel label="Minute" items={Array.from({length:60},(_,n)=>String(n).padStart(2,'0'))} index={draft.getMinutes()} onChange={n=>update('minute',n)}/></div><div className="departure-inline-actions"><span>Your local time</span><button type="button" onClick={()=>{setDraft(new Date());setError('');onChange('');}}>Now</button><button type="button" onClick={()=>{const t=draft.getTime(),now=Date.now();if(t<now-60000||t>=now+6*86400000){setError('Choose a future time within 6 days.');return;}onChange(new Date(t-draft.getTimezoneOffset()*60000).toISOString().slice(0,16));}}>Apply</button></div>{error&&<small role="alert">{error}</small>}</div>;
}
export default function DeparturePicker(props:{value:string;onChange:(v:string)=>void}){return <InlinePicker key={props.value} {...props}/>;}
