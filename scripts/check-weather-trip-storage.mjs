import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const road=fs.readFileSync('app/road-route.ts','utf8');
const validCode=road.slice(road.indexOf('export function validTruck'),road.indexOf('export async function loadRoadRoute'));
const validExports={};new Function('exports',ts.transpileModule(validCode,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(validExports);
const waypointApi={};new Function('exports',ts.transpileModule(fs.readFileSync('app/route-waypoints.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(waypointApi);
const source=fs.readFileSync('app/weather-trip-storage.ts','utf8');
let data=null,blocked=false;
const storage={getItem:()=>{if(blocked)throw Error('blocked');return data;},setItem:(_,v)=>{if(blocked)throw Error('blocked');data=v;}};
const doc={documentElement:{dataset:{weatherStandalone:'true'}}};
const e={};new Function('exports','require','document','localStorage',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(e,n=>n==='./route-waypoints'?waypointApi:validExports,doc,storage);
assert.equal(e.readTrip(),null);
assert.deepEqual(e.defaultTripPoints(),[null,null]);
e.saveTrip({departure:''});assert.deepEqual(e.readTrip().points,[null,null]);
e.saveTrip({points:[[-80,35],[-81,30]],departure:'2026-10-05T18:30',stops:90});
assert.deepEqual(e.readTrip().points,[[-80,35],[-81,30]]);
assert.equal(e.readTrip().departure,new Date('2026-10-05T18:30').toISOString());
e.saveTrip({confirmed:false});assert.equal(e.readTrip().stops,90);
e.saveTrip({points:[null,null],builtKey:null});assert.deepEqual(e.readTrip().points,[null,null]);
data='{bad';assert.equal(e.readTrip(),null);
data=JSON.stringify({version:2,points:[null,null]});assert.equal(e.readTrip(),null);
data=JSON.stringify({version:1,points:[[0,999],null]});assert.equal(e.readTrip(),null);
data=JSON.stringify({version:1,points:[null,null],truck:{},confirmed:true,departure:'oops',stops:-3});assert.equal(e.readTrip().confirmed,false);assert.equal(e.readTrip().departure,'');assert.equal(e.readTrip().stops,0);
blocked=true;assert.doesNotThrow(()=>e.saveTrip({stops:30}));assert.equal(e.readTrip(),null);blocked=false;
doc.documentElement.dataset.weatherStandalone='false';const before=data;e.saveTrip({stops:200});assert.equal(data,before);assert.equal(e.readTrip(),null);
console.log('PASS: trip round trip, timing merge, explicit clear, corrupt/versioned data, invalid fields, unavailable storage, general-site isolation');

// An explicitly selected instant must survive a device timezone change.
const originalTZ=process.env.TZ;
try{
 doc.documentElement.dataset.weatherStandalone='true';
 process.env.TZ='America/New_York';
 data=JSON.stringify({version:1,points:[null,null],departure:'2026-10-05T18:30',stops:0});
 const migrated=e.readTrip();assert.equal(migrated.departure,'2026-10-05T22:30:00.000Z');
 process.env.TZ='America/Denver';
 assert.equal(e.readTrip().departure,migrated.departure);
 assert.equal(e.readTrip().departureZone,'America/New_York');
 e.saveTrip({departure:'2026-11-01T01:30:00-04:00',departureZone:'America/New_York'});
 assert.equal(e.readTrip().departure,'2026-11-01T05:30:00.000Z');
 e.saveTrip({departure:'2026-11-01T01:30:00-05:00'});
 assert.equal(e.readTrip().departure,'2026-11-01T06:30:00.000Z');
 assert.equal(e.normalizeDeparture('2026-03-08T03:30:00-04:00'),'2026-03-08T07:30:00.000Z');
 e.saveTrip({departure:''});assert.equal(e.readTrip().departure,'');
}finally{if(originalTZ===undefined)delete process.env.TZ;else process.env.TZ=originalTZ;}
console.log('PASS: legacy migration, timezone travel, DST repeated-hour instants, spring offset, leave-now mode');

const clock=Date.parse('2026-10-05T23:12:00Z');
assert.equal(e.currentDeparture('2026-10-05T17:45:00-04:00',clock),'');
assert.equal(e.currentDeparture('2026-10-05T23:12:00Z',clock),'');
assert.equal(e.currentDeparture('2026-10-06T08:00:00-04:00',clock),'2026-10-06T08:00:00-04:00');
assert.equal(e.currentDeparture('',clock),'');assert.equal(e.currentDeparture('bad',clock),'');
console.log('PASS: expired departure rolls to now, exact boundary, future plan preserved');

doc.documentElement.dataset.weatherStandalone='true';data=null;
e.saveTrip({points:[[-86.78,36.16],null]});e.savePointLabel([-86.78,36.16],'Nashville, Tennessee');
e.saveTrip({departure:''});assert.equal(e.readTrip().pointLabels[e.pointLabelKey([-86.78,36.16])],'Nashville, Tennessee');
assert.equal(e.readTrip().pointLabels[e.pointLabelKey([-86.79,36.16])],undefined);
for(let i=0;i<20;i++)e.savePointLabel([-80,i],'Place '+i);assert.equal(Object.keys(e.readTrip().pointLabels).length,12);
console.log('PASS: selected names persist, moved points do not reuse old names, label cache bounded');

data=null;e.saveTrip({points:[[-86,36],[-81,30]],via:[[-81.03,34]],departure:'2099-10-09T15:00:00Z',vehicle:'truck',stops:20});
e.saveTrip({builtKey:'via-route'});assert.deepEqual(e.readTrip().via,[[-81.03,34]]);assert.equal(e.readTrip().stops,20);
e.saveTrip({via:[]});assert.deepEqual(e.readTrip().via,[]);assert.equal(e.readTrip().departure,'2099-10-09T15:00:00.000Z');
for(const via of [[[null,34]],[[0,100]],Array(6).fill([-80,30])]){data=JSON.stringify({version:1,points:[null,null],via});assert.equal(e.readTrip(),null);}
console.log('PASS: via round-trip, removal preserves time/stops, invalid via coordinates and count rejected');
