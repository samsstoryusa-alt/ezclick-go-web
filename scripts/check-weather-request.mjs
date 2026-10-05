import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
let fetchImpl;
const e={};new Function('exports','fetch',ts.transpileModule(fs.readFileSync('app/weather-request.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(e,(...args)=>fetchImpl(...args));
fetchImpl=async()=>{throw new TypeError('Failed to fetch');};
await assert.rejects(e.weatherRequest('/test'),/Check your internet/);
const controller=new AbortController();controller.abort();const abort=new Error('cancelled');fetchImpl=async()=>{throw abort;};await assert.rejects(e.weatherRequest('/test',{signal:controller.signal}),x=>x===abort);
for(const status of [429,503]){fetchImpl=async()=>new Response('<html>proxy failure</html>',{status});await assert.rejects(e.weatherRequest('/test'),status===429?/Wait a moment/:/temporarily unavailable/);}
for(const body of ['null','[]','<html>broken</html>']){fetchImpl=async()=>new Response(body);await assert.rejects(e.weatherRequest('/test'),/Could not read/);}
fetchImpl=async()=>new Response('{"error":"Choose valid points"}',{status:422});await assert.rejects(e.weatherRequest('/test'),/Choose valid points/);
fetchImpl=async()=>new Response('{"ok":true}');assert.deepEqual(await e.weatherRequest('/test'),{ok:true});
const good={available:true,condition:'Rain',level:'caution',temperatureC:10,windMph:12};
const value=points=>({checkedAt:Date.now(),points});
assert.equal(e.validForecastResponse(value([good]),1),true);
assert.equal(e.validForecastResponse(value([{available:false,condition:'Forecast unavailable',level:'unknown'}]),1),true);
for(const p of [null,{...good,level:'safe'},{...good,temperatureC:'warm'},{...good,windMph:-1},{...good,place:{}},{...good,available:false}])assert.equal(e.validForecastResponse(value([p]),1),false);
assert.equal(e.validForecastResponse(value([good]),2),false);
console.log('PASS: network failure, cancellation, throttling, service outage, invalid JSON, input error, retry success, valid/missing/corrupt forecasts');
