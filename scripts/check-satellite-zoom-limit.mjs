import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const exports={};
new Function('exports',ts.transpileModule(fs.readFileSync('app/satellite-zoom-limit.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports);
function fakeMap(lat,width=1920){
 const listeners=new Map(),route={a:'Nashville',b:'Jacksonville'};
 const map={lat,width,height:1000,zoom:2,min:0.5,max:18,route,listeners,sets:0,
  getContainer:()=>({clientWidth:map.width,clientHeight:map.height}),
  getMinZoom:()=>map.min,getMaxZoom:()=>map.max,getZoom:()=>map.zoom,
  setMinZoom(value){map.sets++;map.min=value;map.zoom=Math.max(map.zoom,value);listeners.get('move')?.();},
  on:(type,fn)=>listeners.set(type,fn),off:type=>listeners.delete(type),
  unproject([x]){
   const lng=(x-map.width/2)/(512*2**map.zoom)*360;
   return {lng,distanceTo(right){const cosine=Math.cos(map.lat*Math.PI/180);return 2*6371008.8*Math.asin(Math.min(1,Math.abs(cosine*Math.sin((right.lng-lng)*Math.PI/360))));}};
  },
  scale(){const a=map.unproject([map.width/2-50]),b=map.unproject([map.width/2+50]);return a.distanceTo(b);},
 };
 return map;
}
for(const units of ['metric','us']){
 for(const lat of [0,25,36,55,65]){
  for(const width of [375,1920]){
   const map=fakeMap(lat,width),originalMin=map.min,originalRoute=map.route;
   const dispose=exports.installSatelliteZoomLimit(map,units);
   // Simulate settling after the initial far view is constrained.
   map.listeners.get('move')();map.zoom=map.min;
   const maximum=exports.satelliteScaleMeters(units);
   assert.ok(map.scale()<=maximum*1.01,'Ruler cap: '+units+'/'+lat+'/'+width);
   assert.ok(map.scale()>=maximum*.99,'Allow the intended regional view');
   map.zoom=Math.max(map.min,map.zoom-3);map.listeners.get('move')();assert.ok(map.zoom>=map.min);
   map.lat=0;map.listeners.get('move')();map.zoom=map.min;
   assert.ok(map.scale()<=maximum*1.01,'Cap follows latitude');
   map.width=400;map.listeners.get('resize')();assert.ok(map.scale()<=maximum*1.01);
   assert.equal(map.route,originalRoute);
   dispose();dispose();assert.equal(map.min,originalMin,'Restore normal map freedom');
   assert.equal(map.listeners.size,0);assert.ok(map.sets<20,'No recursive event loop');
  }
 }
}
const map=fakeMap(35);
let dispose=exports.installSatelliteZoomLimit(map,'metric');const metric=map.min;dispose();
dispose=exports.installSatelliteZoomLimit(map,'us');assert.ok(map.min<metric,'150-mile range is slightly wider than 200-km range');dispose();
console.log('PASS: metric/imperial ruler caps, desktop/mobile, latitude, units, reentrancy and restoration without route edits.');
