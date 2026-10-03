// Presentation-only contrast. Hue and geographic coverage retain their meaning.
export function enhancePrecipitation(canvas:HTMLCanvasElement){
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return;
 const image=ctx.getImageData(0,0,canvas.width,canvas.height),p=image.data;
 for(let i=0;i<p.length;i+=4){
  const a=p[i+3]/255;if(!a)continue;
  const luminance=.2126*p[i]+.7152*p[i+1]+.0722*p[i+2];
  const core=a*a*(3-2*a);
  for(let c=0;c<3;c++)p[i+c]=Math.min(255,Math.max(0,(luminance+(p[i+c]-luminance)*1.25)*(1.12+core*.12)));
  // Near-transparent fringes stay soft; denser centres stand out from the basemap.
  p[i+3]=Math.round(255*Math.min(.96,a*(1.18+core*.3)));
 }
 ctx.putImageData(image,0,0);
}

