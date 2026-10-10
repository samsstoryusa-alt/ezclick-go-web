import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cloudForecastPosition} from '../app/cloud-forecast-time.ts';
const now=Date.parse('2026-10-09T22:00:00Z');
const frames=[0,1,2].map(h=>({time:now+h*3600000,run:now-4*3600000,url:''}));
assert.deepEqual(cloudForecastPosition(frames,now,now),{a:0,b:0,mix:0});
assert.deepEqual(cloudForecastPosition(frames,now+1800000,now),{a:0,b:1,mix:.5});
assert.deepEqual(cloudForecastPosition(frames,now+7200000,now),{a:2,b:2,mix:0});
assert.equal(cloudForecastPosition(frames,now-1,now),null);
assert.equal(cloudForecastPosition(frames,now+7200001,now),null);
assert.equal(cloudForecastPosition(frames,null,now),null);
assert.equal(cloudForecastPosition(frames,now,now+19*3600000),null);
assert.equal(cloudForecastPosition([frames[0],frames[2]],now+1800000,now),null);
const catalog=JSON.parse(await readFile(new URL('../public/cloud-preview/catalog.json',import.meta.url),'utf8'));
assert.equal(catalog.frames.length,28);
for(let i=0;i<catalog.frames.length;i++){
 const f=catalog.frames[i];assert.equal(f.run,catalog.run);
 if(i)assert.equal(f.time-catalog.frames[i-1].time,3600000);
 const png=await readFile(new URL('../public'+f.url,import.meta.url));assert.equal(png.readUInt32BE(16),1024);assert.equal(png.readUInt32BE(20),600);
}
console.log('Forecast clouds: shared-time interpolation, bounds, gaps, stale data and 28 model images PASS');
