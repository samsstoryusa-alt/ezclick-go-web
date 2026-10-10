import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const compile=file=>ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
// No global patches: only these isolated browser contexts lack the newer methods.
class LegacyAbortController extends AbortController{
 constructor(){super();Object.defineProperty(this.signal,'throwIfAborted',{value:undefined});}
}
const legacySignal=Object.freeze({});
function clock(){
 let next=0;const timers=new Map();
 return {timers,setTimeout(fn,ms){const id=++next;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},fire(){const [id,timer]=timers.entries().next().value??[];assert.ok(timer,'a deadline is pending');timers.delete(id);timer.fn();}};
}
function parent(){
 const controller=new LegacyAbortController(),listeners=new Set(),signal=controller.signal;
 const add=signal.addEventListener.bind(signal),remove=signal.removeEventListener.bind(signal);
 signal.addEventListener=(type,listener,options)=>{if(type==='abort')listeners.add(listener);add(type,listener,options);};
 signal.removeEventListener=(type,listener,options)=>{if(type==='abort')listeners.delete(listener);remove(type,listener,options);};
 return {controller,signal,listeners};
}
function environment(timer){return {console,AbortController:LegacyAbortController,AbortSignal:legacySignal,DOMException,setTimeout:timer.setTimeout,clearTimeout:timer.clearTimeout};}
const abortClock=clock(),abortContext={...environment(abortClock),exports:{}};
vm.runInNewContext(compile('app/abort-timeout.ts'),abortContext);
const abortApi=abortContext.exports;

async function behavior(label,helper,timer){
 const ok=parent();let child;
 assert.equal(await helper(ok.signal,7000,async signal=>{child=signal;assert.equal(signal.aborted,false);assert.equal(timer.timers.size,1);assert.equal(ok.listeners.size,1);return 'response and body';}),'response and body');
 assert.equal(timer.timers.size,0);assert.equal(ok.listeners.size,0);
 ok.controller.abort();assert.equal(child.aborted,false,'finished operation detached from its parent');

 const failure=parent(),networkError=new Error('network failed');
 await assert.rejects(helper(failure.signal,7000,async()=>{throw networkError;}),error=>error===networkError);
 assert.equal(timer.timers.size,0);assert.equal(failure.listeners.size,0);

 for(const reason of [new Error('newer request'),null]){
  const already=parent();already.controller.abort(reason);let started=false;
  await helper(already.signal,7000,async()=>{started=true;}).then(()=>assert.fail('must reject'),error=>assert.equal(error,reason));
  assert.equal(started,false);assert.equal(timer.timers.size,0);assert.equal(already.listeners.size,0);

  const cancelled=parent();
  const pending=helper(cancelled.signal,7000,signal=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true})));
  cancelled.controller.abort(reason);
  assert.equal(timer.timers.size,0,'parent cancellation clears deadline immediately');assert.equal(cancelled.listeners.size,0);
  await pending.then(()=>assert.fail('must reject'),error=>assert.equal(error,reason));
 }

 const timeout=parent();
 const pending=helper(timeout.signal,7000,signal=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true})));
 timer.fire();assert.equal(timeout.listeners.size,0,'deadline detaches parent immediately');
 await assert.rejects(pending,error=>error.name==='TimeoutError');
 assert.equal(timer.timers.size,0);assert.equal(timeout.signal.aborted,false,'timeout does not cancel unrelated parent work');
 assert.equal(await helper(undefined,7000,async()=>42),42);assert.equal(timer.timers.size,0);
 console.log('PASS: '+label+' without native any/timeout/throwIfAborted — success, failure, timeout, pre-aborted and mid-flight cancellation, reason identity, null reason, cleanup');
}
await behavior('app request helper',abortApi.withAbortTimeout,abortClock);
assert.throws(()=>abortApi.throwIfAborted({aborted:true}),error=>error.name==='AbortError','legacy signal without a reason gets AbortError');
abortApi.throwIfAborted({aborted:false});

// Exercise the actual precipitation requests, including a timeout during body consumption.
const catalogParent=parent(),catalogApi={},catalogRequests=[];
let stalledBody=false,bodyStarted;
const bodyEntered=new Promise(resolve=>{bodyStarted=resolve;});
const catalogContext={...environment(abortClock),exports:catalogApi,require:name=>{assert.equal(name,'./abort-timeout');return abortApi;},document:{documentElement:{dataset:{weatherStandalone:'true'}}},window:{location:{hostname:'weather.ezclickgo.com'}},createImageBitmap:async blob=>({blob}),fetch:async(url,{signal})=>{
 catalogRequests.push({url,signal});
 return {ok:true,json:()=>stalledBody?new Promise((_,reject)=>{bodyStarted();signal.addEventListener('abort',()=>reject(signal.reason),{once:true});}):Promise.resolve({frames:[{time:123,url:'/mask/1234567890123.png'}]}),blob:async()=>({image:true})};
}};
vm.runInNewContext(compile('app/precip-types.ts'),catalogContext);
const frames=await catalogApi.typeCatalog(catalogParent.signal);
assert.equal(frames.length,1);assert.equal(catalogRequests[0].url,'/weather-types/frames');
assert.equal((await catalogApi.typeMask(frames[0],catalogParent.signal)).blob.image,true);
assert.equal(catalogParent.listeners.size,0);assert.equal(abortClock.timers.size,0);
stalledBody=true;
const stalled=catalogApi.typeCatalog(catalogParent.signal);await bodyEntered;abortClock.fire();
assert.equal((await stalled).length,0);assert.equal(catalogRequests.at(-1).signal.reason.name,'TimeoutError');
assert.equal(catalogParent.listeners.size,0);assert.equal(abortClock.timers.size,0);
console.log('PASS: actual precipitation catalog/mask work without native methods; a stalled response body still times out');

// The recorder is served by the voice backend separately from the Vite bundle.
const voiceClock=clock(),elements=new Map(),voiceRequests=[];
const element=id=>{if(!elements.has(id))elements.set(id,{classList:{toggle(){}},append(){},pause(){},removeAttribute(){},style:{},textContent:'',disabled:false});return elements.get(id);};
const voiceContext={...environment(voiceClock),URL,URLSearchParams,Blob,TextEncoder,Uint8Array,ArrayBuffer,DataView,cancelAnimationFrame(){},location:{search:'',origin:'https://weather.ezclickgo.com'},crypto:{randomUUID:()=> 'test-session'},sessionStorage:{getItem:()=>null,setItem(){}},document:{getElementById:element,createElement:()=>element('bar'),addEventListener(){},documentElement:{classList:{add(){}}}},window:{addEventListener(){}},fetch:async(url,options)=>{voiceRequests.push({url,signal:options.signal});return {ok:true,json:async()=>url==='./status'?{ready:true,assistantVersion:11}:{text:'Forecast checked.'}};}};
vm.createContext(voiceContext);
await vm.runInContext('(async()=>{'+read('deploy/voice-trial/trial.js')+';globalThis.qa={withAbortTimeout,cancel,state:()=>({ready,feedbackFailed,retryAudio,pending,hasBlob:!!blob}),queueFeedback,feedbackDone:()=>feedbackQueue,answerFacts,prepareAnswer:()=>{answerTurn="test-turn";},prepareRecording:(language="en")=>{blob=new Blob(["test recording"],{type:"audio/wav"});uiLanguage=language;},allowRetry:()=>{cooldownUntil=0;}};})()',voiceContext);
assert.equal(voiceContext.qa.state().ready,true,'initial status enables microphone instead of failing on missing timeout');
assert.equal(element('record').disabled,false);assert.equal(voiceClock.timers.size,0);
voiceContext.qa.queueFeedback({turn:'test-turn',status:'succeeded',message:'QA'});await voiceContext.qa.feedbackDone();
assert.equal(voiceContext.qa.state().feedbackFailed,false);
voiceContext.qa.prepareAnswer();await voiceContext.qa.answerFacts({turn:'test-turn',facts:'Forecast checked.'});
assert.deepEqual(voiceRequests.map(item=>item.url),['./status','./feedback','./answer']);
assert.equal(voiceClock.timers.size,0);
await behavior('standalone recorder helper',voiceContext.qa.withAbortTimeout,voiceClock);
assert.deepEqual(Object.keys(legacySignal),[],'no global AbortSignal polyfill was installed');
console.log('PASS: actual recorder status, feedback, answer requests work without native AbortSignal methods');

let interpretCalls=0,interpretSignal,uploadedBlob,interpretBodyStarted;
const interpretBodyEntered=new Promise(resolve=>{interpretBodyStarted=resolve;});
voiceContext.fetch=async(url,options)=>{
 assert.equal(url,'./interpret');interpretCalls++;interpretSignal=options.signal;uploadedBlob=options.body;
 return {ok:true,json:()=>new Promise((_,reject)=>{interpretBodyStarted();options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});})};
};
voiceContext.qa.prepareRecording();
const sending=element('send').onclick();await interpretBodyEntered;
assert.equal([...voiceClock.timers.values()][0].ms,90000,'allow server 45s transcription + 30s interpretation and network margin');
voiceClock.fire();await sending;
assert.equal(interpretSignal.reason.name,'TimeoutError');assert.equal(interpretCalls,1,'no automatic resend after timeout');
assert.equal(voiceContext.qa.state().pending,false);assert.equal(voiceContext.qa.state().retryAudio,true);assert.equal(voiceContext.qa.state().hasBlob,true);
assert.match(element('status').textContent,/Check your connection and retry.*Recording saved/);
voiceContext.fetch=async(url,options)=>{assert.equal(url,'./interpret');interpretCalls++;assert.equal(options.body,uploadedBlob,'manual retry reuses the recording');return {ok:true,json:async()=>({turn:'retried-turn',draft:{intent:'conversation',reply:'Ready.'}})};};
voiceContext.qa.allowRetry();await element('record').onclick();
assert.equal(interpretCalls,2);assert.equal(voiceContext.qa.state().retryAudio,false);assert.equal(voiceContext.qa.state().pending,false);assert.equal(voiceClock.timers.size,0);

let cancelRequestStarted;
const cancelRequestEntered=new Promise(resolve=>{cancelRequestStarted=resolve;});
voiceContext.fetch=(url,options)=>new Promise((_,reject)=>{assert.equal(url,'./interpret');interpretSignal=options.signal;cancelRequestStarted();options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});});
voiceContext.qa.prepareRecording();const cancelledSend=element('send').onclick();await cancelRequestEntered;voiceContext.qa.cancel();await cancelledSend;
assert.equal(interpretSignal.aborted,true);assert.equal(voiceContext.qa.state().retryAudio,false);assert.equal(voiceContext.qa.state().hasBlob,false);assert.equal(voiceClock.timers.size,0);

voiceContext.fetch=async()=>{throw new TypeError('Failed to fetch');};
voiceContext.qa.prepareRecording('ru');await element('send').onclick();
assert.equal(voiceContext.qa.state().retryAudio,true);assert.equal(voiceContext.qa.state().hasBlob,true);assert.match(element('status').textContent,/Проверьте интернет.*Запись сохранена/);
voiceContext.qa.cancel();assert.equal(voiceClock.timers.size,0);
console.log('PASS: actual interpretation has a 90s body deadline, keeps audio for manual retry, never resends automatically, honors Cancel, and explains an offline failure in Russian');
