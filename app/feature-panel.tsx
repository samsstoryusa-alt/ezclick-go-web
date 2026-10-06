'use client';
import {weatherUrl,tripEmbedUrl} from './site-links';
import {useRef,useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {gsap} from 'gsap';
import type {PointerEvent} from 'react';
import {Check,FileText,Fuel,CloudRain,Truck,Route,Building2,Search,Headset,Calculator,MapPin,Maximize2,X,Receipt,Wrench,Package,Coins,ShieldCheck,Mail,CircleCheck,Clock3,TriangleAlert,ClipboardCheck} from 'lucide-react';
import type {ReactNode} from 'react';
import {FindLoadDemo,initialLoadSelection,type LoadSelection} from './find-load-demo';
import {LoadMiniMap} from './load-mini-map';
import tripPreview from './trip-preview-data.json';
import {StatementPreview} from './statement-preview';
import {money,tripEstimate,markets,fuelOptions,fuelGallons} from './demo-model';
type DemoState={selection:LoadSelection;setSelection:(value:LoadSelection)=>void;rate:number;setRate:(n:number)=>void;market:number;setMarket:(n:number)=>void;fuel:number;setFuel:(n:number)=>void};
const icons={find:Search,calculator:Calculator,trip:Route,weather:CloudRain,hotzones:MapPin,fuel:Fuel,documents:FileText,dispatcher:Headset,brokers:Building2,setup:ClipboardCheck,statement:Receipt,security:ShieldCheck};
const names={find:'Find Load',calculator:'Trip Calculator',trip:'My Trip',weather:'Route Weather',hotzones:'Hot Zones',fuel:'Fuel Intelligence',documents:'Documents',dispatcher:'AI Dispatcher',brokers:'Broker Database',setup:'Quick Setup',statement:'Statement',security:'Document Security'};
function rowIcon(label:string){
 if(/fuel|diesel|pilot|loveâ€™s|flying j|ta express/i.test(label))return Fuel;
 if(/tolls|route|distance|lane/i.test(label))return Route;
 if(/fees|fines|factoring|gross|rate|share/i.test(label))return Receipt;
 if(/maintenance|repair/i.test(label))return Wrench;
 if(/other expenses|equipment|cargo/i.test(label))return Package;
 if(/dispatch/i.test(label))return Headset;
 if(/insurance|coi|authority/i.test(label))return ShieldCheck;
 if(/w-9|agreement|document|license|registration|cab card/i.test(label))return FileText;
 if(/contact|email|subject/i.test(label))return Mail;
 if(/weather|rain|visibility/i.test(label))return CloudRain;
 if(/net|savings/i.test(label))return Coins;
 return null;
}
function RowIcon({label}:{label:string}){const Icon=rowIcon(label);return Icon?<Icon className="row-icon" size={18} strokeWidth={1.6} aria-hidden="true"/>:null;}
function statusTone(value:string){
 if(/^(needs new coi|action|blocked|restricted|company blacklist|multiple payment issues)$/i.test(value))return 'problem';
 if(/^(needs review|review|waiting|watchlist|setup in progress|needs action|slower pay terms)$/i.test(value))return 'attention';
 if(/^(ready|active|enabled|attached|approved|setup complete|preferred broker)$/i.test(value)||/ Â· Ready$/i.test(value))return 'ready';
 return '';
}
function StatusValue({value}:{value:string}){const tone=statusTone(value),Icon=tone==='ready'?CircleCheck:tone==='attention'?Clock3:TriangleAlert;return <strong className={tone?`status-value status-${tone}`:undefined}>{tone&&<Icon size={16} strokeWidth={1.6} aria-hidden="true"/>}{value}</strong>;}
function Rows({items}:{items:string[][]}){return <div className="panel-rows">{items.map(([label,value,detail])=><div className="panel-row panel-reveal" key={label}><span className="row-label"><RowIcon label={label}/><span>{label}{detail&&<small>{detail}</small>}</span></span><StatusValue value={value}/></div>)}</div>}
function Stat({label,value,detail}:{label:string,value:string,detail?:string}){return <div className="panel-stat panel-reveal"><span>{label}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}</div>}
function Section({title,children}:{title:string,children:ReactNode}){return <section className="panel-section"><h4>{title}</h4>{children}</section>}
function Chips({items}:{items:string[]}){return <div className="detail-chips panel-reveal">{items.map(s=><span key={s} className={statusTone(s)?`status-${statusTone(s)}`:undefined}>{s}</span>)}</div>}
function Note({children}:{children:ReactNode}){return <div className="panel-note panel-reveal">{children}</div>}
const crops:Record<string,number[]>={find:[.611,.317,.2,.254,1672/941],trip:[.263,.055,.433,.865,3],weather:[.262,.167,.465,.681,1536/864],hotzones:[.029,.244,.628,.681,1536/864],fuel:[.263,.157,.435,.694,1536/864],dispatcher:[.54,.345,.283,.225,1672/941]};
function MapView({kind,label}:{kind:string,label:string}){if(kind==='find')return <figure className="source-map native-route panel-reveal"><img src="/media/find-route.svg" width="1000" height="500" alt="Map of the United States with an illustrative Denver to Atlanta route"/><figcaption>Denver â†’ Atlanta Â· Route illustration</figcaption></figure>;const [x,y,w,h,ratio]=crops[kind];return <figure className="source-map panel-reveal" style={{aspectRatio:String(w*ratio/h)}}><div className="map-window"><img src={`/media/${kind}.png`} alt={label} loading="eager" decoding="async" style={{width:`${100/w}%`,maxWidth:'none',left:`${-x/w*100}%`,top:`${-y/h*100}%`}}/></div><figcaption>{label}</figcaption></figure>}
function TripInfo(){return <><Rows items={ [['Denver, CO','Pickup','Oct 12 Â· 08:00 AM'],['Atlanta, GA','Delivery','Oct 14 Â· 02:00 PM']]}/><div className="panel-metrics three"><Stat label="Distance" value="1,243 mi"/><Stat label="Drive time" value="20h 30m"/><Stat label="Fuel stops" value="4"/></div></>}
function ExpenseRing({rate=3250}:{rate?:number}){const {costs,net,rpm}=tripEstimate(rate),values=[...costs,net],colors=['#83cadb','#aacbda','#cadbe5','#6399b0','#467a95','#315b78','#203d54'];let offset=0;return <div className="expense-ring panel-reveal"><svg viewBox="0 0 120 120" role="img" aria-label={`Trip allocation. Estimated net ${money(net)} after expenses.`}><g transform="rotate(-90 60 60)">{values.map((v,i)=>{const length=v/rate*100,start=offset;offset+=length;return <circle key={i} cx="60" cy="60" r="52" fill="none" stroke={colors[i]} strokeWidth="8" pathLength="100" strokeDasharray={`${length} ${100-length}`} strokeDashoffset={-start}/>;})}</g></svg><div><span>ESTIMATED NET</span><strong>{money(net)}</strong><small>${rpm.toFixed(2)} / mi</small></div></div>}
function MarketDemo({demo}:{demo:DemoState}){const m=markets[demo.market];return <section className="live-demo"><div className="demo-caption">TRY IT Â· SAMPLE MARKET DATA</div><div className="demo-options" role="group" aria-label="Choose a state">{markets.map((x,i)=><button key={x.code} aria-pressed={demo.market===i} onClick={()=>demo.setMarket(i)}>{x.code}</button>)}</div><div className="panel-route">{m.name}<small>{m.note}</small></div><div className="panel-metrics four" aria-live="polite" aria-atomic="true"><Stat label="Loads" value={m.loads.toLocaleString('en-US')}/><Stat label="Trucks" value={m.trucks.toLocaleString('en-US')}/><Stat label="Load / truck ratio" value={(m.loads/m.trucks).toFixed(2)}/><Stat label="Average RPM" value={`$${m.rpm.toFixed(2)}`}/></div><p className="demo-footnote">Select a state to compare outbound demand. Illustrative data, not live availability.</p></section>}
function FuelDemo({demo}:{demo:DemoState}){const option=fuelOptions[demo.fuel],cost=option.price*fuelGallons,saved=(fuelOptions[0].price-option.price)*fuelGallons;return <section className="live-demo"><div className="demo-caption">TRY IT Â· COMPARE A {fuelGallons}-GALLON FILL</div><div className="demo-options" role="group" aria-label="Choose a fuel stop">{fuelOptions.map((x,i)=><button key={x.name} aria-pressed={demo.fuel===i} onClick={()=>demo.setFuel(i)}>{x.name}<small>${x.price.toFixed(2)} / gal</small></button>)}</div><div className="panel-metrics" aria-live="polite" aria-atomic="true"><Stat label="Fuel cost" value={money(cost)}/><Stat label="Saved on this fill" value={money(saved)}/></div><p className="demo-footnote">Sample pump prices. Same fuel quantity; detour costs are excluded.</p></section>}
function Content({kind,demo,animatedTrip=false}:{kind:string,demo:DemoState;animatedTrip?:boolean}){switch(kind){
case 'statement':return <StatementPreview/>;
case 'security':return <>
<div className="security-intro panel-reveal"><span className="security-emblem"><ShieldCheck size={42} strokeWidth={1.4}/></span><p>ID, insurance, and company documents â€” together in a protected space. You choose who gets access.</p></div>
<Section title="Protection designed around you"><Rows items={[
['Encrypted documents','Encryption','Protection while stored and transferred.'],
['Two-factor sign-in','Verification','An extra check when signing in to your account.'],
['You choose who sees it','Access control','Share documents with the people you authorize.']
]}/></Section>
<Chips items={['Driver ID','Insurance','Company records']}/>
<Note>Security preview Â· These protections are planned for launch and are not connected in this demo.</Note>
</>;
case 'find':return <FindLoadDemo selection={demo.selection} onSelect={demo.setSelection}/>;
case 'calculator':return <><CalculatorStory demo={demo}/><Section title="Demo cost assumptions"><Rows items={ [['Trip distance','1,230 mi'],['Fuel budget','$861'],['Tolls','$62'],['Fees / tickets / fines','$40'],['Other expenses','$120'],['Maintenance','12% of gross'],['Dispatch / company','10% of gross'],['Company share','0%']]}/><Note>Change the gross rate above. Maintenance, dispatch, total expenses and estimated net update together.</Note></Section></>;
case 'trip':if(animatedTrip)return <><div className="panel-route">Your route. Your weather.<small>Set A and B on the map to plan your trip.</small></div><div className="trip-live-map"><iframe title="My Trip Â· interactive EZCLICK map" src={tripEmbedUrl} loading="eager" tabIndex={-1} allow="geolocation"/><a href={weatherUrl} target="_blank" rel="noreferrer">Open full map â†—</a></div><Note>Choose your points, check truck settings and build your route. Weather is checked along the route at estimated arrival times.</Note></>;
return <><div className="panel-route">Denver, CO â†’ Atlanta, GA<small>One trip. A clear overview.</small></div><Rows items={ [['Denver, CO','A Â· Pickup'],['Atlanta, GA','B Â· Delivery']]}/><div className="panel-metrics"><Stat label="Road distance" value={`${tripPreview.miles.toLocaleString('en-US')} mi`}/><Stat label="Drive estimate" value={`${tripPreview.hours} h`} detail="Before breaks, traffic and truck restrictions"/></div><figure className="load-route-illustration"><LoadMiniMap origin="Denver, CO" destination="Atlanta, GA"/><figcaption>Road preview Â· Not truck-specific</figcaption><a className="mini-map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Â© OpenStreetMap contributors</a><span className="route-map-sources">OpenFreeMap Â· OpenMapTiles Â· Elevation Â© Mapterhorn</span></figure><Section title="Plan your trip"><Rows items={ [['Route overview','Denver â†’ Atlanta','Pickup and delivery match the map above.'],['Fuel stops','Plan ahead','Review fuel options before departure.'],['Weather along the way','Check conditions','Review route weather before departure.']]}/></Section><Note>Demo route overview. Distance and driving estimate refer to the road shown above.</Note></>;
case 'weather':return <><a href={weatherUrl} style={{display:'inline-block',padding:'12px 16px',marginBottom:12,border:'1px solid #70dcf4',borderRadius:10,color:'#70dcf4',textDecoration:'none'}}>Explore interactive map & terrain â†’</a><Chips items={['Route','Fuel stops','Weather']}/><TripInfo/><div className="panel-metrics"><Stat label="Weather affected" value="412 mi"/><Stat label="Current conditions" value="48Â°F" detail="Light rain Â· Wind 18 mph SW Â· Good visibility"/></div><MapView kind="weather" label="Radar Â· planned route and safer alternative"/><Section title="Route weather summary"><Rows items={ [['High risk','312 mi','Severe storms, heavy rain, possible hail Â· I-35 to I-40 Â· +2h delay risk'],['Moderate risk','124 mi','Crosswinds 25â€“40 mph Â· I-40 to I-75'],['Low risk','807 mi','Generally clear Â· Good driving conditions'],['Heavy rain','0.5â€“1.5 in','Reduced visibility'],['Visibility','Less than 1 mile','Watch for fog']]}/></Section><Note>Recommendation: delay possible â€” reroute south to avoid the severe cell.</Note><Chips items={['View best route','Route conditions','Weather settings','Radar example Â· Updated 5 min ago','Light','Moderate','Heavy','Severe','Planned route','Safer route']}/></>;
case 'hotzones':return <><Chips items={['Balance','Loads','Trucks']}/><Chips items={['All equipment','Step deck','Flatbed','Dry van','Reefer','Lowboy','Tanker']}/><MapView kind="hotzones" label="Market heat by state Â· Loads versus trucks"/><MarketDemo demo={demo}/><Chips items={['50 states Â· Demo data','Cool market','Balanced','Hot market']}/><Note>Higher demand. Greater potential. Find loads and maximize your miles.</Note></>;
case 'fuel':return <><Chips items={['Route','Fuel stops','Weather']}/><TripInfo/><FuelDemo demo={demo}/><div className="demo-caption">ORIGINAL ROUTE EXAMPLE</div><MapView kind="fuel" label="Fuel stops Â· Denver to Atlanta"/><Section title="Stops along the route"><Rows items={ [['Pilot','$3.26 / gal','12 mi off I-70'],['TA Express','$3.18 / gal','8 mi off I-44'],["Loveâ€™s Â· Cheapest on route",'$3.11 / gal','6 mi off I-40 Â· Save ~$18 vs. next best stop'],['Flying J','$3.24 / gal','10 mi off I-75']]}/></Section><Section title="Recommended fuel plan"><Rows items={ [['Best route + fuel stops','$401 Â· Save $42','1,243 mi Â· 20h 30m Â· 4 stops'],['Faster route','+$12 fuel','1,198 mi Â· 19h 50m Â· Saves 40 minutes'],['Cheaper fuel route','Save $63','1,256 mi Â· 21h 10m Â· 5 stops'],['Fewer tolls','+$8 fuel','1,268 mi Â· 21h 30m Â· 1 less stop']]}/></Section><Note>Light rain possible in KS and MO. Fuel prices may vary by up to $0.60 / gal along this route. Pro tip: fill up in MO or AR.</Note><Chips items={['Optimize fuel stops','Route','Fuel stop','Origin','Destination']}/></>;
case 'documents':return <><Chips items={['Add document']}/><div className="panel-columns"><Section title="Company documents Â· 4 / 4 complete"><Rows items={ [['W-9','Ready','Tax identification form'],['Certificate of insurance','Ready','Active commercial insurance'],['Motor carrier authority','Ready','MC number and authority letter'],['Factoring / NOA','Ready','Notice of Assignment']]}/></Section><Section title="Fleet documents Â· 4 / 4 complete"><Rows items={ [['IFTA license','Ready','Fuel tax agreement'],['UCR registration','Ready','Unified Carrier Registration'],['IRP cab cards','4 units','Apportioned registration'],['Insurance','Active','Fleet / physical damage']]}/></Section></div><Section title="Quick Setup packet Â· Ready"><Note>All required documents in one packet. Ready for dispatcher review.</Note><Chips items={['Agreement Â· Ready','W-9 Â· Ready','MC authority Â· Ready','COI Â· Ready','NOA Â· Ready','View packet']}/></Section><Section title="Driver access"><Rows items={ [['View permissions','Enabled','Give drivers access to company documents'],['Last update','Today'],['Documents synced','9']]}/><Chips items={['Manage access']}/></Section></>;
case 'dispatcher':return <><Note>Good morning, Driver! Iâ€™ve found a great load for you. High rate, smooth route, and good weather ahead. Shall I add it to your planner? Â· 6:42 AM</Note><Chips items={['Add to planner','Suggested load #1183927 Â· High paying']}/><Rows items={ [['Dallas, TX','Pickup','Mon, Apr 21 Â· 08:00 AM Â· Warehouse Distribution'],['Chicago, IL','Delivery','Wed, Apr 23 Â· 02:00 PM Â· Retail DC']]}/><div className="panel-metrics three"><Stat label="Rate" value="$2,800"/><Stat label="Rate / mile" value="$2.24"/><Stat label="Distance" value="1,250 mi"/></div><Chips items={['Dry van','44,000 lbs','Drop & hook','Fuel friendly']}/><MapView kind="dispatcher" label="Route optimization Â· Dallas to Chicago"/><Rows items={ [['Fastest + cheapest','20h 15m','1,250 mi Â· 3 recommended stops'],['Estimated fuel cost','âˆ’$120']]}/><div className="panel-columns"><Section title="Weather ahead"><p>Light rain near St. Louis, MO. Tue, Apr 22 Â· 10 AMâ€“4 PM. Plan for wet roads.</p></Section><Section title="Best fuel stop"><p>Pilot Travel Center Â· Springfield, IL Â· I-55, Exit 92</p><Rows items={ [['Best price','$3.09 / gal','Average $3.42'],['Savings','~$45']]}/></Section></div><Note>AI insight: this route is 12% more profitable than your usual lanes. Lower fuel cost, strong rate, and minimal weather risk.</Note><Section title="Quick actions"><Chips items={['Calculate Â· Payments & costs','Plan route Â· With stops','Find load Â· Match my lanes','Summarize week Â· Earnings & miles']}/></Section><Section title="This week"><div className="panel-metrics four"><Stat label="Miles" value="2,840"/><Stat label="Loads" value="5"/><Stat label="Gross" value="$7,420"/><Stat label="Average / mi" value="$2.61"/></div></Section><Note>Your 24/7 co-pilot Â· Plan smarter Â· Drive further Â· Earn more</Note></>;
case 'brokers':return <><div className="panel-metrics four"><Stat label="Total brokers" value="248"/><Stat label="Approved" value="142"/><Stat label="Watchlist" value="67"/><Stat label="Blocked" value="39"/></div><Chips items={['Search brokers, lanes, contact','Company database']}/>{[
['NorthPeak Freight Partners','A','Setup complete','6 months','Priority','428','21 days','$2.48','Dry van','CHI â†’ ATL','Sarah Mitchell','(312) 555-0186','s.mitchell@northpeakfp.com','Preferred broker'],
['BlueRiver Logistics Group','B','Setup in progress','3 months','Watchlist','186','32 days','$2.12','Reefer','DAL â†’ LAX','Marcus Reed','(469) 555-2034','m.reed@blueriverlog.com','Slower pay terms'],
['Summit Lane Brokerage','C','Company blacklist','12 months','Blocked','52','45 days','$1.76','Flatbed','HOU â†’ NYC','David Lawson','(713) 555-4477','d.lawson@summitlane.com','Multiple payment issues']
].map(([name,rating,status,age,rule,completed,pay,rpm,equipment,lane,contact,phone,email,note])=><Section key={name} title={name}><Chips items={[`Rated ${rating}`,status,note]}/><Rows items={ [['MC age requirement',age],['Company rule',rule],['Completed loads',completed],['Average days to pay',pay],['Average RPM',rpm],['Preferred equipment',equipment],['Top lane',lane],['Contact',contact],['Phone',phone],['Email',email]]}/></Section>)}</>;
default:return <><Chips items={['Broker email','Packet check','Autofill','Review','Reply','2 actions']}/><Section title="Incoming carrier setup Â· Needs action"><p><strong>SD Transportation</strong><br/>From: Sherri Reese Â· Carrier agreement attached</p><blockquote>Please fill out the attached carrier agreement and return it to me along with your setup packet.</blockquote><div className="panel-metrics three"><Stat label="Broker packet" value="9 pages"/><Stat label="Mandatory items" value="4"/><Stat label="Company Vault match" value="2 / 4 ready"/></div></Section><Section title="Required by SD Transportation Â· 2 need action"><Rows items={ [['Carrier agreement','Needs review','Broker form found Â· Company fields can be prefilled'],['MC authority','Ready','GGWP INC carrier authority available in Company Vault'],['W-9','Ready','Completed GGWP INC W-9 available in Company Vault'],['Certificate of insurance','Needs new COI','Current COI exists, but SD Transportation must be the certificate holder']]}/><Chips items={['Autofill','Review & sign','Preview PDF','Request COI','Demo: COI received']}/></Section><Section title="Setup review Â· 2 / 4 ready"><progress max="4" value="2" aria-label="2 of 4 required items ready"/><Rows items={ [['W-9','Ready'],['MC authority','Ready'],['Carrier agreement','Review'],['Broker-specific COI','Action']]}/><Note>Factoring / NOA is available in Company Vault and can be attached to the reply, but is not one of this packetâ€™s four mandatory items.</Note></Section><Section title="Reply package Â· Draft"><p>Prepared only after all required items are ready.</p><Rows items={ [['Carrier agreement','Waiting'],['W-9','Attached'],['MC authority','Attached'],['Certificate of insurance','Waiting'],['Factoring / NOA','Optional']]}/><Chips items={['Preview package','Prepare reply']}/></Section><Section title="Reply preview"><Rows items={ [['To','Sherri Reese'],['Subject','Re: SD Transportation Carrier Agreement']]}/><blockquote>Hi Sherri,<br/>Please find our completed carrier agreement and setup packet attached.<br/>Thank you.</blockquote><Chips items={['Agreement','W-9','MC authority','COI','NOA','Send reply']}/><Note>Nothing is sent automatically. This is a sample reply preview.</Note></Section></>;
}}
function CalculatorStory({demo}:{demo:DemoState}){const {rate,setRate}=demo,{costs,expenses,net}=tripEstimate(rate);return <div className="calculator-story"><div className="calc-route">Denver, CO â†’ Atlanta, GA <span>1,230 miles Â· Van Â· Demo assumptions</span></div><label className="rate-control"><span>Try your gross rate <strong>{money(rate)}</strong></span><input type="range" min="2000" max="6000" step="50" value={rate} onChange={e=>setRate(Number(e.target.value))} aria-valuetext={money(rate)}/><small>Drag to see what you keep Â· $2,000â€“$6,000</small></label><div className="calc-story-grid"><div className="calc-ledger"><div className="calc-gross"><span>Gross rate</span><strong>{money(rate)}</strong></div><div className="calc-costs">{['Fuel','Tolls','Fees / fines','Other expenses','Maintenance Â· 12%','Dispatch Â· 10%'].map((name,i)=><div className="calc-cost" key={name}><span className="calc-cost-label"><RowIcon label={name}/>{name}</span><strong>{money(costs[i])}</strong></div>)}</div><div className="calc-total"><span>Total expenses</span><strong>âˆ’{money(expenses)}</strong></div></div><div className="calc-result"><span className="calc-result-label">WHAT YOU KEEP</span><ExpenseRing rate={rate}/><p>After trip expenses.</p></div></div><div className="calc-equation" aria-live="polite" aria-atomic="true"><span>{money(rate)} gross</span><span>âˆ’ {money(expenses)} costs</span><strong>= {money(net)} estimated net</strong></div></div>}
export function FeaturePanel({kind,onExpand,mobile=false}:{kind:string,onExpand?:()=>void,mobile?:boolean}){
 const key=kind as keyof typeof icons,Icon=icons[key],dialog=useRef<HTMLDialogElement>(null);
 const panelRef=useRef<HTMLDivElement>(null),contentRef=useRef<HTMLDivElement>(null),tiltAllowed=useRef(false);
 const lightPositioned=useRef(false),lightMotion=useRef<{x:(value:number)=>void;y:(value:number)=>void}|null>(null);
 const [hasMore,setHasMore]=useState(false);
 const [overlayHost,setOverlayHost]=useState<HTMLDivElement|null>(null);
 const releaseBackground=useRef<(()=>void)|null>(null);
 const dimmerRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const host=document.createElement('div');host.className='experience feature-overlay-root';
  document.body.appendChild(host);setOverlayHost(host);
  return()=>{releaseBackground.current?.();host.remove();};
 },[]);
 const [rate,setRate]=useState(3250),[market,setMarket]=useState(0),[fuel,setFuel]=useState(1);
 const [selection,setSelection]=useState(initialLoadSelection);
 const demo={rate,setRate,market,setMarket,fuel,setFuel,selection,setSelection};
 const animation=useRef<Animation|null>(null),detailAnimation=useRef<Animation|null>(null),returnAnimation=useRef<Animation|null>(null),dimmerAnimation=useRef<Animation|null>(null),closing=useRef(false);
 useEffect(()=>()=>{animation.current?.cancel();detailAnimation.current?.cancel();returnAnimation.current?.cancel();dimmerAnimation.current?.cancel();if(dialog.current?.open)delete document.documentElement.dataset.mobileDetailOpen;},[]);
 const updateMore=()=>{const el=contentRef.current;if(el)setHasMore(el.scrollHeight-el.clientHeight-el.scrollTop>8);};
 useEffect(()=>{
  const query=window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const panel=panelRef.current!;
  gsap.set(panel,{'--light-x':'0px','--light-y':'0px'});
  const x=gsap.quickTo(panel,'--light-x',{duration:.38,ease:'power2.out'});
  const y=gsap.quickTo(panel,'--light-y',{duration:.38,ease:'power2.out'});
  lightMotion.current={x,y};
  const sync=()=>{tiltAllowed.current=query.matches;if(!query.matches)resetTilt();};sync();query.addEventListener('change',sync);
  window.addEventListener('blur',resetTilt);
  const el=contentRef.current!;const observer=new ResizeObserver(updateMore);observer.observe(el);Array.from(el.children).forEach(child=>observer.observe(child));updateMore();
  return()=>{observer.disconnect();query.removeEventListener('change',sync);window.removeEventListener('blur',resetTilt);x.tween.kill();y.tween.kill();lightMotion.current=null;};
 },[]);
 const resetTilt=()=>{panelRef.current?.style.setProperty('--light-on','0');panelRef.current?.style.setProperty('--tilt-x','0deg');panelRef.current?.style.setProperty('--tilt-y','0deg');};
 const tilt=(event:PointerEvent<HTMLDivElement>)=>{
  if(!tiltAllowed.current||event.pointerType!=='mouse')return;
  const rect=event.currentTarget.getBoundingClientRect();
  const lightX=event.clientX-rect.left,lightY=event.clientY-rect.top;
  if(!lightPositioned.current){
   gsap.set(event.currentTarget,{'--light-x':`${lightX}px`,'--light-y':`${lightY}px`});
   lightPositioned.current=true;
  }
  lightMotion.current?.x(lightX);lightMotion.current?.y(lightY);
  event.currentTarget.style.setProperty('--light-on','1');
  const x=Math.max(-1,Math.min(1,(event.clientX-rect.left)/rect.width*2-1));
  const y=Math.max(-1,Math.min(1,(event.clientY-rect.top)/rect.height*2-1));
  event.currentTarget.style.setProperty('--tilt-x',`${-y*1.4}deg`);
  event.currentTarget.style.setProperty('--tilt-y',`${x*1.4}deg`);
 };
 const animateDialog=(entering:boolean)=>{
  const el=dialog.current,origin=panelRef.current;if(!el)return;
  const phone=matchMedia('(max-width: 800px)').matches;
  const shell=el.querySelector<HTMLElement>('.dialog-shell'),content=el.querySelector<HTMLElement>('.dialog-content'),surface=el.querySelector<HTMLElement>('.dialog-surface'),dimmer=dimmerRef.current;
  const dimmerOpacity=dimmer?getComputedStyle(dimmer).opacity:'1';
  const shellState=shell?getComputedStyle(shell).transform:'none';
  const contentOpacity=content?getComputedStyle(content).opacity:'1';
  const interrupted=!!animation.current;
  animation.current?.cancel();detailAnimation.current?.cancel();dimmerAnimation.current?.cancel();
  el.dataset.motion=entering?'opening':'closing';
  const finish=()=>{
   if(!entering){const position=window.scrollY;origin?.style.removeProperty('opacity');el.close();releaseBackground.current?.();releaseBackground.current=null;origin?.querySelector<HTMLButtonElement>('.expand-card')?.focus({preventScroll:true});if(phone&&window.scrollY!==position)window.scrollTo({top:position,behavior:'instant'});closing.current=false;delete document.documentElement.dataset.mobileDetailOpen;el.style.removeProperty('opacity');el.style.removeProperty('max-height');el.style.removeProperty('height');returnAnimation.current?.cancel();returnAnimation.current=null;shell?.style.removeProperty('opacity');shell?.style.removeProperty('transform');}
   animation.current?.cancel();detailAnimation.current?.cancel();animation.current=null;detailAnimation.current=null;dimmerAnimation.current?.cancel();dimmerAnimation.current=null;delete el.dataset.motion;
  };
  if(!origin||matchMedia('(prefers-reduced-motion: reduce)').matches){el.style.removeProperty('opacity');finish();return;}
  if(phone&&shell&&content){
   const from=origin.getBoundingClientRect(),to=el.getBoundingClientRect();
   const collapsed=`translate(${from.left+from.width/2-to.left-to.width/2}px,${from.top+from.height/2-to.top-to.height/2}px) scale(${from.width/to.width},${from.height/to.height})`;
   const full='translate(0px,0px) scale(1,1)';
   origin.style.opacity='0';
   if(entering){
    animation.current=shell.animate([{transform:interrupted?shellState:collapsed},{transform:full}],{duration:560,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});
    detailAnimation.current=content.animate([{opacity:interrupted?contentOpacity:0},{opacity:1}],{duration:520,delay:280,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'});
    if(dimmer)dimmerAnimation.current=dimmer.animate([{opacity:interrupted?dimmerOpacity:0},{opacity:1}],{duration:560,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'});
   }else{
    // Fade the complete clipped surface and its sibling shade on one clock.
    // No empty shrinking shell and no delayed return of the preview underneath.
    const timing:KeyframeAnimationOptions={duration:360,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'};
    if(interrupted)shell.style.transform=shellState;
    animation.current=(surface??shell).animate([{opacity:1,transform:'translateY(0px) scale(1)'},{opacity:0,transform:'translateY(6px) scale(.985)'}],timing);
    detailAnimation.current=content.animate([{opacity:contentOpacity},{opacity:contentOpacity}],timing);
    returnAnimation.current=origin.animate([{opacity:0},{opacity:1}],timing);
    if(dimmer)dimmerAnimation.current=dimmer.animate([{opacity:dimmerOpacity},{opacity:0}],timing);
    const start=document.timeline.currentTime;
    if(start!==null)for(const motion of [animation.current,detailAnimation.current,returnAnimation.current,dimmerAnimation.current])if(motion)motion.startTime=start;
   }
   const surfaceMotion=animation.current,textMotion=detailAnimation.current;
   Promise.all([surfaceMotion.finished,textMotion.finished,...(dimmerAnimation.current?[dimmerAnimation.current.finished]:[]),...(!entering&&returnAnimation.current?[returnAnimation.current.finished]:[])]).then(()=>{
    if(animation.current===surfaceMotion&&detailAnimation.current===textMotion)finish();
   }).catch(()=>{});
   el.style.removeProperty('opacity');return;
  }
  const from=origin.getBoundingClientRect(),to=el.getBoundingClientRect();
  const collapsed={transform:`translate(${from.left+from.width/2-to.left-to.width/2}px,${from.top+from.height/2-to.top-to.height/2}px) scale(${from.width/to.width},${from.height/to.height})`,opacity:0};
  const expanded={transform:'translate(0,0) scale(1)',opacity:1};
  animation.current=el.animate(entering?[collapsed,expanded]:[expanded,collapsed],{duration:entering?420:280,easing:'cubic-bezier(.22,1,.36,1)'});
  animation.current.onfinish=finish;
 };
 const open=()=>{
  const el=dialog.current;if(!el||el.open)return;
  resetTilt();onExpand?.();
  if(!matchMedia('(max-width: 800px)').matches){el.showModal();animateDialog(true);return;}
  const scrollY=window.scrollY;
  document.documentElement.dataset.mobileDetailOpen='true';
  el.dataset.motion='preparing';el.style.opacity='0';el.style.maxHeight=`${Math.round(window.innerHeight*.88)}px`;
  // The phone overlay lives outside the animated scenes, without a browser top-layer backdrop.
  el.show();
  if(overlayHost){
   const siblings=Array.from(document.body.children).filter((node):node is HTMLElement=>node instanceof HTMLElement&&node!==overlayHost);
   const previous=siblings.map(node=>node.inert);siblings.forEach(node=>{node.inert=true;});
   // Keep root overflow unchanged: toggling it can relocate sticky video/navigation.
   const blockOutside=(event:Event)=>{if(!(event.target instanceof Element)||!event.target.closest('.dialog-content'))event.preventDefault();};
   document.addEventListener('touchmove',blockOutside,{passive:false});
   document.addEventListener('wheel',blockOutside,{passive:false});
   releaseBackground.current=()=>{
    document.removeEventListener('touchmove',blockOutside);document.removeEventListener('wheel',blockOutside);
    siblings.forEach((node,index)=>{node.inert=previous[index];});
   };
  }
  el.style.height=`${el.getBoundingClientRect().height}px`;el.scrollTop=0;const detail=el.querySelector<HTMLElement>('.dialog-content');if(detail)detail.scrollTop=0;
  el.querySelector<HTMLButtonElement>('.detail-heading button')?.focus({preventScroll:true});
  if(window.scrollY!==scrollY)window.scrollTo({top:scrollY,behavior:'instant'});
  // Let the browser lay out and composite the full panel before revealing it.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(el.open&&!closing.current)animateDialog(true);}));
 };
 const close=()=>{if(!dialog.current?.open||closing.current)return;closing.current=true;animateDialog(false);};
 const detailWindow=<dialog ref={dialog} className={`feature-dialog feature-dialog-${kind}`} aria-modal={true} onKeyDown={e=>{
  if(!matchMedia('(max-width: 800px)').matches)return;
  if(e.key==='Escape'){e.preventDefault();close();return;}
  if(e.key!=='Tab')return;
  const items=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')).filter(node=>node.getClientRects().length&&!node.closest('[inert]'));
  const first=items[0],last=items[items.length-1];
  if(!first){e.preventDefault();return;}
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus({preventScroll:true});}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus({preventScroll:true});}
 }} aria-label={`${names[key]} details`} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}} onWheel={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()}><div className="dialog-surface"><div className="dialog-shell" aria-hidden="true"/><div className="dialog-content"><div className="detail-heading"><span className="feature-icon"><Icon size={24} strokeWidth={1.6} aria-hidden="true"/></span><div><span>EZCLICK GO Â· DEMO PREVIEW</span><h3>{names[key]}</h3></div><button autoFocus aria-label="Close feature details" onClick={close}><X/></button></div><div className={`glass-panel glass-${kind} expanded-panel`}><Content kind={kind} demo={demo}/></div></div></div></dialog>;
 return <><div ref={panelRef} onPointerEnter={tilt} onPointerMove={tilt} onPointerLeave={resetTilt} onPointerDown={onExpand} onFocusCapture={onExpand} className={`glass-panel glass-${kind} rich-panel`}><div className="panel-heading panel-reveal"><span className="feature-icon"><Icon size={24} strokeWidth={1.6} aria-hidden="true"/></span><h3>{names[key]}</h3><span className="preview-label">Demo preview</span></div><div className="card-scroll-shell" data-more={hasMore}><div ref={contentRef} inert={mobile} onWheel={e=>{if(!mobile)e.stopPropagation();}} onTouchMove={e=>{if(!mobile)e.stopPropagation();}} onScroll={updateMore} tabIndex={mobile?-1:0} aria-label={`${names[key]} preview details`} className={`card-content ${kind==='calculator'?'calculator-focus':''}`}>{kind==='calculator'?<CalculatorStory demo={demo}/>:<Content kind={kind} demo={demo} animatedTrip={mobile&&kind==='trip'}/>}</div>{hasMore&&<div className="card-scroll-hint">Scroll for more</div>}</div><button className="expand-card" onClick={open}><Maximize2 size={16}/>{kind==='calculator'?'See the full breakdown':`Explore full ${names[key]}`}</button></div>{overlayHost?createPortal(<><div ref={dimmerRef} className="dialog-dimmer" aria-hidden="true" onClick={close}/>{detailWindow}</>,overlayHost):detailWindow}</>;
}
