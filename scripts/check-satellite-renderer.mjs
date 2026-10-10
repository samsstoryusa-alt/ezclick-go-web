import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const exports={};
new Function('exports',ts.transpileModule(fs.readFileSync('app/satellite-renderer.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports);
const frames=Array.from({length:13},(_,i)=>({time:1791565200000+i*600000}));
function fakeMap(){
 const sources=new Map(),listeners=new Map(),layers=[{id:'ground',type:'fill'},{id:'base',type:'raster'},{id:'roads',type:'line'},{id:'route',type:'line'},{id:'labels',type:'symbol'}];
 const map={
  sources,listeners,layers,maxSources:0,moving:false,requests:0,paints:0,reorders:0,
  isMoving:()=>map.moving,on:(type,fn)=>listeners.set(type,fn),off:type=>listeners.delete(type),
  getStyle:()=>({layers}),getLayer:id=>layers.find(l=>l.id===id),getSource:id=>sources.get(id),
  addSource(id,spec){assert.equal(spec.type,'raster','Never substitute a blurry world image');assert.equal(spec.tileSize,256);sources.set(id,{loaded:false,observation:Number(id.split('-').at(-1))});map.requests++;map.maxSources=Math.max(map.maxSources,sources.size);},
  addLayer(l,before){layers.splice(layers.findIndex(x=>x.id===before),0,l);},
  moveLayer(id,before){map.reorders++;const [l]=layers.splice(layers.findIndex(x=>x.id===id),1);layers.splice(before?layers.findIndex(x=>x.id===before):layers.length,0,l);},
  setPaintProperty(id,key,v){map.paints++;map.getLayer(id).paint[key]=v;},
  isSourceLoaded:id=>sources.get(id)?.loaded,
  removeLayer(id){layers.splice(layers.findIndex(x=>x.id===id),1);},
  removeSource(id){assert.ok(!layers.some(l=>l.source===id));sources.delete(id);},
  load(){for(const s of sources.values())s.loaded=true;},
  observation(){return layers.filter(l=>l.source).reduce((v,l)=>v*(1-l.paint['raster-opacity'])+sources.get(l.source).observation*l.paint['raster-opacity'],0);},
 };
 return map;
}
const map=fakeMap(),renderer=exports.createSatelliteRenderer(map,frames);
assert.equal(renderer.draw(0),false);assert.equal(map.sources.size,1);
map.load();assert.equal(renderer.draw(0),false);
assert.equal(map.getLayer('ezclick-cloud-frame-0').paint['raster-opacity'],1,'Show the first sharp observation before next frame');
map.load();assert.equal(renderer.draw(0),true);
renderer.draw(0);const paints=map.paints,reorders=map.reorders;
for(let i=0;i<100;i++)renderer.draw(0);
assert.equal(map.paints,paints);assert.equal(map.reorders,reorders);
for(let step=0;step<=720;step++){
 const position=step/60;
 if(!renderer.draw(position)){map.load();assert.equal(renderer.draw(position),true);}
 assert.ok(Math.abs(map.observation()-position)<1e-8);
}
for(const position of [2.7,4.2,7.9,1.01,11.999,12,0]){
 const visible=map.observation();
 if(!renderer.draw(position)){assert.equal(map.observation(),visible);map.load();assert.equal(renderer.draw(position),true);}
 assert.ok(Math.abs(map.observation()-position)<1e-8);
}
for(const position of [12,12.25,12.5,12.75,12.999,0]){
 if(!renderer.draw(position)){map.load();assert.equal(renderer.draw(position),true);}
 assert.ok(Math.abs(map.observation()-(position>12?12*(13-position):position))<1e-8);
}
renderer.draw(.2);map.load();renderer.draw(.2);
const first=map.getSource('ezclick-cloud-frame-0'),second=map.getSource('ezclick-cloud-frame-1'),requests=map.requests;
map.moving=true;map.listeners.get('movestart')();
assert.equal(map.getSource('ezclick-cloud-frame-0'),first,'Keep visible tile cache');
assert.equal(map.getSource('ezclick-cloud-frame-1'),second);
assert.equal(map.sources.size,2,'Stop competing future observation loads during gesture');
first.loaded=false;second.loaded=false;
for(let i=0;i<120;i++){
 assert.equal(renderer.draw(.3),false,'Do not change time during gesture');
 assert.ok(Math.abs(map.observation()-.2)<1e-8,'Keep sharp displayed tiles and opacity');
}
assert.equal(map.requests,requests);
map.moving=false;map.listeners.get('moveend')();
assert.equal(renderer.draw(.3),false,'Wait for gesture to settle');
await new Promise(r=>setTimeout(r,210));
assert.equal(renderer.draw(.3),false,'Wait for matching detailed observations');
assert.equal(map.getSource('ezclick-cloud-frame-0'),first,'No blurry replacement during load');
map.load();assert.equal(renderer.draw(.3),true);assert.ok(Math.abs(map.observation()-.3)<1e-8);
assert.ok(map.maxSources<=5);
map.listeners.get('error')({sourceId:'ezclick-cloud-frame-0',error:Error('timeout')});
assert.throws(()=>renderer.draw(.4),/could not load/);
renderer.dispose();renderer.dispose();
assert.equal(map.sources.size,0);assert.equal(map.listeners.size,0);
assert.deepEqual(map.layers.map(l=>l.id),['ground','base','roads','route','labels']);
for(let i=0;i<4;i++){const r=exports.createSatelliteRenderer(map,frames);r.draw(i);map.load();r.draw(i);map.listeners.get('moveend')();r.dispose();}
await new Promise(r=>setTimeout(r,210));assert.equal(map.sources.size,0);
console.log('PASS: no blurry overview, retained sharp tile caches through gestures, matching time, prefetch priority, loop, resource bounds and cleanup.');
