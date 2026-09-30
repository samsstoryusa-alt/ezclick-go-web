'use client';
import {useEffect,useRef} from 'react';
import {gsap} from 'gsap';
import {Check,Minus} from 'lucide-react';
import {Accordion,AccordionItem,AccordionTrigger,AccordionContent} from '@/components/ui/accordion';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';

const plans=[
 {name:'Free',price:0,tagline:'Get started.',caption:'Your first tools for the road.',features:[
 ['Personalized load picks','Three matching offers at a time. Your selection refreshes as load availability changes.'],
 ['Trip calculator','Estimate your costs and what you keep before you roll.'],
 ['Driver Progress','Track career miles, ranks, and personal achievements.']]},
 {name:'Plus',price:19,tagline:'Plan with confidence.',caption:'Free tools, with more ways to plan.',features:[
 ['Full load search','Filter and compare all offers available through EZCLICK.'],
 ['Your cost profile','Apply your fuel consumption, fees, and operating costs to each estimate.'],
 ['Hot Zones','Explore markets for your next load.'],
 ['Fuel and route weather','Plan fuel stops and check the forecast along your route.'],
 ['Load history and PDF','Keep your trip records and export your calculations.'],
 ['Photo to PDF','Turn BOLs, PODs, and receipts into clean, multi-page documents.']]},
 {name:'Pro',price:39,tagline:'Automate and manage.',caption:'Plus features + automation.',features:[
 ['AI Dispatcher','Matching loads and notifications for your preferences.'],
 ['Document checks','Flag missing information and approaching expiry dates.'],
 ['Trip document comparison','Compare Rate Confirmation and BOL addresses, dates, and cargo details. Review possible mismatches.'],
 ['Weather-aware planning','Consider departure times and route alternatives when weather changes.'],
 ['Broker checks','Review available broker information before moving forward.'],
 ['Quick Setup','Prepare carrier paperwork with reusable company details.'],
 ['Statements and team','Manage driver settlements, deductions, and assigned trucks.'],
 ['Company insights','Review revenue, average rate per mile, and your top lanes.']]}
];
const comparison:[string,string,string,string][]=[
 ['Matching load offers','3 at a time','Full search','Full search'],
 ['Trip calculator','Included','Included','Included'],
 ['Driver Progress','Included','Included','Included'],
 ['Saved cost profile','—','Included','Included'],
 ['Hot Zones','Preview only','Included','Included'],
 ['Fuel planning and route forecast','—','Included','Included'],
 ['Load history and PDF exports','—','Included','Included'],
 ['Photo to PDF scanner','—','Included','Included'],
 ['AI Dispatcher','Preview only','—','Launch limits to be confirmed'],
 ['Document checks and Rate Con / BOL comparison','—','—','Included'],
 ['Weather-aware departure and route planning','—','—','Included'],
 ['Broker checks and Quick Setup','—','—','Included'],
 ['Driver settlements: percentage or per mile','—','—','Included'],
 ['Weekly deductions and escrow tracking','—','—','Included'],
 ['Company statistics and team permissions','—','—','Included'],
 ['Active trucks per workspace','1','1','Launch limit to be confirmed']
];
export function Pricing({onJoin}:{onJoin:(plan:string)=>void}){
 const root=useRef<HTMLElement>(null);
 useEffect(()=>{
  const scope=root.current!,cards=Array.from(scope.querySelectorAll<HTMLElement>('.pricing-card'));
  const media=gsap.matchMedia();
  media.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',()=>{
   const cleanups=cards.map(card=>{
    gsap.set(card,{'--plan-rx':'0deg','--plan-ry':'0deg'});
    const rx=gsap.quickTo(card,'--plan-rx',{duration:.55,ease:'power2.out'});
    const ry=gsap.quickTo(card,'--plan-ry',{duration:.55,ease:'power2.out'});
    const move=(e:PointerEvent)=>{if(e.pointerType!=='mouse')return;const r=card.getBoundingClientRect();rx(-(Math.max(-1,Math.min(1,(e.clientY-r.top)/r.height*2-1)))*1.25);ry(Math.max(-1,Math.min(1,(e.clientX-r.left)/r.width*2-1))*1.6);};
    const reset=()=>{rx(0);ry(0);};
    card.addEventListener('pointermove',move);card.addEventListener('pointerleave',reset);window.addEventListener('blur',reset);
    return()=>{card.removeEventListener('pointermove',move);card.removeEventListener('pointerleave',reset);window.removeEventListener('blur',reset);rx.tween.kill();ry.tween.kill();card.style.removeProperty('--plan-rx');card.style.removeProperty('--plan-ry');};
   });return()=>cleanups.forEach(clean=>clean());
  });
  return()=>media.revert();
 },[]);
 return <section ref={root} className="pricing-section" id="pricing" aria-labelledby="pricing-title">
 <div className="pricing-backdrop" aria-hidden="true"><img src="/media/pricing-fleet-night.webp" alt="" width="1672" height="941" loading="lazy"/></div>
 <div className="pricing-inner">
  <header className="pricing-heading"><p className="eyebrow">PLANS FOR THE ROAD AHEAD</p><h2 id="pricing-title">Your business.<br/><span>Your plan.</span></h2><p>For drivers, dispatchers, and company owners.</p><div className="pricing-status">Preview pricing · Launch details being finalized</div></header>
  <div className="pricing-grid">{plans.map(p=><article className={`pricing-card ${p.name==='Plus'?'pricing-recommended':''}`} key={p.name} aria-labelledby={`plan-${p.name}`}>
   <div className="plan-top"><h3 id={`plan-${p.name}`}>{p.name}</h3>{p.name==='Plus'&&<span className="plan-badge">Recommended</span>}</div>
   <div className="plan-price">${p.price}{p.price>0&&<span>/ month</span>}</div><p className="plan-billing">{p.price===0?'No subscription fee':'Per workspace'}</p>
   <h4>{p.tagline}</h4><p className="plan-caption">{p.caption}</p>
   <ul>{p.features.map(([title,description])=><li key={title}><Check size={18} aria-hidden="true"/><div><strong>{title}</strong><p>{description}</p></div></li>)}</ul>
   <div className="plan-footer">{p.name==='Pro'&&<p className="plan-limit">Included trucks and AI usage limits will be confirmed before launch.</p>}<button className="plan-cta" onClick={()=>onJoin(p.name)}>Join the launch list</button></div>
  </article>)}</div>
  <p className="pricing-roles">One account can combine roles. Your subscription unlocks tools; company permissions determine which data you can access. Invited teammates do not each need a separate subscription to work in the paid workspace.</p>
  <Accordion type="single" collapsible className="pricing-comparison"><AccordionItem value="features"><AccordionTrigger>Compare all features</AccordionTrigger><AccordionContent>
   <div className="comparison-scroll" tabIndex={0} role="region" aria-label="Plan comparison. Scroll horizontally on small screens."><Table><TableHeader><TableRow><TableHead>Features</TableHead>{plans.map(p=><TableHead key={p.name}>{p.name}</TableHead>)}</TableRow></TableHeader><TableBody>{comparison.map(([label,...values])=><TableRow key={label}><TableCell>{label}</TableCell>{values.map((value,i)=><TableCell key={i}>{value==='Included'?<span className="comparison-included"><Check size={16} aria-hidden="true"/>Included</span>:value==='—'?<><Minus size={16} aria-hidden="true"/><span className="sr-only">Not included</span></>:value}</TableCell>)}</TableRow>)}</TableBody></Table></div>
   <p className="comparison-note">Planned launch features. Availability, data sources, and usage limits are being finalized. Automated checks highlight possible issues for your review.</p>
  </AccordionContent></AccordionItem></Accordion>
  <p className="pricing-note">Join the launch list for updates. App access and subscriptions are not open yet. No payment is collected on this site.</p>
 </div>
</section>}
