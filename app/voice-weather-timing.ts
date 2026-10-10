import {weatherRequest,validForecastResponse} from './weather-request';
import {tripApi} from './road-route';
import {throwIfAborted,withAbortTimeout} from './abort-timeout';
import type {VoiceForecast,VoiceForecastSnapshot} from './voice-weather-answer';
export type TimingOption={hours:number;departure:number;points:VoiceForecast[]};
export const hasPrecipitation=(p:VoiceForecast)=>/rain|shower|snow|sleet|freezing|ice|thunder|blizzard/i.test(p.condition)||(p.precipProbability??0)>=40;
const adverse=(p:VoiceForecast)=>hasPrecipitation(p)||p.level==='high'||p.level==='caution';
export function waitingPoint(snapshot:VoiceForecastSnapshot){
 const first=snapshot.points.findIndex(p=>p.available&&adverse(p));
 const prior=snapshot.points[first-1];
 return first>0&&prior?.available&&prior.level==='low'&&!adverse(prior)&&prior.place&&prior.place!==snapshot.points[first].place?first-1:-1;
}
export function timingVerdict(options:TimingOption[],snapshot:VoiceForecastSnapshot,stop:number|null):string{
 const complete=options.length===5&&options.every((o,i)=>o.hours===i&&o.points.length===snapshot.points.length&&o.points.every(p=>p.available&&['low','caution','high'].includes(p.level)));
 if(!complete)return 'Пока не хватает прогноза на все нужные часы. Не буду угадывать, сколько ждать: попробуйте ещё раз после обновления погоды.';
 const score=(o:TimingOption)=>({wet:o.points.filter(hasPrecipitation).length,high:o.points.filter(p=>p.level==='high').length,caution:o.points.filter(p=>p.level==='caution').length});
 const base=score(options[0]);
 const rank:Record<string,number>={low:0,caution:1,high:2};
 const noWorsening=(candidate:TimingOption)=>candidate.points.every((p,i)=>{
  const old=options[0].points[i];
  if(rank[p.level]>rank[old.level]||(!hasPrecipitation(old)&&hasPrecipitation(p)))return false;
  if(/heavy|thunder|freezing|sleet|blizzard/i.test(p.condition)&&p.condition!==old.condition)return false;
  return (['windMph','gustMph','precipProbability'] as const).every(key=>!Number.isFinite(old[key])||(Number.isFinite(p[key])&&p[key]!<=old[key]!));
 });
 const better=options.slice(1).find(o=>{
  const next=score(o);
  const improves=next.wet<=base.wet&&next.high<=base.high&&next.caution<=base.caution&&(next.wet<base.wet||next.high<base.high||next.caution<base.caution);
  // A town must remain lower-concern at every checked hour of the proposed wait.
  return improves&&noWorsening(o)&&(stop===null||options.slice(0,o.hours+1).every(option=>!adverse(option.points[stop])&&option.points[stop].level==='low'));
 });
 if(!better)return base.wet===0&&base.high===0&&base.caution===0?'По проверенному прогнозу сейчас нет заметной погодной причины откладывать поездку. Варианты на ближайшие четыре часа существенного улучшения не показывают.':'Проверил ближайшие четыре часа: заметного улучшения для этой поездки пока не видно. Назвать удачное время ожидания не могу.';
 const delay=better.hours===1?'час':`${better.hours} часа`;
 const improvement=score(better).wet<base.wet?'по прогнозу впереди будет меньше участков с осадками':'впереди будет меньше участков с неблагоприятной погодой';
 if(stop!==null)return `Если вы ещё не проехали район ${snapshot.points[stop].place}, можно поискать место для остановки там. При ожидании около ${delay} ${improvement}. Это ориентир по почасовому прогнозу, конкретную стоянку нужно выбрать самостоятельно.`;
 const time=new Date(better.departure).toLocaleString('ru-RU',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
 return `Если отложить выбранный выезд примерно на ${delay}, ${improvement}. Можно рассмотреть выезд ${time} — по времени вашего устройства. Проверены сдвиги на 0–4 часа с шагом час, а не время окончания дождя. Время поездки я не менял.`;
}
export async function checkWeatherTiming(snapshot:VoiceForecastSnapshot|null,topic:'compare'|'stops',signal:AbortSignal):Promise<string>{
 const now=Date.now();
 if(!snapshot||snapshot.points.length<2)return 'Для этого нужен построенный маршрут с загруженным прогнозом. Как только он появится, смогу проверить время ожидания.';
 if(!Number.isFinite(snapshot.checkedAt)||now-snapshot.checkedAt>600000||snapshot.checkedAt>now+60000)return 'Прогноз маршрута устарел. Дождитесь обновления, чтобы я сравнил часы по свежим данным.';
 const stop=topic==='stops'?waitingPoint(snapshot):null;
 if(stop===-1)return 'Не вижу в доступных точках подходящего населённого пункта перед непогодой. Называть город наугад не буду.';
 const coords=snapshot.points as Array<VoiceForecast&{lon?:number;lat?:number;fraction?:number}>;
 if(coords.some(p=>!Number.isFinite(p.lon)||!Number.isFinite(p.lat)||!Number.isFinite(p.eta)))return 'Не удалось получить точки маршрута для сравнения. Обновите прогноз и повторите вопрос.';
 const originTime=coords[0].eta,departure=Math.max(now,originTime);
 return withAbortTimeout(signal,90000,async combined=>{
 const options:TimingOption[]=[];
 for(let hours=0;hours<=4;hours++){
  throwIfAborted(combined);
  const samples=coords.map((p,i)=>({lon:p.lon!,lat:p.lat!,fraction:p.fraction??i/(coords.length-1),eta:p.eta+(departure-originTime)+(stop===null||i>=stop?hours*3600000:0)}));
  const data=await weatherRequest(tripApi()+'/weather',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({points:samples}),signal:combined});
  if(!validForecastResponse(data,samples.length)||!Number.isFinite(data.checkedAt)||Date.now()-Number(data.checkedAt)>600000||Number(data.checkedAt)>Date.now()+60000)throw Error('Incomplete hourly forecast');
  options.push({hours,departure:departure+hours*3600000,points:(data.points as VoiceForecast[]).map((p,i)=>({...p,...samples[i],place:coords[i].place||p.place}))});
 }
 throwIfAborted(combined);
 return timingVerdict(options,snapshot,stop);
 });
}
