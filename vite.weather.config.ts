import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const path=(value:string)=>fileURLToPath(new URL(value,import.meta.url));
const proxy={
 '/trip-api':{target:'http://127.0.0.1:8767',rewrite:(p:string)=>p.replace(/^\/trip-api/,'')},
 '/weather-types':{target:'http://127.0.0.1:8766',rewrite:(p:string)=>p.replace(/^\/weather-types/,'')},
};
export default defineConfig({
 root:path('./weather-app'),base:'/',publicDir:path('./public'),
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
