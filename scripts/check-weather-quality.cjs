const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const ts=require(root+'/node_modules/typescript');
let stored=null,blocked=false,listener,events=0;
const context={exports,require:n=>{assert.equal(n,'react');return {useSyncExternalStore:(subscribe,snapshot)=>{listener=subscribe(()=>events++);return snapshot();}}},localStorage:{getItem(){if(blocked)throw Error();return stored;},setItem(k,v){if(blocked)throw Error();stored=v;}},Event,window:{addEventListener(){},removeEventListener(){},dispatchEvent(){events++;}}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(root+'/app/weather-quality.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
assert.equal(exports.getWeatherQuality(),'balanced');stored='corrupt';assert.equal(exports.getWeatherQuality(),'balanced');
for(const mode of ['light','balanced','maximum']){exports.setWeatherQuality(mode);assert.equal(stored,mode);assert.equal(exports.useWeatherQuality(),mode);}
listener();blocked=true;exports.setWeatherQuality('light');assert.equal(exports.getWeatherQuality(),'light');
exports.setWeatherQuality('invalid');assert.equal(exports.getWeatherQuality(),'light');assert.ok(events>=4);
const p=exports.qualityProfiles;assert.ok(p.light.maxParticles<p.balanced.maxParticles&&p.balanced.maxParticles<p.maximum.maxParticles);assert.ok(p.light.pixelRatio<p.balanced.pixelRatio&&p.balanced.pixelRatio<p.maximum.pixelRatio);
console.log('PASS: default, corrupt storage, three profiles, immediate subscribers, blocked storage fallback, invalid input and ordered rendering budgets');
