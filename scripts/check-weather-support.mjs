import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const module = {};
const source = fs.readFileSync('app/weather-support-data.ts','utf8');
new Function('exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(module);
const context={language:'ru',quality:'balanced',units:'us',map:'ready',routeActive:true,route:['secret origin','secret destination'],token:'NEVER_SEND'};
const ios={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1',platform:'iPhone',maxTouchPoints:5,width:390,height:844,online:true};
const data=module.supportDiagnostics(context,ios,'test-build');
assert.equal(data.system,'iOS');assert.equal(data.browser,'Safari 18');assert.equal(data.device,'phone');
assert.equal(data.viewport,'390x844');assert.equal(data.build,'test-build');
assert(!JSON.stringify(data).includes('secret'));assert(!JSON.stringify(data).includes('NEVER_SEND'));assert(!JSON.stringify(data).includes('Mozilla'));
assert.equal(module.supportDiagnostics(context,{...ios,platform:'MacIntel',userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X) Version/18.1 Safari/605.1.15'},'test').device,'tablet');
assert.equal(module.supportDiagnostics(context,{...ios,userAgent:'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36'},'test').browser,'Chrome 130');
const translations={};new Function('exports',ts.transpileModule(fs.readFileSync('app/weather-translations.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(translations);
for(const language of translations.languages){assert(translations.translateWeather('Report a problem',language.code));if(language.code!=='en')assert.notEqual(translations.translateWeather('Report a problem',language.code),'Report a problem');}
const fetchOriginal=globalThis.fetch;
const report={requestId:'c61fc9e5-b868-421e-a193-c23f4dab6abe',description:'Test support form',replyTo:'',language:'en',diagnostics:null,aiConsent:true};
try{
 globalThis.fetch=async(url,options)=>{assert.equal(url,'/support-api/reports');assert.equal(options.credentials,'omit');assert.deepEqual(JSON.parse(options.body),report);return new Response(JSON.stringify({ticketId:'EZ-ABCDEF012345',status:'received'}),{status:202});};
 assert.equal(await module.sendSupportReport(report,new AbortController().signal),'EZ-ABCDEF012345');
 globalThis.fetch=async()=>new Response('rate limited',{status:429});await assert.rejects(()=>module.sendSupportReport(report,new AbortController().signal),/rate_limited/);
 globalThis.fetch=async()=>new Response('<html>proxy fallback</html>',{status:200});await assert.rejects(()=>module.sendSupportReport(report,new AbortController().signal));
 globalThis.fetch=async()=>new Response(JSON.stringify({ticketId:'<script>bad</script>'}),{status:202});await assert.rejects(()=>module.sendSupportReport(report,new AbortController().signal));
}finally{globalThis.fetch=fetchOriginal;}
console.log('PASS: privacy whitelist, mobile browsers, iPad desktop UA, all languages, real receipt validation, rate-limit/HTML error handling.');

for(const key of ["Allow AI-assisted review (optional)","OpenAI receives your description, language and device system to help review the issue. Your reply email is excluded.","Destination B opens in your navigation app. It calculates its own route; truck restrictions are not transferred."]) for(const language of translations.languages){ if(language.code!=='en') assert.notEqual(translations.translateWeather(key,language.code),key); }
