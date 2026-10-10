import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const cells=[],effects=[];let cursor=0,dirty=false;
const react={
 useState(initial){const i=cursor++;if(!(i in cells))cells[i]=typeof initial==='function'?initial():initial;return[cells[i],value=>{const next=typeof value==='function'?value(cells[i]):value;if(!Object.is(next,cells[i])){cells[i]=next;dirty=true;}}];},
 useRef(initial){const i=cursor++;return cells[i]??(cells[i]={current:initial});},
 useCallback(fn){cursor++;return fn;},
 useEffectEvent(fn){const ref=this.useRef(fn);ref.current=fn;return(...args)=>ref.current(...args);},
 useEffect(fn,deps){const i=cursor++,old=cells[i];if(!old||deps.some((value,index)=>!Object.is(value,old.deps[index]))){cells[i]={deps,cleanup:old?.cleanup};effects.push(()=>{cells[i].cleanup?.();cells[i].cleanup=fn();});}}
};
// Compiled named React imports are called without a receiver.
react.useEffectEvent=fn=>{const ref=react.useRef(fn);ref.current=fn;return(...args)=>ref.current(...args);};
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const departure={};new Function('exports',compile('app/voice-departure.ts'))(departure);
const abortApi={};new Function('exports',compile('app/abort-timeout.ts'))(abortApi);
const catalog={};new Function('exports',compile('app/weather-translations.ts'))(catalog);
const voiceLanguage={};new Function('exports','require',compile('app/voice-language.ts'))(voiceLanguage,()=>catalog);
let trip={points:[[-86,36],[-81,30]],pointLabels:{},departure:''},vehicle='car',active=true,closed=0;
const sent=[],confirmed=[],fetches=[],intervals=new Set();
const frameWindow={postMessage:data=>sent.push(data)};
globalThis.location={origin:'https://weather.test'};
globalThis.window=new EventTarget();
const jsx=(type,props)=>{if(type==='iframe')props.ref.current={contentWindow:frameWindow};return props;};
const dependencies={react,'react/jsx-runtime':{jsx,jsxs:jsx},'./weather-language':{useWeatherLanguage:()=>({language:'en',dir:'ltr',t:text=>text})},'./weather-vehicle':{useWeatherVehicle:()=>({vehicle})},'./weather-trip-storage':{readTrip:()=>trip,pointLabelKey:p=>p.join(',')},'./voice-departure':departure,'./route-search-data':{parsePlaces:data=>data},'./voice-place-choice':{chooseVoiceRoutePlace:(_query,places)=>places[0]?.id}};
const api={};
dependencies['./abort-timeout']=abortApi;
dependencies['./voice-language']=voiceLanguage;
new Function('exports','require','fetch','setInterval','clearInterval',compile('app/voice-route-confirm.tsx'))(api,name=>dependencies[name]??{},(_url,options)=>_url==='/voice-api/status'?Promise.resolve({ok:true,json:async()=>({assistantVersion:14})}):new Promise(resolve=>fetches.push({resolve,signal:options.signal})),fn=>{intervals.add(fn);return fn;},fn=>intervals.delete(fn));
function render(){do{dirty=false;cursor=0;api.default({active,onClose:()=>closed++,onConfirm:value=>confirmed.push(value)});}while(dirty);while(effects.length)effects.shift()();}
function send(data){const event=new Event('message');Object.assign(event,{origin:location.origin,source:frameWindow,data});window.dispatchEvent(event);render();}
let sequence=0;
function context(){const id=String(++sequence);send({type:'voice-route-context-request',id});send({type:'voice-turn',turn:id});return id;}
const draft={intent:'trip',origin:'Nashville, Tennessee',destination:'Jacksonville, Florida',departure_mode:'now',clarification:null};
const place={id:'place',point:[-86,36],label:'City'};
const flush=async()=>{for(let n=0;n<8;n++)await Promise.resolve();render();};
const resolve=index=>fetches[index].resolve({ok:true,json:async()=>[place]});
render();let id=context();send({type:'voice-trip-draft',turn:id,draft});assert.equal(fetches.length,1);
send({type:'voice-cancel',turn:id});assert.equal(fetches[0].signal.aborted,true);resolve(0);await flush();assert.equal(confirmed.length,0);assert.ok(sent.some(item=>item.turn===id&&item.status==='cancelled'));

id=context();send({type:'voice-trip-draft',turn:id,draft:{...draft,departure_mode:null,departure_phrase:'tomorrow'}});
assert.ok(sent.some(item=>item.turn===id&&item.status==='clarification'));assert.equal(fetches.length,1);

id=context();send({type:'voice-trip-draft',turn:id,draft});resolve(1);await flush();resolve(2);await flush();
assert.equal(confirmed.length,1);assert.equal(confirmed[0].turn,id);assert.equal(closed,0);
window.dispatchEvent(new CustomEvent('weather-voice-result',{detail:{turn:id,status:'submitted',message:'Calculating'}}));render();assert.equal(closed,0);
window.dispatchEvent(new CustomEvent('weather-voice-result',{detail:{turn:id,status:'failed',message:'No route'}}));render();assert.equal(closed,0);assert.ok(sent.some(item=>item.turn===id&&item.status==='failed'));

id=context();send({type:'voice-trip-draft',turn:id,draft});resolve(3);await flush();resolve(4);await flush();
window.dispatchEvent(new CustomEvent('weather-voice-result',{detail:{turn:'obsolete',status:'succeeded',message:'Wrong turn'}}));render();assert.equal(closed,0);
window.dispatchEvent(new CustomEvent('weather-voice-result',{detail:{turn:id,status:'succeeded',message:'Ready'}}));render();assert.equal(closed,1);

id=context();send({type:'voice-trip-draft',turn:id,draft});vehicle='truck';render();for(const tick of intervals)tick();render();assert.equal(fetches[5].signal.aborted,true);resolve(5);await flush();assert.equal(confirmed.length,2);

id=context();send({type:'voice-trip-draft',turn:id,draft:{...draft,origin:null,departure_mode:'scheduled',departure_date:'2099-10-06',departure_time:'18:00',departure_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}});
trip={...trip,points:[[-85,35],[-81,30]]};id=context();send({type:'voice-trip-draft',turn:id,draft:{...draft,departure_mode:'keep'}});resolve(6);await flush();resolve(7);await flush();assert.equal(confirmed.at(-1).departure,'');
console.log('PASS: iframe cancel aborts geocoding; typed clarification feedback; actual matching result gates close; vehicle/route changes discard stale context');
const originalTimeout=globalThis.setTimeout,originalClearTimeout=globalThis.clearTimeout,timers=new Map();let timerId=0;
globalThis.setTimeout=(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;};globalThis.clearTimeout=id=>timers.delete(id);
try{
 id=context();send({type:'voice-trip-draft',turn:id,draft:{...draft,after_build_topic:'summary'}});resolve(8);await flush();resolve(9);await flush();
 window.dispatchEvent(new CustomEvent('weather-voice-result',{detail:{turn:id,status:'succeeded',message:'Ready'}}));render();
 const before=closed;
 send({type:'voice-ui-answer',contextual:true,text:'Which city?',sad:false});assert.equal(timers.size,0);
 send({type:'voice-ui-answer',contextual:true,text:'No significant weather issues in the forecast.',sad:false});assert.equal(closed,before);assert.equal(timers.size,1);
 const timer=[...timers.values()][0];assert.equal(timer.delay,4500);timer.fn();assert.equal(closed,before+1);
}finally{globalThis.setTimeout=originalTimeout;globalThis.clearTimeout=originalClearTimeout;}
console.log('PASS: completed route summary closes after reading delay; clarification stays open.');

id=context();send({type:"voice-trip-draft",turn:id,draft:{...draft,vehicle:"car"}});resolve(10);await flush();resolve(11);await flush();assert.equal(confirmed.at(-1).vehicle,"car");
console.log("PASS: explicit voice vehicle survives geocoding and reaches route acceptance.");

trip={...trip,points:[[-86.7816,36.1627],[-81.6557,30.3322]],via:[[-83.92,35.96]],departure:'2099-10-10T15:00:00.000Z'};
const original=structuredClone(trip),columbia={id:'columbia',point:[-81.035,34.0007],label:'Columbia, South Carolina'};
id=context();const nextFetch=fetches.length;
send({type:'voice-trip-draft',turn:id,draft:{...draft,route_mode:'update',via_mode:'add',via:['Columbia, South Carolina'],departure_mode:'keep'}});
assert.equal(fetches.length,nextFetch+1);
fetches[nextFetch].resolve({ok:true,json:async()=>[columbia]});await flush();
assert.deepEqual(confirmed.at(-1).origin.point,original.points[0]);
assert.deepEqual(confirmed.at(-1).destination.point,original.points[1]);
assert.deepEqual(confirmed.at(-1).via.map(p=>p.point),[...original.via,columbia.point]);
assert.equal(confirmed.at(-1).departure,original.departure);
assert.equal(confirmed.at(-1).vehicle,undefined);
window.dispatchEvent(new CustomEvent('weather-voice-result',{detail:{turn:id,status:'succeeded',message:'Ready'}}));render();
id=context();const beforeClear=fetches.length;
send({type:'voice-trip-draft',turn:id,draft:{...draft,route_mode:'update',via_mode:'clear',via:[],departure_mode:'keep'}});
await flush();assert.equal(fetches.length,beforeClear);assert.deepEqual(confirmed.at(-1).via,[]);
window.dispatchEvent(new CustomEvent('weather-voice-result',{detail:{turn:id,status:'succeeded',message:'Ready'}}));render();
id=context();const staleFetch=fetches.length,count=confirmed.length;
send({type:'voice-trip-draft',turn:id,draft:{...draft,route_mode:'update',via_mode:'add',via:['Columbia, South Carolina'],departure_mode:'keep'}});
trip={...trip,via:[]};for(const tick of intervals)tick();render();assert.equal(fetches[staleFetch].signal.aborted,true);
fetches[staleFetch].resolve({ok:true,json:async()=>[columbia]});await flush();assert.equal(confirmed.length,count);
console.log('PASS: spoken via keeps exact A/B, existing via, departure and vehicle; clear skips geocoding; changed via aborts stale speech');
