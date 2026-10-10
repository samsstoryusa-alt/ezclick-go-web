import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const path=(value:string)=>fileURLToPath(new URL(value,import.meta.url));
const proxy:Record<string,import('vite').ProxyOptions>={
 '/satellite-tiles':{target:'http://127.0.0.1:8798'},
 '/satellite-data':{target:'http://127.0.0.1:8798'},
 '/support-api':{target:'http://127.0.0.1:8770',rewrite:(p:string)=>p.replace(/^\/support-api/,'')},
 '/voice-api':{target:'http://127.0.0.1:5196',changeOrigin:true,rewrite:(p:string)=>p.replace(/^\/voice-api/,'').split('?')[0]||'/',configure:(proxy)=>{proxy.on('proxyReq',(request)=>{request.setHeader('Origin','http://127.0.0.1:5196');});proxy.on('proxyRes',(response)=>{response.headers['content-security-policy']="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'self'";});}},
 '/trip-api/route':{target:'http://127.0.0.1:8768',rewrite:(p:string)=>p.replace(/^\/trip-api/,'')},
 '/trip-api':{target:'http://127.0.0.1:8767',rewrite:(p:string)=>p.replace(/^\/trip-api/,'')},
 '/weather-types':{target:'http://127.0.0.1:8766',rewrite:(p:string)=>p.replace(/^\/weather-types/,'')},
};
export default defineConfig({
 root:path('./weather-app'),base:'/',publicDir:path('./public'),
 // Voice is part of the standalone product; keep it enabled in clean builds too.
 define:{'import.meta.env.VITE_PUBLIC_VOICE_BETA':JSON.stringify('1'),'import.meta.env.VITE_WEATHER_BUILD_ID':JSON.stringify(process.env.VITE_WEATHER_BUILD_ID||new Date().toISOString())},
 resolve:{alias:{'@':path('./')}},plugins:[react(),{
  name:'weather-only-boundary',
  generateBundle(_options,bundle){
   for(const item of Object.values(bundle))if(item.type==='chunk')for(const id of Object.keys(item.modules)){
    const normalized=id.replaceAll('\\','/');
    if(/\/app\/(page|version-a|site-details|pricing|mobile-tour)\.tsx$/.test(normalized))this.error(`Standalone weather unexpectedly imports ${normalized}`);
   }
  },
 }],
 build:{outDir:path('./dist-weather'),emptyOutDir:true,copyPublicDir:false,manifest:true},
 server:{host:'127.0.0.1',port:5192,strictPort:true,proxy,fs:{allow:[path('./')]}},
 preview:{host:'127.0.0.1',port:5192,strictPort:true,proxy},
});
