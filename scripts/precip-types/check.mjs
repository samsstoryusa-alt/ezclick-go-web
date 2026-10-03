import assert from 'node:assert/strict';
import {nearestTypeFrame} from '../../app/precip-types.ts';
import {precipColor} from '../../app/weather-palette.ts';
assert.equal(nearestTypeFrame([{time:1000000,url:'a'}],1240001),null);
assert.equal(nearestTypeFrame([{time:1000000,url:'a'},{time:1100000,url:'b'}],1090000)?.url,'b');
assert.deepEqual(precipColor(0,255,0,2).slice(0,3),[192,165,247]);
assert.equal(precipColor(255,0,0,0)[3],0);
assert.equal(precipColor(0,255,0,3)[3],0);
console.log('Precipitation timestamp and color checks passed');
