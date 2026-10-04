import {useEffect, useId, useRef} from 'react';
import {ArrowRight, ArrowUpRight} from 'lucide-react';
import {weatherUrl} from './site-links';
import './version-a-hero.css';

export function HeroScene(){
 const sceneRef=useRef<HTMLDivElement>(null), buttonRef=useRef<HTMLButtonElement>(null);
 const id=useId().replace(/:/g,'');
 useEffect(()=>{
  const sceneElement=sceneRef.current,buttonElement=buttonRef.current;
  if(!sceneElement||!buttonElement)return;
  const scene=sceneElement,button=buttonElement;
  const controller=new AbortController(),signal=controller.signal;
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(pointer:fine)'),small=matchMedia('(max-width:650px)');
const layers=[...scene.querySelectorAll<HTMLElement>('[data-depth]')],lampLeft=scene.querySelector<SVGGElement>('.va-rock-lamp-left')!,lampRight=scene.querySelector<SVGGElement>('.va-rock-lamp-right')!;let enabled=!reduced.matches,tx=0,ty=0,x=0,y=0,scrollTarget=0,scrollPosition=0,raf=0,last=0,inView=true,phase=0;
function paint(){const w=Math.min(scene.clientWidth/1240,1);for(const el of layers){const back=el.classList.contains('va-rock-back'),amount=back?3:7;const slide=back?0:scrollPosition*18*w;el.style.transform=`translate3d(${x*amount*w+slide}px,${y*amount*.4*w-(back?0:scrollPosition*3*w)}px,0) scale(1.045)`}}
function draw(now:number){const dt=last?Math.min(now-last,48):16;last=now;const active=enabled&&!reduced.matches&&!small.matches;if(active)phase+=dt/1000;const a=1-Math.exp(-dt/250);x+=(tx-x)*a;y+=(ty-y)*a;scrollPosition+=(scrollTarget-scrollPosition)*(1-Math.exp(-dt/190));paint();scene.querySelector<SVGSVGElement>('.va-rock-headlamp-light')!.style.opacity=active?String(.9+Math.sin(phase*.65)*.1):'.9';const turn=active?Math.sin(phase*.48)*1.8+x*5.5:0;lampLeft.setAttribute('transform',`rotate(${turn} 1137 303)`);lampRight.setAttribute('transform',`rotate(${turn*.8} 1283 302)`);if(inView&&!document.hidden&&(active||Math.abs(x-tx)+Math.abs(y-ty)+Math.abs(scrollTarget-scrollPosition)>.0005))raf=requestAnimationFrame(draw);else{raf=0;last=0}}
function request(){if(!raf&&inView&&!document.hidden)raf=requestAnimationFrame(draw)}
function reset(){tx=ty=0;request()}
function updateScroll(){const r=scene.getBoundingClientRect();scrollTarget=enabled&&!reduced.matches?Math.max(0,Math.min(1,(innerHeight*.45-r.top)/(r.height+innerHeight*.25))):0;request()}
window.addEventListener('scroll',updateScroll,{passive:true,signal});
function sync(){button.setAttribute('aria-pressed',String(enabled));button.textContent=enabled?'Motion on ↗':'Motion off';if(!enabled||reduced.matches){tx=ty=x=y=scrollPosition=scrollTarget=0;cancelAnimationFrame(raf);raf=0;last=0;paint();lampLeft.removeAttribute('transform');lampRight.removeAttribute('transform')}else{if(small.matches)tx=ty=x=y=0;updateScroll()}}
window.addEventListener('pointermove',e=>{if(!enabled||reduced.matches||small.matches||!fine.matches)return;tx=Math.max(-1,Math.min(1,(e.clientX/innerWidth-.5)*2));ty=Math.max(-1,Math.min(1,(e.clientY/innerHeight-.5)*2));request()},{passive:true,signal});document.documentElement.addEventListener('pointerleave',reset,{signal});window.addEventListener('blur',reset,{signal});window.addEventListener('resize',sync,{passive:true,signal});button.addEventListener('click',()=>{enabled=!enabled;sync()},{signal});reduced.addEventListener('change',()=>{enabled=!reduced.matches;sync()},{signal});small.addEventListener('change',sync,{signal});document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0}else request()},{signal});const observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(inView)request();else{cancelAnimationFrame(raf);raf=0;last=0}},{rootMargin:'100px'});observer.observe(scene);paint();sync();
return()=>{controller.abort();observer.disconnect();cancelAnimationFrame(raf);};

 },[]);
 return <section className="va-rock-hero" aria-labelledby="va-rock-title">
 <div className="va-rock-copy"><p className="va-eyebrow">BUILT AROUND THE WAY YOU MOVE</p>
 <h1 id="va-rock-title">Your road. Your business.<br/><em>One clear view.</em></h1>
 <p className="va-rock-intro">From the next load to the last mile.<br/>Your trucking day, brought together.</p>
 <div className="va-actions"><a className="va-primary" href="#product"><span className="va-action-surface">Explore EZCLICK GO <ArrowRight size={18}/></span></a><a className="va-weather-cta" href={weatherUrl} target="_blank" rel="noopener noreferrer"><span className="va-action-surface">Try live weather <ArrowUpRight size={17}/></span></a></div>
 <p className="va-availability">Platform preview · Live weather available now</p></div>
<div className="va-rock-scene" ref={sceneRef} role="img" aria-label="EZCLICK GO: silver laptop with route weather and silver phone with Find Load on rocks; distant truck headlights illuminate the scene"><div className="va-rock-depth-layer va-rock-back" data-depth="0.18"><img src="/media/hero/hero-truck-background.png" alt="" width="1672" height="941"/><svg className="va-rock-headlamp-light" viewBox="0 0 1672 941" aria-hidden="true"><defs><filter id={id+"-lamp-diffuse"} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16"/></filter><radialGradient id={id+"-lamp-falloff"} cx="75%" cy="8%" r="90%"><stop offset="0" stopColor="#ffe8bb" stopOpacity=".85"/><stop offset=".38" stopColor="#f4dcaf" stopOpacity=".42"/><stop offset="1" stopColor="#e5d0ad" stopOpacity="0"/></radialGradient><radialGradient id={id+"-lamp-halo"}><stop stopColor="#fff1cf" stopOpacity=".42"/><stop offset="1" stopColor="#ffe8c0" stopOpacity="0"/></radialGradient></defs><g className="va-rock-lamp-ray va-rock-lamp-left" filter={`url(#${id}-lamp-diffuse)`}><path d="M1137 303 Q1030 370 580 500 Q490 610 560 690 Q830 635 1144 310Z" fill={`url(#${id}-lamp-falloff)`}/></g><g className="va-rock-lamp-ray va-rock-lamp-right" filter={`url(#${id}-lamp-diffuse)`}><path d="M1283 302 Q1170 365 800 540 Q730 650 840 705 Q1115 560 1290 309Z" fill={`url(#${id}-lamp-falloff)`}/></g><ellipse cx="1137" cy="303" rx="65" ry="48" fill={`url(#${id}-lamp-halo)`}/><ellipse cx="1283" cy="302" rx="64" ry="47" fill={`url(#${id}-lamp-halo)`}/></svg></div><div className="va-rock-depth-layer va-rock-devices" data-depth="0.55"><img src="/media/hero/hero-devices-layer.png" alt="" width="1672" height="941"/></div><div className="va-rock-depth-layer va-rock-near" data-depth="1.8"><img src="/media/hero/hero-near-rocks.png" alt="" width="1672" height="941"/></div></div>
 <div className="va-rock-hint"><span>Weather &amp; Find Load · Desktop and mobile</span><button ref={buttonRef} type="button" aria-pressed="true">Motion on ↗</button></div>
 </section>;
}
