export const W=128,H=75,GX=16,GY=10,R=4;
export function estimateFlow(a:Float32Array,b:Float32Array){
 const out=new Uint8Array(GX*GY*4);
 for(let gy=0;gy<GY;gy++)for(let gx=0;gx<GX;gx++){
  const k=(gy*GX+gx)*4,x=Math.round((gx+.5)*W/GX),y=Math.round((gy+.5)*H/GY);
  out[k]=128;out[k+1]=128;out[k+3]=255;
  // Trial region: Gulf of Mexico and nearby coast, with a feathered boundary in shader.
  if(x/W<.3||x/W>.78||y/H<.53||y/H>.98)continue;
  let energy=0;
  for(let py=-3;py<=3;py++)for(let px=-3;px<=3;px++)energy+=a[Math.max(0,Math.min(H-1,y+py))*W+Math.max(0,Math.min(W-1,x+px))];
  if(energy<2)continue;
  const score=(dx:number,dy:number)=>{
   let error=0;
   for(let py=-3;py<=3;py++)for(let px=-3;px<=3;px++){
    const ay=Math.max(0,Math.min(H-1,y+py)),ax=Math.max(0,Math.min(W-1,x+px));
    const by=Math.max(0,Math.min(H-1,y+py+dy)),bx=Math.max(0,Math.min(W-1,x+px+dx));
    const d=a[ay*W+ax]-b[by*W+bx];error+=d*d;
   }return error;
  };
  const original=score(0,0);let best=original,dx=0,dy=0;
  for(let sy=-R;sy<=R;sy++)for(let sx=-R;sx<=R;sx++){
   const error=score(sx,sy)+.002*(sx*sx+sy*sy);
   if(error<best){best=error;dx=sx;dy=sy;}
  }
  const confidence=original>.01?Math.max(0,Math.min(1,(original-best)/original*1.5)):0;
  out[k]=Math.round(128+dx/R*127*confidence);out[k+1]=Math.round(128+dy/R*127*confidence);
 }
 return out;
}

