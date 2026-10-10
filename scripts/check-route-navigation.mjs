import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const helpers={};new Function('exports',compile(fs.readFileSync('app/route-navigation-link.ts','utf8')))(helpers);
const destination=[-81.6557,30.3322];
for(const point of [null,undefined,{},[],[1],[1,2,3],['1',2],[NaN,30],[1,Infinity],[0,91],[0,-91],[181,0],[-181,0],[278.3443,30.3322]]){
 assert.equal(helpers.destinationGeoUrl(point),null);
 assert.deepEqual(helpers.destinationNavigationOptions(point),[]);
}
assert.equal(helpers.destinationGeoUrl([0,0]),'geo:0,0?q=0.000000,0.000000');
assert.equal(helpers.destinationGeoUrl([180,90]),'geo:0,0?q=90.000000,180.000000');
assert.equal(helpers.destinationGeoUrl([-180,-90]),'geo:0,0?q=-90.000000,-180.000000');
const android={userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',platform:'Linux aarch64',maxTouchPoints:5};
const iphone={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',platform:'iPhone',maxTouchPoints:5};
const desktopUA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
const iphoneDesktop={userAgent:desktopUA,platform:'iPhone',maxTouchPoints:5};
const ipadDesktop={userAgent:desktopUA,platform:'MacIntel',maxTouchPoints:5};
const windows={userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130',platform:'Win32',maxTouchPoints:10};
const browsers=[iphone,iphoneDesktop,ipadDesktop,android,windows,{}];
for(const browser of browsers){
 const choices=helpers.destinationNavigationOptions(destination,browser);
 assert.deepEqual(choices.map(c=>c.label),['Trucker Path','Apple Maps','Google Maps']);
 assert.equal(new Set(choices.map(c=>c.id)).size,3);
 const [tp,apple,google]=choices.map(c=>new URL(c.url));
 assert.equal(tp.protocol,'truckerpath:'); assert.equal(tp.host,'cal_route');
 assert.equal(tp.searchParams.get(browser===android?'d_addr':'daddr'),'30.332200,-81.655700');
 assert.equal(tp.searchParams.has(browser===android?'daddr':'d_addr'),false);
 assert.equal(apple.host,'maps.apple.com'); assert.equal(apple.searchParams.get('daddr'),'30.332200,-81.655700');
 assert.equal(google.host,'www.google.com'); assert.equal(google.searchParams.get('destination'),'30.332200,-81.655700');
 assert.equal(google.searchParams.get('api'),'1');
 for(const url of [tp,apple,google]){assert.equal(url.searchParams.has('saddr'),false);assert.equal(url.searchParams.has('origin'),false);assert.equal(url.searchParams.has('s_addr'),false);}
 assert.equal(choices[0].target,undefined);
 assert.equal(choices[1].target,browser===windows||Object.keys(browser).length===0?'_blank':undefined);
 assert.equal(choices[2].target,choices[1].target);
}
console.log('PASS: all platforms keep explicit three-app choice; documented Trucker Path iOS/Android parameter names; Safari desktop UA; coordinate validation and destination-only links');
const code=compile(fs.readFileSync('app/route-navigator.tsx','utf8'));
function render(browser,props={}){
 const component={};
 const load=name=>name==='./route-navigation-link'?helpers:name==='./weather-language'?{useWeatherLanguage:()=>({t:value=>value})}:name.endsWith('.css')?{}:require(name);
 new Function('exports','require','navigator',code)(component,load,browser);
 return renderToStaticMarkup(createElement(component.default,{available:true,destination,...props}));
}
for(const browser of browsers){
 const html=render(browser);
 const button=html.match(/<button\b[^>]*>/)[0];
 assert.ok(button.includes('aria-haspopup="menu"')); assert.ok(button.includes('aria-expanded="false"'));
 assert.equal(button.includes('href='),false); assert.equal(button.includes('disabled='),false);
 assert.equal((html.match(/role="menuitem"/g)||[]).length,3);
 assert.ok(/role="menu"[^>]*inert=""[^>]*aria-hidden="true"/.test(html));
 for(const choice of helpers.destinationNavigationOptions(destination,browser))assert.ok(html.includes(`href="${choice.url.replaceAll('&','&amp;')}"`));
}
for(const props of [{available:false},{destination:null},{destination:[181,0]}]){
 const html=render(iphone,props); assert.ok(html.includes('disabled=""'));assert.equal(html.includes('href='),false);
}
const translations={};new Function('exports',compile(fs.readFileSync('app/weather-translations.ts','utf8')))(translations);
for(const key of ['Choose navigation app','Trucker Path must be installed.','Only destination B is sent. Check the route and vehicle settings in your navigator.'])for(const {code} of translations.languages)if(code!=='en')assert.notEqual(translations.translateWeather(key,code),key);
console.log('PASS: actual trigger cannot navigate directly; options start hidden/inert; invalid routes expose no links; all 12 languages have menu copy');
