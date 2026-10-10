import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const catalog={};new Function('exports',compile(read('app/weather-translations.ts')))(catalog);
const source=ts.createSourceFile('route.tsx',read('app/weather-route.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let command;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='voiceMapCommand')command=node.initializer.arguments[0];ts.forEachChild(node,visit);}visit(source);
assert.ok(command,'actual route command handler');
const code=compile('const handler='+command.getText(source)+'; exports.handler=handler;');
function handler(overrides={}){const calls={fit:0,clear:0,reply:[]},api={};const args={map:{fitBounds:()=>calls.fit++},route:{coordinates:[[-86,36],[-81,30]]},busy:false,autoWaiting:false,hasPrevious:true,clearRoute:()=>calls.clear++,t:key=>catalog.translateWeather(key,'en'),matchMedia:()=>({matches:true}),...overrides};new Function('exports',...Object.keys(args),code)(api,...Object.values(args));return{calls,receive:api.handler,send:(action,translate)=>api.handler({detail:{action,translate,reply:message=>calls.reply.push(message)}})};}
let control=handler();control.send('show_route');assert.equal(control.calls.fit,1,'saved current route is shown');assert.deepEqual(control.calls.reply,['Showing the full route.']);
control=handler({busy:true});control.send('show_route');assert.equal(control.calls.fit,0,'in-flight route cannot be shown');
for(const state of [{busy:true},{autoWaiting:true}]){control=handler(state);control.send('clear_route');assert.equal(control.calls.clear,1,'voice clear uses common cancellation path while calculating');assert.deepEqual(control.calls.reply,['Route cleared.']);}
control=handler({route:null});control.send('show_route');assert.equal(control.calls.fit,0);assert.deepEqual(control.calls.reply,['Build a route first.']);
control=handler({t:key=>catalog.translateWeather(key,'ru')});control.send('clear_route');assert.deepEqual(control.calls.reply,['Маршрут очищен.']);
console.log('PASS: actual route handler shows saved route, rejects missing/busy route, clears during build/auto-wait, translates reply');
function actionEffect(file){
 const tree=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),effects=[];
 function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(tree)==='useEffect'&&node.arguments[0]?.getText(tree).includes("addEventListener('voice-map-action'"))effects.push(node.arguments[0]);ts.forEachChild(node,visit);}visit(tree);
 assert.equal(effects.length,1,file+': actual voice action effect');
 return compile('exports.install='+effects[0].getText(tree)+';');
}
const effectCode={units:actionEffect('app/weather-map.tsx'),wind:actionEffect('app/wind-controls.tsx'),radar:actionEffect('app/radar-controls.tsx')};
const answerTree=ts.createSourceFile('voice-weather-answer.ts',read('app/voice-weather-answer.ts'),ts.ScriptTarget.Latest,true),mapAction=answerTree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='mapVoiceAction');
assert.ok(mapAction,'actual mapVoiceAction bridge');
const bridgeCode=compile(mapAction.getText(answerTree));
class ActionEvent extends Event{constructor(type,{detail}){super(type);this.detail=detail;}}
function controls({menu='en',units='us',ready=true,routeOverrides={}}={}){
 const window=new EventTarget(),api={},calls={units:0,wind:[],radar:[],content:[],uiTranslations:[]};
 const t=key=>{calls.uiTranslations.push(key);return catalog.translateWeather(key,menu);};
 const routeControl=handler({t,...routeOverrides});window.addEventListener('voice-map-action',routeControl.receive);
 const cleanups=[()=>window.removeEventListener('voice-map-action',routeControl.receive)];
 for(const [kind,dependencies] of Object.entries({units:{units,toggleUnits:()=>calls.units++},wind:{ready,setEnabled:value=>calls.wind.push(value)},radar:{ready,setEnabled:value=>calls.radar.push(value),setContentVisible:value=>calls.content.push(value)}})){
  const effect={},args={window,t,...dependencies};new Function('exports',...Object.keys(args),effectCode[kind])(effect,...Object.values(args));cleanups.push(effect.install());
 }
 new Function('exports','window','CustomEvent',bridgeCode)(api,window,ActionEvent);
 return{calls,route:routeControl.calls,act:api.mapVoiceAction,legacy(action){let reply;window.dispatchEvent(new ActionEvent('voice-map-action',{detail:{action,reply:text=>{reply=text;}}}));return reply;},cleanup(){for(const cleanup of cleanups)cleanup();}};
}
const actionReplies=[['show_route','Showing the full route.'],['clear_route','Route cleared.'],['units_metric','Kilometers and Celsius enabled.'],['units_us','Miles and Fahrenheit enabled.'],['wind_on','Wind layer on.'],['wind_off','Wind layer off.'],['weather_on','Precipitation layer on.'],['weather_off','Precipitation layer off.']];
const notReady='The map is not ready for this command.';
for(const language of ['ru','ar','ro']){
 const ui=controls(),translatedKeys=[],translate=key=>{translatedKeys.push(key);return catalog.translateWeather(key,language);};
 for(const [action,key] of actionReplies){
  const expected=catalog.translateWeather(key,language);assert.notEqual(expected,key,language+': expected spoken translation exists');
  translatedKeys.length=0;assert.equal(ui.act(action,translate),expected,language+': '+action+' replies in spoken language with English menu');
  assert.deepEqual(translatedKeys,[notReady,key],'bridge and handler translate original source keys');
 }
 assert.equal(ui.route.fit,1);assert.equal(ui.route.clear,1);assert.equal(ui.calls.units,1,'matching US units stay unchanged');
 assert.deepEqual(ui.calls.wind,[true,false]);assert.deepEqual(ui.calls.radar,[true,false]);assert.deepEqual(ui.calls.content,[true],'weather_on still opens precipitation controls');
 assert.deepEqual(ui.calls.uiTranslations,[],'explicit spoken translator overrides English UI translator');
 assert.equal(ui.act('unknown_action',translate),catalog.translateWeather(notReady,language),'unhandled command fallback uses spoken language');
 const before=JSON.stringify([ui.calls,ui.route]);ui.cleanup();assert.equal(ui.act('wind_on',translate),catalog.translateWeather(notReady,language));assert.equal(JSON.stringify([ui.calls,ui.route]),before,'cleanup removes all action listeners');
 for(const routeOverrides of [{busy:true},{route:null},{map:null}]){
  const unavailable=controls({routeOverrides});assert.equal(unavailable.act('show_route',translate),catalog.translateWeather('Build a route first.',language));assert.equal(unavailable.route.fit,0);unavailable.cleanup();
 }
 const unavailable=controls({ready:false});for(const action of ['wind_on','wind_off','weather_on','weather_off'])assert.equal(unavailable.act(action,translate),catalog.translateWeather(notReady,language));
 assert.deepEqual(unavailable.calls.wind,[]);assert.deepEqual(unavailable.calls.radar,[]);assert.deepEqual(unavailable.calls.content,[]);unavailable.cleanup();
 const metric=controls({units:'metric'});assert.equal(metric.act('units_metric',translate),catalog.translateWeather('Kilometers and Celsius enabled.',language));assert.equal(metric.calls.units,0,'already selected metric units do not toggle');metric.cleanup();
}
const legacy=controls({menu:'ru'});for(const [action,key] of actionReplies)assert.equal(legacy.legacy(action),catalog.translateWeather(key,'ru'),'missing translator falls back to current UI: '+action);legacy.cleanup();
assert.equal(legacy.act('unknown_action'),notReady,'bridge without translator preserves default English fallback');
console.log('PASS: actual action bridge and all four handlers use RU/AR/RO spoken translator with English menu; source keys, UI fallback, readiness, units idempotence, side effects and cleanup');
const keys=['Route cleared.','Build a route first.','Showing the full route.','Wind layer on.','Wind layer off.','Precipitation layer on.','Precipitation layer off.','Kilometers and Celsius enabled.','Miles and Fahrenheit enabled.','The map is not ready for this command.','Delete both points and the current route?','Yes, clear the route','Route clearing cancelled.','Checking…',"All 20 voice requests for today are used up. I'm taking a pit stop ☕ See you tomorrow! The limit resets at midnight in New York. The map and forecasts still work.",'The shared daily voice allowance is used up. It resets at midnight in New York.'];
for(const language of catalog.languages)for(const key of keys){const text=catalog.translateWeather(key,language.code);assert.ok(text);if(language.code!=='en')assert.notEqual(text,key,language.code+': '+key);}
console.log('PASS: all16 local voice strings translated in all12 languages');
async function quota(code,language='en',options={}){
 const elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,{classList:{toggle(){}},append(){},style:{},pause(){},removeAttribute(){},textContent:'',disabled:false});return elements.get(id);};
 let clock=Date.parse('2026-10-08T03:59:00Z'),statusResult={ready:true,assistantVersion:11,dailyLimit:20,requestsUsed:0,...options.status},statusFailure=false;
 const calls={status:0,interpret:0},posted=[],window=new EventTarget();
 class ClockDate extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
 const parent={postMessage:data=>{posted.push(data);if(data.type==='voice-route-context-request')message({type:'voice-route-context',id:data.id,context:{}});}};
 function message(data){const event=new Event('message');Object.assign(event,{origin:'http://qa',source:parent,data});window.dispatchEvent(event);}
 const sandbox={console,URL,URLSearchParams,Blob,AbortController,DOMException,TextEncoder,Uint8Array,ArrayBuffer,DataView,btoa,Date:ClockDate,location:{search:'?embedded=1',origin:'http://qa'},parent,crypto:{randomUUID:()=> 'uuid'},sessionStorage:{getItem:()=>null,setItem(){}},document:{getElementById:element,createElement:()=>element('bar'),addEventListener(){},documentElement:{classList:{add(){},toggle(){}}}},window,setTimeout:()=>1,clearTimeout(){},cancelAnimationFrame(){},fetch:async url=>{
  if(url==='./status'){calls.status++;if(statusFailure)throw TypeError('offline');return {ok:true,json:async()=>statusResult};}
  assert.equal(url,'./interpret','no unexpected or live request');calls.interpret++;return {ok:false,status:429,headers:{get:()=>null},json:async()=>({code,error:'allowance unavailable'})};
 }};
 vm.createContext(sandbox);await vm.runInContext('(async()=>{'+read('deploy/voice-trial/trial.js')+';globalThis.test={prepare(){blob=new Blob(["test"],{type:"audio/wav"});},state(){return{quotaStopped,retryAudio,cooldownUntil};}};})()',sandbox);
 const setLanguage=language=>message({type:'voice-language',language,labels:Object.fromEntries(keys.map(k=>[k,catalog.translateWeather(k,language)]))});
 setLanguage(language);
 if(!options.skipSend){sandbox.test.prepare();await element('send').onclick();}
 return{get state(){return sandbox.test.state();},get text(){return element('status').textContent;},get now(){return clock;},record:element('record'),send:element('send'),cancel:()=>element('cancel').onclick(),message,setLanguage,calls,posted,advance:ms=>{clock+=ms;},setStatus:value=>{statusResult={...statusResult,...value};},failStatus:()=>{statusFailure=true;},flush:async()=>{for(let i=0;i<30;i++)await Promise.resolve();}};
}
(async()=>{
 for(const code of ['daily_limit','global_limit'])for(const {code:language} of catalog.languages){
  const result=await quota(code,language),key=keys[code==='global_limit'?15:14],expected=catalog.translateWeather(key,language);
  assert.equal(result.state.quotaStopped,true);assert.equal(result.state.retryAudio,false);assert.equal(result.state.cooldownUntil,0);assert.equal(result.record.disabled,true);assert.equal(result.send.disabled,true);assert.equal(result.text,expected);
  result.cancel();assert.equal(result.record.disabled,true);assert.equal(result.send.disabled,true);assert.equal(result.text,expected);assert.equal(result.posted.at(-1).text,expected,'Cancel restores quota explanation in parent');
  for(const type of ['voice-close','voice-open','voice-answer-ready','voice-context-stale']){result.message({type});assert.equal(result.text,expected);assert.equal(result.record.disabled,true);}
  await result.record.onclick();assert.equal(result.calls.interpret,1,'blocked Record never resends');assert.equal(result.calls.status,1,'no same-day polling');
  result.setLanguage('ro');assert.equal(result.text,catalog.translateWeather(key,'ro'));assert.equal(result.posted.at(-1).text,result.text,'parent gets translated quota');
 }
 for(const used of [19,20]){const result=await quota('daily_limit','ru',{skipSend:true,status:{requestsUsed:used}});assert.equal(result.record.disabled,used===20);assert.equal(result.calls.interpret,0);if(used===20)assert.equal(result.text,catalog.translateWeather(keys[14],'ru'));}
 const unlimited=await quota('daily_limit','en',{skipSend:true,status:{dailyLimit:null,requestsUsed:20}});assert.equal(unlimited.record.disabled,false);
 for(const code of ['daily_limit','global_limit']){
  const result=await quota(code);result.advance(120000);result.message({type:'voice-open'});await result.flush();assert.equal(result.state.quotaStopped,false,'NY midnight + reopen refreshes quota');assert.equal(result.record.disabled,false);assert.equal(result.calls.status,2);assert.equal(result.calls.interpret,1,'refresh never submits audio');
 }
 const exhaustedAgain=await quota('daily_limit');exhaustedAgain.advance(120000);exhaustedAgain.setStatus({requestsUsed:20});exhaustedAgain.message({type:'voice-open'});await exhaustedAgain.flush();assert.equal(exhaustedAgain.record.disabled,true,'fresh server limit remains enforced');
 const offline=await quota('daily_limit');offline.advance(120000);offline.failStatus();offline.message({type:'voice-open'});await offline.flush();assert.equal(offline.record.disabled,true,'failed status cannot unlock recording');
 for(const invalid of [{assistantVersion:undefined},{dailyLimit:undefined},{requestsUsed:undefined},{requestsUsed:-1},{requestsUsed:NaN}]){const result=await quota('daily_limit');result.advance(120000);result.setStatus(invalid);result.message({type:'voice-open'});await result.flush();assert.equal(result.record.disabled,true,'invalid status cannot unlock recording');}
 const temporary=await quota('busy');assert.equal(temporary.state.quotaStopped,false);assert.equal(temporary.state.retryAudio,true);assert.ok(temporary.state.cooldownUntil>temporary.now);
 console.log('PASS: daily/global quota in all12 languages; Cancel, close/reopen, stale messages, language changes, initial20/19/unlimited, NY next-day refresh and offline lock; temporary429 keeps retry');
})().catch(error=>{console.error(error);process.exitCode=1;});
