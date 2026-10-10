import test from 'node:test';
import assert from 'node:assert/strict';
import {schema,validateDraft,readRouteContext,interpret} from './server.mjs';
const draft={intent:'trip',origin:'Charlotte, North Carolina',destination:'Houston, Texas',departure_phrase:null,departure_mode:'keep',clarification:null,route_mode:'update',via_mode:'add',via:['Columbia, South Carolina'],response_language:'ru'};
const context={origin:draft.origin,destination:draft.destination,departure:'2099-10-10T15:00:00Z',vehicle:'truck',status:'built',supports_via:true,via:[]};
test('typed via contract rejects malformed or contradictory commands',()=>{
 assert.deepEqual(validateDraft(draft),draft);
 for(const patch of [{via:['']},{via:Array(6).fill('Columbia')},{via:[{name:'Columbia'}]},{via_mode:'clear'},{intent:'weather',topic:'rain'},{via_mode:null},{route_mode:'delete'}])assert.throws(()=>validateDraft({...draft,...patch}));
 assert.equal(schema.properties.via.maxItems,5);
 assert.deepEqual(readRouteContext(Buffer.from(JSON.stringify(context)).toString('base64')),context);
 assert.throws(()=>readRouteContext(Buffer.from(JSON.stringify({...context,supports_via:'yes'})).toString('base64')));
});
test('actual adapter passes via draft, capabilities and application feedback through unchanged',async()=>{
 let payload;
 const request=async(url,options)=>{
  if(url.endsWith('/transcriptions'))return Response.json({text:'Перестрой через Коламбию, Южная Каролина'});
  payload=JSON.parse(options.body);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(draft)}}]});
 };
 const result=await interpret(Buffer.from('test'),'audio/wav','test',request,null,context,[{role:'application',status:'clarification',content:'Which state?'}]);
 assert.deepEqual(result.draft.via,draft.via);
 const data=JSON.parse(payload.messages[1].content);
 assert.deepEqual(data.current_trip,context);assert.equal(data.conversation[0].status,'clarification');
 assert.match(payload.messages[0].content,/supports via waypoints/);
});
test('older client cannot receive an unsupported waypoint mutation even if model emits one',async()=>{
 const request=async(url)=>url.endsWith('/transcriptions')?Response.json({text:'via Columbia'}):Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(draft)}}]});
 await assert.rejects(()=>interpret(Buffer.from('test'),'audio/wav','test',request,null,{...context,supports_via:false}),e=>e.code==='draft');
});
