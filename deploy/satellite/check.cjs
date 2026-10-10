const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const cache=path.join(os.tmpdir(),'ezclick-satellite-check-'+process.pid);process.env.SATELLITE_CACHE=cache;
const api=require('./satellite-tiles.cjs');
test('bounded coordinates and recorded timestamps',()=>{
 assert.deepEqual(api.parseTile('/satellite-tiles/1791565200000/4/4/6.png'),{time:1791565200000,z:4,x:4,y:6});
 for(const url of ['/satellite-tiles/1791565200001/4/4/6.png','/satellite-tiles/1791565200000/8/4/6.png','/satellite-tiles/1791565200000/4/16/6.png','/satellite-tiles/1791565200000/4/-1/6.png','/satellite-tiles/../../etc/passwd'])assert.equal(api.parseTile(url),null);
 assert.equal(new URL(api.upstream({time:1791565200000,z:4,x:4,y:6})).hostname,'gibs.earthdata.nasa.gov');
});
test('upstream concurrency, deduplication and reusable disk cache',async()=>{
 const original=global.fetch;let calls=0,running=0,peak=0;
 const png=Buffer.alloc(24);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.writeUInt32BE(256,16);png.writeUInt32BE(256,20);
 global.fetch=async()=>{calls++;running++;peak=Math.max(peak,running);await new Promise(r=>setTimeout(r,15));running--;return{ok:true,headers:{get:()=> 'image/png'},arrayBuffer:async()=>png};};
 try{
 const tile={time:1791565200000,z:4,x:4,y:6};
 await Promise.all([api.getTile(tile),api.getTile(tile)]);assert.equal(calls,1);
 await api.getTile(tile);assert.equal(calls,1);
 await Promise.all(Array.from({length:24},(_,i)=>api.getTile({...tile,x:i%16,y:Math.floor(i/16)+8})));
 assert.ok(peak<=8);assert.equal(calls,25);
 }finally{global.fetch=original;await fs.rm(cache,{recursive:true,force:true});}
});
