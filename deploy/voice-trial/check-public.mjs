import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {makeServer,schema} from './server.mjs';import {publicBudget} from './public-budget.mjs';
const origin='https://weather.ezclickgo.com';
function wav(){const b=Buffer.alloc(364);b.write('RIFF');b.writeUInt32LE(356,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(320,40);return b;}
test('public browser limits isolate, persist, reject forgery and enforce global cap before paid calls',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'voice-beta-'));const file=join(dir,'usage.json');let calls=0;const clock=()=>Date.parse('2026-10-05T15:00:00Z');
 const server=makeServer({key:'test',enabled:true,publicOrigin:origin,publicUsageFile:file,globalLimit:21,now:clock,request:async url=>{calls++;if(url.endsWith('/transcriptions'))return Response.json({text:'hello'});const draft=Object.fromEntries(schema.required.map(k=>[k,null]));draft.intent='conversation';draft.reply='Hello';return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(draft)}}]});}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
 const a=await fetch(base+'/status'),b=await fetch(base+'/status');const ca=a.headers.get('set-cookie').split(';')[0],cb=b.headers.get('set-cookie').split(';')[0];assert.notEqual(ca,cb);assert.match(a.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
 const send=(cookie,from=origin)=>fetch(base+'/interpret',{method:'POST',headers:{Origin:from,Cookie:cookie,'X-Voice-Trial':'1','X-Voice-Session':'00000000-0000-4000-8000-000000000001','Content-Type':'audio/wav'},body:wav()});
 assert.equal((await send(ca,'https://evil.example')).status,403);assert.equal((await send('weather_voice='+'a'.repeat(48))).status,403);assert.equal(calls,0);
 for(let i=0;i<20;i++)assert.equal((await send(ca)).status,200);assert.equal((await (await send(ca)).json()).code,'daily_limit');assert.equal(calls,40);
 assert.equal((await send(cb)).status,200);assert.equal((await (await send(cb)).json()).code,'global_limit');assert.equal(calls,42);
 const restored=publicBudget(file,21);const id=restored.identify(ca,clock()).id;assert.equal(restored.status(id,clock()).requestsUsed,20);assert.equal(restored.status(id,clock()+86400000).requestsUsed,0);
 assert.equal((await fetch(base+'/?embedded=1')).status,200);
 }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});

test('trusted test access has no daily cap; public and forged access retain quotas',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'voice-unlimited-'));
 const token='test-only-credential-'.repeat(3);let calls=0;
 const server=makeServer({key:'test',enabled:true,publicOrigin:origin,globalLimit:0,publicUsageFile:join(dir,'usage.json'),testToken:token,request:async url=>{calls++;if(url.endsWith('/transcriptions'))return Response.json({text:'hello'});const draft=Object.fromEntries(schema.required.map(k=>[k,null]));draft.intent='conversation';draft.reply='Hello';return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(draft)}}]});}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  const status=async headers=>(await fetch(base+'/status',{headers})).json();
  assert.equal((await status({'X-Voice-Test-Token':token})).dailyLimit,null);
  assert.equal((await status({'X-Voice-Test-Token':'x'.repeat(token.length)})).dailyLimit,20);
  assert.equal((await status({})).dailyLimit,20);
  for(let i=0;i<22;i++){
   const r=await fetch(base+'/interpret',{method:'POST',headers:{Origin:origin,'X-Voice-Test-Token':token,'X-Voice-Trial':'1','X-Voice-Session':'00000000-0000-4000-8000-000000000002','Content-Type':'audio/wav'},body:wav()});
   assert.equal(r.status,200);
  }
  assert.equal(calls,44);
 }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
