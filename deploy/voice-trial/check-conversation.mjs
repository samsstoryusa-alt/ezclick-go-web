import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {makeServer} from './server.mjs';
import {dailyBudget} from './daily-budget.mjs';
function wav(){const b=Buffer.alloc(32044);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(32000,40);return b;}
const draft={intent:'conversation',origin:null,destination:null,departure_phrase:null,clarification:null,city:null,topic:null,action:null,reply:'Да, помню ваш маршрут. Что хотите уточнить?'};
test('persistent daily budget survives reload, resets at New York midnight',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'voice-budget-'));try{
 const file=join(dir,'usage.json'),before=Date.parse('2026-10-06T03:59:59Z');
 let budget=dailyBudget(file);for(let i=0;i<20;i++)assert(budget.reserve(before));assert.equal(budget.reserve(before),false);
 budget=dailyBudget(file);assert.equal(budget.status(before).requestsUsed,20);assert.equal(budget.reserve(before),false);
 assert(budget.reserve(Date.parse('2026-10-06T04:00:00Z')));assert.equal(budget.status(Date.parse('2026-10-06T04:00:00Z')).requestsUsed,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('20 utterances, 21st blocked before API, next day available; answers remember context',async()=>{
 let clock=Date.parse('2026-10-05T14:00:00Z'),paid=0;const payloads=[];
 const server=makeServer({key:'test',enabled:true,now:()=>clock,request:async(url,options)=>{paid++;if(url.endsWith('transcriptions'))return Response.json({text:'Сегодня в десять вечера'});payloads.push(JSON.parse(options.body));return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(draft)}}]});}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const post=()=>fetch(base+'/interpret',{method:'POST',headers:{Origin:base,'X-Voice-Trial':'1','X-Voice-Session':'00000000-0000-4000-8000-000000000001','X-Voice-Timezone':'America/New_York','Content-Type':'audio/wav'},body:wav()});
 try{for(let i=0;i<20;i++){const r=await post();assert.equal(r.status,200);assert.equal((await r.json()).draft.reply,draft.reply);clock+=11000;}
 assert.equal(JSON.parse(payloads[1].messages[1].content).conversation[1].content,draft.reply);
 assert.match(JSON.parse(payloads[0].messages[1].content).local_time,/2026-10-05 10:00/);
 clock+=60000;const blocked=await post();assert.equal((await blocked.json()).code,'daily_limit');assert.equal(paid,40);
 clock+=86400000;assert.equal((await post()).status,200);
 }finally{await new Promise(r=>server.close(r));}
});
test('weather prose uses facts and original question, one paid followup only',async()=>{
 let paid=0,answerPayload;const server=makeServer({key:'test',enabled:true,request:async(url,options)=>{paid++;if(url.endsWith('transcriptions'))return Response.json({text:'Что по дождю впереди?'});const body=JSON.parse(options.body);if(!body.response_format){answerPayload=body;return Response.json({choices:[{finish_reason:'stop',message:{content:'В конце пути ожидается дождь.'}}]});}return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({...draft,intent:'weather',topic:'rain'})}}]});}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const post=(path,body,type)=>fetch(base+path,{method:'POST',headers:{Origin:base,'X-Voice-Trial':'1','X-Voice-Session':'00000000-0000-4000-8000-000000000001','Content-Type':type},body});
 try{const result=await(await post('/interpret',wav(),'audio/wav')).json();assert(result.turn);
 const body=JSON.stringify({turn:result.turn,facts:'В конце пути дождь, прогноз свежий.'});
 assert.equal((await post('/answer',body,'application/json')).status,200);
 assert.equal((await post('/answer',body,'application/json')).status,409);assert.equal(paid,3);
 const input=JSON.parse(answerPayload.messages[1].content);assert.equal(input.question,'Что по дождю впереди?');assert.match(input.application_facts,/дождь/);
 assert.equal((await(await fetch(base+'/status')).json()).requestsUsed,1);
 }finally{await new Promise(r=>server.close(r));}
});
