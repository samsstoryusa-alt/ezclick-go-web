import {mkdir,copyFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
for(const name of ['favicon.svg','media/ezclick-go-logo.png',...Array.from({length:6},(_,i)=>`fonts/brand-${i}.ttf`)]){
 const dest=fileURLToPath(new URL(`dist-weather/${name}`,root));
 await mkdir(dirname(dest),{recursive:true});await copyFile(new URL(`public/${name}`,root),dest);
}
await mkdir(new URL('dist-weather/terms/',root),{recursive:true});
await copyFile(new URL('dist-weather/index.html',root),new URL('dist-weather/terms/index.html',root));

await copyFile(new URL('weather-app/mobile-preview.html',root),new URL('dist-weather/mobile-preview.html',root));
await copyFile(new URL('public/voice-preview.html',root),new URL('dist-weather/voice-preview.html',root));
