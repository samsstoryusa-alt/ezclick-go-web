import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../app/weather-translations.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {languages,translateWeather}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
assert.equal(languages.length,12);
assert.equal(new Set(languages.map(item=>item.code)).size,12);
assert.deepEqual(languages.filter(item=>item.dir==='rtl').map(item=>item.code),['ar']);
for(const lang of languages){
 assert.ok(Intl.DateTimeFormat.supportedLocalesOf([lang.locale]).length);
 for(const key of ['Menu','Language','Change departure','Rain','Snow','Wind','Clear route','Truck settings','Apply'])assert.ok(translateWeather(key,lang.code).trim());
 assert.equal(translateWeather('unrecognised source warning',lang.code),'unrecognised source warning');
}
assert.equal(translateWeather('Clear','ru'),'Ясно');
assert.notEqual(translateWeather('Clear route','ru'),translateWeather('Clear','ru'));
console.log('PASS: 12 unique languages, supported locales, Arabic RTL, source-text fallback, distinct clear-weather and clear-route labels');

assert.equal(translateWeather("Language","ro"),"Limbă");
assert.equal(translateWeather("Snow","ro"),"Ninsoare");
assert.equal(translateWeather("Clear route","ro"),"Șterge");
