import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const compile=code=>ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const helper={};new Function('exports',compile(read('app/route-point-drag.ts')))(helper);
const tree=ts.createSourceFile('route.tsx',read('app/weather-route.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let finish,cancel,pin;
function visit(node){
 if(ts.isFunctionDeclaration(node)&&node.name?.text==='finishPointDrag')finish=node.getText(tree);
 if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='cancel')cancel=node.initializer.getText(tree);
 if(ts.isJsxOpeningElement(node)&&node.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(tree)==='className'&&p.initializer?.getText(tree).includes('route-pin ')))pin=node;
 ts.forEachChild(node,visit);
}visit(tree);
assert.ok(finish&&cancel&&pin,'test actual component gesture handlers');
const handlers=Object.fromEntries(pin.attributes.properties.filter(p=>ts.isJsxAttribute(p)&&/^onPointer(Down|Move|Up)$/.test(p.name.getText(tree))).map(p=>[p.name.getText(tree),p.initializer.expression.getText(tree)]));
function harness({index=0,pointerType='touch',busy=false,autoWaiting=false}={}){
 const initial=[[-86.7816,36.1627],[-81.6557,30.3322]],current={current:initial},gesture={current:null},dragPreview={current:null},suppress={current:false},autoBuildStarted={current:null};
 const calls={commit:[],build:[],waiting:[],dragging:[],show:0,repaint:0,capture:0},timers=new Map();let timerId=0;
 const args={...helper,current,gesture,dragPreview,suppress,autoBuildStarted,busy,autoWaiting,p:initial[index],i:index,
  map:{stop(){},project:([x,y])=>({x:x+200,y:y+100}),unproject:([x,y])=>({lng:x-200,lat:y-100}),getContainer:()=>({getBoundingClientRect:()=>({width:1000,height:700})}),triggerRepaint:()=>calls.repaint++},
  window:{setTimeout:callback=>{const id=++timerId;timers.set(id,callback);return id;}},clearTimeout:id=>timers.delete(id),
  change:next=>calls.commit.push(next),setDragging:v=>calls.dragging.push(v),setMobileChoices(){},setMobileEditing(){},setRouteSettings(){},setMobileStep(){},setAutoBuildPoints:v=>calls.build.push(v),setAutoWaiting:v=>calls.waiting.push(v),onShowInfo:()=>calls.show++};
 const api={};new Function('exports',...Object.keys(args),compile(`${finish}\nconst cancel=${cancel};exports.cancel=cancel;${Object.entries(handlers).map(([k,v])=>`exports.${k}=${v};`).join('\n')}`))(api,...Object.values(args));
 const event=(x=200,y=150,id=1)=>({button:0,isPrimary:true,pointerType,pointerId:id,clientX:x,clientY:y,stopPropagation(){},preventDefault(){},currentTarget:{setPointerCapture:()=>calls.capture++}});
 return {calls,current,gesture,dragPreview,suppress,initial,down:e=>api.onPointerDown(e??event()),move:(x,y,id)=>api.onPointerMove(event(x,y,id)),up:id=>api.onPointerUp(event(200,150,id)),cancel:api.cancel,hold:()=>{for(const cb of [...timers.values()])cb();timers.clear();},event};
}
for(const index of [0,1]){
 const h=harness({index});h.down();h.hold();h.move(217,142);
 assert.deepEqual(h.current.current,h.initial,'moving a finger does not mutate committed route');
 assert.equal(h.calls.build.length,0,'no network build scheduled while moving');
 assert.equal(h.calls.commit.length,0,'no persistent change while moving');
 h.up();
 assert.equal(h.calls.commit.length,1);assert.equal(h.calls.build.length,1,'one rebuild on release');
 assert.deepEqual(h.calls.commit[0][1-index],h.initial[1-index],'other endpoint preserved');
 assert.ok(Math.abs(h.calls.commit[0][index][0]-h.initial[index][0]-17)<1e-9,'grab offset preserved');
 assert.ok(Math.abs(h.calls.commit[0][index][1]-h.initial[index][1]+8)<1e-9);
 assert.equal(h.dragPreview.current,null);assert.equal(h.suppress.current,true,'no click opens edit after drag');
 h.up();assert.equal(h.calls.build.length,1,'repeated release cannot rebuild twice');
}
let h=harness();h.down();h.up();assert.equal(h.suppress.current,false,'short tap still edits');assert.equal(h.calls.commit.length,0);
h=harness();h.down();h.move(225,150);h.hold();h.move(240,150);h.up();assert.equal(h.calls.commit.length,0,'early swipe does not move point');assert.equal(h.suppress.current,true);
h=harness();h.down();h.hold();h.move(220,150);h.cancel();h.up();assert.equal(h.calls.commit.length,0,'pointer cancellation restores original route');assert.equal(h.calls.build.length,0);assert.deepEqual(h.current.current,h.initial);assert.equal(h.dragPreview.current,null);
h=harness();h.down();h.hold();h.move(220,150,2);h.up(2);assert.equal(h.calls.commit.length,0,'second finger cannot commit first finger gesture');h.cancel();
h=harness({pointerType:'mouse'});h.down();h.move(212,144);h.up();assert.equal(h.calls.commit.length,1,'desktop mouse drag still works without a hold');
for(const flags of [{busy:true},{autoWaiting:true}]){h=harness(flags);h.down();h.hold();h.move(220,150);h.up();assert.equal(h.calls.commit.length,0);assert.equal(h.calls.capture,0,'calculating state rejects new drag');}
h=harness();h.down({...h.event(),isPrimary:false});assert.equal(h.calls.capture,0,'secondary pointer ignored');
console.log('PASS: actual A/B touch and mouse handlers; hold/tap/swipe, grab offset, no commit during movement, single release rebuild, cancellation, second pointer, busy guard');
