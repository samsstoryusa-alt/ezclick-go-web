const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'trial.js'),'utf8');
async function check(){
 const messages=[],calls=[],elements=new Map();const el=()=>({append(){},classList:{toggle(){},add(){}},style:{},pause(){},removeAttribute(){},disabled:false});
 const document={getElementById(id){if(!elements.has(id))elements.set(id,el());return elements.get(id);},createElement:el,documentElement:{classList:{add(){}}},addEventListener(){}};
 const ctx={assert,document,location:{search:'?embedded=1',origin:'http://localhost'},parent:{postMessage:m=>messages.push(m)},window:{addEventListener(){}},URLSearchParams,URL,TextEncoder,Blob,AbortController,AbortSignal,clearTimeout,setTimeout,cancelAnimationFrame(){},crypto:require('node:crypto').webcrypto,sessionStorage:{getItem:()=>null,setItem(){}},fetch:async(url,options)=>{
  calls.push({url,options});return {ok:true,json:async()=>url==='./status'?{ready:true,assistantVersion:8}:url==='./answer'?{text:'По прогнозу дождь ближе к концу пути.'}:url==='./feedback'?{ok:true}:{turn:'test-turn',text:'Salgo ahora',draft:{intent:'trip',origin:'Nashville, Tennessee',destination:'Jacksonville, Florida',departure_mode:'now',clarification:null}}};
 },calls,messages};
 await vm.runInNewContext('(async()=>{'+source+`;routeContextHeader=async()=>({});queueFeedback({turn:'prior',status:'clarification',message:'Which state?'});blob=new Blob(['test'],{type:'audio/wav'});await $('send').onclick();assert(calls.findIndex(c=>c.url==='./feedback')<calls.findIndex(c=>c.url==='./interpret'));assert(messages.some(m=>m.type==='voice-trip-draft'&&m.draft.departure_mode==='now'&&m.turn==='test-turn'));assert(calls.filter(c=>c.options?.method).every(c=>!!c.options.headers['X-Voice-Session']));answerTurn='weather-turn';await answerFacts({turn:'weather-turn',facts:'Rain at destination.'});await answerFacts({turn:'weather-turn',facts:'Duplicate'});assert.equal(calls.filter(c=>c.url==='./answer').length,1);cancel();assert(messages.some(m=>m.type==='voice-cancel'&&m.turn==='test-turn'));})()`,ctx);
 console.log('PASS: session headers, feedback precedes next request, typed multilingual action dispatch, single final facts completion, explicit cancellation event. No paid calls.');
}
check().catch(e=>{console.error(e);process.exit(1);});
