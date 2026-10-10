import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const exported={};
new Function('exports',ts.transpileModule(fs.readFileSync('app/satellite-clock.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exported);
const step=exported.advanceSatelliteClock;
let state={position:0,target:null,hold:0},loops=0,replaySteps=0;
for(let t=0;t<60000;t+=16){
 const next=step(state,16,13,true,false);
 assert.ok(next.position>=0&&next.position<13);
 if(next.position>12)replaySteps++;
 if(next.position<state.position)loops++;
 state=next;
}
assert.ok(loops>=3,'Animation must keep looping after the first sequence');
assert.ok(replaySteps>30,'Restart dissolves over multiple display frames');
assert.deepEqual(step(state,1000,13,false,false),state,'Pause holds the observation');
const frozen={position:4.5,target:null,hold:0};
// Failed rendering does not commit the proposed clock: no elapsed-time jump.
for(let i=0;i<100;i++)step(frozen,16,13,true,false);
assert.equal(frozen.position,4.5);
assert.ok(step(frozen,60000,13,true,false).position<4.55,'Returning from a hidden tab cannot skip time');
state={position:11,target:2.2,hold:0};
for(let i=0;i<100&&state.target!==null;i++)state=step(state,16,13,false,false);
assert.equal(state.position,2.2);assert.equal(state.target,null);
assert.equal(step({position:2,target:8,hold:0},16,13,false,true).position,8,'Reduced-motion seeks immediately');
assert.equal(step({position:12,target:null,hold:0},16,13,false,false).position,12,'Last-frame selection stays paused');
console.log('PASS: three complete loops, smooth restart, pause, seek, reduced motion, buffering and hidden-tab time safety.');
