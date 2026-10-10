"use client";
import {useWeatherLanguage} from './weather-language';
import {translateVoice,voiceDirection,voiceLanguage,VOICE_RECORDER_KEYS} from './voice-language';
import {withAbortTimeout} from './abort-timeout';
import VoiceCloudAvatar,{type VoiceMood} from './voice-cloud-avatar';
import {useCallback,useEffect,useEffectEvent,useRef,useState,type CSSProperties} from 'react';
import {parsePlaces,type SearchPlace} from './route-search-data';
import {chooseVoiceRoutePlace} from './voice-place-choice';
import {useWeatherVehicle} from './weather-vehicle';
import {readTrip,pointLabelKey} from './weather-trip-storage';
import {structuredVoiceDeparture,voiceDepartureInstant,voiceDepartureIssue,type VoiceDeparture} from './voice-departure';
import VoiceWeatherPanel from './voice-weather-panel';
import {routeForecastSnapshot,type AssistantCommand} from './voice-weather-answer';
export type VoiceTrip={origin:SearchPlace;destination:SearchPlace;via?:SearchPlace[];departure:string;vehicle?:'truck'|'car';turn?:string};
export default function VoiceRouteConfirm({onConfirm,onClose,active=true}:{onConfirm:(trip:VoiceTrip)=>void;onClose:()=>void;active?:boolean}){
 const {language,dir,t}=useWeatherLanguage(),{vehicle}=useWeatherVehicle();
 const [supportsVia,setSupportsVia]=useState(false);
 useEffect(()=>{const controller=new AbortController();void fetch('/voice-api/status',{signal:controller.signal}).then(r=>r.ok?r.json():null).then(value=>{if(!controller.signal.aborted)setSupportsVia(!!value&&typeof value==='object'&&'assistantVersion' in value&&typeof value.assistantVersion==='number'&&value.assistantVersion>=14);}).catch(()=>{});return()=>controller.abort();},[]);
 const [responseLanguage,setResponseLanguage]=useState<string|null>(()=>{try{return voiceLanguage(sessionStorage.getItem('weather-voice-response-language'));}catch{return null;}});
 const spokenLanguage=useRef(responseLanguage);
 const frame=useRef<HTMLIFrameElement>(null),request=useRef<AbortController|null>(null);
 const pendingContext=useRef<string|null>(null);
 const pendingDraft=useRef<{origin:string;destination:string;departure:VoiceDeparture}|null>(null);
 const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null),awaitingSummary=useRef(false);
 const turn=useRef<string|null>(null),submitted=useRef<string|null>(null),afterBuild=useRef<AssistantCommand|null>(null);
 const contextKey=()=>{const trip=readTrip();return JSON.stringify([vehicle,trip?.points,trip?.via,trip?.departure,Intl.DateTimeFormat().resolvedOptions().timeZone]);};
 const [phase,setPhase]=useState<VoiceMood>('neutral'),[answer,setAnswer]=useState('');
 const [assistant,setAssistant]=useState<{command:AssistantCommand;id:number;vehicle:string;turn:string|null}|null>(null);
 const [viewContext,setViewContext]=useState({active,vehicle});
 if(viewContext.active!==active||viewContext.vehicle!==vehicle){setViewContext({active,vehicle});setAssistant(null);}
 const content=useRef<HTMLDivElement>(null),[contentHeight,setContentHeight]=useState(0);
 useEffect(()=>{const node=content.current;if(!node)return;const observer=new ResizeObserver(()=>setContentHeight(Math.ceil(node.getBoundingClientRect().height)));observer.observe(node);return()=>observer.disconnect();},[]);
 const syncFrame=useCallback(()=>{
  const answerLanguage=responseLanguage??language;
  frame.current?.contentWindow?.postMessage({type:'voice-language',language,dir,labels:Object.fromEntries(VOICE_RECORDER_KEYS.map(key=>[key,translateVoice(key,language)])),responseLanguage:answerLanguage,voiceLabels:Object.fromEntries(VOICE_RECORDER_KEYS.map(key=>[key,translateVoice(key,answerLanguage)]))},location.origin);
 },[language,dir,responseLanguage]);
 useEffect(()=>{syncFrame();},[syncFrame]);
 useEffect(()=>{frame.current?.contentWindow?.postMessage({type:'voice-layout',compact:!!answer},location.origin);},[answer]);
 useEffect(()=>{if(active)frame.current?.contentWindow?.postMessage({type:'voice-start'},location.origin);},[active]);
 const text=(key:string,values?:Record<string,string|number>)=>translateVoice(key,spokenLanguage.current??language,values);
 function acceptLanguage(value:unknown){const next=voiceLanguage(value);if(!next)return;spokenLanguage.current=next;setResponseLanguage(next);try{sessionStorage.setItem('weather-voice-response-language',next);}catch{/* Keep language in this conversation when storage is unavailable. */}}
 function reply(message:string,mood:VoiceMood='neutral'){setAnswer(message);setPhase(mood);}
 function feedback(id:string|null,status:'clarification'|'submitted'|'succeeded'|'failed'|'cancelled',message:string){
  if(id)frame.current?.contentWindow?.postMessage({type:'voice-feedback',turn:id,status,message},location.origin);
 }
 function cancelWork(message:string){
  if(closeTimer.current)clearTimeout(closeTimer.current);awaitingSummary.current=false;
  request.current?.abort();request.current=null;pendingDraft.current=null;afterBuild.current=null;
  const id=submitted.current??turn.current;submitted.current=null;turn.current=null;pendingContext.current=null;
  if(id){window.dispatchEvent(new CustomEvent('weather-voice-cancel',{detail:{turn:id}}));feedback(id,'cancelled',message);}
 }
 function cancelPending(message:string){cancelWork(message);setAssistant(null);}
 const invalidate=useEffectEvent(()=>{
  if(!submitted.current&&pendingContext.current!==null&&pendingContext.current!==contextKey()){
   const message=text('The route changed. Please repeat your request.');cancelPending(message);reply(message,'sad');
  }
 });
 const deactivate=useEffectEvent(()=>cancelWork(text('Voice request cancelled.')));
 useEffect(()=>{
  if(!active){deactivate();return;}
  const timer=setInterval(()=>invalidate(),250);
  return()=>{clearInterval(timer);request.current?.abort();};
 },[active,vehicle]);
 useEffect(()=>()=>{request.current?.abort();if(closeTimer.current)clearTimeout(closeTimer.current);},[]);
 const routeResult=useEffectEvent((event:Event)=>{
  const result=(event as CustomEvent).detail;
  if(!result||result.turn!==submitted.current||!['submitted','succeeded','failed','cancelled'].includes(result.status))return;
  feedback(result.turn,result.status,result.message);
  if(result.status==='submitted'){reply(text('Finding your route…'),'thinking');return;}
  submitted.current=null;
  if(result.status==='succeeded'){
   pendingDraft.current=null;pendingContext.current=contextKey();
   if(afterBuild.current){awaitingSummary.current=true;const command=afterBuild.current;afterBuild.current=null;setAssistant(old=>({command,id:(old?.id??0)+1,vehicle,turn:result.turn}));reply(text('Checking your forecast…'),'thinking');}
   else{turn.current=null;setPhase('happy');setAnswer('');onClose();}
  }else{afterBuild.current=null;turn.current=null;reply(text(result.status==='cancelled'?'Voice request cancelled.':'Could not build the route. Please try again.'),'sad');}
 });
 useEffect(()=>{const receive=(event:Event)=>routeResult(event);window.addEventListener('weather-voice-result',receive);return()=>window.removeEventListener('weather-voice-result',receive);},[]);
 const receive=useEffectEvent((event:MessageEvent)=>{
  if(event.origin!==location.origin||event.source!==frame.current?.contentWindow)return;
  const data=event.data;
  if(data?.type==='voice-cancel'){cancelPending(text('Voice request cancelled.'));reply(text('Voice request cancelled.'));return;}
  if(data?.type==='voice-quota-reset'){reply(text('Ask another question.'));return;}
  if(!active)return;
  if(data?.type==='voice-turn'&&typeof data.turn==='string'){turn.current=data.turn;acceptLanguage(data.responseLanguage);return;}
  if(data?.type==='voice-ui-state'){
   if(['neutral','happy','sad','listening','thinking'].includes(data.phase))setPhase(data.phase);
   if(data.phase==='listening'){if(closeTimer.current)clearTimeout(closeTimer.current);awaitingSummary.current=false;if(submitted.current)cancelPending(text('A newer voice request replaced this request.'));request.current?.abort();setAssistant(null);setAnswer('');}
   return;
  }
  if(data?.type==='voice-ui-answer'&&typeof data.text==='string'){if(data.contextual&&pendingContext.current!==contextKey())return;reply(data.text.slice(0,2000),data.sad?'sad':'neutral');if(awaitingSummary.current&&data.contextual&&!data.sad&&!/[?؟]/.test(data.text)){awaitingSummary.current=false;const key=contextKey();closeTimer.current=setTimeout(()=>{if(key===contextKey())onClose();},4500);}return;}
  if(data?.type==='voice-ui-audio'){request.current?.abort();setAssistant(null);setAnswer('');return;}
  if(data?.type==='voice-route-context-request'){
   invalidate();
   pendingContext.current=contextKey();const trip=readTrip();
   frame.current?.contentWindow?.postMessage({type:'voice-route-context',id:data.id,context:{vehicle,origin:trip?.points[0]?trip.pointLabels?.[pointLabelKey(trip.points[0])]??'Map point A':null,destination:trip?.points[1]?trip.pointLabels?.[pointLabelKey(trip.points[1])]??'Map point B':null,departure:trip?.departure||'leave now',status:trip?.builtKey?'built':'selected',...(supportsVia?{supports_via:true,via:(trip?.via??[]).map(p=>trip?.pointLabels?.[pointLabelKey(p)]??`${p[1].toFixed(3)}, ${p[0].toFixed(3)}`)}:{})}},location.origin);return;
  }
  if(!['voice-assistant-command','voice-trip-draft'].includes(data?.type))return;
  const id=typeof data.turn==='string'?data.turn:null;
  if(!id)return;
  turn.current=id;
  acceptLanguage(data.draft?.response_language);
  const respond=(message:string,status:'clarification'|'failed'='clarification')=>{feedback(id,status,message);reply(message,status==='failed'?'sad':'neutral');};
  if(pendingContext.current!==contextKey()){cancelPending(text('The route changed. Please repeat your request.'));reply(text('The route changed. Please repeat your request.'),'sad');return;}
  if(data.type==='voice-assistant-command'){
   const command=data.draft;
   if(command?.intent==='control'&&command.action==='cancel_pending'){const message=text('Voice request cancelled.');cancelPending(message);feedback(id,'succeeded',message);reply(message);return;}
   if(command&&['weather','help','control'].includes(command.intent)&&['city','topic','action','departure_phrase','clarification'].every(k=>command[k]==null||typeof command[k]==='string'&&command[k].length<=600))setAssistant(old=>({command,id:(old?.id??0)+1,vehicle,turn:typeof data.turn==='string'?data.turn:null}));
   return;
  }
  const d=data.draft;
  if(!d||d.intent!=='trip'||!['origin','destination','departure_phrase','clarification'].every(k=>d[k]==null||typeof d[k]==='string'&&d[k].length<=600))return;
  if(d.vehicle!=null&&!['truck','car'].includes(d.vehicle))return;
  if(d.via!=null&&(!Array.isArray(d.via)||d.via.length>5||!d.via.every((p:unknown)=>typeof p==='string'&&p.trim().length>0&&p.length<=400)))return;
  if(d.via_mode!=null&&!['add','replace','clear'].includes(d.via_mode)||d.route_mode!=null&&!['new','update'].includes(d.route_mode))return;
  const stored=readTrip(),keepEndpoints=d.route_mode==='update'&&!!stored?.points[0]&&!!stored?.points[1];
  request.current?.abort();setAssistant(null);
  const previous=pendingDraft.current;
  const origin=d.origin?.trim()||'',destination=d.destination?.trim()||'';
  const departure=structuredVoiceDeparture(d,keepEndpoints&&d.departure_mode==='keep'?null:previous?.departure??null,stored?.departure??null);
  pendingDraft.current={origin,destination,departure};
  if(!keepEndpoints&&(!origin||!destination)){respond(d.clarification||text(!origin?'Say the starting city and state.':'Say the destination city and state.'));return;}
  if(departure.notice==='timezone'){respond(text('Please give the departure day and time in your device timezone ({timezone}).',{timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}));return;}
  if(departure.notice==='ambiguous'){respond(text('That local time occurs twice when the clocks change. Please choose a different departure time.'));return;}
  if(voiceDepartureIssue(departure)==='past'){respond(text('That departure time ({time}) has already passed. Are you leaving now or tomorrow at {time}?',{time:departure.time}));return;}
  if(d.clarification){respond(d.clarification);return;}
  if(voiceDepartureInstant(departure)===null){respond(text('What day and time are you leaving? You can also say “now”.'));return;}
  const controller=new AbortController();request.current=controller;
  const fingerprint=contextKey();setPhase('thinking');reply(text('Finding your route…'),'thinking');
  void (async()=>{
   const savedPlace=(p:[number,number],name:string):SearchPlace=>({id:pointLabelKey(p),point:p,name,detail:'',label:stored?.pointLabels?.[pointLabelKey(p)]??name});
   const found:SearchPlace[]=[];
   const findPlace=async(query:string)=>{
    const params=new URLSearchParams({q:query,limit:'6',countrycode:'US',bbox:'-125,24,-66,50',lang:'en'});
    const places=await withAbortTimeout(controller.signal,15000,async signal=>{const response=await fetch('https://photon.komoot.io/api/?'+params,{signal});if(!response.ok)throw Error();return parsePlaces(await response.json());});
    if(controller.signal.aborted)return null;
    const choice=places.find(place=>place.id===chooseVoiceRoutePlace(query,places));
    if(!choice){respond(text('Which state is {city} in? Please say the city and state.',{city:query}));return null;}
    return choice;
   };
   if(keepEndpoints){found.push(savedPlace(stored!.points[0]!,origin||'A'),savedPlace(stored!.points[1]!,destination||'B'));}
   else for(const query of [origin,destination]){const choice=await findPlace(query);if(!choice)return;found.push(choice);}
   const waypoints:SearchPlace[]=keepEndpoints&&!['replace','clear'].includes(d.via_mode)?(stored?.via??[]).map((p,i)=>savedPlace(p,'Via '+(i+1))):[];
   if(d.via_mode!=='clear')for(const query of d.via??[]){const choice=await findPlace(query);if(!choice)return;if(!waypoints.some(p=>Math.hypot(p.point[0]-choice.point[0],p.point[1]-choice.point[1])<.001))waypoints.push(choice);}
   if(waypoints.length>5){respond(spokenLanguage.current==='ru'?'Можно добавить до пяти промежуточных точек. Удалите одну из существующих.':'You can add up to five intermediate points. Remove one first.');return;}
   if(controller.signal.aborted)return;
   if(fingerprint!==contextKey()){cancelPending(text('The route changed. Please repeat your request.'));reply(text('The route changed. Please repeat your request.'),'sad');return;}
   const time=voiceDepartureInstant(departure);
   if(time===null){respond(text('That departure time has passed. When are you leaving?'));return;}
   submitted.current=id;
   afterBuild.current=typeof d.after_build_topic==='string'?{intent:'weather',topic:d.after_build_topic,city:null,departure_mode:'keep',departure_phrase:null,clarification:null,wait_for_forecast:true,response_language:spokenLanguage.current}:null;
   onConfirm({origin:found[0],destination:found[1],...(d.route_mode||d.via_mode?{via:waypoints}:{}),departure:time,vehicle:d.vehicle??undefined,turn:id});
  })().catch(()=>{if(!controller.signal.aborted)respond(text('City search is unavailable. Please try again.'),'failed');});
 });
 useEffect(()=>{const listener=(event:MessageEvent)=>receive(event);window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener);},[]);
 return <section className={'voice-route-panel voice-direct-route '+(answer?'has-content':'is-compact')} style={{'--voice-content-height':contentHeight+'px'} as CSSProperties} aria-label={t('Voice route')} dir={dir}>
 <header><VoiceCloudAvatar mood={phase}/><strong>{t('Trip assistant')}</strong><button type="button" onClick={onClose} aria-label={t('Close voice input')}>×</button></header>
 <div className="voice-chat-scroll" lang={responseLanguage??language} dir={voiceDirection(responseLanguage??language)}><div ref={content} className="voice-content-stack"><div className="voice-direct-answer" role="status">{answer}</div>{assistant&&assistant.vehicle===vehicle&&<VoiceWeatherPanel key={assistant.id} command={assistant.command} responseLanguage={responseLanguage??language} onAnswer={(message,final,status)=>{if(!active||pendingContext.current!==contextKey())return;if(status)feedback(assistant.turn,status,message);if(final&&assistant.turn&&status!=='clarification'&&assistant.command.intent!=='control'){reply(text('Checking your forecast…'),'thinking');frame.current?.contentWindow?.postMessage({type:'voice-facts',turn:assistant.turn,facts:JSON.stringify({conclusion:message,route_forecast_points:routeForecastSnapshot()?.points.map(p=>({place:p.place??null,available:p.available,condition:p.condition,level:p.level}))??[],note:'Ordered forecast sample locations from the current route. Do not invent other stops. Missing places are unknown.'})},location.origin);}else reply(message);frame.current?.contentWindow?.postMessage({type:'voice-answer-ready'},location.origin);}} hideAnswer/>}</div></div>
 <iframe ref={frame} src="/voice-api/?embedded=1" title={t('Voice route')} onLoad={()=>{syncFrame();if(active)frame.current?.contentWindow?.postMessage({type:'voice-start'},location.origin);frame.current?.contentWindow?.postMessage({type:'voice-layout',compact:!!answer},location.origin);}} allow="microphone"/>
 </section>;
}
