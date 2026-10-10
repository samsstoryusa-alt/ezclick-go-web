import {contrastRain} from './rain-intensity-palette';
// Recolor before temporal interpolation, never infer rain strength from opacity.
export function enhancePrecipitation(canvas:HTMLCanvasElement){
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return;
 const image=ctx.getImageData(0,0,canvas.width,canvas.height),p=image.data;
 const colors=new Map<number,number[]>();
 for(let i=0;i<p.length;i+=4){
  const a=p[i+3]/255;if(!a)continue;
  const key=(p[i]<<16)|(p[i+1]<<8)|p[i+2];
  let color=colors.get(key);if(!color){color=contrastRain(p[i],p[i+1],p[i+2]);if(colors.size<65536)colors.set(key,color);}
  const core=a*a*(3-2*a);
  for(let c=0;c<3;c++)p[i+c]=color[c];
  // Near-transparent fringes stay soft; denser centres stand out from the basemap.
  p[i+3]=Math.round(255*Math.min(.96,a*(1.18+core*.3)));
 }
 ctx.putImageData(image,0,0);
}
