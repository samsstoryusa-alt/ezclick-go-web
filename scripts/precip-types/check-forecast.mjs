import assert from 'node:assert/strict';
import {forecastWindow} from '../../app/forecast-time.ts';
const hour=3600000,base=Date.UTC(2026,9,3,6),now=base+17*60000,run=base-6*hour;
const frames=Array.from({length:26},(_,i)=>({time:base+i*hour,run,url:'/forecast/'+run+'_'+(base+i*hour)+'.png'}));
const w=forecastWindow(frames,now);
assert.ok(w);assert.equal(w.times.length,25);assert.equal(w.times[0],now);assert.equal(w.times.at(-1),now+24*hour);
assert.ok(w.times.every((t,i)=>t===now+i*hour));
assert.equal(forecastWindow(frames.slice(0,-1),now),null,'never shorten the last hour');
assert.equal(forecastWindow(frames.filter((_,i)=>i!==12),now),null,'reject missing middle hour');
assert.equal(forecastWindow(frames.map((f,i)=>i===12?{...f,run:run-hour}:f),now),null,'reject mixed model runs');
assert.equal(forecastWindow(frames,now+24*hour),null,'reject stale run');
assert.equal(forecastWindow([],now),null);
console.log('Forecast covers exactly now through +24h; missing, stale and mixed runs rejected.');

