// Execute the actual radar loading effect with deterministic resource ownership.
// No network, browser, phone, real pixel allocation or memory measurements.
// Optional argument: absolute application source root. Also works after moving
// this file to scripts/precip-types/check-cache.cjs inside that source tree.
/* eslint-disable @typescript-eslint/no-require-imports -- This standalone .cjs runner deliberately uses CommonJS and resolves TypeScript from the selected checkout. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const candidates = [process.argv[2], path.resolve(__dirname, '../support-feature/source'), path.resolve(__dirname, '../..')].filter(Boolean);
const root = candidates.find(candidate => fs.existsSync(path.join(candidate, 'app/radar-controls.tsx')));
assert.ok(root, 'pass the absolute application source-root directory');
const ts = require(path.join(root, 'node_modules/typescript'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const compile = source => ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
const sourceText = read('app/radar-controls.tsx');
const source = ts.createSourceFile('radar-controls.tsx', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect;
(function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect') {
    const body = node.arguments[0]?.getText(source) || '';
    if (body.includes('ImageBitmap') && body.includes('async function load')) effect = node.arguments[0];
  }
  ts.forEachChild(node, visit);
})(source);
assert.ok(effect, 'locate the actual radar-loading useEffect');
const effectCode = compile('exports.setup=' + effect.getText(source));
const forecast = {};
new Function('exports', compile(read('app/forecast-time.ts')))(forecast);
const timeoutCode = compile(read('app/abort-timeout.ts'));
const flush = async () => { for (let n = 0; n < 3; n++) await new Promise(resolve => setImmediate(resolve)); };
const HOUR = 3600000;
const START = Date.UTC(2026, 9, 7, 6, 17);
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
function plan(now = START, options = {}) {
  const base = options.base ?? Math.floor(now / HOUR) * HOUR;
  const run = options.run ?? base - 6 * HOUR;
  const frames = Array.from({length: 40}, (_, index) => ({time: base + index * HOUR, run, url: '/forecast/' + run + '_' + (base + index * HOUR) + '.png'}));
  return {now, frames, fetchFailures: new Set(), decodeGates: new Map(), decodeFailures: new Set(), ...options};
}
function harness(initial = plan(), options = {}) {
  let current = initial, clock = initial.now, stopped = false, cleanup;
  let requestId = 0, playerCreates = 0, commits = 0, replacements = 0, bitmapId = 0;
  let contextFailureAt = null, enhanceFailureAt = null, enhanceCalls = 0;
  const intervals = new Map(), deadlines = new Map(), listeners = new Map();
  const bitmaps = [], canvases = [], fetches = [], decoded = [], stateAfterStop = [], allMotions = [];
  const player = {current: null};
  const state = {failed: false, status: '', frames: []};
  const actualTimeout = {};
  new Function('exports', 'AbortController', 'DOMException', 'setTimeout', 'clearTimeout', timeoutCode)(
    actualTimeout, AbortController, DOMException,
    (fn, ms) => { const id = ++requestId; deadlines.set(id, {fn, ms}); return id; },
    id => deadlines.delete(id),
  );
  const recordState = (name, value) => {
    if (stopped) stateAfterStop.push(name);
    state[name] = value;
  };
  function makeBitmap(blob) {
    const dimensions = blob.attempt.invalidDimensions?.get(blob.index) ?? [1024, 600];
    const bitmap = {id: ++bitmapId, url: blob.url, attempt: blob.attempt, width: dimensions[0], height: dimensions[1], closeCalls: 0,
      close() { this.closeCalls++; },
    };
    bitmaps.push(bitmap); return bitmap;
  }
  function makeCanvas() {
    const canvas = {id: canvases.length + 1, width: 300, height: 150,
      getContext() { return contextFailureAt === canvas.id ? null : {canvas}; },
    };
    canvases.push(canvas); return canvas;
  }
  function assertReadable(image) {
    assert.ok(image, 'render only an existing image');
    assert.ok(image.width > 1 && image.height > 1, 'do not render a released image/canvas');
    if ('closeCalls' in image) assert.equal(image.closeCalls, 0, 'do not render a closed bitmap');
  }
  function makeMotion() {
    const motion = {disposeCalls: 0, draw() { return true; }, dispose() { this.disposeCalls++; }};
    allMotions.push(motion); return motion;
  }
  const motionGate = options.motionGate;
  const environment = {
    exports: {}, map: {}, ready: true, enabled: true, AbortController, DOMException,
    Date: class extends Date { static now() { return clock; } },
    document: {hidden: false, createElement: makeCanvas, addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type)},
    window: {}, ...actualTimeout,
    fetch: async (url, {signal}) => {
      if (signal?.aborted) throw signal.reason;
      const chosen = current;
      if (url.endsWith('/frames')) {
        fetches.push({kind: 'catalog', url, plan: chosen});
        return {ok: true, json: async () => ({frames: chosen.frames})};
      }
      const index = chosen.frames.findIndex(frame => url.endsWith(frame.url));
      assert.ok(index >= 0, 'known frame in the selected catalog');
      fetches.push({kind: 'frame', url, plan: chosen, index});
      return {ok: !chosen.fetchFailures.has(index), blob: async () => ({url, index, attempt: chosen})};
    },
    typeServiceBase: () => '/weather-types',
    createImageBitmap: async blob => {
      decoded.push(blob);
      const gate = blob.attempt.decodeGates.get(blob.index);
      if (gate) await gate.promise; // Browser decoding itself is not abortable.
      if (blob.attempt.decodeFailures.has(blob.index)) throw new Error('Decode failed');
      return makeBitmap(blob);
    },
    forecastWindow: forecast.forecastWindow,
    blendRadar(ctx, first, second) { assertReadable(first); assertReadable(second); assert.ok(ctx); },
    enhancePrecipitation() { enhanceCalls++; if (enhanceFailureAt === enhanceCalls) throw new Error('Pixel read failed'); },
    motionPreview: !!options.motionPreview,
    createPrecipMotion: async () => { if (motionGate) await motionGate.promise; return makeMotion(); },
    player,
    createRadarPlayer(_map, images, onPosition, _onSmooth, motion) {
      playerCreates++;
      images.forEach(assertReadable);
      return {images, motion, position: () => 0,
        replace(next, index, nextMotion) {
          next.forEach(assertReadable);
          this.motion?.dispose(); this.images = next; this.motion = nextMotion; replacements++; onPosition(index);
        },
        seek() {}, play() {}, opacity() {},
        dispose() {
          this.motion?.dispose();
          for (const canvas of this.images) { canvas.width = 1; canvas.height = 1; }
        },
      };
    },
    qualityFps: {current: 30}, timeline: {current: null},
    setStatus: value => recordState('status', value), setFailed: value => recordState('failed', value),
    setMotionReady: value => recordState('motionReady', value), setIndex: value => recordState('index', value),
    setRun: value => recordState('run', value), setPlaying: value => recordState('playing', value),
    setFrames(value) { commits++; recordState('frames', value); },
    setInterval(fn, ms) { const id = ++requestId; intervals.set(id, {fn, ms}); return id; },
    clearInterval: id => intervals.delete(id),
  };
  new Function(...Object.keys(environment), effectCode)(...Object.values(environment));
  cleanup = environment.exports.setup();
  return {
    bitmaps, canvases, fetches, decoded, player, state, deadlines, intervals, listeners, allMotions,
    get commits() { return commits; }, get playerCreates() { return playerCreates; }, get replacements() { return replacements; },
    get stopped() { return stopped; },
    setPlan(next) { current = next; clock = next.now; },
    refresh() { assert.equal(intervals.size, 1); [...intervals.values()][0].fn(); },
    fireDeadline(ms) {
      const matching = [...deadlines.entries()].filter(([, timer]) => timer.ms === ms);
      assert.equal(matching.length, 1, 'exactly one pending deadline at ' + ms + ' ms');
      const [id, timer] = matching[0]; deadlines.delete(id); timer.fn();
    },
    liveBitmaps() { return bitmaps.filter(bitmap => bitmap.closeCalls === 0); },
    failContextOnNextCanvas(offset = 1) { contextFailureAt = canvases.length + offset; },
    failEnhanceAfter(offset = 1) { enhanceFailureAt = enhanceCalls + offset; },
    stop() { assert.equal(stopped, false); stopped = true; cleanup(); },
    assertLastSetAlive(previousBitmaps, previousCanvases) {
      assert.deepEqual(this.liveBitmaps().map(bitmap => bitmap.id), previousBitmaps.map(bitmap => bitmap.id), 'only the last complete bitmap set remains live');
      previousBitmaps.forEach(bitmap => assert.equal(bitmap.closeCalls, 0, 'keep previous successful bitmap open'));
      previousCanvases.forEach(assertReadable);
      assert.equal(player.current.images, previousCanvases, 'failed update must not replace previous display');
    },
    assertAllReleased() {
      assert.ok(stopped);
      for (const bitmap of bitmaps) assert.equal(bitmap.closeCalls, 1, 'each bitmap closes exactly once: ' + bitmap.id);
      for (const canvas of canvases) assert.deepEqual([canvas.width, canvas.height], [1, 1], 'release canvas backing store: ' + canvas.id);
      for (const motion of allMotions) assert.equal(motion.disposeCalls, 1, 'dispose every motion renderer exactly once');
      assert.equal(intervals.size, 0); assert.equal(deadlines.size, 0); assert.equal(listeners.size, 0);
      assert.deepEqual(stateAfterStop, [], 'do not publish state after cleanup');
    },
  };
}
async function initialized() {
  const h = harness(); await flush();
  assert.equal(h.commits, 1); assert.equal(h.playerCreates, 1); assert.equal(h.liveBitmaps().length, 26);
  assert.equal(h.player.current.images.length, 25);
  return h;
}
async function close(h) { if (!h.stopped) h.stop(); await flush(); h.assertAllReleased(); }
const tests = [];
function test(name, run) { tests.push({name, run}); }

test('repeated partial failed model runs preserve previous forecast without accumulation', async () => {
  const h = await initialized(), keep = [...h.liveBitmaps()], displayed = h.player.current.images;
  for (let run = 1; run <= 4; run++) {
    h.setPlan(plan(START + run * 6 * HOUR, {fetchFailures: new Set([8])})); h.refresh(); await flush();
    assert.equal(h.commits, 1); assert.equal(h.state.failed, true); h.assertLastSetAlive(keep, displayed);
    h.bitmaps.filter(bitmap => !keep.includes(bitmap)).forEach(bitmap => assert.equal(bitmap.closeCalls, 1));
  }
  await close(h);
});

test('late decode after failed batch cannot contaminate a newer retry or unlock its busy gate', async () => {
  const h = await initialized(), keep = [...h.liveBitmaps()], displayed = h.player.current.images;
  const oldDecode = deferred();
  h.setPlan(plan(START + 6 * HOUR, {fetchFailures: new Set([8]), decodeGates: new Map([[9, oldDecode]])}));
  h.refresh(); await flush();
  assert.ok(h.decoded.some(blob => blob.index === 9 && blob.attempt.decodeGates.has(9)), 'old decode started');
  assert.equal(h.state.failed, true, 'one failed request promptly fails the batch despite another pending decode');
  h.assertLastSetAlive(keep, displayed);
  const newDecode = deferred(), retry = plan(START + 6 * HOUR, {decodeGates: new Map([[0, newDecode]])});
  h.setPlan(retry); h.refresh(); await flush();
  assert.ok(h.decoded.some(blob => blob.attempt === retry && blob.index === 0), 'retry starts before old decode resolves');
  const catalogs = h.fetches.filter(fetch => fetch.kind === 'catalog').length;
  oldDecode.resolve(); await flush();
  assert.equal(h.bitmaps.filter(bitmap => bitmap.attempt.decodeGates.get(9) === oldDecode).every(bitmap => bitmap.closeCalls === 1), true);
  h.refresh(); await flush();
  assert.equal(h.fetches.filter(fetch => fetch.kind === 'catalog').length, catalogs, 'old completion cannot unlock another in-flight attempt');
  newDecode.resolve(); await flush();
  assert.equal(h.commits, 2); assert.equal(h.liveBitmaps().length, 26); assert.equal(h.state.failed, false);
  assert.ok(h.liveBitmaps().every(bitmap => bitmap.attempt === retry), 'only the newer successful attempt owns live cache');
  keep.forEach(bitmap => assert.equal(bitmap.closeCalls, 1));
  await close(h);
});

test('late initial decode after layer cleanup closes once and cannot create a player', async () => {
  const gate = deferred(), h = harness(plan(START, {decodeGates: new Map([[0, gate]])}));
  await flush(); assert.ok(h.decoded.some(blob => blob.index === 0));
  h.stop(); gate.resolve(); await flush();
  assert.equal(h.commits, 0); assert.equal(h.playerCreates, 0); h.assertAllReleased();
});

test('late refresh decode after layer cleanup cannot replace previous player', async () => {
  const h = await initialized(), gate = deferred();
  h.setPlan(plan(START + 6 * HOUR, {decodeGates: new Map([[0, gate]])})); h.refresh(); await flush();
  h.stop(); gate.resolve(); await flush();
  assert.equal(h.commits, 1); assert.equal(h.replacements, 0); h.assertAllReleased();
});

test('actual 20-second deadline rejects an unabortable late decode without replacing the previous set', async () => {
  const h = await initialized(), keep = [...h.liveBitmaps()], displayed = h.player.current.images, gate = deferred();
  const attempt = plan(START + 6 * HOUR, {decodeGates: new Map([[0, gate]])});
  h.setPlan(attempt); h.refresh(); await flush();
  assert.ok(h.decoded.some(blob => blob.attempt === attempt && blob.index === 0), 'decode has started before the deadline');
  h.fireDeadline(20000); await flush(); // Runs the real withAbortTimeout callback.
  assert.equal(h.commits, 1); assert.equal(h.player.current.images, displayed);
  gate.resolve(); await flush();
  assert.equal(h.commits, 1); assert.equal(h.state.failed, true); h.assertLastSetAlive(keep, displayed);
  const late = h.bitmaps.find(bitmap => bitmap.attempt === attempt && bitmap.url.endsWith(attempt.frames[0].url));
  assert.ok(late, 'non-abortable decoder still returned a bitmap');
  assert.equal(late.closeCalls, 1, 'the expired child signal closes its late bitmap exactly once');
  await close(h);
});

for (const failure of ['decode rejection', 'invalid bitmap dimensions']) test(failure + ' releases all new resources and keeps the prior successful set', async () => {
  const h = await initialized(), keep = [...h.liveBitmaps()], displayed = h.player.current.images;
  const options = failure === 'decode rejection'
    ? {decodeFailures: new Set([8])}
    : {invalidDimensions: new Map([[8, [512, 600]]])};
  h.setPlan(plan(START + 6 * HOUR, options)); h.refresh(); await flush();
  assert.equal(h.commits, 1); assert.equal(h.state.failed, true); h.assertLastSetAlive(keep, displayed);
  h.bitmaps.filter(bitmap => !keep.includes(bitmap)).forEach(bitmap => assert.equal(bitmap.closeCalls, 1));
  await close(h);
});

test('successful identical refresh reuses all bitmaps; shifted window reuses overlap only', async () => {
  const h = await initialized(), first = [...h.liveBitmaps()], initialCanvas = h.player.current.images;
  const base = Math.floor(START / HOUR) * HOUR, run = base - 6 * HOUR;
  const imageRequests = h.fetches.filter(fetch => fetch.kind === 'frame').length;
  h.setPlan(plan(START + 2 * 60000, {base, run})); h.refresh(); await flush();
  assert.equal(h.commits, 2); assert.equal(h.bitmaps.length, 26);
  assert.equal(h.fetches.filter(fetch => fetch.kind === 'frame').length, imageRequests);
  assert.deepEqual(h.liveBitmaps().map(bitmap => bitmap.id), first.map(bitmap => bitmap.id));
  initialCanvas.forEach(canvas => assert.deepEqual([canvas.width, canvas.height], [1, 1]));
  h.setPlan(plan(START + HOUR, {base, run})); h.refresh(); await flush();
  assert.equal(h.commits, 3); assert.equal(h.bitmaps.length, 27); assert.equal(h.liveBitmaps().length, 26);
  assert.equal(first[0].closeCalls, 1); first.slice(1).forEach(bitmap => assert.equal(bitmap.closeCalls, 0));
  assert.equal(h.playerCreates, 1); assert.equal(h.replacements, 2);
  await close(h);
});

for (const failure of ['getContext', 'enhance']) test('temporary canvas cleanup after ' + failure + ' failure keeps displayed frame intact', async () => {
  const h = await initialized(), keep = [...h.liveBitmaps()], displayed = h.player.current.images;
  if (failure === 'getContext') h.failContextOnNextCanvas(3); else h.failEnhanceAfter(3);
  h.setPlan(plan(START + 6 * HOUR)); h.refresh(); await flush();
  assert.equal(h.commits, 1); assert.equal(h.state.failed, true); h.assertLastSetAlive(keep, displayed);
  h.canvases.filter(canvas => !displayed.includes(canvas)).forEach(canvas => assert.deepEqual([canvas.width, canvas.height], [1, 1]));
  await close(h);
});

test('pending motion preparation cleanup releases temporary canvases and late motion renderer', async () => {
  const motionGate = deferred(), h = harness(plan(), {motionPreview: true, motionGate});
  await flush(); assert.equal(h.canvases.length, 25); assert.equal(h.commits, 0);
  h.stop(); motionGate.resolve(); await flush();
  assert.equal(h.playerCreates, 0); assert.equal(h.commits, 0); h.assertAllReleased();
});

async function main() {
  console.log('Source:', root);
  console.log('radar-controls.tsx SHA-256:', crypto.createHash('sha256').update(sourceText).digest('hex'));
  let failures = 0;
  for (const item of tests) {
    try { await item.run(); console.log('PASS:', item.name); }
    catch (error) { failures++; console.error('FAIL:', item.name); console.error(error.stack); }
  }
  console.log(JSON.stringify({tests: tests.length, passed: tests.length - failures, failed: failures, scope: 'actual source effect with mocked network/bitmap/canvas ownership, not browser RAM or phone performance'}));
  process.exitCode = failures ? 1 : 0;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
