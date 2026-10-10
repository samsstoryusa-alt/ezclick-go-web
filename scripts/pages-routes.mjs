import {mkdir,copyFile,cp} from 'node:fs/promises';
// GitHub Pages needs actual entry documents for direct navigation and reloads.
for (const route of ['version-a','experience','terms']) {
 await mkdir(`dist-pages/${route}`,{recursive:true});
 await copyFile('dist-pages/index.html',`dist-pages/${route}/index.html`);
}
// Keep the marketing page separate from the API-enabled weather application.
// Its relative media URLs work both on the custom domain and a Pages base path.
await cp(new URL('../marketing/weather/',import.meta.url),'dist-pages/weather',{recursive:true});
