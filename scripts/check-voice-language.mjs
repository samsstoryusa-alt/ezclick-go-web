import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import vm from 'node:vm';
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
const storage=new Map(),storageWrites=[];globalThis.sessionStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>{storage.set(k,v);storageWrites.push(k)}};globalThis.localStorage={getItem:()=>null,setItem:()=>{throw Error('menu storage must not change')}};
globalThis.location={origin:'https://weather.test'};
globalThis.window=new EventTarget();
let tree;const jsx=(type,props)=>{if(type==='iframe')props.ref.current={contentWindow:frameWindow};return {type,props};};
const dependencies={react,'react/jsx-runtime':{jsx,jsxs:jsx},'./weather-language':{useWeatherLanguage:()=>({language:'en',dir:'ltr',t:text=>text})},'./weather-vehicle':{useWeatherVehicle:()=>({vehicle})},'./weather-trip-storage':{readTrip:()=>trip,pointLabelKey:p=>p.join(',')},'./voice-departure':departure,'./route-search-data':{parsePlaces:data=>data},'./voice-place-choice':{chooseVoiceRoutePlace:(_query,places)=>places[0]?.id}};
const api={};
dependencies['./abort-timeout']=abortApi;
dependencies['./voice-language']=voiceLanguage;
new Function('exports','require','fetch','setInterval','clearInterval',compile('app/voice-route-confirm.tsx'))(api,name=>dependencies[name]??{},(_url,options)=>_url==='/voice-api/status'?Promise.resolve({ok:true,json:async()=>({assistantVersion:14})}):new Promise(resolve=>fetches.push({resolve,signal:options.signal})),fn=>{intervals.add(fn);return fn;},fn=>intervals.delete(fn));
function render(){do{dirty=false;cursor=0;tree=api.default({active,onClose:()=>closed++,onConfirm:value=>confirmed.push(value)});}while(dirty);while(effects.length)effects.shift()();}
function send(data){const event=new Event('message');Object.assign(event,{origin:location.origin,source:frameWindow,data});window.dispatchEvent(event);render();}
let sequence=0;
function context(){const id=String(++sequence);send({type:'voice-route-context-request',id});send({type:'voice-turn',turn:id});return id;}
const draft={intent:'trip',origin:'Nashville, Tennessee',destination:'Jacksonville, Florida',departure_mode:'now',clarification:null};
const place={id:'place',point:[-86,36],label:'City'};
const flush=async()=>{for(let n=0;n<8;n++)await Promise.resolve();render();};
const resolve=index=>fetches[index].resolve({ok:true,json:async()=>[place]});
const results=[];
async function test(name,fn){try{await fn();results.push({name,result:'PASS'});console.log('PASS '+name);}catch(e){results.push({name,result:'FAIL',error:e.message});console.error('FAIL '+name+': '+e.message);}}
const nodes=(node)=>!node||typeof node!=='object'?[]:[node,...[node.props?.children].flat(Infinity).flatMap(nodes)];
const visible=()=>nodes(tree).map(n=>typeof n.props?.children==='string'?n.props.children:'').join('\n');
render();
await test('spoken language accepted before next render; null turns retain it; language switches without menu writes',()=>{
 for(const lang of ['ru','ar','ro','en']){
  const id=String(++sequence);send({type:'voice-route-context-request',id});
  const event=new Event('message');Object.assign(event,{origin:location.origin,source:frameWindow,data:{type:'voice-turn',turn:id,responseLanguage:lang}});window.dispatchEvent(event);
  send({type:'voice-trip-draft',turn:id,draft:{intent:'trip',origin:null,destination:null,response_language:null}});
  assert.ok(visible().includes(voiceLanguage.translateVoice('Say the starting city and state.',lang)),visible());
  assert.equal(sent.filter(x=>x.type==='voice-language').at(-1).responseLanguage,lang);
  send({type:'voice-turn',turn:id+'short',responseLanguage:null});
  assert.equal(sent.filter(x=>x.type==='voice-language').at(-1).responseLanguage,lang);
  const chat=nodes(tree).find(x=>x.props?.lang===lang);assert.ok(chat);assert.equal(chat.props.dir,voiceLanguage.voiceDirection(lang));
 }
 assert.ok(storageWrites.every(k=>k==='weather-voice-response-language'));
});
await test('wrong origin/source and inactive parent cannot switch conversation language',()=>{
 for(const patch of [{origin:'https://evil.test'},{source:{}}]){const event=new Event('message');Object.assign(event,{origin:location.origin,source:frameWindow,data:{type:'voice-turn',turn:'bad',responseLanguage:'ar'}},patch);window.dispatchEvent(event);render();assert.equal(storage.get('weather-voice-response-language'),'en');}
 active=false;render();send({type:'voice-turn',turn:'inactive',responseLanguage:'ar'});assert.equal(storage.get('weather-voice-response-language'),'en');active=true;render();
});
await test('close/reopen and fresh mount preserve conversation language',()=>{
 send({type:'voice-turn',turn:'persist',responseLanguage:'ro'});active=false;render();active=true;render();assert.equal(sent.filter(x=>x.type==='voice-language').at(-1).responseLanguage,'ro');
 for(const cell of cells)cell?.cleanup?.();cells.length=0;effects.length=0;render();assert.equal(sent.filter(x=>x.type==='voice-language').at(-1).responseLanguage,'ro');
});

async function recorder(initialUsed=0){
 const elements=new Map(),out=[],requests=[],timers=new Map();let timerId=0,now=Date.parse('2026-10-07T16:00:00Z');
 const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',disabled:false,style:{},classList:{toggle(){},add(){}},append(){},pause(){},removeAttribute(){}});return elements.get(id);};
 const win=new EventTarget(),parent={postMessage:data=>out.push(data)},doc=Object.assign(new EventTarget(),{getElementById:element,createElement:()=>element('bar'),documentElement:{classList:{add(){},toggle(){}}}});
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 let fetcher=async()=>({ok:true,json:async()=>({ready:true,assistantVersion:11,dailyLimit:20,requestsUsed:initialUsed})});
 const ctx={console,URLSearchParams,URL,Blob,AbortController,AbortSignal,DOMException,Date:Clock,Intl,Event,Uint8Array,ArrayBuffer,DataView,TextEncoder,location:{origin:'https://weather.test',search:'?embedded=1'},parent,window:win,document:doc,navigator:{mediaDevices:{getUserMedia:async()=>{throw new DOMException('denied','NotAllowedError')}}},crypto:{randomUUID:()=> 'qa'},sessionStorage:{getItem:()=>null,setItem(){}},setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id),cancelAnimationFrame(){},btoa:s=>Buffer.from(s).toString('base64'),fetch:async(url,options)=>{requests.push({url,options});return fetcher(url,options);}};ctx.window.MediaRecorder=function(){};
 vm.createContext(ctx);await vm.runInContext('(async()=>{'+fs.readFileSync('deploy/voice-trial/trial.js','utf8')+';globalThis.qa={prepare:()=>{blob=new Blob(["test"]);},refreshQuota};})()',ctx);
 const send=data=>{const event=new Event('message');Object.assign(event,{origin:ctx.location.origin,source:parent,data});win.dispatchEvent(event);};
 const language=lang=>send({type:'voice-language',language:'en',dir:'ltr',labels:Object.fromEntries(voiceLanguage.VOICE_RECORDER_KEYS.map(k=>[k,voiceLanguage.translateVoice(k,'en')])),responseLanguage:lang,voiceLabels:Object.fromEntries(voiceLanguage.VOICE_RECORDER_KEYS.map(k=>[k,voiceLanguage.translateVoice(k,lang)]))});
 const drain=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};
 return {ctx,element,out,requests,send,language,drain,fetch:f=>fetcher=f,day:()=>now=Date.parse('2026-10-08T04:01:00Z'),async interpret(result,status=200){ctx.qa.prepare();fetcher=async url=>url==='./interpret'?{ok:status===200,status,headers:{get:()=> '1'},json:async()=>{if(result instanceof Error)throw result;return result;}}:url==='./answer'?{ok:false,json:async()=>({error:'RAW RUSSIAN FACTS'})}:{ok:true,json:async()=>({})};const pending=element('send').onclick();await drain();const id=out.findLast(x=>x.type==='voice-route-context-request')?.id;send({type:'voice-route-context',id,context:{}});await pending;await drain();}};
}
await test('real iframe microphone denial uses menu initially and spoken language thereafter; Arabic direction',async()=>{
 const h=await recorder();h.language('en');await h.element('record').onclick();assert.equal(h.element('status').textContent,voiceLanguage.translateVoice('Microphone access is blocked. Allow it in your browser settings.','en'));
 for(const lang of ['ru','ar','ro','en']){h.language(lang);await h.element('record').onclick();assert.equal(h.element('status').textContent,voiceLanguage.translateVoice('Microphone access is blocked. Allow it in your browser settings.',lang));assert.equal(h.element('status').dir,voiceLanguage.voiceDirection(lang));}
});
await test('real interpret posts top-level language fallback, localized server failures and answer failure hides facts',async()=>{
 for(const lang of ['ru','ar','ro','en']){
  const h=await recorder();h.language(lang);await h.interpret({turn:'t',response_language:lang,draft:{intent:'weather',response_language:null}});assert.equal(h.out.find(x=>x.type==='voice-turn').responseLanguage,lang);
  h.send({type:'voice-facts',turn:'t',facts:'RAW RUSSIAN FACTS'});await h.drain();assert.equal(h.out.findLast(x=>x.type==='voice-ui-answer')?.text,voiceLanguage.translateVoice('Could not prepare the reply. Check the forecast on the map and try again.',lang));
  const e=await recorder();e.language(lang);await e.interpret({code:'speech',error:'provider secret'},400);assert.equal(e.element('status').textContent,voiceLanguage.translateVoice('No speech was recognized. Please try recording again.',lang));
  const broken=await recorder();broken.language(lang);await broken.interpret(new SyntaxError('UPSTREAM PRIVATE HTML ERROR'));assert.equal(broken.element('status').textContent,voiceLanguage.translateVoice('Could not process your request. Please try again.',lang));assert.ok(!JSON.stringify(broken.out).includes('UPSTREAM PRIVATE'));
 }
});
await test('quota cancellation and reopen retain localized banner; new NY day unlocks safely',async()=>{
 const h=await recorder(20);h.language('ar');const banner=h.element('status').textContent;h.element('cancel').onclick();h.send({type:'voice-close'});h.send({type:'voice-open'});assert.equal(h.element('status').textContent,banner);assert.equal(h.element('record').disabled,true);h.day();h.fetch(async()=>({ok:true,json:async()=>({ready:true,assistantVersion:11,dailyLimit:20,requestsUsed:0})}));await h.ctx.qa.refreshQuota();assert.equal(h.element('record').disabled,false);assert.equal(h.element('status').dir,'rtl');
});
await test('draft-only response language survives iframe bridge; busy retry retains recording and localizes notice',async()=>{
 const h=await recorder();h.language('ro');await h.interpret({turn:'draft-language',draft:{intent:'weather',response_language:'ar'}});assert.equal(h.out.find(x=>x.type==='voice-turn').responseLanguage,'ar');
 const retry=await recorder();retry.language('ru');await retry.interpret({code:'busy',error:'do not display provider error'},429);assert.equal(retry.element('record').disabled,true);assert.ok(retry.element('status').textContent.includes(voiceLanguage.translateVoice('Recording saved. You can retry in {seconds} s.','ru',{seconds:1})));assert.ok(!retry.element('status').textContent.includes('provider error'));assert.ok(retry.element('record').textContent.includes('1'));
});
console.log(JSON.stringify(results,null,2));process.exitCode=results.some(x=>x.result==='FAIL')?1:0;
