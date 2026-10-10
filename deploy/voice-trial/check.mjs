import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeServer,interpret,validateDraft,validateAudio,checkedResponse,publicFailure,readRouteContext,loadAssistantRules} from './server.mjs';
test('current map route reaches model separately from pending voice draft',async()=>{
 const current={origin:'Jacksonville, Florida',destination:'Charleston, South Carolina',departure:'leave now',status:'built',vehicle:'car'};
 const encoded=Buffer.from(JSON.stringify(current)).toString('base64');
 assert.deepEqual(readRouteContext(encoded),current);
 assert.equal(readRouteContext(undefined),null);
 assert.equal(readRouteContext(Buffer.from('null').toString('base64')),null);
 for(const bad of [{...current,origin:123},{...current,origin:'x'.repeat(401)},{...current,key:'secret'},{...current,vehicle:'plane'},[]])assert.throws(()=>readRouteContext(Buffer.from(JSON.stringify(bad)).toString('base64')));
 let payload;
 const server=makeServer({key:'test',enabled:true,request:async(url,options)=>{
  if(url.endsWith('/transcriptions'))return Response.json({text:'А во сколько мне выехать, чтобы закончился дождь?'});
  payload=JSON.parse(options.body);
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({...draft,intent:'weather',topic:'compare',clarification:null,city:null,action:null})}}]});
 }});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const response=await fetch(base+'/interpret',{method:'POST',headers:{Origin:base,'X-Voice-Trial':'1','X-Voice-Session':'00000000-0000-4000-8000-000000000001','X-Voice-Route':encoded,'Content-Type':'audio/wav'},body:wav()});
  assert.equal(response.status,200);
  assert.equal((await response.json()).draft.topic,'compare');
  assert.deepEqual(JSON.parse(payload.messages[1].content).current_trip,current);
  assert.equal(JSON.parse(payload.messages[1].content).previous_draft,null);
  assert.match(payload.messages[0].content,/NOT a command to change departure/);
  assert.equal((await(await fetch(base+'/status')).json()).assistantVersion,14);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('provider failures are specific and never echo provider secrets',async()=>{
 for(const [status,providerCode,expected] of [[401,'invalid_api_key','key'],[429,'insufficient_quota','quota'],[429,'rate_limit_exceeded','rate'],[403,'denied','permission'],[400,'invalid_request','request']]){
  try{await checkedResponse(Response.json({error:{code:providerCode,message:'secret-value-must-not-escape'}},{status}),'transcription');assert.fail('Must reject');}catch(error){const safe=publicFailure(error);assert.equal(safe.code,expected);assert.equal(safe.stage,'transcription');assert.ok(!JSON.stringify(safe).includes('secret-value'));}
 }
});
const draft={intent:'trip',origin:'Nashville, Tennessee',destination:'Jacksonville, Florida',departure_phrase:'завтра',clarification:'Во сколько выезжаете?'};
test('weather and controls are validated and cannot invent actions',()=>{
 assert.equal(validateDraft({...draft,intent:'weather',topic:'rain',city:null,action:null}).intent,'weather');
 assert.throws(()=>validateDraft({...draft,intent:'control',action:'buy_subscription'}));
 assert.throws(()=>validateDraft({...draft,intent:'weather',topic:'nuclear_forecast'}));
});
test('weather query does not replace previous trip context',async()=>{
 let count=0;const contexts=[];
 const server=makeServer({key:'test',enabled:true,request:async(url,options)=>{
  if(url.endsWith('/transcriptions'))return Response.json({text:'test'});
  contexts.push(JSON.parse(options.body));count++;
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(count===2?{...draft,intent:'weather',origin:null,destination:null,topic:'wind',city:'Savannah'}:draft)}}]});
 }});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  for(let i=0;i<3;i++)assert.equal((await fetch(base+'/interpret',{method:'POST',headers:{Origin:base,'X-Voice-Trial':'1','X-Voice-Session':'00000000-0000-4000-8000-000000000001','Content-Type':'audio/wav'},body:wav()})).status,200);
  assert.deepEqual(JSON.parse(contexts[2].messages[1].content).previous_draft,draft);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
function wav(seconds=1){const buffer=Buffer.alloc(44+32000*seconds);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVE',8);buffer.write('fmt ',12);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(16000,24);buffer.writeUInt32LE(32000,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(buffer.length-44,40);return buffer;}
test('audio duration and format checked on server before paid calls',()=>{assert.equal(validateAudio(wav(20)).length,640044);assert.throws(()=>validateAudio(wav(21)));assert.throws(()=>validateAudio(Buffer.alloc(500)));const invalid=wav();invalid.writeUInt32LE(1,24);assert.throws(()=>validateAudio(invalid));});
test('draft rejects unexpected fields and invalid types',()=>{
 assert.deepEqual(validateDraft(draft),draft);
 for(const invalid of [null,[],{...draft,latitude:1},{...draft,origin:52},{...draft,clarification:'x'.repeat(601)}])assert.throws(()=>validateDraft(invalid));
});
test('trip context retained, off-topic cannot replace it, rate limit enforced',async()=>{
 const bodies=[];let count=0;
 const server=makeServer({key:'test',enabled:true,request:async(url,options)=>{
  if(url.endsWith('/transcriptions'))return Response.json({text:'test'});
  bodies.push(JSON.parse(options.body));count++;
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(count===2?{...draft,intent:'off_topic',origin:'wrong'}:draft)}}]});
 }});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const post=body=>fetch(base+'/interpret',{method:'POST',headers:{Origin:base,'X-Voice-Trial':'1','X-Voice-Session':'00000000-0000-4000-8000-000000000001','Content-Type':'audio/wav'},body});
 try{
  assert.equal((await post(wav(21))).status,413);assert.equal(count,0);
  assert.equal((await post(wav())).status,200);
  const off=await(await post(wav())).json();assert.equal(off.draft.intent,'off_topic');
  assert.equal((await post(wav())).status,200);
  assert.deepEqual(JSON.parse(bodies[2].messages[1].content).previous_draft,draft);
  for(let i=0;i<3;i++)assert.equal((await post(wav())).status,200);
  assert.equal((await post(wav())).status,200);assert.equal(count,7);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('real API adapter transcribes then extracts, with no stored completion',async()=>{
 const calls=[];
 const result=await interpret(new Uint8Array(120),'audio/webm','test-key',async(url,options)=>{
  calls.push({url,options});return Response.json(calls.length===1?{text:'Завтра из Нэшвилла в Джексонвилл'}:{choices:[{finish_reason:'stop',message:{content:JSON.stringify(draft)}}]});
 });
 assert.equal(calls.length,2);assert.equal(calls[0].options.body.get('model'),'gpt-4o-mini-transcribe');
 assert.equal(JSON.parse(calls[1].options.body).store,false);assert.deepEqual(result.draft,draft);
});
test('failed transcription never calls text model; no automatic retry',async()=>{
 let calls=0;await assert.rejects(interpret(new Uint8Array(120),'audio/mp4','test',async()=>{calls++;return new Response('',{status:429});}));assert.equal(calls,1);
});
test('refused or truncated completion does not produce a draft',async()=>{
 for(const choice of [{finish_reason:'length',message:{content:JSON.stringify(draft)}},{finish_reason:'stop',message:{refusal:'no'}}]){
  let calls=0;await assert.rejects(interpret(new Uint8Array(120),'audio/mp4','test',async()=>Response.json(++calls===1?{text:'test'}:{choices:[choice]})));
 }
});
test('unconfigured server rejects audio and makes zero external requests',async()=>{
 let calls=0;const server=makeServer({request:()=>{calls++;throw Error('Unexpected');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  assert.equal((await(await fetch(base+'/status')).json()).ready,false);
  assert.equal((await fetch(base+'/interpret',{method:'POST',headers:{Origin:base,'X-Voice-Trial':'1','X-Voice-Session':'00000000-0000-4000-8000-000000000001','Content-Type':'audio/webm'},body:'test'})).status,503);
  assert.equal((await fetch(base+'/interpret',{method:'POST',headers:{Origin:'https://other.test','X-Voice-Trial':'1','X-Voice-Session':'00000000-0000-4000-8000-000000000001'},body:'test'})).status,403);
  assert.equal(calls,0);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('rules reload between calls and invalid configuration fails closed',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'voice-rules-'));const path=join(folder,'rules.json');
 try{
  await writeFile(path,JSON.stringify({version:1,instructions:'first '.repeat(30)}));
  assert.match(await loadAssistantRules(path),/^first/);
  await writeFile(path,JSON.stringify({version:1,instructions:'updated '.repeat(30)}));
  assert.match(await loadAssistantRules(path),/^updated/);
  await writeFile(path,'{}');await assert.rejects(loadAssistantRules(path),error=>error.code==='configuration');
 }finally{await rm(folder,{recursive:true,force:true});}
});
test('road questions have explicit topics instead of unrelated-chat fallback',()=>{
 for(const topic of ['stops','parking','detour','road_conditions','closures','truck_safety','services','arrival'])assert.equal(validateDraft({...draft,intent:'weather',topic}).topic,topic);
});

test('typed language-independent fields reject malformed action data',()=>{
 assert.equal(validateDraft({...draft,departure_mode:'now',departure_date:null,departure_time:null,departure_timezone:null}).departure_mode,'now');
 assert.equal(validateDraft({...draft,departure_mode:'scheduled',departure_date:'2026-10-07',departure_time:'22:00',departure_timezone:'America/Chicago'}).departure_time,'22:00');
 for(const bad of [{departure_mode:'tomorrow'},{departure_time:'25:99'},{departure_date:'tomorrow'},{departure_timezone:'Mars/Base'},{departure_mode:'now',departure_time:'22:00'},{scope:'moon'},{after_build_topic:'buy'}])assert.throws(()=>validateDraft({...draft,...bad}));
 assert.equal(validateDraft({...draft,intent:'control',action:'cancel_pending'}).action,'cancel_pending');
});

test('session-scoped feedback becomes context, rejects stale turns and clears completed draft',async()=>{
 const contexts=[];let calls=0;
 const server=makeServer({key:'test',enabled:true,request:async(url,options)=>{
  calls++;if(url.endsWith('/transcriptions'))return Response.json({text:'yes'});
  contexts.push(JSON.parse(JSON.parse(options.body).messages[1].content));
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(draft)}}]});
 }});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const s1='00000000-0000-4000-8000-000000000001',s2='00000000-0000-4000-8000-000000000002';
 const headers=session=>({Origin:base,'X-Voice-Trial':'1','X-Voice-Session':session});
 const infer=async(session,route)=>{const response=await fetch(base+'/interpret',{method:'POST',headers:{...headers(session),'Content-Type':'audio/wav',...(route?{'X-Voice-Route':Buffer.from(JSON.stringify(route)).toString('base64')}:{})},body:wav()});assert.equal(response.status,200);return response.json();};
 const feedback=(session,turn,status,message='Which state?')=>fetch(base+'/feedback',{method:'POST',headers:{...headers(session),'Content-Type':'application/json'},body:JSON.stringify({turn,status,message})});
 try{
  assert.equal((await fetch(base+'/interpret',{method:'POST',headers:headers('bad'),body:wav()})).status,400);
  const first=await infer(s1);assert.match(first.turn,/^[0-9a-f-]{36}$/);
  assert.equal((await feedback(s2,first.turn,'clarification')).status,409);
  const before=calls;assert.equal((await feedback(s1,first.turn,'clarification')).status,200);assert.equal(calls,before);
  const second=await infer(s1);assert.ok(contexts[1].conversation.some(x=>x.status==='clarification'&&x.content==='Which state?'));
  assert.equal((await feedback(s1,first.turn,'cancelled')).status,409);
  await infer(s2);assert.equal(contexts[2].previous_draft,null);assert.deepEqual(contexts[2].conversation,[]);
  assert.equal((await feedback(s1,second.turn,'submitted','Building')).status,200);
  assert.equal((await feedback(s1,second.turn,'succeeded','Route built')).status,200);
  await infer(s1);assert.equal(contexts[3].previous_draft,null);assert.ok(contexts[3].conversation.some(x=>x.status==='succeeded'));
  const map={origin:'Denver, Colorado',destination:'Chicago, Illinois',departure:'leave now',status:'built',vehicle:'car'};
  await infer(s1,map);assert.equal(contexts[4].previous_draft,null);assert.ok(contexts[4].conversation.some(x=>x.status==='context_changed'));
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('compound weather answer remains eligible after successful build, consumed once',async()=>{
 let paid=0;
 const server=makeServer({key:'test',enabled:true,request:async(url,options)=>{
  paid++;if(url.endsWith('/transcriptions'))return Response.json({text:'Build and tell weather'});
  const payload=JSON.parse(options.body);
  return Response.json({choices:[{finish_reason:'stop',message:{content:payload.response_format?JSON.stringify({...draft,clarification:null,after_build_topic:'rain'}):'Rain is forecast near the destination.'}}]});
 }});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const headers={Origin:base,'X-Voice-Trial':'1','X-Voice-Session':'00000000-0000-4000-8000-000000000001'};
 const json=(path,body)=>fetch(base+path,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  const result=await(await fetch(base+'/interpret',{method:'POST',headers:{...headers,'Content-Type':'audio/wav'},body:wav()})).json();
  assert.equal((await json('/feedback',{turn:result.turn,status:'submitted',message:'Building'})).status,200);
  assert.equal((await json('/feedback',{turn:result.turn,status:'succeeded',message:'Built'})).status,200);
  assert.equal((await json('/answer',{turn:result.turn,facts:'Rain at destination'})).status,200);
  assert.equal((await json('/answer',{turn:result.turn,facts:'Rain at destination'})).status,409);
  assert.equal(paid,3);assert.equal((await(await fetch(base+'/status')).json()).requestsUsed,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
