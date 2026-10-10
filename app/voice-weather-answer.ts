import type {WeatherUnits} from './weather-units';
export type VoiceForecast={available:boolean;condition:string;eta:number;place?:string;temperatureC?:number;windMph?:number;gustMph?:number|null;windDirection?:string;precipProbability?:number|null;level:string};
export type VoiceForecastSnapshot={points:VoiceForecast[];checkedAt:number;distance:number;duration:number;units:WeatherUnits};
export type AssistantCommand={intent:'weather'|'help'|'control';city?:string|null;topic?:string|null;action?:string|null;response_language?:string|null;departure_phrase?:string|null;departure_mode?:'now'|'scheduled'|'keep'|null;departure_date?:string|null;departure_time?:string|null;departure_timezone?:string|null;scope?:'route'|'origin'|'destination'|'city'|null;clarification?:string|null;wait_for_forecast?:boolean};
export function scopedForecast(snapshot:VoiceForecastSnapshot|null,scope:AssistantCommand['scope']){
 if(!snapshot||!['origin','destination'].includes(scope??''))return snapshot;
 const point=scope==='origin'?snapshot.points[0]:snapshot.points.at(-1);
 return {...snapshot,distance:0,points:point?[point]:[]};
}
export function routeForecastSnapshot(){
 let value:VoiceForecastSnapshot|null=null;
 window.dispatchEvent(new CustomEvent('voice-forecast-request',{detail:{reply:(snapshot:VoiceForecastSnapshot)=>{value=snapshot;}}}));
 return value as VoiceForecastSnapshot|null;
}
export function mapVoiceAction(action:string,translate:(text:string)=>string=text=>text){
 let answer=translate('The map is not ready for this command.');
 window.dispatchEvent(new CustomEvent('voice-map-action',{detail:{action,translate,reply:(text:string)=>{answer=text;}}}));
 return answer;
}
export const roadAdviceTopics=['compare','crosswind','stops','parking','detour','road_conditions','closures','truck_safety','services','arrival'];
export function weatherAnswer(snapshot:VoiceForecastSnapshot|null,topic='summary',now=Date.now(),vehicle:'truck'|'car'='truck'):string{
 if(topic==='compare')return (snapshot?'Понимаю, речь о текущем маршруте. ':'')+'Чтобы подсказать, когда выехать после дождя, нужно сравнить прогноз на несколько часов вперёд. Этот расчёт пока не подключён, поэтому время не буду угадывать. Маршрут и выезд не изменены.';
 if(topic==='parking'&&vehicle==='car')return 'Поиск парковок пока не подключён. Могу подсказать населённый пункт по маршруту, где по прогнозу можно переждать непогоду.';
 if(topic==='truck_safety'&&vehicle==='car')return 'Одного прогноза недостаточно, чтобы оценить безопасность поездки на вашей машине. Могу показать ветер и осадки по маршруту, но состояние дороги и шин мне неизвестно.';
 if(topic==='detour'&&vehicle==='car')return 'Чтобы предложить объезд, нужно сравнить альтернативные дороги и погоду по времени прибытия. Этот расчёт пока не подключён; текущий маршрут не меняю.';
 if(topic==='crosswind'&&vehicle==='car')return 'Могу показать скорость ветра по маршруту. Расчёт бокового ветра относительно дороги пока не подключён.';
 if(topic==='parking')return 'Нужна именно стоянка, где поместится трак. Поиск таких парковок пока не подключён, поэтому адрес и свободные места я подтвердить не могу.';
 if(topic==='detour')return 'Объезд можно рассмотреть, но сначала нужно сравнить погоду и проверить альтернативную дорогу под ваш трак. Такого расчёта пока нет — я не буду направлять вас на случайную дорогу. Текущий маршрут оставляю как есть.';
 if(topic==='road_conditions')return 'По прогнозу можно заметить риск снега, ледяных осадков или тумана. Но фактическое состояние покрытия я пока не получаю: сказать, есть ли сейчас лёд или вода на самой дороге, не смогу.';
 if(topic==='closures')return 'Живые данные о перекрытиях, авариях и пробках пока не подключены. По одной погоде нельзя понять, открыта ли трасса.';
 if(topic==='truck_safety')return 'Одного прогноза недостаточно, чтобы сказать, безопасно ли ехать именно вашему траку. Нужны условия на дороге, загрузка и ограничения. Я могу показать прогноз ветра и осадков, но разрешение ехать или необходимость цепей по нему не определю.';
 if(topic==='services')return 'Заправки, кафе и сервисы по маршруту пока не ищу — их каталог ещё не подключён. Могу помочь с погодой на этой дороге.';
 if(topic==='crosswind')return 'Для бокового ветра нужен расчёт направления относительно дороги. Пока могу показать скорость ветра по маршруту; это не оценка безопасности трака.';
 if(!snapshot)return 'Сначала постройте маршрут и дождитесь прогноза. Или назовите город и время, для которых нужна погода.';
 if(topic==='arrival'){
  const last=snapshot.points[snapshot.points.length-1];
  if(!Number.isFinite(last?.eta)||!Number.isFinite(snapshot.duration))return 'Расчётное время прибытия сейчас недоступно.';
  const minutes=Math.round(snapshot.duration/60);
  return 'По плану поездка займёт около '+Math.floor(minutes/60)+' ч '+minutes%60+' мин. Расчётное прибытие — '+new Date(last.eta).toLocaleString('ru-RU',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})+' по времени устройства. Это оценка всего маршрута, без учёта живых пробок и отслеживания вашего движения.';
 }
 if(!Number.isFinite(snapshot.checkedAt)||snapshot.checkedAt>now+60000||now-snapshot.checkedAt>10*60000)return 'Прогноз устарел. Дождитесь обновления погоды и повторите вопрос.';
 const points=snapshot.points.filter(p=>p.available&&Number.isFinite(p.eta));
 if(!points.length)return 'Для выбранного времени прогноз пока недоступен.';
 const speed=(mph:number)=>`${Math.round(snapshot.units==='us'?mph:mph*1.609344)} ${snapshot.units==='us'?'миль/ч':'км/ч'}`;
 const missing=snapshot.points.length-points.length;
 const route=snapshot.distance>0&&snapshot.points.length>1;
 const notes=missing?' Для части пути прогноза пока нет.':'';
 const location=(p:VoiceForecast,index:number)=>{
  const part=!route?'':index===0?'В начале пути':index>=snapshot.points.length*.65?'Ближе к концу маршрута':'По дороге';
  return p.place?(part?part+', возле ': 'В районе ')+p.place:part||'В выбранном месте';
 };
 const risks=(p:VoiceForecast)=>{
  const c=p.condition;
  const labels:string[]=[];
  if(/freezing|ice|sleet/i.test(c))labels.push('ледяные осадки');
  else if(/blizzard|snow/i.test(c))labels.push('снег');
  if(/thunder/i.test(c))labels.push('гроза');
  else if(/rain|shower/i.test(c)&&!labels.length)labels.push('дождь');
  if(/fog|mist/i.test(c))labels.push('туман');
  if((p.windMph??0)>=20||(p.gustMph??0)>=35)labels.push('усиление ветра');
  if(!labels.length&&['high','caution'].includes(p.level))labels.push('неблагоприятные погодные условия');
  return labels;
 };
 if(topic==='stops'){
  const index=snapshot.points.findIndex(p=>p.available&&risks(p).length>0);
  if(index<0)return 'В доступном прогнозе нет явного участка с непогодой, перед которым стоило бы выбирать остановку.'+notes;
  const hazard=snapshot.points[index],before=snapshot.points[index-1];
  const at=hazard.place?' возле '+hazard.place:' в начале маршрута';
  if(!before?.available||before.level!=='low'||!before.place||risks(before).length||before.place===hazard.place)return 'Непогода ожидается'+at+'. По этим точкам не могу уверенно назвать город перед ней для поиска стоянки. Саму парковку и время окончания осадков ещё нужно проверить.';
  return 'По плану маршрута перед участком с непогодой'+at+' есть точка возле '+before.place+'. Если вы её ещё не проехали, можно поискать стоянку для трака в этом районе. Это ориентир на карте: конкретная парковка и время окончания непогоды пока не проверены.';
 }
 if(topic==='temperature'){
  const measured=points.filter(p=>Number.isFinite(p.temperatureC));
  if(!measured.length)return 'Данных о температуре для выбранного места и времени пока нет.';
  const value=(p:VoiceForecast)=>Math.round(snapshot.units==='us'?p.temperatureC!*9/5+32:p.temperatureC!);
  const unit=snapshot.units==='us'?'°F':'°C';
  const low=measured.reduce((a,b)=>a.temperatureC!<b.temperatureC!?a:b),high=measured.reduce((a,b)=>a.temperatureC!>b.temperatureC!?a:b);
  return measured.length===1?`${location(low,snapshot.points.indexOf(low))} температура по прогнозу ${value(low)} ${unit}.`+notes:`В доступных точках маршрута температура от ${value(low)} до ${value(high)} ${unit}.`+notes;
 }
 if(topic==='wind'){
  const windy=points.filter(p=>Number.isFinite(p.windMph));
  if(!windy.length)return 'Данных о скорости ветра пока нет.';
  const peak=windy.reduce((a,b)=>a.windMph!>=b.windMph!?a:b);
  const gusty=points.filter(p=>Number.isFinite(p.gustMph));
  const gust=gusty.length?gusty.reduce((a,b)=>a.gustMph!>=b.gustMph!?a:b):null;
  return location(peak,snapshot.points.indexOf(peak))+', '+(route?'самый сильный из доступных прогнозов ветра':'ветер')+' — '+speed(peak.windMph!)+'.'+(gust?' Порывы'+(gust.place?' возле '+gust.place:'')+' — до '+speed(gust.gustMph!)+'.':'')+notes;
 }
 const wanted=topic==='rain'?['дождь','гроза']:topic==='snow'?['снег','ледяные осадки']:topic==='fog'?['туман']:null;
 const groups:{first:VoiceForecast;last:VoiceForecast;index:number;end:number;labels:string[];score:number}[]=[];
 snapshot.points.forEach((p,index)=>{
  if(!p.available||!Number.isFinite(p.eta))return;
  const labels=risks(p).filter(label=>!wanted||wanted.includes(label));
  if(!labels.length)return;
  const score=(p.level==='high'?4:p.level==='caution'?2:1)+(labels.some(l=>['гроза','ледяные осадки'].includes(l))?3:0);
  const previous=groups[groups.length-1];
  if(previous&&previous.end===index-1&&previous.labels.join()===labels.join()){previous.last=p;previous.end=index;previous.score=Math.max(previous.score,score);}
  else groups.push({first:p,last:p,index,end:index,labels,score});
 });
 if(!groups.length){
  if(wanted)return (topic==='rain'?'Дождь':topic==='snow'?'Снег и ледяные осадки':'Туман')+' в доступном прогнозе не указаны.'+notes;
  const calm=points.every(p=>p.level==='low'&&/clear|sunny|cloud|fair/i.test(p.condition)&&(p.precipProbability??100)<30&&Number.isFinite(p.windMph));
  return (calm?(route?'Судя по прогнозу в точках маршрута, погода по пути ожидается спокойная, без заметных осложнений.':'В выбранном месте заметных погодных осложнений не ожидается.'):'Явных погодных предупреждений в доступных данных нет, но полной картины пока недостаточно.')+notes;
 }
 const chosen=[...groups].sort((a,b)=>b.score-a.score).slice(0,2).sort((a,b)=>a.index-b.index);
 const wording:Record<string,string>={'дождь':'может пойти дождь','гроза':'возможна гроза','снег':'может пойти снег','ледяные осадки':'возможны ледяные осадки','туман':'возможен туман','усиление ветра':'может усилиться ветер','неблагоприятные погодные условия':'погода может осложнить поездку'};
 const phrases=chosen.map(g=>{
  const where=location(g.first,g.index)+(g.end>g.index&&g.last.place&&g.last.place!==g.first.place?' и '+g.last.place:'');
  const description=g.labels.map(label=>wording[label]).join(', ').replace('может пойти дождь, может усилиться ветер','может пойти дождь и усилиться ветер').replace('может пойти снег, может усилиться ветер','может пойти снег и усилиться ветер');
  return where+' '+description+'.';
 });
 const firstRisk=groups[0].index;
 const quietStart=firstRisk>0&&snapshot.points.slice(0,firstRisk).every(p=>p.available&&p.level==='low'&&/clear|sunny|cloud|fair/i.test(p.condition)&&(p.precipProbability??100)<30&&risks(p).length===0);
 const intro=route&&topic==='summary'&&quietStart?'По прогнозу, в начале пути погода спокойная. ':'';
 return intro+phrases.join(' ')+(groups.length>chosen.length?' Есть и другие участки с непростой погодой — посмотрите их на карте.':'')+' Будьте внимательнее.'+notes;
}
export function helpAnswer(topic:string){
 return topic==='probability'?'Процент осадков — вероятность осадков в указанном месте и периоде. Это не интенсивность дождя и не доля времени, когда он будет идти.':
 'Цвета точек: голубой — меньшая погодная настороженность, оранжевый — повышенная, красный — высокая, серый — нет прогноза. Цвет не гарантирует безопасность дороги и не является порогом опрокидывания трака.';
}
