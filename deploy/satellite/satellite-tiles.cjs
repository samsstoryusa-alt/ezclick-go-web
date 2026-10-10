const fs=require('node:fs/promises');
const path=require('node:path');
const cache=path.resolve(process.env.SATELLITE_CACHE||path.join(__dirname,'tile-cache'));
const pending=new Map();
let running=0;
const queue=[];
async function acquire(){if(running<8){running++;return;}await new Promise(resolve=>queue.push(resolve));}
function release(){const next=queue.shift();if(next)next();else running--;}
async function trimCache(){
 const names=await fs.readdir(cache).catch(()=>[]),entries=[];
 for(const name of names)if(/^v3-[\d-]+\.png$/.test(name)){
  const file=path.join(cache,name),stat=await fs.stat(file).catch(()=>null);
  if(stat?.isFile())entries.push({file,size:stat.size,time:stat.mtimeMs});
 }
 let size=entries.reduce((n,e)=>n+e.size,0);
 for(const entry of entries.sort((a,b)=>a.time-b.time)){
  if(size<=512*1024*1024)break;
  await fs.unlink(entry.file).catch(()=>{});size-=entry.size;
 }
}
setInterval(()=>void trimCache().catch(()=>{}),60000).unref();
const HALF=20037508.342789244;
function bounds(z,x,y){const span=HALF*2/2**z;return[-HALF+x*span,HALF-(y+1)*span,-HALF+(x+1)*span,HALF-y*span];}
function parseTile(pathname){
 const m=pathname.match(/^\/satellite-tiles\/(\d{13})\/(\d+)\/(\d+)\/(\d+)\.png$/);if(!m)return null;
 const [time,z,x,y]=m.slice(1).map(Number);
 // Only the timestamped observation series offered by this local preview.
 if(time<1791565200000||time>1791572400000||(time-1791565200000)%600000||z>7||x>=2**z||y>=2**z)return null;
 return{time,z,x,y};
}
function upstream(tile){
 const longitude=(tile.x+.5)/2**tile.z*360-180;
 const time=new Date(tile.time).toISOString().replace('.000Z','Z');
 // GOES already publishes projected XYZ tiles; avoid recompositing three
 // satellite products in WMS for every animation frame over the Americas.
 if(tile.z>=3&&longitude>=-180&&longitude<-22.5){
  const layer=longitude<-110?'GOES-West_ABI_GeoColor':'GOES-East_ABI_GeoColor';
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${time}/GoogleMapsCompatible_Level7/${tile.z}/${tile.y}/${tile.x}.png`;
 }
 const layers=['VIIRS_SNPP_CorrectedReflectance_TrueColor','MODIS_Terra_CorrectedReflectance_TrueColor'];
 // Use each geostationary instrument near its useful viewing area. Its
 // stretched horizon must not obscure the daily mosaic over Europe or Asia.
 if(tile.z<3&&longitude<=0)layers.push('GOES-West_ABI_GeoColor','GOES-East_ABI_GeoColor');
 const p=new URLSearchParams({SERVICE:'WMS',REQUEST:'GetMap',VERSION:'1.3.0',
  LAYERS:layers.join(','),
  STYLES:'',FORMAT:'image/png',TRANSPARENT:'TRUE',WIDTH:'256',HEIGHT:'256',CRS:'EPSG:3857',BBOX:bounds(tile.z,tile.x,tile.y).join(','),TIME:time});
 return 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?'+p;
}
async function getTile(tile){
 const longitude=(tile.x+.5)/2**tile.z*360-180;
 const animated=tile.z<3?longitude<=0:longitude>=-180&&longitude<-22.5;
 const key=`v3-${animated?tile.time:'2026-10-09'}-${tile.z}-${tile.x}-${tile.y}.png`,file=path.join(cache,key);
 try{return await fs.readFile(file);}catch(error){if(error.code!=='ENOENT')throw error;}
 if(pending.has(key))return pending.get(key);
 if(pending.size>=72)throw Error('Satellite cache busy');
 const task=(async()=>{
  await acquire();
  try{
  const r=await fetch(upstream(tile),{signal:AbortSignal.timeout(25000)});
  if(!r.ok||!r.headers.get('content-type')?.includes('image/png'))throw Error('Satellite tiles unavailable');
  const b=Buffer.from(await r.arrayBuffer());
  if(b.length<24||b.toString('hex',0,8)!=='89504e470d0a1a0a'||b.readUInt32BE(16)!==256||b.readUInt32BE(20)!==256)throw Error('Invalid satellite tile');
  await fs.mkdir(cache,{recursive:true});await fs.writeFile(file+'.tmp',b);await fs.rename(file+'.tmp',file);return b;
  }finally{release();}
 })();pending.set(key,task);
 try{return await task;}finally{pending.delete(key);}
}
async function handle(req,res,pathname){
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
 const tile=parseTile(pathname);if(!tile){res.writeHead(404).end();return;}
 try{const b=await getTile(tile);if(res.destroyed)return;res.writeHead(200,{'content-type':'image/png','cache-control':'public,max-age=86400','x-content-type-options':'nosniff'});res.end(req.method==='HEAD'?undefined:b);}
 catch{if(!res.destroyed)res.writeHead(502,{'content-type':'text/plain','cache-control':'no-store'}).end('Satellite observations unavailable');}
}
module.exports={handle,parseTile,bounds,upstream,getTile,trimCache};
