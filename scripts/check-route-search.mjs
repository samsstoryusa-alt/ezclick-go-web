import fs from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync('app/route-search-data.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};new Function('exports',js)(exports);const parse=exports.parsePlaces;
const feature=(name,state,coordinates)=>({geometry:{type:'Point',coordinates},properties:{name,state,countrycode:'US'}});
const a=feature('Nashville','Tennessee',[-86.78,36.16]),b=feature('Nashville','Indiana',[-86.25,39.2]);
const results=parse({features:[a,a,b,feature('Bad','',[-150,60]),null]});assert.equal(results.length,2);assert.equal(results[0].detail,'Tennessee');assert.equal(results[1].detail,'Indiana');assert.deepEqual(results[0].point,[-86.78,36.16]);
assert.deepEqual(parse({features:[]}),[]);assert.throws(()=>parse({error:'unavailable'}));
assert.deepEqual(parse({features:[{...a,properties:{...a.properties,countrycode:'CA'}},feature('Bad','',[NaN,40])]}),[]);
console.log('Search: homonyms, state labels, coordinate order, deduplication, coverage, corrupt response PASS');


const zip=exports.parseZipPlaces({places:[{'place name':'Jacksonville',state:'Florida',longitude:'-81.6517',latitude:'30.3299'}]},'32202');assert.equal(zip[0].name,'Jacksonville');assert.equal(zip[0].detail,'Florida \u00b7 32202');assert.deepEqual(zip[0].point,[-81.6517,30.3299]);assert.deepEqual(exports.parseZipPlaces({places:[{longitude:'',latitude:'30'}]},'32202'),[]);
console.log('ZIP: place label, postcode, numeric coordinates, missing coordinate rejection PASS');

assert.equal(exports.nextSearchHighlight(-1,'ArrowUp',6),5);assert.equal(exports.nextSearchHighlight(-1,'ArrowDown',6),0);
assert.equal(exports.nextSearchHighlight(0,'ArrowUp',6),5);assert.equal(exports.nextSearchHighlight(5,'ArrowDown',6),0);assert.equal(exports.nextSearchHighlight(-1,'ArrowUp',0),-1);
assert.equal(exports.searchScrollTop(0,144,240,48),144);assert.equal(exports.searchScrollTop(144,144,0,48),0);assert.equal(exports.searchScrollTop(48,144,96,48),48);
console.log('PASS: first ArrowUp/Down, wrap-around, empty results, sixth row visible, wrap scrolls back to first');
