"use client";
import {useEffect,useRef} from 'react';
import {gsap} from 'gsap';

export function BrandIntro({onFinish}:{onFinish:()=>void}) {
 const overlay=useRef<HTMLDivElement>(null);
 const finish=useRef(onFinish);finish.current=onFinish;
 useEffect(()=>{
  const panel=overlay.current!;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.scrollY>60){finish.current();return;}
  let ended=false,started=false;
  let playbackTimeout:number|undefined;
  const oldOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const end=()=>{if(ended)return;ended=true;document.body.style.overflow=oldOverflow;finish.current();};
  const logo=panel.querySelector<HTMLImageElement>('.intro-logo')!;
  const line=panel.querySelector('.intro-line');
  const veil=panel.querySelector('.intro-veil');
  const tl=gsap.timeline({paused:true,onComplete:end});
  // The intro uses a separate timeline; the truck remains on its first scroll frame.
  tl.fromTo(line,{autoAlpha:0},{autoAlpha:1,duration:.8,ease:'sine.inOut'},.15)
    .to(line,{autoAlpha:0,duration:.5,ease:'sine.inOut'},2.45)
    .fromTo(logo,{autoAlpha:0},{autoAlpha:1,duration:1.3,ease:'sine.inOut'},2.95)
    .to(logo,{autoAlpha:0,duration:1,ease:'sine.inOut'},5.25)
    .to(veil,{autoAlpha:0,duration:1,ease:'sine.inOut'},6.25);
  const start=()=>{
   if(ended||started)return;
   started=true;clearTimeout(loadTimeout);tl.play();
   playbackTimeout=window.setTimeout(end,(tl.duration()+3)*1000);
  };
  // Loading gets its own fallback; it must not consume the animation time.
  const loadTimeout=window.setTimeout(start,8000);
  if(logo.complete)start();else{logo.addEventListener('load',start,{once:true});logo.addEventListener('error',start,{once:true});}
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){tl.kill();end();}};
  window.addEventListener('keydown',key);
  return()=>{ended=true;tl.kill();clearTimeout(loadTimeout);clearTimeout(playbackTimeout);logo.removeEventListener('load',start);logo.removeEventListener('error',start);window.removeEventListener('keydown',key);document.body.style.overflow=oldOverflow;};
 },[]);
 return <div ref={overlay} className="brand-intro" aria-label="EZCLICK GO introduction">
  <div className="intro-veil" />
  <p className="intro-line">The future is here.</p>
  <img className="intro-logo" src="/media/ezclick-go-logo.png" alt="EZCLICK GO" fetchPriority="high" />
  <button className="intro-skip" onClick={()=>finish.current()}>Skip intro <span aria-hidden="true">↗</span></button>
 </div>;
}
