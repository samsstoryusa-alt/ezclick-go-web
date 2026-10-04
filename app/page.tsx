'use client';
import {useEffect,useRef,useState} from 'react';
import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {Play,Pause,RotateCcw,Home as HomeIcon,Search,Calculator,Route,CloudRain,Flame,Fuel,FileText,Headphones,Building2,ClipboardCheck,Receipt,ShieldCheck,Download} from 'lucide-react';
import {AmbientInteractions} from './ambient-interactions';

import {Pricing} from './pricing';
import {SiteDetails} from './site-details';
import {sceneWindows} from './scene-motion';
import {FeaturePanel} from './feature-panel';
import {JourneyCanvas} from './journey-canvas';
import {chapters,clips,shots,frameUrl,total} from './journey';

// Release the desktop pin at the last moving frame; omit the final static hold.
const finalShot=shots[shots.length-1];
const desktopEnd=finalShot.hold?finalShot.start:total;
const chapterIcons=[HomeIcon,Search,Calculator,Route,CloudRain,Flame,Fuel,FileText,Headphones,Building2,ClipboardCheck,Receipt,ShieldCheck,Building2,Download];
const headlineAccents:Record<string,string>={find:'ahead',calculator:'profit',trip:'Own the road',weather:'safer',hotzones:'next load',fuel:'More in your pocket',documents:'Handled',dispatcher:'great load',brokers:'Make your move',setup:'More hauling',statement:'Every dollar',security:'Your control'};
function FeatureHeadline({title,kind}:{title:string,kind:string}){const word=headlineAccents[kind],at=word?title.indexOf(word):-1;return <h2>{at<0?title:<>{title.slice(0,at)}<span className="headline-accent">{word}</span>{title.slice(at+word.length)}</>}</h2>;}

export default function Home(){
 const root=useRef<HTMLElement>(null),trigger=useRef<ScrollTrigger|null>(null);
 const demo=useRef<gsap.core.Tween|null>(null),time=useRef(0);
 const navigation=useRef<gsap.core.Animation|null>(null),navigationVeil=useRef<HTMLDivElement>(null);
 const [active,setActive]=useState(0),[playing,setPlaying]=useState(false),[reduced,setReduced]=useState(false);
 const [mobile,setMobile]=useState(false);
 const autoStarted=useRef(false);
 const mobileNav=useRef<HTMLDivElement>(null);
 const [leadPlan,setLeadPlan]=useState('Undecided'),[joinRequest,setJoinRequest]=useState(0);
 const stop=()=>{demo.current?.kill();demo.current=null;navigation.current?.kill();navigation.current=null;if(navigationVeil.current)gsap.set(navigationVeil.current,{autoAlpha:0});setPlaying(false);};
 const leaveStory=()=>{
  stop();
  trigger.current?.disable(false);
  window.location.assign('/version-a');
 };
 const travelTo=(target:number)=>{
  stop();const max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
  const destination=Math.min(max,Math.max(0,target)),distance=Math.abs(destination-window.scrollY);
  if(window.matchMedia('(max-width: 800px)').matches){window.scrollTo({top:destination,behavior:reduced?'instant':'smooth'});return;}
  if(reduced||distance<2){window.scrollTo(0,destination);return;}
  if(distance>window.innerHeight*2.5&&navigationVeil.current){
   // Distant chapters crossfade through darkness instead of fast-forwarding the film.
   navigation.current=gsap.timeline({onComplete:()=>{navigation.current=null;}})
    .to(navigationVeil.current,{autoAlpha:1,duration:.45,ease:'sine.inOut'})
    .call(()=>{window.scrollTo(0,destination);ScrollTrigger.update();trigger.current?.getTween()?.progress(1);})
    .to(navigationVeil.current,{autoAlpha:0,duration:.85,ease:'sine.inOut'},'+=.65');
  }else{
   const position={y:window.scrollY};
   navigation.current=gsap.to(position,{y:destination,duration:1.2+Math.min(.6,distance/window.innerHeight*.25),ease:'sine.inOut',onUpdate:()=>window.scrollTo(0,position.y),onComplete:()=>{navigation.current=null;}});
  }
 };
 const go=(i:number)=>{
  const st=trigger.current,element=document.getElementById(`scene-${i}`);
  if(window.matchMedia('(max-width: 800px)').matches&&element){travelTo(element.getBoundingClientRect().top+window.scrollY);return;}
  if(st)travelTo(st.start+(st.end-st.start)*Math.min(chapters[i].mark,st.animation?.duration()??total)/(st.animation?.duration()??total));
  else if(element)travelTo(element.getBoundingClientRect().top+window.scrollY);
 };
 const goContact=()=>{const el=document.getElementById('contact');if(el)travelTo(el.getBoundingClientRect().top+window.scrollY-40);};
 const joinLaunch=(plan='Undecided')=>{setLeadPlan(plan);setJoinRequest(x=>x+1);goContact();};
 const goPricing=()=>{const element=document.getElementById('pricing');if(element)travelTo(element.getBoundingClientRect().top+window.scrollY);};
 const play=()=>{
  if(playing){stop();return;}const stage=root.current?.querySelector<HTMLElement>('.stage');
  const st=trigger.current??(window.matchMedia('(max-width: 800px)').matches&&stage?{start:stage.offsetTop,end:stage.offsetTop+stage.offsetHeight-window.innerHeight}:null);if(!st)return;
  let y=window.scrollY;if(y>=st.end-10){y=st.start;window.scrollTo(0,y);}
  const state={y};setPlaying(true);
  demo.current=gsap.to(state,{y:st.end,duration:Math.max(4,(trigger.current?.animation?.duration()??total)*(1-(y-st.start)/(st.end-st.start))),ease:'none',onUpdate:()=>window.scrollTo(0,state.y),onComplete:()=>{demo.current=null;setPlaying(false);}});
 };
 useEffect(()=>{
  gsap.registerPlugin(ScrollTrigger);const media=gsap.matchMedia();
  media.add({reduce:'(prefers-reduced-motion: reduce)',motion:'(prefers-reduced-motion: no-preference)',mobile:'(max-width: 800px)',desktop:'(min-width: 801px)'},context=>{
   const reduce=!!context.conditions?.reduce,isMobile=!!context.conditions?.mobile;setReduced(reduce);setMobile(isMobile);if(reduce)return;
   if(isMobile){
    // Native document scrolling owns mobile navigation; no pin or nested scroll trap.
    const elements=chapters.map((_,i)=>document.getElementById(`scene-${i}`)!);
    const stage=root.current!.querySelector<HTMLElement>('.stage')!;
    const update=()=>{
     const y=window.scrollY;let index=0;
     elements.forEach((el,i)=>{if(y>=el.offsetTop+stage.offsetTop-2)index=i;});
     const start=elements[index].offsetTop+stage.offsetTop;
     const end=index<elements.length-1?elements[index+1].offsetTop+stage.offsetTop:stage.offsetTop+stage.offsetHeight-window.innerHeight;
     const fraction=Math.max(0,Math.min(1,(y-start)/Math.max(1,end-start)));
     const from=index===0?0:chapters[index].mark,to=chapters[index+1]?.mark??total;
     time.current=from+(to-from)*fraction;setActive(index);
    };
    const st=ScrollTrigger.create({trigger:stage,start:'top top',end:'bottom bottom',onUpdate:update,onRefresh:update});
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){(entry.target as HTMLElement).dataset.mobileSeen='true';observer.unobserve(entry.target);}}),{threshold:.08});
    elements.forEach(el=>{if(el.getBoundingClientRect().top>window.innerHeight)el.dataset.mobileSeen='false';observer.observe(el);});
    update();
    return()=>{st.kill();observer.disconnect();elements.forEach(el=>el.removeAttribute('data-mobile-seen'));};
   }
   const scope=gsap.context(()=>{
    const clock={value:0};let chapter=-1;
    const sceneElements=chapters.map((_,i)=>root.current!.querySelector<HTMLElement>(`#scene-${i}`)!);
    const visibleFlags=chapters.map(()=>false);
    const syncVisibility=(value:number)=>sceneElements.forEach((element,i)=>{
     const w=sceneWindows[i],visible=value>=w.start&&value<w.end;
     if(element.dataset.motionVisible===undefined||visible!==visibleFlags[i]){element.dataset.motionVisible=String(visible);visibleFlags[i]=visible;}
    });
    syncVisibility(0);
    const timeline=gsap.timeline({scrollTrigger:{trigger:root.current,start:'top top',end:()=>`+=${window.innerHeight*25*desktopEnd/total}`,pin:'.stage',scrub:.55,invalidateOnRefresh:true},onUpdate:()=>{
     time.current=clock.value;syncVisibility(clock.value);
     let next=0;chapters.forEach((c,i)=>{if(clock.value>=c.start)next=i;});
     if(next!==chapter){chapter=next;setActive(next);}
     gsap.set('.journey-fill',{scaleX:clock.value/desktopEnd});
    }});
    timeline.to(clock,{value:desktopEnd,duration:desktopEnd,ease:'none'},0);
    chapters.forEach((c,i)=>{
     const scene=`#scene-${i}`;
     if(i===0){timeline.to(scene,{autoAlpha:0,y:-22,duration:1.4},4.6);return;}
     gsap.set(scene,{autoAlpha:0});
     timeline.fromTo(scene,{autoAlpha:0},{autoAlpha:1,duration:i===1?1.15:1,ease:'sine.inOut'},c.start);
     if(c.name==='City'){
      const motion=sceneWindows[i];
      timeline.to(scene,{autoAlpha:0,duration:1.3,ease:'sine.inOut'},motion.end-1.3);
     }else if(i===chapters.length-1){
      timeline.fromTo('.final-logo',{y:-65,autoAlpha:0},{y:0,autoAlpha:1,duration:2,ease:'power2.out'},c.start);
      timeline.fromTo('.download-area',{y:30,autoAlpha:0},{y:0,autoAlpha:1,duration:1.5},c.start+1.5);
     }else{
      const mobile=window.innerWidth<801, sign=i%2?-1:1;
      const motion=sceneWindows[i];
      const pilot=c.card==='find';
      const drift=Math.max(.1,motion.exitStart-c.start-1.6);
      // One motion owner: settle the copy, then keep it still until the scene fades.
      // Nested transforms and a second drift made glyphs crawl at fractional pixels.
      timeline.fromTo(`${scene} .scene-copy`,{y:mobile?6:10},{y:0,force3D:false,duration:1.4,ease:'sine.out'},c.start);
      timeline.fromTo(`${scene} .scene-copy .eyebrow`,{autoAlpha:0},{autoAlpha:1,duration:.9,ease:'sine.inOut'},c.start+.1);
      timeline.fromTo(`${scene} .scene-copy h2`,{autoAlpha:0},{autoAlpha:1,duration:1.1,ease:'sine.inOut'},c.start+.25);
      // Keep the percentage anchor explicit: GSAP normalizes CSS translate when animating.
      timeline.fromTo(`${scene} .product-card`,{yPercent:-50,y:mobile?30:58,x:mobile?0:sign*25,scale:.96,rotationY:mobile?0:sign*4},{yPercent:-50,y:0,x:0,scale:1,rotationY:0,duration:1.5,ease:'power2.out'},c.start+.1);
      timeline.fromTo(`${scene} .rich-panel > .panel-heading`,{autoAlpha:0,y:8},{autoAlpha:1,y:0,duration:.6},c.start+.35);
      if(c.card!=='calculator'){
       const panel=sceneElements[i].querySelector('.rich-panel')!;
       // Animate disjoint siblings once; nested content inherits its parent's reveal.
       const blocks=Array.from(panel.querySelectorAll('.card-content > *'));
       const payoff=blocks.filter(el=>el.matches('.source-map, .panel-metrics, .panel-note'));
       const details=blocks.filter(el=>!payoff.includes(el));
       if(details.length)timeline.fromTo(details,{autoAlpha:0,y:pilot?8:12},{autoAlpha:1,y:0,duration:pilot?.95:.65,stagger:{amount:pilot?.35:.55},ease:pilot?'sine.out':'power2.out'},c.start+.55);
       if(payoff.length)timeline.fromTo(payoff,{autoAlpha:0,y:8},{autoAlpha:1,y:0,duration:pilot?.9:.7,stagger:{amount:pilot?.2:.3},ease:pilot?'sine.out':'power2.out'},c.start+1.5);
      }
      if(c.card==='calculator'){
       timeline.fromTo(`${scene} .rich-panel .calc-cost`,{autoAlpha:0,x:-12},{autoAlpha:1,x:0,duration:.5,stagger:.12,ease:'power2.out'},c.start+.7);
       timeline.fromTo(`${scene} .rich-panel .calc-total`,{autoAlpha:0,y:8},{autoAlpha:1,y:0,duration:.55},c.start+1.4);
       timeline.fromTo(`${scene} .rich-panel .calc-result`,{autoAlpha:0,scale:.94,y:12},{autoAlpha:1,scale:1,y:0,duration:.85,ease:'power2.out'},c.start+1.65);
       timeline.fromTo(`${scene} .rich-panel .calc-equation`,{autoAlpha:0,y:8},{autoAlpha:1,y:0,duration:.6},c.start+2.2);
      }
      timeline.to(`${scene} .product-card`,{y:mobile?-6:-12,scale:1.008,duration:drift,ease:'none'},c.start+1.6);
      timeline.to(`${scene} .product-card`,{y:mobile?-24:-45,scale:.985,duration:.8,ease:'sine.in'},motion.exitStart);
      timeline.to(scene,{autoAlpha:0,duration:.8,ease:'sine.inOut'},motion.exitStart);
     }
    });
    timeline.to('.vignette',{opacity:.15,duration:3},152);
    timeline.to('.site-nav',{autoAlpha:0,duration:1.2},161);
    trigger.current=timeline.scrollTrigger!;
   },root);
   return()=>{trigger.current=null;scope.revert();root.current?.querySelectorAll('[data-motion-visible]').forEach(el=>el.removeAttribute('data-motion-visible'));};
  });
  // Measure the pinned story after layout settles, independently of the removed intro.
  let disposed=false,startFrame=0;
  const ready=()=>{if(disposed)return;startFrame=requestAnimationFrame(()=>{
   if(disposed)return;ScrollTrigger.refresh();
   if(!autoStarted.current&&new URLSearchParams(window.location.search).get('play')==='1'){
    autoStarted.current=true;
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)play();
   }
  });};
  document.fonts.ready.then(ready);window.addEventListener('pageshow',ready);
  const cancel=()=>stop();const key=(e:KeyboardEvent)=>{if(['Escape','ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key))cancel();};
  window.addEventListener('wheel',cancel,{passive:true});window.addEventListener('touchstart',cancel,{passive:true});window.addEventListener('keydown',key);
  const visibility=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',visibility);
  return()=>{disposed=true;cancelAnimationFrame(startFrame);window.removeEventListener('pageshow',ready);media.revert();demo.current?.kill();navigation.current?.kill();window.removeEventListener('wheel',cancel);window.removeEventListener('touchstart',cancel);window.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 useEffect(()=>{
  if(!mobile)return;
  const row=mobileNav.current;if(!row)return;
  const buttons=Array.from(row.querySelectorAll<HTMLButtonElement>('button'));
  const marker=row.querySelector<HTMLElement>('.chapter-highlight');
  const animate=()=>{
   let x=5,selectedX=5,selectedWidth=44;
   const duration=reduced?0:.55;
   buttons.forEach((button,i)=>{
    const width=i===active?(button.querySelector('span')?.scrollWidth||70)+47:44;
    if(i===active){selectedX=x;selectedWidth=width;}
    gsap.to(button,{width,duration,ease:'power2.inOut',overwrite:true});x+=width+6;
   });
   if(marker)gsap.to(marker,{x:selectedX,width:selectedWidth,opacity:1,duration,ease:'power2.inOut',overwrite:true});
   gsap.to(row,{scrollLeft:Math.max(0,Math.min(x-row.clientWidth,selectedX-(row.clientWidth-selectedWidth)/2)),duration,ease:'power2.inOut',overwrite:true});
  };
  animate();window.addEventListener('resize',animate);
  return()=>{window.removeEventListener('resize',animate);gsap.killTweensOf([...buttons,row,...(marker?[marker]:[])]);};
 },[active,mobile,reduced]);
 return <main ref={root} className={`experience ${reduced?'reduced':''}`}>
  <div ref={navigationVeil} className="navigation-veil" aria-hidden="true"/>
  <AmbientInteractions/>

  <a className="skip" href="#scene-1" onClick={e=>{e.preventDefault();go(1);}}>Skip to features</a>
  <header className="site-nav">
   <a className="brand" aria-label="EZCLICK GO platform home" href="/version-a" onPointerDown={stop} onClick={e=>{if(!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();leaveStory();}}}><img src="/media/ezclick-go-logo.png" width="2166" height="726" alt="EZCLICK GO"/></a>
   <nav aria-label="Explore EZCLICK GO"><button onClick={()=>go(1)}>Find Load</button><button onClick={()=>go(2)}>Plan & earn</button><button onClick={()=>go(8)}>AI Dispatcher</button><button onClick={goPricing}>Pricing</button></nav>
   <a className="story-back-platform" href="/version-a" onPointerDown={stop} onClick={e=>{if(!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();leaveStory();}}}>← Back to platform</a>
   <button className="nav-cta" onClick={()=>joinLaunch()}>Join the launch list</button>
  </header>
  <div className="stage">
   <nav className="mobile-chapters" aria-label="Journey sections"><div ref={mobileNav} className="mobile-chapter-list"><i className="chapter-highlight" aria-hidden="true"/>{chapters.map((chapter,i)=>{const Icon=chapterIcons[i];return <button key={chapter.name} aria-label={chapter.name} aria-current={active===i?'step':undefined} onClick={()=>go(i)}><Icon size={17} strokeWidth={1.7}/><span aria-hidden={active!==i}>{chapter.name}</span></button>;})}</div></nav>
   <div className="environments" aria-hidden="true"><img className="film-poster" src={mobile?frameUrl(chapters[active].clip,active===0?0:Math.min(30,clips[chapters[active].clip].frames-1)):frameUrl(0,0)} alt="" fetchPriority="high"/><JourneyCanvas time={time} enabled={!reduced}/><div className="vignette"/></div>
   {chapters.map((c,i)=><section id={`scene-${i}`} key={c.name} className={`scene ${i===0?'hero-scene':i===chapters.length-1?'final-scene':`feature-scene ${i%2===0?'reverse':''}`} ${c.card==='find'?'find-scene':''} ${c.name==='City'?'city-scene':''}`} aria-label={c.name} aria-hidden={!mobile&&!reduced&&active!==i}>
    <img className="reduced-backdrop" src={frameUrl(c.clip,i===0?0:clips[c.clip].frames-1)} alt="" loading="lazy"/>
    {i===0?<div className="hero-copy"><div className="eyebrow">BUILT FOR THE ROAD AHEAD</div><h1>Your truck.<br/>Your business.<br/><span>Your rules.</span></h1><div className="actions"><button className="primary" onClick={()=>go(1)}>Explore EZCLICK GO</button><button className="secondary" onClick={play} disabled={reduced}>{playing?<Pause size={17}/>:<Play size={17}/>} {playing?'Pause film':'Watch the film'}</button></div><p className="scroll-hint">Scroll to begin your journey</p></div>:i===chapters.length-1?<>
     <div className="final-brand"><img className="final-logo" src="/media/ezclick-go-logo.png" width="2166" height="726" alt="EZCLICK GO"/><h2>Your next move.<br/>One click away.</h2></div>
     <div className="download-area"><div className="download-buttons">{[{name:'App Store',icon:'appstore',platform:'iOS'},{name:'Google Play',icon:'googleplay',platform:'Android'},{name:'Windows',icon:'windows11',platform:'PC'},{name:'macOS',icon:'apple',platform:'Mac'}].map(({name,icon,platform})=><button key={name} disabled className="download-button" aria-label={`${name} for ${platform} — coming soon`}><img className="platform-logo" src={`/media/platforms/${icon}.svg`} width={28} height={28} alt="" aria-hidden="true"/><span><small>Coming soon</small><strong>{name}</strong></span></button>)}</div><button className="final-join-launch" onClick={()=>joinLaunch()}>Notify me at launch</button><a className="final-pricing-link" href="#pricing" onClick={e=>{e.preventDefault();goPricing();}}>Explore plans</a><button className="replay" onClick={()=>go(0)}><RotateCcw size={15}/> Replay the journey</button></div>
    </>:c.name==='City'?<div className="city-message"><h2>Your business.<br/><span>Under control.</span></h2></div>:<><div className="scene-copy"><div className="eyebrow">{String(i).padStart(2,'0')} / {c.name.toUpperCase()}</div><FeatureHeadline title={c.title} kind={c.card}/></div><div className={`product-card ${c.card}-card`}><FeaturePanel kind={c.card} onExpand={stop} mobile={mobile}/></div></>}
   </section>)}
   <div className="journey"><label className="chapter-picker"><span className="sr-only">Choose a chapter</span><span className="chapter-count" aria-hidden="true">{String(active+1).padStart(2,'0')} <span>/ {chapters.length}</span></span><select aria-label="Choose a chapter" value={active} onChange={e=>go(Number(e.target.value))}>{chapters.map((c,i)=><option value={i} key={c.name}>{c.name}</option>)}</select></label><div className="journey-track"><span className="journey-fill"/></div><button className="motion-toggle" onClick={play} aria-label={playing?'Pause film':'Play film'}>{playing?<Pause size={16}/>:<Play size={16}/>}<span>{playing?'Pause':'Play film'}</span></button></div>
  </div>
  <Pricing onJoin={joinLaunch}/><SiteDetails onExplore={go} onPricing={goPricing} onJoin={goContact} onFaq={()=>{const el=document.getElementById('faq');if(el)travelTo(el.getBoundingClientRect().top+window.scrollY-40);}} selectedPlan={leadPlan} joinRequest={joinRequest}/>
 </main>;
}
