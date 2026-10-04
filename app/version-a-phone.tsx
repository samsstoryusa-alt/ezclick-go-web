"use client";
import {weatherUrl} from './site-links';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Search,Calculator,Route,CloudRain} from 'lucide-react';
import {FeaturePanel} from './feature-panel';
import './version-a-phone.css';
const scenes=[
 {key:'find',name:'Find Load',icon:Search,title:'The next opportunity.\nAlready in your hands.',copy:'Explore loads and compare the details that matter before making your next move.'},
 {key:'calculator',name:'Calculator',icon:Calculator,title:'Know the numbers.\nBefore the miles.',copy:'Change the rate. See the costs. Understand the estimated earnings behind the trip.'},
 {key:'trip',name:'My Trip',icon:Route,title:'Your whole trip.\nOne clear picture.',copy:'From pickup to delivery, keep the route and its details close at hand.'},
 {key:'weather',name:'Weather',icon:CloudRain,title:'A clearer view.\nOf what lies ahead.',copy:'Bring the weather into your planning, then open the live map to explore the forecast.'},
];
export function PhoneStory(){
 const section=useRef<HTMLElement>(null),body=useRef<HTMLDivElement>(null);
 const [active,setActive]=useState(0);const activeRef=useRef(0);
 const [manual,setManual]=useState(false);
 const selectedChapter=useRef<{index:number;progress:number}|null>(null);
 useEffect(()=>{
  const reduce=matchMedia('(prefers-reduced-motion: reduce)'),small=matchMedia('(max-width: 767px)');
  let raf=0,current=0,target=0,last=0;
  const draw=(now:number)=>{
   const dt=last?Math.min(64,now-last):16;last=now;current+=(target-current)*(1-Math.exp(-dt/140));
   body.current?.style.setProperty('--phone-progress',String(current));
   const selection=selectedChapter.current;
   const index=selection?.index??Math.min(3,Math.floor(current*4));if(index!==activeRef.current){activeRef.current=index;setActive(index);}
   if(selection&&Math.abs(target-selection.progress)<.002&&Math.abs(current-selection.progress)<.002)selectedChapter.current=null;
   if(Math.abs(target-current)>.0002)raf=requestAnimationFrame(draw);else{raf=0;last=0;}
  };
  const update=()=>{
   if(!section.current||reduce.matches||small.matches)return;
   const r=section.current.getBoundingClientRect();target=Math.max(0,Math.min(1,-r.top/Math.max(1,r.height-innerHeight)));
   if(!raf)raf=requestAnimationFrame(draw);
  };
  const sync=()=>{const isManual=reduce.matches||small.matches;setManual(isManual);if(isManual){cancelAnimationFrame(raf);raf=0;last=0;body.current?.style.setProperty('--phone-progress','.42');}else update();};
  const interrupt=()=>{selectedChapter.current=null;};
  const interruptKey=(event:KeyboardEvent)=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))interrupt();};
  window.addEventListener('wheel',interrupt,{passive:true});window.addEventListener('touchstart',interrupt,{passive:true});window.addEventListener('keydown',interruptKey);
  sync();window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);reduce.addEventListener('change',sync);small.addEventListener('change',sync);
  return()=>{window.removeEventListener('wheel',interrupt);window.removeEventListener('touchstart',interrupt);window.removeEventListener('keydown',interruptKey);cancelAnimationFrame(raf);window.removeEventListener('scroll',update);window.removeEventListener('resize',update);reduce.removeEventListener('change',sync);small.removeEventListener('change',sync);};
 },[]);
 const choose=(index:number)=>{
  activeRef.current=index;setActive(index);
  if(manual)return;
  const el=section.current;if(!el)return;
  selectedChapter.current={index,progress:(index+.45)/4};
  window.scrollTo({top:scrollY+el.getBoundingClientRect().top+(el.offsetHeight-innerHeight)*(index+.45)/4,behavior:'smooth'});
 };
 const scene=scenes[active];
 return <section className="va-phone-story" ref={section} aria-label="Mobile platform tour" id="mobile-tour">
  <div className="va-phone-sticky">
   <div className="va-phone-story-copy"><p className="va-eyebrow">EZCLICK GO · ON THE MOVE</p><h2>{scene.title.split('\n').map((line,i)=>i?<em key={line}>{line}</em>:<span key={line}>{line}</span>)}</h2><p className="va-phone-description">{scene.copy}</p>
    <div className="va-phone-chapters" aria-label="Mobile tour chapters">{scenes.map((s,i)=><button key={s.key} aria-pressed={active===i} onClick={()=>choose(i)}><s.icon size={18}/><span>{s.name}</span><small>0{i+1}</small></button>)}</div>
    <p className="va-phone-hint">{manual?'Choose a chapter to explore.':'Scroll to follow the journey.'}</p><a href={active===3?weatherUrl:'#product'} className="va-text-link">{active===3?'Open live weather':'Explore the full platform'} <ArrowUpRight size={15}/></a>
   </div>
   <div className="va-phone-stage"><div className="va-phone-aura" aria-hidden="true"/><div className="va-solid-phone" ref={body}>
    <div className="va-phone-back" aria-hidden="true"><div className="va-camera-cluster"><i/><i/><i/></div><span>EZCLICK GO</span></div>
    <div className="va-phone-edge va-edge-left" aria-hidden="true"/><div className="va-phone-edge va-edge-right" aria-hidden="true"/><div className="va-phone-edge va-edge-top" aria-hidden="true"/><div className="va-phone-edge va-edge-bottom" aria-hidden="true"/>
    <div className="va-phone-volume" aria-hidden="true"/><div className="va-phone-power" aria-hidden="true"/>
    <div className="va-solid-front"><div className="va-solid-island" aria-hidden="true"><i/></div><div className="va-solid-status"><img src="/media/ezclick-go-logo.png" alt="EZCLICK GO"/><span>•••</span></div><div className="va-solid-screen"><div className={`va-phone-scene${scene.key==='trip'?' is-active':''}`} aria-hidden={scene.key!=='trip'} inert={scene.key!=='trip'}><FeaturePanel kind="trip" mobile/></div><div className={`va-phone-scene${scene.key!=='trip'?' is-active':''}`} aria-hidden={scene.key==='trip'} inert={scene.key==='trip'}>{scene.key!=='trip'&&<FeaturePanel key={scene.key} kind={scene.key} mobile/>}</div></div><div className="va-glass-reflection" aria-hidden="true"/><div className="va-solid-home" aria-hidden="true"/></div>
   </div><p className="va-phone-screen-caption">{scene.name} · Interactive product preview</p></div>
  </div>
 </section>;
}
