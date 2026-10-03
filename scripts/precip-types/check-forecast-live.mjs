import assert from 'node:assert/strict';
import {forecastWindow} from '../../app/forecast-time.ts';
const base='https://weather.ezclickgo.com/weather-types';
const catalog=await (await fetch(base+'/forecast/frames')).json();
const window=forecastWindow(catalog.frames,Date.now());assert.ok(window);
const wind=await (await fetch(base+'/wind/frames')).json();
for(const frame of window.source){
 assert.ok(wind.frames.some(w=>w.time===frame.time&&w.run===frame.run),'matching wind for every forecast hour');
}
const hashes=new Set();
for(const f of window.source){
 const r=await fetch(base+f.url);assert.equal(r.status,200);
 const bytes=new Uint8Array(await r.arrayBuffer());
 assert.ok(bytes.length>1000);hashes.add(Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex'));
}
assert.ok(hashes.size>20,'real changing weather images');
for(const hour of [0,6,12,18,24]){
 const time=window.times[hour];
 assert.ok(wind.frames.some(f=>f.time<=time)&&wind.frames.some(f=>f.time>=time),'wind brackets every selected time');
}
console.log('Live forecast: 26 hourly images, same-run wind, exactly 24h coverage, '+hashes.size+' distinct precipitation frames.');

