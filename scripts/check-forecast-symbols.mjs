import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=fs.readFileSync('app/forecast-condition.tsx','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const mod={};new Function('require','exports',js)(require,mod);
const classify=(condition,extra={})=>mod.forecastCondition({available:true,condition,...extra}).kind;
assert.equal(classify('Winter Storm'),'snow');
assert.equal(classify('Snow Showers'),'snow');
assert.equal(classify('Freezing Rain'),'ice');
assert.equal(classify('Thunderstorms and Rain'),'storm');
assert.equal(classify('Sunny',{windMph:21}),'wind');
assert.equal(classify('Cloudy',{gustMph:48}),'wind');
assert.equal(classify('Sunny',{available:false}),'unknown');
assert.notEqual(classify('Road closed due to snow'),'closure');
assert.notEqual(classify('Ice storm'),'storm');
console.log('Forecast symbols: winter vs thunderstorm, wind, missing data, and no inferred closures PASS');
if(process.argv[2]){
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const names={clear:'Clear',cloud:'Cloudy',rain:'Rain',snow:'Snow',ice:'Ice / freezing rain',storm:'Thunderstorms',fog:'Low visibility',wind:'Strong wind',unknown:'No forecast',closure:'Road closed'};
 const css=fs.readFileSync('app/weather-route.css','utf8');
 const cards=Object.entries(names).map(([kind,label])=>`<article>${renderToStaticMarkup(React.createElement(mod.WeatherSymbol,{kind,size:48}))}<strong>${label}</strong><small>${kind==='closure'?'Requires a confirmed DOT / 511 report':'Forecast icon · design preview'}</small></article>`).join('');
 fs.writeFileSync(process.argv[2],`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Weather symbols · EZCLICK GO</title><style>${css}body{margin:0;background:#091923;color:#e3f5fa;font-family:Arial,sans-serif;padding:40px;box-sizing:border-box}h1{font-size:28px;margin-bottom:10px}p{color:#a9c8d4;line-height:1.5}main{max-width:1000px;margin:auto}.icons{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-top:30px}article{padding:26px 14px;background:#132e3f;border:1px solid #476677;border-radius:18px;display:flex;flex-direction:column;gap:16px;align-items:center;text-align:center}article .forecast-symbol{width:64px;height:64px}strong{font-size:14px}small{font-size:11px;line-height:1.5;color:#98b9c8}.note{margin-top:24px;font-size:12px}@media(max-width:650px){body{padding:20px}.icons{grid-template-columns:repeat(2,1fr)}}</style><main><p>EZCLICK GO · WEATHER</p><h1>Forecast & road-event symbols</h1><p>Subtle motion for weather. A separate symbol for confirmed road closures.</p><div class="icons">${cards}</div><p class="note">Design preview, not live conditions. Snow does not imply a road closure. Closure data is not connected yet.</p></main></html>`);
}
