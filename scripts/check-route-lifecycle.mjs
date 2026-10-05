import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
// Execute the real hook with deterministic hook scheduling and controllable requests.
const cells=[], effects=[];let cursor=0,dirty=false;
const react={
 useState(initial){const i=cursor++;if(!(i in cells))cells[i]=typeof initial==='function'?initial():initial;return[cells[i],v=>{const next=typeof v==='function'?v(cells[i]):v;if(!Object.is(next,cells[i])){cells[i]=next;dirty=true;}}];},
 useRef(initial){const i=cursor++;return cells[i]??(cells[i]={current:initial});},
 useEffect:effect,useLayoutEffect:effect
};
function effect(fn,deps){const i=cursor++,old=cells[i];if(!old||deps.some((v,n)=>!Object.is(v,old.deps[n]))){cells[i]={deps,cleanup:old?.cleanup};effects.push(()=>{cells[i].cleanup?.();cells[i].cleanup=fn();});}}
let clock=10000;const date={now:()=>clock};let pending=[];
const transport={weatherRequest:(_,options)=>new Promise(resolve=>pending.push({resolve,signal:options.signal}))};
const exports={};new Function('exports','require','fetch','setTimeout','clearTimeout','setInterval','clearInterval','Date',ts.transpileModule(fs.readFileSync('app/road-route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,n=>n==='react'?react:transport,async()=>({ok:true,json:async()=>({coverage:'contiguous-us'})}),()=>1,()=>{},()=>1,()=>{},date);
// tripApi is the only browser-specific part of the transport setup.
globalThis.document={documentElement:{dataset:{weatherStandalone:'true'}}};
let active=true,points=[[-86,36],[-81,30]],current;
function render(){do{dirty=false;cursor=0;current=exports.useRoadRoute(null,active,points,exports.DEFAULT_TRUCK);}while(dirty);while(effects.length)effects.shift()();return current;}
const payload={code:'Ok',routes:[{distance:100,duration:60,geometry:{type:'LineString',coordinates:[[-86,36],[-81,30]]}}]};
render();const oldBuild=current.build();render();assert.equal(current.busy,true);
points=[[-85,35],[-81,30]];render();assert.equal(pending[0].signal.aborted,true);assert.equal(current.busy,false);
clock+=2000;const newBuild=current.build();render();pending[0].resolve(payload);await oldBuild;render();assert.equal(current.route,null);assert.equal(current.busy,true);
pending[1].resolve(payload);await newBuild;render();assert.ok(current.route);assert.equal(current.busy,false);
clock+=2000;const closingBuild=current.build();render();active=false;render();assert.equal(pending[2].signal.aborted,true);pending[2].resolve({...payload,routes:[{...payload.routes[0],distance:999}]});await closingBuild;render();assert.equal(current.route.distance,100);assert.equal(current.error,'');assert.equal(current.busy,false);
active=true;points=[null,null];render();assert.equal(current.route,null);assert.equal(current.hasPrevious,false);
console.log('PASS: changed-route cancellation, late response isolation, current request success, close cancellation, clear route');
