/** Lifecycle tests use explicit DOM/Canvas/scheduler mocks, not a real browser. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mountFox } from '../lib/browser.js';

class Target {
  listeners = new Map();
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  emit(type, fields = {}) { for (const callback of [...(this.listeners.get(type) ?? [])]) callback({ type, ...fields }); }
  get count() { return [...this.listeners.values()].reduce((n, values) => n + values.size, 0); }
}
function environment({ reduced = false, width = 900, height = 600, contextAvailable = true,
  failObserve = false, dpr = 1 } = {}) {
  const frames = new Map();
  const resizers = [], intersections = [], canvases = [];
  const media = Object.assign(new Target(), { matches: reduced });
  const document = Object.assign(new Target(), { hidden: false });
  let nextFrame = 0, paints = 0, resolveFonts;
  document.fonts = { ready: new Promise(resolve => { resolveFonts = resolve; }) };
  const view = Object.assign(new Target(), {
    devicePixelRatio: dpr,
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    matchMedia() { return media; },
    ResizeObserver: class {
      targets = new Set();
      constructor(callback) { this.callback = callback; resizers.push(this); }
      observe(target) { this.targets.add(target); if (failObserve) throw new Error('setup failed'); }
      disconnect() { this.targets.clear(); }
    },
    IntersectionObserver: class {
      targets = new Set();
      constructor(callback) { this.callback = callback; intersections.push(this); }
      observe(target) { this.targets.add(target); this.callback([{ target, isIntersecting: true }]); }
      disconnect() { this.targets.clear(); }
    },
  });
  document.defaultView = view;
  function makeCanvas() {
    const rect = { left: 40, top: 70, width, height };
    const ctx = new Proxy({
      fillText() { paints++; },
      measureText() { return { width: 8 }; },
    }, { get(target, name) { return name in target ? target[name] : () => {}; }, set(target, name, value) { target[name] = value; return true; } });
    const canvas = Object.assign(new Target(), { width: 0, height: 0, ownerDocument: document, rect,
      getContext() { return contextAvailable ? ctx : null; },
      getBoundingClientRect() { return { ...rect }; } });
    canvases.push(canvas); return canvas;
  }
  const canvas = makeCanvas();
  return { canvas, makeCanvas, document, view, media, frames, resizers, intersections,
    paints: () => paints,
    frame(timestamp) { const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback(timestamp); },
    resize() { for (const observer of resizers) observer.callback([]); },
    visible(value, target = canvas) { for (const observer of intersections) observer.callback([{ target, isIntersecting: value }]); },
    setReduced(value) { media.matches = value; media.emit('change'); },
    hidden(value) { document.hidden = value; document.emit('visibilitychange'); },
    resources() { return frames.size + document.count + view.count + media.count + canvases.reduce((n, c) => n + c.count, 0)
      + resizers.reduce((n, o) => n + o.targets.size, 0) + intersections.reduce((n, o) => n + o.targets.size, 0); },
    async fontsReady() { resolveFonts(); await Promise.resolve(); },
  };
}
function advance(env, frames = 1, start = 0) {
  for (let i = 0; i <= frames; i++) env.frame(start + i * (1000 / 60));
}

test('SSR import and one live mount own one bounded frame loop; dispose twice releases all mock resources', async () => {
  assert.equal(typeof globalThis.document, 'undefined');
  const env = environment();
  const fox = mountFox(env.canvas);
  assert.equal(env.frames.size, 1);
  assert.equal(fox.getStatus().running, true);
  advance(env, 10);
  assert.equal(fox.getState().tick, 10);
  assert.equal(env.frames.size, 1);
  const callbacks = [...env.frames.values()];
  fox.dispose(); fox.dispose();
  assert.equal(env.resources(), 0);
  assert.equal(fox.getStatus().disposed, true);
  assert.equal(env.canvas.width, 1);
  const paints = env.paints();
  callbacks.forEach(callback => callback(8000));
  env.resize(); env.visible(true); env.media.emit('change'); await env.fontsReady();
  assert.equal(env.paints(), paints);
  assert.equal(env.frames.size, 0);
  for (const call of [() => fox.configure({}), () => fox.reset(), () => fox.setPaused(false),
    () => fox.guide(0, 0), () => fox.leave(), () => fox.pounce(), () => fox.showStaticPose('idle'),
    () => fox.getState(), () => fox.exportText()]) assert.throws(call, /disposed/);
});

test('pointer storms coalesce to latest CSS-normalized guide plus one pounce, independent of DPR', () => {
  const env = environment({ dpr: 3 });
  const batches = [];
  const fox = mountFox(env.canvas, { onInputs: batch => batches.push(batch) });
  for (let n = 0; n < 3000; n++) env.canvas.emit('pointermove', { clientX: 40 + n % 900, clientY: 70 + 300 });
  env.canvas.emit('pointermove', { clientX: 40 + 900 * .75, clientY: 70 + 600 * .25 });
  for (let n = 0; n < 3000; n++) fox.pounce();
  assert.equal(fox.getStatus().pendingInputs, 2);
  advance(env);
  assert.deepEqual(batches[0], [{ type: 'guide', tick: 1, seq: 0, x: .5, y: -.5 }, { type: 'pounce', tick: 1, seq: 1 }]);
  assert.equal(fox.getStatus().pendingInputs, 0);
  assert.equal(fox.getState().behavior.kind, 'crouch');
  assert.equal(env.canvas.width, 1800);
  assert.equal(env.canvas.height, 1200);
  fox.dispose();
});

test('pause drops pending actions, reset/configuration preserve pause, resume records a policy leave', () => {
  const env = environment(); const batches = [];
  const fox = mountFox(env.canvas, { onInputs: batch => batches.push(batch) });
  fox.guide(.8, .1); advance(env, 2);
  assert.equal(fox.getState().target.active, true);
  fox.pounce(); fox.setPaused(true);
  const pausedTick = fox.getState().tick;
  assert.equal(fox.getStatus().pendingInputs, 0);
  assert.equal(fox.getStatus().pendingPolicyReset, true);
  assert.equal(env.frames.size, 0);
  fox.configure({ tailSway: .05 });
  env.hidden(true); env.hidden(false); env.resize();
  assert.equal(fox.getState().tick, pausedTick);
  assert.equal(env.frames.size, 0);
  fox.setPaused(false); advance(env, 1, 10000);
  assert.equal(fox.getState().target.active, false);
  assert.equal(batches.at(-1)[0].type, 'leave');
  assert.notEqual(fox.getState().behavior.kind, 'crouch');
  fox.setPaused(true); fox.reset();
  assert.equal(fox.getState().tick, 0);
  assert.equal(fox.getStatus().pendingInputs, 0);
  assert.equal(fox.getStatus().paused, true);
  assert.equal(env.frames.size, 0); fox.dispose();
});

test('reduced motion keeps a static specimen: deliberate guide/pounce work without ticks or RAF', () => {
  const env = environment({ reduced: true }); const fox = mountFox(env.canvas);
  const idle = fox.exportText();
  assert.equal(env.frames.size, 0);
  env.canvas.emit('pointermove', { clientX: 800, clientY: 300 });
  assert.equal(fox.exportText(), idle);
  fox.guide(.8, .2);
  assert.equal(fox.getStatus().staticPose, 'sniff');
  fox.pounce();
  assert.equal(fox.getStatus().staticPose, 'crouch');
  assert.equal(fox.getState().tick, 0);
  assert.equal(env.frames.size, 0);
  fox.setPaused(false); assert.equal(env.frames.size, 0);
  fox.setPaused(true); env.setReduced(false); assert.equal(env.frames.size, 0);
  fox.reset(); assert.equal(env.frames.size, 0);
  fox.setPaused(false); assert.equal(env.frames.size, 1);
  advance(env, 2); env.setReduced(true);
  assert.equal(env.frames.size, 0);
  assert.equal(fox.getStatus().staticPose, 'idle'); fox.dispose();
});

test('hidden, offscreen and zero-size causes compose; old callbacks do not advance after resubscription', () => {
  const env = environment(); const fox = mountFox(env.canvas);
  advance(env, 3);
  const stale = [...env.frames.values()][0];
  env.hidden(true); env.visible(false);
  env.canvas.rect.width = 0; env.resize();
  assert.equal(env.frames.size, 0);
  assert.equal(fox.getStatus().zeroSized, true);
  env.hidden(false); env.visible(true);
  assert.equal(env.frames.size, 0);
  env.canvas.rect.width = 900; env.resize();
  assert.equal(env.frames.size, 1);
  const before = fox.getState().tick;
  stale(1000000);
  assert.equal(fox.getState().tick, before);
  env.frame(1000000);
  assert.equal(fox.getState().tick, before);
  env.frame(1000000 + 1000 / 60);
  assert.equal(fox.getState().tick, before + 1);
  assert.equal(fox.getStatus().droppedMilliseconds, 0);
  fox.dispose();
});

test('long stalls are bounded to five ticks and discarded elapsed time is reported', () => {
  const env = environment(); const fox = mountFox(env.canvas);
  env.frame(0); env.frame(5000);
  assert.equal(fox.getState().tick, 5);
  assert.ok(Math.abs(fox.getStatus().droppedMilliseconds - (5000 - 5000 / 60)) < 1e-6);
  env.frame(5000 + 1000 / 60);
  assert.equal(fox.getState().tick, 6);
  fox.dispose();
});

test('leave, cancel and lost capture discard queued pounces and clear active guidance', () => {
  for (const eventName of ['pointerleave', 'pointercancel', 'lostpointercapture']) {
    const env = environment(); const fox = mountFox(env.canvas);
    fox.guide(.6, .3); advance(env, 1);
    fox.guide(.9, -.2); fox.pounce(); env.canvas.emit(eventName);
    assert.equal(fox.getStatus().pendingInputs, 0);
    env.frame(2 * 1000 / 60);
    assert.equal(fox.getState().target.active, false);
    assert.notEqual(fox.getState().behavior.kind, 'crouch');
    fox.dispose();
  }
});

test('invalid configuration/input is atomic and does not dispose a working controller', () => {
  const env = environment(); const fox = mountFox(env.canvas);
  const before = fox.getState();
  assert.throws(() => fox.configure({ tailSway: NaN }));
  assert.throws(() => fox.configure({ facing: 'up' }));
  assert.throws(() => fox.reset(-1));
  assert.throws(() => fox.guide(Infinity, 0));
  assert.throws(() => fox.setPaused('true'));
  assert.throws(() => fox.showStaticPose('flying'));
  assert.deepEqual(fox.getState(), before);
  assert.equal(fox.getStatus().disposed, false);
  assert.equal(env.frames.size, 1); fox.dispose();
  for (const grid of [{ cols: 79 }, { rows: 65 }, { cols: Infinity }, { monochrome: 'yes' }, { cells: 12 }]) {
    const next = environment(); assert.throws(() => mountFox(next.canvas, { grid })); assert.equal(next.resources(), 0);
  }
});

test('failed setup and unsupported Canvas roll back all owned listeners and observers', () => {
  for (const setup of [{ failObserve: true }, { contextAvailable: false }]) {
    const env = environment(setup);
    assert.throws(() => mountFox(env.canvas), /setup failed|Canvas 2D/);
    assert.equal(env.resources(), 0);
    assert.equal(env.canvas.width, 1);
  }
});

test('consumer callback errors stop the instance and release resources', () => {
  const a = environment();
  assert.throws(() => mountFox(a.canvas, { onStatus() { throw new Error('consumer status failed'); } }), /consumer status failed/);
  assert.equal(a.resources(), 0);
  const b = environment();
  const fox = mountFox(b.canvas, { onInputs() { throw new Error('consumer input failed'); } });
  fox.pounce(); b.frame(0);
  assert.throws(() => b.frame(1000 / 60), /consumer input failed/);
  assert.equal(b.resources(), 0);
  assert.equal(fox.getStatus().disposed, true);
});

test('multiple mounts share a borrowed scheduler without disposing it or each other', () => {
  const env = environment(); const subscribers = new Set(); let sharedDisposed = false, releases = 0;
  const source = { subscribe(callback) { subscribers.add(callback); let live = true; return () => { if (live) { live = false; releases++; subscribers.delete(callback); } }; },
    dispose() { sharedDisposed = true; } };
  const a = mountFox(env.canvas, { frameSource: source });
  const b = mountFox(env.makeCanvas(), { frameSource: source });
  assert.equal(subscribers.size, 2); assert.equal(env.frames.size, 0);
  const tick = value => { for (const callback of [...subscribers]) callback(value); };
  tick(0); tick(1000 / 60);
  assert.equal(a.getState().tick, 1); assert.equal(b.getState().tick, 1);
  a.setPaused(true); assert.equal(subscribers.size, 1);
  a.dispose(); tick(2 * 1000 / 60);
  assert.equal(b.getState().tick, 2); assert.equal(sharedDisposed, false);
  b.dispose(); assert.equal(subscribers.size, 0); assert.equal(sharedDisposed, false);
  assert.equal(releases, 2); assert.equal(env.resources(), 0);
});

test('repeated mount/dispose and bounded DPR/size preserve output and do not retain mock resources', () => {
  const env = environment({ width: 10000, height: 10000, dpr: 99 });
  for (let i = 0; i < 12; i++) {
    const fox = mountFox(env.canvas, { fox: { paused: true } });
    assert.ok(env.canvas.width <= 2560 && env.canvas.height <= 1536);
    assert.ok(env.canvas.width * env.canvas.height <= 3932160);
    assert.equal(fox.exportText().split('\n').length, 44);
    fox.dispose(); assert.equal(env.resources(), 0);
  }
  const narrow = environment({ width: 390, height: 300 });
  const fox = mountFox(narrow.canvas, { fox: { paused: true } });
  assert.equal(fox.getStatus().cols, 80); assert.equal(fox.getStatus().rows, 32);
  assert.equal(fox.exportText().split('\n')[0].length, 80);
  fox.dispose();
});
