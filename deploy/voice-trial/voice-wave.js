// Presentation only. Recording, recognition, quotas and route events stay in trial.js.
if(new URLSearchParams(location.search).get('embedded')==='1'){
 const meter=document.getElementById('meter'),record=document.getElementById('record');
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');meter.append(canvas);
 const ctx=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let target=0,energy=0,raf=0,last=0;
 function paint(now){
  raf=0;const width=canvas.clientWidth,height=76,d=Math.min(devicePixelRatio||1,2);
  if(canvas.width!==Math.round(width*d)){canvas.width=Math.round(width*d);canvas.height=height*d;}
  ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,width,height);
  const dt=last?Math.min(50,now-last):16;last=now;
  energy+=(target-energy)*(1-Math.exp(-dt/(target>energy?45:170)));
  const strength=reduced.matches?0:energy;
  record.style.setProperty('--voice-energy',strength.toFixed(3));
  const buttonBox=record.getBoundingClientRect(),canvasBox=canvas.getBoundingClientRect();
  const gapLeft=Math.max(0,buttonBox.left-canvasBox.left-6);
  const gapRight=Math.min(width,buttonBox.right-canvasBox.left+6);
  // Clip both the stroke and its glow outside the real microphone hit area.
  ctx.save();ctx.beginPath();
  ctx.rect(0,0,gapLeft,height);ctx.rect(gapRight,0,Math.max(0,width-gapRight),height);ctx.clip();
  for(let layer=4;layer>=0;layer--){
   ctx.beginPath();ctx.strokeStyle=['#c1ffe9','#7df5d4cc','#67e9d9aa','#56cbd877','#96efdb55'][layer];ctx.lineWidth=layer?1.2:2;ctx.shadowColor='#75f5d0';ctx.shadowBlur=reduced.matches?0:4+strength*5;
   for(let x=0;x<=width;x+=2){const r=Math.abs(x-width/2),u=Math.min(1,Math.max(0,(r-36)/Math.max(1,width/2-36)));const envelope=r<36?0:Math.pow(Math.sin(u*Math.PI),.7),phase=reduced.matches?0:now*.006;const wave=.76*Math.sin(r*.10-phase+layer*.65)+.24*Math.sin(r*.19+phase*.7+layer);const y=height/2+wave*(1+strength*31)*envelope*(1-layer*.11);if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
   ctx.stroke();
  }
  ctx.shadowBlur=0;
  ctx.restore();
  if(!document.hidden&&(target>0||energy>.003))raf=requestAnimationFrame(paint);else last=0;
 }
 function wake(){if(!raf&&!document.hidden)raf=requestAnimationFrame(paint);}
 window.addEventListener('voice-wave-level',event=>{target=Math.max(0,Math.min(1,Number(event.detail)||0));wake();});
 new ResizeObserver(wake).observe(meter);
 new MutationObserver(()=>{record.setAttribute('aria-label',record.textContent||'Microphone');}).observe(record,{childList:true,characterData:true,subtree:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){target=0;energy=0;cancelAnimationFrame(raf);raf=0;}else wake();});
 reduced.addEventListener('change',wake);record.setAttribute('aria-label',record.textContent||'Microphone');wake();
}
