import assert from 'node:assert/strict';
import {createRadarPlayer} from '../../app/radar-player.ts';
let next=0;const queue=new Map();
globalThis.requestAnimationFrame=fn=>{queue.set(++next,fn);return next;};globalThis.cancelAnimationFrame=id=>queue.delete(id);
globalThis.window={matchMedia:()=>({matches:false})};
function canvas(){const c={width:16,height:16,toDataURL:()=>'',getContext:()=>ctx};const ctx={canvas:c,clearRect(){},drawImage(){},globalAlpha:1,globalCompositeOperation:'source-over'};return c;}
globalThis.document={createElement:canvas};
let adds=0,updates=0,position=-1,layer=false,source=false;
const events=new Map();const container={dataset:{}};
const map={on(name,fn){events.set(name,fn);},off(name){events.delete(name);},isMoving:()=>false,getContainer:()=>container,addSource(){adds++;source=true;},addLayer(){layer=true;},getStyle:()=>({layers:[]}),getSource:()=>source?{updateImage(){updates++;}}:null,getLayer:()=>layer,setPaintProperty(){},triggerRepaint(){},removeLayer(){layer=false;},removeSource(){source=false;}};
const smooth=[];const p=createRadarPlayer(map,[canvas(),canvas()],x=>position=x,x=>smooth.push(x));
p.play(true);p.replace([canvas(),canvas(),canvas()],1);assert.equal(adds,1);assert.equal(position,1);
for(const [id,fn] of [...queue]){queue.delete(id);fn(1000);}
assert.ok(updates>=2);assert.ok(queue.size>0,'playback continues after refresh');
const uploads=updates,previous=smooth.at(-1);
for(const [id,fn] of [...queue]){queue.delete(id);fn(1016);}
assert.ok(smooth.at(-1)>previous,'timeline advances between raster frames');assert.equal(updates,uploads,'smooth timeline adds no raster uploads');
p.seek(2);assert.equal(position,2);p.replace([canvas(),canvas()],1);assert.equal(p.position(),1);
p.play(true);map.isMoving=()=>true;
const beforeDrag=updates;
for(const [id,fn] of [...queue]){queue.delete(id);fn(1100);}
assert.equal(updates,beforeDrag,'hold terrain image uploads during camera gestures');
assert.ok(queue.size>0,'timeline continues while camera moves');
map.isMoving=()=>false;
events.get('moveend')();
assert.ok(updates>beforeDrag,'publish latest frame immediately after camera settles');
for(const [id,fn] of [...queue]){queue.delete(id);fn(1150);}
assert.ok(updates>beforeDrag,'playback resumes after camera gesture');
p.dispose();
const cadence=createRadarPlayer(map,[canvas(),canvas()],()=>{});
cadence.play(true);
let startUploads=0;
for(let i=0;i<=120;i++){
 for(const [id,fn] of [...queue]){queue.delete(id);fn(2000+i*1000/60);}
 if(i===0)startUploads=updates;
}
const rendered=updates-startUploads;
console.log('Raster updates over two seconds at 60 Hz:',rendered);
assert.ok(rendered>=58&&rendered<=61,'30 fps scheduling must not discard fractional frame time');
cadence.dispose();assert.equal(events.size,0,'remove camera listeners');assert.equal(layer,false);assert.equal(source,false);assert.equal(queue.size,0);
console.log('Radar replacement retains one map source, preserves playback, seeks and disposes cleanly');


