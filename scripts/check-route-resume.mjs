import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const duration={};new Function('exports',compile(fs.readFileSync('app/route-duration.ts','utf8')))(duration);
assert.equal(duration.formatRouteDuration(10*3600+59*60+31),'11h 0m');assert.equal(duration.formatRouteDuration(3599),'1h 0m');assert.equal(duration.formatRouteDuration(0),'0h 0m');assert.equal(duration.formatRouteDuration(30),'0h 1m');
assert.equal(duration.formatRouteDuration(duration.totalTripSeconds(10*3600+30*60,60)),'11h 30m');assert.equal(duration.totalTripSeconds(3600,0),3600);
console.log('PASS: duration rounding carries hours; total includes breaks; zero/no-break and half-minute boundary');
const source=ts.createSourceFile('route.tsx',fs.readFileSync('app/weather-route.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let callback;
function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(source)==='useEffect'&&node.arguments[0]?.getText(source).includes('handledResume.current===resumeRequest'))callback=node.arguments[0];ts.forEachChild(node,visit);}visit(source);assert.ok(callback);
const code=compile('const handler='+callback.getText(source)+';exports.handler=handler;');
function setup(overrides={}){const calls={build:0},handledResume={current:0},restoredBuild={current:false},exports={};const args={resumeRequest:1,handledResume,restoredBuild,map:{},active:true,citiesOnly:false,points:[[-86.7816,36.1627],[-81.6557,30.3322]],route:null,busy:false,setMobileStep(){},setMobileEditing(){},setMobileChoices(){},build(){calls.build++;},...overrides};new Function('exports',...Object.keys(args),code)(exports,...Object.values(args));return {...calls,args,run:exports.handler,calls};}
let test=setup();test.run();test.run();assert.equal(test.calls.build,1);assert.equal(test.args.restoredBuild.current,true);
for(const state of [{resumeRequest:0},{map:null},{active:false},{citiesOnly:true},{points:[null,[-81,30]]}]){test=setup(state);test.run();assert.equal(test.calls.build,0);assert.equal(test.args.handledResume.current,0);}
for(const state of [{route:{}},{busy:true}]){test=setup(state);test.run();assert.equal(test.calls.build,0);}
test=setup({map:null});test.run();test.args.map={};const late=setup({handledResume:test.args.handledResume});late.run();assert.equal(late.calls.build,1);
console.log('PASS: resume waits for map and full route view, builds once, rejects incomplete points, reuses current route, avoids concurrent builds');
