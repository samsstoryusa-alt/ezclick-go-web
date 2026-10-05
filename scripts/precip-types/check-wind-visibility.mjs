import assert from 'node:assert/strict';
import {createWindVisibility} from '../../app/wind-visibility.ts';
const update=createWindVisibility();let state;
for(let t=0;t<=2000;t+=33)state=update(t,false);
assert.equal(state.opacity,1);
state=update(2033,true);assert.ok(state.opacity>0&&state.opacity<1);assert.equal(state.draw,false);
let previous=state.opacity;
for(let t=2066;t<3000;t+=33){state=update(t,true);assert.ok(state.opacity<=previous);assert.equal(state.draw,false);previous=state.opacity;}
assert.equal(state.opacity,0);
state=update(3033,false);assert.equal(state.draw,false,'wait for camera to settle');
let resets=0;
for(let t=3066;t<5000;t+=33){state=update(t,false);if(state.reset){resets++;assert.equal(state.opacity,0,'reset only when invisible');}}
assert.equal(resets,1);assert.equal(state.opacity,1);
// A quick second gesture must not clear the still-visible overlay.
update(5033,true);state=update(5066,false);assert.equal(state.reset,false);assert.equal(state.draw,false);
const reduced=createWindVisibility(true);for(let t=0;t<300;t+=33)reduced(t,false);assert.equal(reduced(330,true).opacity,0);
console.log('Wind visibility: smooth fade, stationary reset, settle delay, repeated gestures, reduced motion PASS');
