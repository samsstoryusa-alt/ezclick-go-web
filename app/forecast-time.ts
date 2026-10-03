export type ForecastFrame={time:number;run:number;url:string};
const HOUR=3600000;
export function forecastWindow(input:ForecastFrame[],now:number){
 if(!Array.isArray(input))return null;
 const source=input.filter(f=>Number.isFinite(f.time)&&Number.isFinite(f.run)&&f.run<=now&&f.run>=now-18*HOUR&&/^\/forecast\/(?:v2\/)?\d{13}_\d{13}\.png$/.test(f.url)).sort((a,b)=>a.time-b.time);
 const start=source.findLastIndex(f=>f.time<=now),end=source.findIndex(f=>f.time>=now+24*HOUR);
 if(start<0||end<0)return null;
 const frames=source.slice(start,end+1);
 if(frames.some((f,i)=>f.run!==frames[0].run||(i>0&&f.time-frames[i-1].time!==HOUR)))return null;
 return {source:frames,times:Array.from({length:25},(_,i)=>now+i*HOUR)};
}


