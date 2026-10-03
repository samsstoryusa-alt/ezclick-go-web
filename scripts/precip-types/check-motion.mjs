import assert from 'node:assert/strict';
import {estimateFlow,W,H,GX,GY,R} from '../../app/precip-motion-math.ts';
const blob=(dx,dy)=>Float32Array.from({length:W*H},(_,i)=>Math.exp(-(((i%W-68-dx)/5)**2+((Math.floor(i/W)-56-dy)/5)**2)));
const forward=estimateFlow(blob(0,0),blob(3,1)),backward=estimateFlow(blob(3,1),blob(0,0));
const k=(7*GX+8)*4;
assert.ok((forward[k]-128)/127*R>1.5,'detect eastward cloud movement');
assert.ok((backward[k]-128)/127*R<-.8,'reverse field points west');
const still=estimateFlow(blob(0,0),blob(0,0));
assert.ok(still.every((v,i)=>i%4===0||i%4===1?v===128:true),'stationary field does not drift');
const empty=estimateFlow(new Float32Array(W*H),new Float32Array(W*H));
assert.equal(empty.length,GX*GY*4);
assert.equal(empty[k],128,'empty sky has no invented motion');
assert.equal(forward[0],128,'outside trial region remains unchanged');
console.log('Motion matching: translated storm, reverse flow, stationary/empty fields and regional boundary passed');

