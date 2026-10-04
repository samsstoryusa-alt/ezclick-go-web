import {mkdir,copyFile} from 'node:fs/promises';
// GitHub Pages needs actual entry documents for direct navigation and reloads.
for (const route of ['version-a','experience','terms','weather']) {
 await mkdir(`dist-pages/${route}`,{recursive:true});
 await copyFile('dist-pages/index.html',`dist-pages/${route}/index.html`);
}
