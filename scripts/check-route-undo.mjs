import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const tree=ts.createSourceFile('route.tsx',fs.readFileSync('app/weather-route.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=['rememberRoute','change','changeVia','clearRoute','undoRoute'],handlers={};
function visit(n){if(ts.isFunctionDeclaration(n)&&names.includes(n.name?.text))handlers[n.name.text]=n.getText(tree);ts.forEachChild(n,visit);}visit(tree);
assert.equal(Object.keys(handlers).length,names.length);
const code=ts.transpileModule(Object.values(handlers).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const initial=[[-86.7816,36.1627],[-81.6557,30.3322]];
function setup(initial){
 let points=structuredClone(initial),via=[],historySize=0,autoAttempt=0,autoWaiting=false,autoBuildPoints=null;
 const current={current:points},routeHistory={current:[]},motionTimer={current:null},voiceBuild={current:null},restoredBuild={current:false},autoBuildStarted={current:null};
 const calls={abort:0,gestureCancel:0,show:0,clear:0,voice:[],saved:[]};
 const t=x=>x,setHistorySize=n=>historySize=n,setPoints=p=>{points=p;current.current=p;},setVia=p=>via=p,
  setAutoAttempt=fn=>autoAttempt=fn(autoAttempt),setAutoWaiting=v=>autoWaiting=v,setAutoBuildPoints=v=>autoBuildPoints=v,
  cancelBuild=()=>calls.abort++,cancel=()=>calls.gestureCancel++,onShowInfo=()=>calls.show++,onClear=()=>calls.clear++,
  voiceResult=(...args)=>calls.voice.push(args),saveTrip=patch=>calls.saved.push(patch),
  setPointsOpen=()=>{},select=()=>{},edit=()=>{},setViaError=()=>{},setVoiceFocusRoute=()=>{},setMobileChoices=()=>{},
  setMobileEditing=()=>{},setMobileStep=()=>{},setRouteSettings=()=>{},setRemoving=()=>{},setClosing=()=>{};
}
function harness(){
 const source=setup.toString(),body=source.slice(source.indexOf('{')+1,source.lastIndexOf('}'));
 return new Function('initial',body+code+'\nreturn {change,changeVia,clearRoute,undoRoute,voiceBuild,state:()=>structuredClone({points,via,historySize,autoAttempt,autoWaiting,autoBuildPoints,calls})};')(initial);
}
const h=harness(),columbia=[-81.035,34.0007],moved=[-80.96,34.11];
h.change(initial);assert.equal(h.state().historySize,0,'no-op endpoint selection has no history');
h.changeVia([columbia]);h.changeVia([moved]);h.changeVia([]);
h.undoRoute();assert.deepEqual(h.state().via,[moved],'restore removed via');
h.undoRoute();assert.deepEqual(h.state().via,[columbia],'restore moved via');
h.undoRoute();assert.deepEqual(h.state().via,[],'undo insertion');
assert.deepEqual(h.state().points,initial);assert.equal(h.state().historySize,0);
const calls=h.state().calls.abort;h.undoRoute();assert.equal(h.state().calls.abort,calls,'empty Undo does nothing');
h.changeVia([columbia]);h.clearRoute();assert.deepEqual(h.state().points,[null,null]);
h.undoRoute();assert.deepEqual(h.state().points,initial);assert.deepEqual(h.state().via,[columbia],'Undo Clear restores all points together');
assert.equal(h.state().autoWaiting,true);assert.equal(h.state().autoBuildPoints,JSON.stringify(initial));
h.change([null,initial[1]]);h.undoRoute();assert.deepEqual(h.state().points,initial);
h.change([initial[0],[-81.6,30.4]]);h.voiceBuild.current={turn:'pending'};
h.undoRoute();assert.deepEqual(h.state().points,initial);assert.equal(h.voiceBuild.current,null);assert.equal(h.state().calls.voice.at(-1)[1],'cancelled');
const voice=harness();voice.change(initial,[columbia]);voice.undoRoute();assert.deepEqual(voice.state().via,[],'same-endpoint voice via counts as one edit');
const partial=harness();partial.clearRoute();partial.change([initial[0],null]);partial.undoRoute();assert.equal(partial.state().autoWaiting,false);assert.equal(partial.state().autoBuildPoints,null,'incomplete Undo must not calculate');
const cap=harness();for(let i=0;i<25;i++)cap.changeVia([[-81+i/100,34]]);
assert.equal(cap.state().historySize,20);for(let i=0;i<20;i++)cap.undoRoute();assert.equal(cap.state().historySize,0);
assert.ok(h.state().calls.saved.every(p=>!('departure'in p)&&!('vehicle'in p)),'geometry undo leaves time and vehicle preferences alone');
console.log('PASS: real route edit handlers; multi-step add/move/remove via, endpoint/clear undo, no-op, bounded history, incomplete routes, cancellation, preference preservation');
