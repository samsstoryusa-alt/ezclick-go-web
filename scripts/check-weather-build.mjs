import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const root=new URL('../dist-weather/',import.meta.url);
const html=await readFile(new URL('index.html',root),'utf8');
assert.match(html,/data-weather-standalone="true"/);
assert.match(html,/<title>EZCLICK GO Weather/);
assert.doesNotMatch(html,/journey|Trucking &amp; Dispatch Platform/);
assert.equal(await readFile(new URL('terms/index.html',root),'utf8'),html);
assert.deepEqual(await readdir(new URL('media/',root)),['ezclick-go-logo.png']);
const manifest=JSON.parse(await readFile(new URL('.vite/manifest.json',root),'utf8'));
for(const entry of Object.values(manifest)){
 await readFile(new URL(entry.file,root));
 for(const css of entry.css??[])await readFile(new URL(css,root));
}
for(const file of ['favicon.svg',...Array.from({length:6},(_,i)=>`fonts/brand-${i}.ttf`)])await readFile(new URL(file,root));
console.log('Standalone weather: metadata, terms entry, minimal public assets, manifest assets PASS');
