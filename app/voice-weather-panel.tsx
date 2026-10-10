import {useCallback,useEffect,useEffectEvent,useRef,useState} from 'react';
import {withAbortTimeout} from './abort-timeout';
import {parsePlaces,type SearchPlace} from './route-search-data';
import {structuredVoiceDeparture,voiceDepartureInstant} from './voice-departure';
import {weatherRequest,validForecastResponse} from './weather-request';
import {tripApi} from './road-route';
import {useWeatherVehicle} from './weather-vehicle';
import {useWeatherUnits} from './weather-units';
import {useWeatherLanguage} from './weather-language';
import {translateVoice,voiceLanguage} from './voice-language';
import {checkWeatherTiming} from './voice-weather-timing';
import {roadAdviceTopics,helpAnswer,mapVoiceAction,routeForecastSnapshot,scopedForecast,weatherAnswer,type AssistantCommand,type VoiceForecast} from './voice-weather-answer';
export type WeatherFeedback='clarification'|'failed'|'succeeded';
export default function VoiceWeatherPanel({command,onAnswer,hideAnswer=false,responseLanguage}:{command:AssistantCommand;onAnswer:(text:string,final:boolean,status?:WeatherFeedback)=>void;hideAnswer?:boolean;responseLanguage?:string}){
 const {language}=useWeatherLanguage();
 const answerLanguage=voiceLanguage(command.response_language)??responseLanguage??language;
 const t=useCallback((key:string)=>translateVoice(key,answerLanguage),[answerLanguage]);
 const {vehicle}=useWeatherVehicle();
 const {units}=useWeatherUnits();
 const [final,setFinal]=useState(false);
 const [feedback,setFeedback]=useState<WeatherFeedback|undefined>();
 const [answer,setAnswer]=useState(t('Checking…')),[places,setPlaces]=useState<SearchPlace[]>([]),[placeId,setPlaceId]=useState(''),[busy,setBusy]=useState(false);
 const [departure,setDeparture]=useState(()=>structuredVoiceDeparture({...command,departure_mode:command.departure_mode??(command.departure_phrase?null:'now')}));
 const request=useRef<AbortController|null>(null);
 const answerCallback=useRef(onAnswer);
 useEffect(()=>{answerCallback.current=onAnswer;},[onAnswer]);
 useEffect(()=>{answerCallback.current(answer,final,feedback);},[answer,final,feedback]);
 const controlAnswer=useEffectEvent((action:string)=>action==='clear_route'?t('Delete both points and the current route?'):mapVoiceAction(action,t));
 const autoCheckCity=useEffectEvent((place:SearchPlace)=>{
  if(voiceDepartureInstant(departure)===null)return false;
  setPlaceId(place.id);void checkCity(place);return true;
 });
 useEffect(()=>{
  const controller=new AbortController();request.current=controller;
  let forecastWait:ReturnType<typeof setInterval>|undefined;
  function show(text:string,complete=true,status?:WeatherFeedback){if(!controller.signal.aborted){setAnswer(text);setFinal(complete);setFeedback(status);}}
  const routeAnswer=(topic:string)=>weatherAnswer(topic==='arrival'?routeForecastSnapshot():scopedForecast(routeForecastSnapshot(),command.scope),topic,Date.now(),vehicle);
  if(command.clarification)show(command.clarification,false,'clarification');
  else if(command.intent==='weather'&&command.scope==='city'&&!command.city)show(t('Say the city and state for a separate forecast.'),false,'clarification');
  else if(command.wait_for_forecast&&command.intent==='weather'&&!command.city){
   show(t('Waiting for the route forecast…'),false);
   const started=Date.now();
   forecastWait=setInterval(()=>{
    const snapshot=routeForecastSnapshot();
    if(snapshot?.points.some(p=>p.available)){
     clearInterval(forecastWait);
     if(command.topic==='compare'||command.topic==='stops')void checkWeatherTiming(snapshot,command.topic,controller.signal).then(value=>show(value)).catch(()=>show('Не удалось сравнить погоду на нужные часы.'));
     else show(weatherAnswer(scopedForecast(snapshot,command.scope),command.topic??'summary',Date.now(),vehicle));
    }else if(Date.now()-started>=30000){clearInterval(forecastWait);show('Маршрут построен, но прогноз пока не получен. Повторите вопрос после загрузки погоды.');}
   },300);
  }
  else if(command.intent==='weather'&&(command.topic==='compare'||command.topic==='stops')&&(command.city||command.scope==='city'||command.scope==='origin'||command.scope==='destination'||command.departure_mode==='scheduled'))show('Сравнение поддерживает только весь выбранный маршрут и сдвиги его выезда на 0–4 часа. Для отдельного города или другого времени этот расчёт пока недоступен.');
  else if(command.intent==='weather'&&(command.topic==='compare'||command.topic==='stops')){
   show(t('Comparing weather over the next four hours…'),false);
   const snapshot=routeForecastSnapshot();
   void checkWeatherTiming(snapshot,command.topic,controller.signal).then(text=>{
    const current=routeForecastSnapshot();
    if(snapshot&&JSON.stringify(current?.points.map(p=>[p.eta,p.place]))!==JSON.stringify(snapshot.points.map(p=>[p.eta,p.place])))show('Маршрут или время изменились. Повторите вопрос для новой поездки.');
    else show(text);
   }).catch(()=>{if(!controller.signal.aborted)show('Не удалось проверить погоду на нужные часы. Время ожидания пока не подскажу — попробуйте позже.');});
  }
  else if(command.intent==='weather'&&roadAdviceTopics.includes(command.topic??''))show(routeAnswer(command.topic??'summary'));
  else if(command.intent==='help')show(helpAnswer(command.topic??'colors'));
  else if(command.intent==='control')show(controlAnswer(command.action??''));
  else if(command.topic==='compare'||command.topic==='crosswind')show(weatherAnswer(null,command.topic,Date.now(),vehicle));
  else if(!command.city){
   if(command.departure_phrase||command.departure_mode==='scheduled')show('Прогноз маршрута относится к выбранному выезду. Для другого времени сначала измените выезд или назовите отдельный город.');
   else show(routeAnswer(command.topic??'summary'));
  }else{
   const params=new URLSearchParams({q:command.city,limit:'6',countrycode:'US',bbox:'-125,24,-66,50',lang:'en'});
   void withAbortTimeout(controller.signal,15000,async signal=>{const response=await fetch('https://photon.komoot.io/api/?'+params,{signal});if(!response.ok)throw Error();return parsePlaces(await response.json());}).then(found=>{if(controller.signal.aborted)return;setPlaces(found);const exact=found.filter(p=>p.state&&['city','town','village','hamlet'].includes(p.kind??'')&&command.city!.trim().toLowerCase()===`${p.name}, ${p.state}`.toLowerCase());if(!(exact.length===1&&autoCheckCity(exact[0])))show(t(found.length?'Choose the forecast city. Times use your device timezone.':'City not found. Please give its name and state.'),false,'clarification');}).catch(()=>{if(!controller.signal.aborted)show(t('City search is unavailable. Please try again.'),false,'failed');});
  }
  return()=>{controller.abort();clearInterval(forecastWait);};
 },[command,vehicle,t]);
 async function checkCity(selected?:SearchPlace){
  const place=selected??places.find(p=>p.id===placeId),instant=voiceDepartureInstant(departure);
  if(!place||instant===null){setAnswer(t('Choose a city, date and future time, or “Now”.'));setFinal(false);setFeedback('clarification');return;}
  const controller=request.current;if(!controller||controller.signal.aborted)return;
  setBusy(true);setFinal(false);setFeedback(undefined);setAnswer(t('Loading forecast…'));
  const eta=instant?Date.parse(instant):Date.now();
  try{
   // Route endpoint requires at least two samples; both refer to this same city/time.
   const result=await withAbortTimeout(controller.signal,30000,signal=>weatherRequest(tripApi()+'/weather',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({points:Array.from({length:2},(_,fraction)=>({lon:place.point[0],lat:place.point[1],eta,fraction}))}),signal}));
   if(!validForecastResponse(result,2))throw Error();
   if(controller.signal.aborted)return;
   const data=result as {points:VoiceForecast[];checkedAt:number};
   const text=weatherAnswer({points:data.points.slice(0,1).map(p=>({...p,eta,place:place.label})),checkedAt:data.checkedAt,distance:0,duration:0,units},command.topic??'summary');
   setAnswer(text);setFinal(true);setFeedback('succeeded');
  }catch{if(!controller.signal.aborted){setAnswer(t('Could not load the forecast. Please try again.'));setFinal(false);setFeedback('failed');}}
  finally{if(!controller.signal.aborted)setBusy(false);}
 }
 const cityForm=command.intent==='weather'&&places.length>0;
 const [confirmDelete,setConfirmDelete]=useState(true);
 return <div className="voice-route-review">{!hideAnswer&&<p role="status" style={{whiteSpace:'pre-line'}}>{answer}</p>}
 {command.intent==='control'&&command.action==='clear_route'&&!command.clarification&&confirmDelete&&<div><button type="button" onClick={()=>{setAnswer(mapVoiceAction('clear_route',t));setConfirmDelete(false);}}>{t('Yes, clear the route')}</button><button type="button" onClick={()=>{setAnswer(t('Route clearing cancelled.'));setConfirmDelete(false);}}>{t('Cancel')}</button></div>}
 {cityForm&&<><label>{t('City')}<select disabled={busy} value={placeId} onChange={e=>setPlaceId(e.target.value)}><option value="">{t('Choose a place')}</option>{places.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
 <label><input type="checkbox" disabled={busy} checked={departure.leaveNow} onChange={e=>setDeparture(old=>({...old,leaveNow:e.target.checked}))}/> {t('Weather now')}</label>
 {!departure.leaveNow&&<><label>{t('Date')}<input type="date" disabled={busy} value={departure.date} onChange={e=>setDeparture(old=>({...old,date:e.target.value}))}/></label><label>{t('Time')} · {Intl.DateTimeFormat().resolvedOptions().timeZone}<input type="time" disabled={busy} value={departure.time} onChange={e=>setDeparture(old=>({...old,time:e.target.value}))}/></label>{departure.notice&&<p>{t('Choose a city, date and future time, or “Now”.')}</p>}</>}
 <button type="button" disabled={busy||!placeId||final} onClick={()=>void checkCity()}>{t(busy?'Loading…':'Show weather')}</button></>}
 </div>;
}
