// Presentation-only remapping of NOAA's precolored radar imagery, not a dBZ decoder.
// Recolor before filtering, so smoothing cannot turn blended RGB into false intensity.
export function rainColor(r:number,g:number,b:number):[number,number,number,number]{
 const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
 let hue=0;if(d){hue=max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4;hue*=60;}
 if(d<20)return [105,180,199,.72];
 if(hue>=270||hue<20)return [247,113,103,1];
 if(hue<45)return [247,173,76,.98];
 if(hue<80)return [225,212,91,.97];
 if(hue<145)return [75,201,130,.94];
 if(hue<190)return [64,196,191,.88];
 return [72,175,221,.82];
}
export function precipColor(r:number,g:number,b:number,type:number):[number,number,number,number]{
 const rain=rainColor(r,g,b);
 if(type===1)return rain;
 if(type===2)return [192,165,247,Math.max(.82,rain[3])];
 return [0,0,0,0];
}
export function styleRain(bitmap:ImageBitmap,mask:ImageBitmap|null=null){
 const raw=document.createElement('canvas');raw.width=bitmap.width;raw.height=bitmap.height;
 const ctx=raw.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Radar canvas unavailable');
 let types:Uint8ClampedArray|null=null;
 if(mask&&mask.width===raw.width&&mask.height===raw.height){ctx.imageSmoothingEnabled=false;ctx.drawImage(mask,0,0);types=ctx.getImageData(0,0,raw.width,raw.height).data;ctx.clearRect(0,0,raw.width,raw.height);}
 ctx.drawImage(bitmap,0,0);const pixels=ctx.getImageData(0,0,raw.width,raw.height),data=pixels.data;
 for(let i=0;i<data.length;i+=4){if(!data[i+3])continue;const [r,g,b,alpha]=precipColor(data[i],data[i+1],data[i+2],types?.[i]??0);data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=Math.round(data[i+3]*alpha);}
 ctx.putImageData(pixels,0,0);
 const out=document.createElement('canvas');out.width=raw.width;out.height=raw.height;const target=out.getContext('2d');if(!target)throw Error('Radar canvas unavailable');
 target.filter='blur(0.9px)';target.drawImage(raw,0,0);raw.width=1;raw.height=1;return out;
}
export const WIND_COLORS=['#91bccf','#51d5c7','#f7be53','#f77167'];
export function windBand(speed:number){return speed<15?0:speed<30?1:speed<50?2:3;}
