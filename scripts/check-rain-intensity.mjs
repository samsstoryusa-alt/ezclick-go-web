import assert from 'node:assert/strict';
import {contrastRain,RAIN_COLORS} from '../app/rain-intensity-palette.ts';
const samples=[[45,139,169],[43,166,178],[55,190,148],[92,201,106],[219,193,75],[226,131,67],[204,81,92]];
for(let i=0;i<samples.length;i++)assert.deepEqual(contrastRain(...samples[i]),RAIN_COLORS[i]);
assert.deepEqual(contrastRain(192,165,247),[192,165,247],'snow must not become strong rain');
assert.deepEqual(contrastRain(0,0,0),[0,0,0],'unknown pixels stay unchanged');
for(let i=0;i<samples.length-1;i++){
 const midpoint=samples[i].map((v,j)=>(v+samples[i+1][j])/2);
 const mapped=contrastRain(...midpoint);
 mapped.forEach((v,j)=>assert.ok(v>=Math.min(RAIN_COLORS[i][j],RAIN_COLORS[i+1][j])-1&&v<=Math.max(RAIN_COLORS[i][j],RAIN_COLORS[i+1][j])+1));
}
console.log('Rain palette: all source knots, continuous intervals, snow and unknown preservation PASS');
