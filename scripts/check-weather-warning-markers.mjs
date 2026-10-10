import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=fs.readFileSync('app/route-weather-display.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={};new Function('exports',js)(mod);
const {weatherWarningMarkers,isWeatherWarning,weatherConcernColors}=mod;
const levels=['low','caution','low','unknown','high','low'];
const samples=Object.freeze(levels.map((level,i)=>Object.freeze({level,available:level!=='unknown',lon:-86+i,lat:36-i,eta:1000+i,place:'Sample '+i})));
const markers=weatherWarningMarkers(samples);
assert.deepEqual(markers.features.map(f=>f.id),[1,4]);
for(const feature of markers.features){
 const sample=samples[feature.properties.index];
 assert.equal(feature.id,feature.properties.index);
 assert.equal(feature.properties.label,String(feature.id+1));
 assert.deepEqual(feature.geometry.coordinates,[sample.lon,sample.lat]);
 assert.equal(feature.properties.color,weatherConcernColors[sample.level]);
}
assert.equal(samples.length,6,'Filtering map markers must not remove forecast samples');
assert.equal(weatherWarningMarkers(samples.map(p=>({...p,level:'low',available:true}))).features.length,0);
assert.equal(weatherWarningMarkers(samples.map(p=>({...p,level:'unknown',available:false}))).features.length,0);
assert.equal(weatherWarningMarkers([]).features.length,0);
assert.equal(isWeatherWarning({available:false,level:'high'}),false,'Unavailable data cannot create a warning marker');
const changed=weatherWarningMarkers(samples.map((p,i)=>({...p,level:i===2?'high':'low',available:true})));
assert.deepEqual(changed.features.map(f=>f.id),[2],'Refreshed forecasts must replace old warnings and preserve original indices');
assert.equal(new Set(Object.values(weatherConcernColors)).size,4,'Missing forecasts need a distinct color from calm conditions');
console.log('PASS: warning-only markers; original indices, coordinates and labels; complete forecast retained; clear, missing, empty and refreshed forecasts');
