const http=require('node:http');
const frames=require('./frames.json');
const {handle}=require('./satellite-tiles.cjs');
const server=http.createServer((req,res)=>{
 let pathname;try{pathname=new URL(req.url,'http://localhost').pathname;}catch{res.writeHead(400).end();return;}
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
 if(pathname==='/health'){res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({ok:true,mode:'recorded',first:frames.frames[0].time,last:frames.frames.at(-1).time}));return;}
 if(pathname==='/satellite-data/frames.json'){res.writeHead(200,{'content-type':'application/json','cache-control':'public,max-age=300','x-content-type-options':'nosniff'}).end(req.method==='HEAD'?undefined:JSON.stringify(frames));return;}
 if(pathname.startsWith('/satellite-tiles/')){void handle(req,res,pathname);return;}
 res.writeHead(404).end();
});
server.headersTimeout=10000;server.requestTimeout=35000;
server.listen(Number(process.env.PORT||8798),'127.0.0.1',()=>console.log('Satellite observation cache ready on loopback'));
