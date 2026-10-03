export type WindFrame={time:number;run:number;nx:number;ny:number;lon0:number;lat0:number;dx:number;dy:number;url:string;values:Int16Array};
export type WindReading={u:number;v:number;speed:number;direction:number;time:number;run:number};
export function sampleWindFrame(f:WindFrame,lon:number,lat:number){
 const x=(((lon-f.lon0)%360)+360)%360/f.dx,y=(lat-f.lat0)/f.dy;
 if(y<0||y>f.ny-1)return null;
 const ix=Math.floor(x)%f.nx,iy=Math.min(f.ny-2,Math.floor(y)),fx=x-Math.floor(x),fy=y-iy;
 const weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy];
 const indices=[iy*f.nx+ix,iy*f.nx+(ix+1)%f.nx,(iy+1)*f.nx+ix,(iy+1)*f.nx+(ix+1)%f.nx];
 let u=0,v=0;for(let i=0;i<4;i++){if(!weights[i])continue;const a=f.values[indices[i]*2],b=f.values[indices[i]*2+1];if(a===32767||b===32767||a===undefined||b===undefined)return null;u+=a*.36*weights[i];v+=b*.36*weights[i];}
 return {u,v};
}
export function windPair(frames:WindFrame[],time:number,now=Date.now()){
 const b=frames.findIndex(f=>f.time>=time);if(b<0||time<frames[0].time)return null;
 const a=frames[b].time===time?b:Math.max(0,b-1);
 if(frames[b].time-frames[a].time>3600000||Math.min(frames[a].run,frames[b].run)<now-18*3600000)return null;
 return {a:frames[a],b:frames[b],mix:a===b?0:(time-frames[a].time)/(frames[b].time-frames[a].time)};
}
export function sampleWind(pair:ReturnType<typeof windPair>,lon:number,lat:number):WindReading|null{
 if(!pair)return null;const a=sampleWindFrame(pair.a,lon,lat),b=sampleWindFrame(pair.b,lon,lat);if(!a||!b)return null;
 const u=a.u+(b.u-a.u)*pair.mix,v=a.v+(b.v-a.v)*pair.mix;
 return {u,v,speed:Math.hypot(u,v),direction:(Math.atan2(-u,-v)*180/Math.PI+360)%360,time:pair.a.time+(pair.b.time-pair.a.time)*pair.mix,run:Math.min(pair.a.run,pair.b.run)};
}
