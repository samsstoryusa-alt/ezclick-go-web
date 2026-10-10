import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const source=fs.readFileSync('app/weather-route.tsx','utf8');
const start=source.indexOf(' const acceptVoice=useEffectEvent(');
const end=source.indexOf('\n useEffect(',start);
assert(start>=0&&end>start);
const js=ts.transpileModule(source.slice(start,end)+'\nacceptVoice(input);',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function run({active=false,map={},busy=false,requestedVehicle}={}){
 const events=[],points=[],saved=[];let opened=0;const selected=[];
 const ctx={active,map,busy,useEffectEvent:fn=>fn,t:x=>x,voiceResult:(...args)=>events.push(args),voiceBuild:{current:null},truck:{},vehicle:'car',setVehicle:v=>selected.push(v),savePointLabel(){},saveTrip:x=>saved.push(x),departureZone:()=> 'America/New_York',window:{dispatchEvent(){}},Event,restoredBuild:{current:false},change:x=>points.push(x),setMobileChoices(){},setMobileEditing(){},setRouteSettings(){},setMobileStep(){},autoBuildStarted:{current:null},setAutoBuildPoints(){},setAutoWaiting(){},onShowInfo:()=>opened++,input:{turn:'test',origin:{point:[-86.78,36.16],label:'Nashville, TN'},destination:{point:[-81.65,30.33],label:'Jacksonville, FL'},departure:'',vehicle:requestedVehicle}};
 new Function(...Object.keys(ctx),js)(...Object.values(ctx));return{events,points,saved,opened,selected,build:ctx.voiceBuild.current};
}
const initial=run();assert.equal(initial.opened,1);assert.equal(initial.points.length,1);assert.equal(initial.saved[0].departure,'');assert.equal(initial.events.at(-1)[1],'submitted');
for(const state of [{map:null},{busy:true}]){const result=run(state);assert.equal(result.opened,0);assert.equal(result.points.length,0);assert.equal(result.events.at(-1)[1],'failed');}
console.log('PASS: closed Route panel accepts voice trip, opens panel and queues build; unavailable map and busy calculation still reject.');

const changed=run({requestedVehicle:"truck"});assert.deepEqual(changed.selected,["truck"]);assert.equal(JSON.parse(changed.build.key).vehicle,"truck");assert.deepEqual(run().selected,[]);

const vehicleChange=source.slice(source.indexOf(' if(previousVehicle!==vehicle){'),source.indexOf(' const tripKey='));
function switchVehicle(active,citiesOnly,points){let waiting=null,queued=null;const ctx={previousVehicle:'truck',vehicle:'car',active,citiesOnly,points,setPreviousVehicle(){},setAutoAttempt(){},setAutoBuildPoints:p=>queued=p,setAutoWaiting:w=>waiting=w};new Function(...Object.keys(ctx),vehicleChange)(...Object.values(ctx));return{waiting,queued};}
for(const state of [[false,false],[true,true]])assert.deepEqual(switchVehicle(...state,[[1,2],[3,4]]),{waiting:false,queued:null});
assert.equal(switchVehicle(true,false,[[1,2],[3,4]]).waiting,true);
console.log('PASS: vehicle changes cannot lock inactive or city-only panels.');
