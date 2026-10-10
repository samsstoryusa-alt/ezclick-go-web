const $=id=>document.getElementById(id);
const bars=Array.from({length:13},()=>{const bar=document.createElement('i');$('meter').append(bar);return bar;});
let startRequested=false;
let ready=false,stream,recorder,context,frame,timer,blob,url,version=0,recording=false,pending=false,request;
const reveal=(id,show)=>{$(id).classList.toggle('open',show);$(id).inert=!show;};
const post=data=>{if(new URLSearchParams(location.search).get('embedded')==='1')parent.postMessage(data,location.origin);};
let uiLanguage='en',uiLabels={},responseLanguage='en',voiceLabels={},lastStatus='',lastStatusValues={};
const ui=key=>uiLabels[key]??key;
const voice=(key,values={})=>(voiceLabels[key]??uiLabels[key]??key).replace(/\{(\w+)\}/g,(match,name)=>Object.hasOwn(values,name)?String(values[name]):match);
const status=(text,values={})=>{lastStatus=text;lastStatusValues=values;$('status').textContent=voice(text,values);$('status').dir=['ar','fa','he','ur'].includes(responseLanguage)?'rtl':'ltr';$('status').lang=responseLanguage;};
const errorMessage=code=>({speech:'No speech was recognized. Please try recording again.',draft:'Could not understand the request. Please say it another way.',rate:'The assistant is busy. Please try again shortly.',busy:'The assistant is busy. Please try again shortly.',timeout:'No response from the server. Check your connection and retry.',network:'No response from the server. Check your connection and retry.',configuration:'Voice assistant is unavailable. Please try again later.',quota:'Voice assistant is unavailable. Please try again later.',key:'Voice assistant is unavailable. Please try again later.',permission:'Voice assistant is unavailable. Please try again later.',model:'Voice assistant is unavailable. Please try again later.',provider:'Voice assistant is unavailable. Please try again later.'}[code]??'Could not process your request. Please try again.');
const phase=value=>post({type:'voice-ui-state',phase:value});
// A tab owns its dialogue. The server owns the account/pilot budget.
const sessionId=(()=>{try{let id=sessionStorage.getItem('weather-voice-session');if(!id){id=crypto.randomUUID();sessionStorage.setItem('weather-voice-session',id);}return id;}catch{return crypto.randomUUID();}})();
const apiHeaders={'X-Voice-Trial':'1','X-Voice-Session':sessionId};
// This separately served recorder cannot import the bundled app helper.
async function withAbortTimeout(parent,timeoutMs,run){
 const controller=new AbortController();
 let deadline;
 const cleanup=()=>{if(deadline!==undefined){clearTimeout(deadline);deadline=undefined;}parent?.removeEventListener('abort',cancel);};
 const cancel=()=>{cleanup();controller.abort(parent?.reason);};
 if(parent?.aborted)cancel();else parent?.addEventListener('abort',cancel,{once:true});
 if(!controller.signal.aborted)deadline=setTimeout(()=>{cleanup();controller.abort(new DOMException('The operation timed out.','TimeoutError'));},timeoutMs);
 try{if(controller.signal.aborted)throw controller.signal.reason===undefined?new DOMException('The operation was aborted.','AbortError'):controller.signal.reason;return await run(controller.signal);}
 finally{cleanup();}
}
let currentTurn=null,feedbackQueue=Promise.resolve(),feedbackFailed=false;
function queueFeedback(data){
 if(typeof data.turn!=='string')return;
 feedbackQueue=feedbackQueue.then(async()=>{
  for(let attempt=0;attempt<10;attempt++){
   const {response,result}=await withAbortTimeout(null,10000,async signal=>{const response=await fetch('./feedback',{method:'POST',headers:{...apiHeaders,'Content-Type':'application/json'},body:JSON.stringify({turn:data.turn,status:data.status,message:String(data.message||'').slice(0,2000)}),signal});return {response,result:response.ok?null:await response.json()};});
   if(response.ok)return;
   if(response.status===409&&result.code==='stale_turn')return;
   if(response.status!==409||result.code!=='busy')throw Error('Feedback unavailable');
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw Error('Feedback still busy');
 }).catch(()=>{feedbackFailed=true;});
}
let answerTurn=null,answerInFlight=false;
async function answerFacts(data){
 if(!answerTurn||data.turn!==answerTurn||answerInFlight||typeof data.facts!=='string')return;
 const turn=answerTurn;answerTurn=null;answerInFlight=true;const token=version;
 const controller=new AbortController();request=controller;
 try{
  await feedbackQueue;if(token!==version)return;const {response,result}=await withAbortTimeout(controller.signal,35000,async signal=>{const response=await fetch('./answer',{method:'POST',headers:{'Content-Type':'application/json',...apiHeaders},body:JSON.stringify({turn,facts:data.facts.slice(0,12000)}),signal});return {response,result:await response.json()};});
  if(token!==version)return;
  if(!response.ok)throw Error();
  post({type:'voice-ui-answer',text:result.text,sad:false,contextual:true});phase('neutral');
 }catch{if(token===version)post({type:'voice-ui-answer',text:voice('Could not prepare the reply. Check the forecast on the map and try again.'),sad:true,contextual:true});}
 finally{answerInFlight=false;}
}
const embedded=new URLSearchParams(location.search).get('embedded')==='1';
if(embedded){document.documentElement.classList.add('is-embedded');window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent)return;if(event.data?.type==='voice-feedback')queueFeedback(event.data);if(event.data?.type==='voice-facts')void answerFacts(event.data);if(event.data?.type==='voice-layout')document.documentElement.classList.toggle('is-condensed',event.data.compact===true);if(event.data?.type==='voice-language'){uiLanguage=event.data.language;uiLabels=event.data.labels??{};responseLanguage=/^[a-z]{2}$/.test(event.data.responseLanguage)?event.data.responseLanguage:uiLanguage;voiceLabels=event.data.voiceLabels??uiLabels;document.documentElement.lang=uiLanguage;document.documentElement.dir=event.data.dir==='rtl'?'rtl':'ltr';$('record').textContent=ui(recording?'Done':'Start recording');$('cancel').textContent=ui('Cancel');status(lastStatus,lastStatusValues);if(retryAudio)updateCooldown(false);if(quotaStopped)showQuota(true);}if(event.data?.type==='voice-start'){startRequested=true;if(ready&&!recording&&!pending){startRequested=false;void begin();}}if(event.data?.type==='voice-open'){if(quotaStopped)showQuota(true);void refreshQuota();}if(event.data?.type==='voice-close')cancel(false);if(event.data?.type==='voice-context-stale'){if(quotaStopped){showQuota(true);return;}reveal('result',false);status('The route changed. Please repeat your request.');}if(event.data?.type==='voice-answer-ready'){if(quotaStopped)showQuota(true);else status('Ask another question.');}});}
async function routeContextHeader(){
 if(!embedded)return {};
 const id=crypto.randomUUID();
 const route=await new Promise((resolve,reject)=>{
  const receive=event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='voice-route-context'||event.data.id!==id)return;clearTimeout(timeout);window.removeEventListener('message',receive);resolve(event.data.context);};
  const timeout=setTimeout(()=>{window.removeEventListener('message',receive);reject(Error('The route changed. Please repeat your request.'));},2000);
  window.addEventListener('message',receive);parent.postMessage({type:'voice-route-context-request',id},location.origin);
 });
 const bytes=new TextEncoder().encode(JSON.stringify(route));
 return {'X-Voice-Timezone':Intl.DateTimeFormat().resolvedOptions().timeZone,'X-Voice-Route':btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''))};
}
async function asWav(recorded){
 const decoder=new AudioContext();
 try{
  const decoded=await decoder.decodeAudioData(await recorded.arrayBuffer());
  const length=Math.min(320000,Math.ceil(decoded.duration*16000));
  const offline=new OfflineAudioContext(1,length,16000);const source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
  const samples=(await offline.startRendering()).getChannelData(0);
  const bytes=new ArrayBuffer(44+samples.length*2),view=new DataView(bytes);
  const tag=(at,text)=>{for(let i=0;i<text.length;i++)view.setUint8(at+i,text.charCodeAt(i));};
  tag(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);tag(8,'WAVE');tag(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);tag(36,'data');view.setUint32(40,samples.length*2,true);
  samples.forEach((sample,i)=>{const value=Math.max(-1,Math.min(1,sample));view.setInt16(44+i*2,value*(value<0?32768:32767),true);});
  return new Blob([bytes],{type:'audio/wav'});
 }finally{await decoder.close();}
}
let retryAudio=false,retryNotice='',cooldownUntil=0,cooldownTimer,quotaStopped=false,quotaCode='daily_limit',quotaDay='',quotaRefreshing=false;
const quotaCalendar=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
function stopForQuota(code){quotaStopped=true;quotaCode=code==='global_limit'?'global_limit':'daily_limit';quotaDay=quotaCalendar.format(new Date());}
async function refreshQuota(){
 if(!quotaStopped||quotaRefreshing||quotaDay===quotaCalendar.format(new Date()))return;
 quotaRefreshing=true;
 try{
  const result=await withAbortTimeout(null,5000,async signal=>{const response=await fetch('./status',{signal});if(!response.ok)throw Error('Server unavailable');return response.json();});
  if(result.ready!==true||!Number.isInteger(result.assistantVersion)||result.assistantVersion<8||(result.dailyLimit!==20&&result.dailyLimit!==null)||!Number.isInteger(result.requestsUsed)||result.requestsUsed<0)return;
  if(result.dailyLimit===20&&result.requestsUsed>=result.dailyLimit){stopForQuota('daily_limit');showQuota(true);return;}
  quotaStopped=false;quotaDay='';ready=true;idle();$('send').disabled=!blob;
  status('Tap to turn on the microphone.');post({type:'voice-quota-reset'});
 }catch{/* Keep the last confirmed limit until status can be checked. */}
 finally{quotaRefreshing=false;}
}
function quotaMessage(){
 const key=quotaCode==='global_limit'?'The shared daily voice allowance is used up. It resets at midnight in New York.':"All 20 voice requests for today are used up. I'm taking a pit stop ☕ See you tomorrow! The limit resets at midnight in New York. The map and forecasts still work.";
 return voice(key);
}
function showQuota(notify=false){
 const text=quotaMessage();status(text);$('record').disabled=true;$('send').disabled=true;
 if(notify)post({type:'voice-ui-answer',text,sad:false});
}
function updateCooldown(notify=true){
 if(!retryAudio)return;
 const seconds=Math.max(0,Math.ceil((cooldownUntil-Date.now())/1000));
 const retryText=voice(seconds?'Recording saved. You can retry in {seconds} s.':'Recording saved. Tap “Send recording” — no need to record again.',{seconds});
 const text=retryNotice?voice(retryNotice)+' '+retryText:retryText;
 status(text);$('record').disabled=seconds>0;$('send').disabled=seconds>0||!ready;
 $('record').textContent=seconds?voice('Wait {seconds} s',{seconds}):voice('Send recording');
 if(notify)post({type:'voice-ui-answer',text,sad:false});
}
function startCooldown(seconds,notice=''){
 clearTimeout(cooldownTimer);retryAudio=true;retryNotice=notice;cooldownUntil=Date.now()+Math.max(1,Math.min(120,seconds))*1000;
 function tick(){if(!retryAudio)return;updateCooldown();if(Date.now()<cooldownUntil)cooldownTimer=setTimeout(tick,1000);}tick();
}
function release(){window.CustomEvent&&window.dispatchEvent(new window.CustomEvent('voice-wave-level',{detail:0}));clearTimeout(timer);cancelAnimationFrame(frame);stream?.getTracks().forEach(track=>track.stop());stream=null;if(context){void context.close();context=null;}bars.forEach(bar=>bar.style.transform='scaleY(.12)');}
function discard(){clearTimeout(cooldownTimer);retryAudio=false;retryNotice='';cooldownUntil=0;if(url)URL.revokeObjectURL(url);url=null;blob=null;$('audio').pause();$('audio').removeAttribute('src');reveal('playback',false);reveal('result',false);$('send').disabled=true;}
function idle(){recording=false;pending=false;$('record').classList.toggle('is-recording',false);$('record').disabled=quotaStopped;$('record').textContent=ui('Start recording');$('cancel').disabled=!blob;}
function cancel(notify=true){startRequested=false;if(notify)post({type:'voice-cancel',turn:currentTurn});answerTurn=null;version++;request?.abort();if(recorder?.state==='recording')recorder.stop();release();discard();idle();phase('neutral');if(quotaStopped)showQuota(notify);else status('Recording cancelled.');}
async function begin(){
 if(quotaStopped||pending)return;
 if(retryAudio){if(Date.now()>=cooldownUntil)await $('send').onclick();return;}
 if(recording){recorder.stop();return;}
 request?.abort();answerTurn=null;discard();pending=true;$('record').disabled=true;$('cancel').disabled=false;const token=++version;
 status('Allow microphone access…');
 try{
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Unsupported');
  const acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
  if(token!==version){acquired.getTracks().forEach(t=>t.stop());return;}
  stream=acquired;context=new AudioContext();await context.resume();
  if(token!==version)return;
  const analyser=context.createAnalyser();analyser.fftSize=256;context.createMediaStreamSource(stream).connect(analyser);
  const data=new Uint8Array(analyser.frequencyBinCount);
  const startedAt=performance.now();let shownSecond=-1;function tick(){const second=Math.floor((performance.now()-startedAt)/1000);if(recording&&second!==shownSecond){shownSecond=second;status(voice('Listening')+' · 0:'+String(second).padStart(2,'0')+' / 0:20');}analyser.getByteFrequencyData(data);let power=0;for(const value of data)power+=value*value;const level=Math.min(1,Math.pow(Math.max(0,Math.sqrt(power/data.length)/255-.025)*3,.7));window.CustomEvent&&window.dispatchEvent(new window.CustomEvent('voice-wave-level',{detail:level}));bars.forEach((bar,i)=>{const level=data[2+i*3]/255;bar.style.transform=`scaleY(${.12+level*.88})`;});frame=requestAnimationFrame(tick);}tick();
  const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));
  recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);const chunks=[];
  recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
  recorder.onerror=()=>{if(token===version){cancel();status('Recording failed. Please try again.');}};
  recorder.onstop=async()=>{
   if(token!==version)return;
   const recorded=new Blob(chunks,{type:recorder.mimeType});release();recording=false;pending=true;$('record').disabled=true;status('Preparing recording…');
   try{const prepared=await asWav(recorded);if(token!==version)return;blob=prepared;}catch{if(token===version){idle();status('Could not prepare the recording. Please try again.');}return;}
   idle();
   if(blob.size<100){status('The recording is empty. Please try again.');return;}
   url=URL.createObjectURL(blob);$('audio').src=url;reveal('playback',true);$('send').disabled=!ready;
   status(ready?'Recording ready. You can listen or send it.':'Voice assistant is unavailable. Please try again later.');if(embedded&&ready)$('send').click();
  };
  recorder.start();pending=false;recording=true;$('record').classList.toggle('is-recording',true);$('record').disabled=false;$('record').textContent=ui('Done');phase('listening');status('Listening · up to 20 seconds');timer=setTimeout(()=>{if(recorder?.state==='recording')recorder.stop();},20000);
 }catch(error){if(token!==version)return;release();idle();phase('sad');status(error.name==='NotAllowedError'?'Microphone access is blocked. Allow it in your browser settings.':'Microphone is unavailable. Check your browser and input device.');}
}
$('record').onclick=begin;$('cancel').onclick=()=>cancel();
$('send').onclick=async()=>{
 if(!ready||!blob||pending||quotaStopped||Date.now()<cooldownUntil)return;
 clearTimeout(cooldownTimer);retryAudio=false;retryNotice='';
 post({type:'voice-ui-audio',audio:blob});phase('thinking');const token=++version;pending=true;request=new AbortController();$('send').disabled=true;$('record').disabled=true;reveal('result',false);status('Recognizing your request…');
 try{await feedbackQueue;if(feedbackFailed){feedbackFailed=false;throw Error('Could not save the clarification. Please repeat the full request.');}const routeHeaders=await routeContextHeader();if(token!==version)return;const {response,result}=await withAbortTimeout(request.signal,90000,async signal=>{const response=await fetch('./interpret',{method:'POST',headers:{'Content-Type':blob.type,...apiHeaders,...routeHeaders},body:blob,signal});return {response,result:await response.json()};});if(token!==version)return;if(!response.ok){
 if(response.status===429){
  if(['daily_limit','global_limit'].includes(result.code)||/20 записей|Лимит теста/.test(result.error||'')){
  clearTimeout(cooldownTimer);retryAudio=false;cooldownUntil=0;stopForQuota(result.code);
  throw Error(quotaMessage());
 }
  startCooldown(Number(response.headers?.get('Retry-After'))||60);return;
 }
 throw Error(errorMessage(result.code));
}currentTurn=result.turn;post({type:'voice-turn',turn:currentTurn,responseLanguage:result.response_language??result.draft.response_language});answerTurn=(['weather','help'].includes(result.draft.intent)||result.draft.after_build_topic)?result.turn:null;if(['conversation','off_topic'].includes(result.draft.intent)){const text=result.draft.reply||result.draft.clarification||'';status(text);post({type:'voice-ui-answer',text,sad:false});return;}if(['weather','help','control'].includes(result.draft.intent)){status(embedded?'Checking…':'Open the assistant from the weather map.');if(embedded)parent.postMessage({type:'voice-assistant-command',draft:result.draft,turn:result.turn},location.origin);return;}$('transcript').textContent=result.text;for(const key of ['origin','destination'])$(key).textContent=result.draft[key]||'Нужно уточнить';$('departure').textContent=result.draft.departure_phrase||'Нужно уточнить';$('question').textContent=result.draft.clarification||'Проверьте, правильно ли распознаны города и время.';reveal('result',true);status('Route draft ready.');if(embedded)parent.postMessage({type:'voice-trip-draft',draft:result.draft,turn:result.turn},location.origin);}
 catch(error){if(token===version&&error.name!=='AbortError'){if(error.name==='TimeoutError'||error.name==='TypeError'){startCooldown(1,'No response from the server. Check your connection and retry.');return;}const key=quotaStopped?quotaMessage():(Object.hasOwn(voiceLabels,error.message)||Object.hasOwn(uiLabels,error.message)?error.message:'Could not process your request. Please try again.');status(key);post({type:'voice-ui-answer',text:voice(key),sad:!quotaStopped});}}
 finally{if(token===version){idle();$('send').disabled=!ready||quotaStopped;if(retryAudio)updateCooldown(false);if(quotaStopped)$('record').disabled=true;}}
};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(recording||pending))cancel();else if(!document.hidden)void refreshQuota();});
window.addEventListener('focus',()=>void refreshQuota());
window.addEventListener('pageshow',()=>void refreshQuota());
window.addEventListener('pagehide',cancel);
try{const result=await withAbortTimeout(null,5000,async signal=>{const response=await fetch('./status',{signal});if(!response.ok)throw Error('Server unavailable');return response.json();});ready=result.ready&&result.assistantVersion>=8;if(result.ready&&!ready){status('Voice assistant is unavailable. Please try again later.');$('record').disabled=true;$('send').disabled=true;}else if(ready&&result.dailyLimit===20&&result.requestsUsed>=result.dailyLimit){stopForQuota('daily_limit');showQuota(true);}else status(ready?'Tap to turn on the microphone.':'Voice assistant is unavailable. Please try again later.');}catch{status('No response from the server. Check your connection and retry.');$('record').disabled=true;}


if(startRequested&&ready&&!recording&&!pending){startRequested=false;void begin();}
