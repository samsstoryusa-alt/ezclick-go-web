export type CloudFrame={time:number;run:number;url:string};
export function cloudForecastPosition(frames:CloudFrame[],time:number|null,now=Date.now()){
 if(time===null||!Number.isFinite(time)||frames.length<2||!Number.isFinite(frames[0].run)||now-frames[0].run>18*3600000||frames[0].run>now||time<frames[0].time||time>frames.at(-1)!.time)return null;
 const b=frames.findIndex(f=>f.time>=time),a=frames[b].time===time?b:b-1;
 if(a<0||frames[a].run!==frames[b].run||a!==b&&frames[b].time-frames[a].time!==3600000)return null;
 return {a,b,mix:a===b?0:(time-frames[a].time)/(frames[b].time-frames[a].time)};
}
