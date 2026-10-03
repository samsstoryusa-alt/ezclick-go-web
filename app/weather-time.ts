export type HourlyWeather={time:number[];wind_speed_10m:number[];wind_direction_10m:number[];temperature_2m?:number[];weather_code?:number[]};
export function sampleHourly(h:HourlyWeather,timeMs:number){
 const t=timeMs/1000,b=h.time.findIndex(v=>v>=t);if(b<0||t<h.time[0])return null;
 const a=Math.max(0,b-1),m=a===b?0:(t-h.time[a])/(h.time[b]-h.time[a]);
 const vec=(i:number)=>{const s=h.wind_speed_10m[i],d=h.wind_direction_10m[i];if(s==null||d==null||!Number.isFinite(s)||!Number.isFinite(d))return null;return {u:-s*Math.sin(d*Math.PI/180),v:-s*Math.cos(d*Math.PI/180)};};
 const x=vec(a),y=vec(b);if(!x||!y)return null;const u=x.u+(y.u-x.u)*m,v=x.v+(y.v-x.v)*m,ta=h.temperature_2m?.[a],tb=h.temperature_2m?.[b];
 return {u,v,speed:Math.hypot(u,v),direction:(Math.atan2(-u,-v)*180/Math.PI+360)%360,temperature:ta!=null&&tb!=null?ta+(tb-ta)*m:null,code:h.weather_code?.[m<.5?a:b]??null};
}
