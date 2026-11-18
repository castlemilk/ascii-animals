// DOM/Canvas bookkeeping stubs, NOT native browser or visual evidence.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mountGecko } from '../compiled/browser.js';

class Events {
  listeners = new Map();
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  emit(type, data = {}) {
    const event = { type, target: this, currentTarget: this, prevented: false,
      preventDefault() { this.prevented = true; }, ...data };
    for (const callback of [...(this.listeners.get(type) ?? [])]) callback(event);
    return event;
  }
  get listenerCount() { return [...this.listeners.values()].reduce((n, set) => n + set.size, 0); }
}
function environment(options = {}) {
  const host = new Events();
  const document = new Events();
  const media = new Events();
  media.matches = options.reduced ?? false;
  document.hidden = false;
  document.defaultView = host;
  host.devicePixelRatio = options.dpr ?? 1;
  host.matchMedia = () => media;
  let nextFrame = 1;
  const frames = new Map();
  const observers = [];
  let draws = 0;
  host.requestAnimationFrame = callback => { const id = nextFrame++; frames.set(id, callback); return id; };
  host.cancelAnimationFrame = id => { frames.delete(id); };
  host.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.connected = false; this.kind = 'resize'; observers.push(this); }
    observe(target) { this.target = target; this.connected = true; if (options.failObserve) throw new Error('Observed setup failure'); }
    disconnect() { this.connected = false; }
  };
  host.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.connected = false; this.kind = 'intersection'; observers.push(this); }
    observe(target) { this.target = target; this.connected = true; }
    disconnect() { this.connected = false; }
  };
  const context = { setTransform() {}, fillRect() { draws++; }, fillText() {}, };
  function canvas() {
    const result = new Events();
    result.ownerDocument = document;
    result.width = 720; result.height = 550;
    result.rect = { left: 30, top: 70, width: options.width ?? 720, height: options.height ?? 550 };
    result.getBoundingClientRect = () => ({ ...result.rect });
    result.getContext = () => options.noCanvas ? null : context;
    return result;
  }
  const primary = canvas();
  return {
    host, document, media, frames, observers, canvas: primary, makeCanvas: canvas,
    get draws() { return draws; },
    frame(timestamp) { const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback(timestamp); },
    resize(target = primary) { for (const observer of observers.filter(o => o.kind === 'resize' && o.target === target)) observer.callback([{ target }]); },
    visible(value, target = primary) { for (const observer of observers.filter(o => o.kind === 'intersection' && o.target === target)) observer.callback([{ target, isIntersecting: value }]); },
    reduce(value) { media.matches = value; media.emit('change'); },
    hide(value) { document.hidden = value; document.emit('visibilitychange'); },
    resources() { return host.listenerCount + document.listenerCount + media.listenerCount + primary.listenerCount + frames.size + observers.filter(o => o.connected).length; }
  };
}

test('controller runs explicit 60 Hz ticks, coalesces pointer flood, and never queues more than two intents', () => {
  const env = environment(); const scene = mountGecko(env.canvas);
  for (let i = 0; i < 10_000; i++) scene.guide(i % 2 ? 1 : -1, .4);
  for (let i = 0; i < 100; i++) scene.startle();
  assert.equal(scene.getStatus().pendingInputs, 2);
  assert.equal(env.frames.size, 1);
  env.frame(0); env.frame(1000 / 60);
  assert.equal(scene.getStatus().tick, 1);
  assert.equal(scene.getSnapshot().lastSequence, 2);
  assert.equal(scene.getSnapshot().behavior.kind, 'startle');
  assert.equal(scene.getStatus().pendingInputs, 0);
  scene.dispose(); assert.equal(env.resources(), 0);
});

test('pause, reset and option/view updates preserve independent rest causes', () => {
  const env = environment(); const scene = mountGecko(env.canvas);
  scene.setPaused(true);
  const original = scene.getSnapshot();
  scene.update({ creepSpeed: .14 }); scene.setView({ neutral: true }); scene.reset({ seed: 51 });
  assert.equal(scene.getStatus().paused, true);
  assert.equal(env.frames.size, 0);
  assert.equal(scene.getSnapshot().seed, 51);
  assert.equal(scene.getSnapshot().options.creepSpeed, .14);
  assert.equal(scene.getSnapshot().tick, original.tick);
  env.hide(true); env.reduce(true); env.hide(false); scene.setPaused(false);
  assert.equal(scene.getStatus().reducedMotion, true);
  assert.equal(env.frames.size, 0);
  env.reduce(false);
  assert.equal(env.frames.size, 1);
  scene.dispose(); assert.equal(env.resources(), 0);
});

test('reduced motion starts static; pointer cannot revive it; deliberate curled poster changes cells without ticking', () => {
  const env = environment({ reduced: true }); const scene = mountGecko(env.canvas);
  const neutral = scene.exportText(); const before = scene.getSnapshot();
  for (let i = 0; i < 20; i++) env.canvas.emit('pointermove', { clientX: 80 + i, clientY: 100, pointerType: 'mouse' });
  assert.deepEqual(scene.guide(1, 1), { outcome: 'ignored', reason: 'resting' });
  assert.deepEqual(scene.startle(), { outcome: 'static' });
  assert.notEqual(scene.exportText(), neutral);
  assert.deepEqual(scene.getSnapshot(), before);
  assert.equal(scene.getStatus().poster, 'curled');
  assert.equal(env.frames.size, 0);
  scene.reset(); assert.equal(scene.exportText(), neutral); assert.equal(env.frames.size, 0);
  scene.dispose(); assert.equal(env.resources(), 0);
});

test('hidden/offscreen/zero-size causes compose and resumption discards wall-clock backlog and stale guidance', () => {
  const env = environment(); const scene = mountGecko(env.canvas);
  scene.guide(.8, -.8); env.frame(0); env.frame(1000 / 60);
  assert.notEqual(scene.getSnapshot().target, null);
  env.hide(true); env.visible(false);
  assert.equal(env.frames.size, 0);
  env.hide(false); assert.equal(env.frames.size, 0);
  env.canvas.rect.width = 0; env.resize(); env.visible(true);
  assert.equal(env.frames.size, 0);
  assert.equal(env.canvas.width, 0);
  assert.equal(env.canvas.height, 0);
  env.canvas.rect.width = 720; env.resize(); assert.equal(env.frames.size, 1);
  const tick = scene.getStatus().tick;
  env.frame(100_000); assert.equal(scene.getStatus().tick, tick);
  env.frame(100_000 + 1000 / 60);
  assert.equal(scene.getStatus().tick, tick + 1);
  assert.equal(scene.getSnapshot().target, null);
  assert.equal(scene.getStatus().droppedMilliseconds, 0);
  scene.dispose(); assert.equal(env.resources(), 0);
});

test('long foreground stall advances at most five ticks and accounts for discarded time', () => {
  const env = environment(); const scene = mountGecko(env.canvas);
  env.frame(0); env.frame(10_000);
  assert.equal(scene.getStatus().tick, 5);
  assert(Math.abs(scene.getStatus().droppedMilliseconds - (10_000 - 5000 / 60)) < 1e-6);
  assert.equal(env.frames.size, 1);
  scene.dispose();
});

test('pointer input uses moved CSS rect, not DPR; departures clear the target on the next tick', () => {
  const env = environment({ dpr: 3 }); const scene = mountGecko(env.canvas);
  env.canvas.rect = { left: 120, top: 210, width: 720, height: 550 };
  env.canvas.emit('pointerdown', { clientX: 840, clientY: 210, pointerType: 'touch', buttons: 1 });
  env.frame(0); env.frame(1000 / 60);
  const target = scene.getSnapshot().target;
  assert(target.x > 0 && target.y < 0);
  for (const type of ['pointerleave', 'pointercancel', 'lostpointercapture']) {
    scene.guide(1, -1); env.frame(scene.getStatus().tick * 1000 / 60 + 1000 / 60);
    env.canvas.emit(type); env.frame(scene.getStatus().tick * 1000 / 60 + 1000 / 60);
    assert.equal(scene.getSnapshot().target, null);
  }
  assert.equal(scene.getStatus().dimensions.dpr, 2);
  scene.dispose();
});

test('keyboard events are stage-local, never form-global, and offer all direction and pause controls', () => {
  const env = environment(); const scene = mountGecko(env.canvas);
  assert.equal(env.canvas.emit('keydown', { key: 'ArrowRight', target: {} }).prevented, false);
  for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) {
    assert.equal(env.canvas.emit('keydown', { key }).prevented, true);
    assert.equal(scene.getStatus().pendingInputs, 1);
  }
  assert.equal(env.canvas.emit('keydown', { key: ' ', code: 'Space' }).prevented, true);
  assert.equal(scene.getStatus().paused, true);
  assert.equal(env.frames.size, 0);
  assert.equal(env.canvas.emit('keydown', { key: 'Tab' }).prevented, false);
  scene.dispose();
});

test('backing dimensions and DPR stay capped; too-small and zero-size hosts schedule no work', () => {
  const env = environment({ width: 9000, height: 5000, dpr: 3 }); const scene = mountGecko(env.canvas);
  assert(env.canvas.width <= 2000); assert(env.canvas.height <= 1560);
  scene.setView({ maxDpr: 1 }); assert.equal(scene.getStatus().dimensions.dpr, 1);
  env.canvas.rect.width = 359; env.resize();
  assert.equal(scene.getStatus().tooSmall, true); assert.equal(env.frames.size, 0);
  const draws = env.draws; env.frame(1000); assert.equal(env.draws, draws);
  scene.dispose();
});

test('all exposed mutation/read methods reject after disposal except status and idempotent dispose', () => {
  const env = environment(); const scene = mountGecko(env.canvas);
  const saved = [...env.frames.values()]; const observers = env.observers.map(o => [o.callback, o.kind]);
  scene.dispose(); scene.dispose();
  assert.equal(scene.getStatus().disposed, true); assert.equal(env.resources(), 0);
  const draws = env.draws;
  for (const callback of saved) callback(3000);
  for (const [callback, kind] of observers) callback(kind === 'resize' ? [] : [{ target: env.canvas, isIntersecting: true }]);
  assert.equal(env.draws, draws); assert.equal(env.resources(), 0);
  for (const action of [() => scene.getSnapshot(), () => scene.update({}), () => scene.setView({}), () => scene.setPaused(false),
    () => scene.guide(0, 0), () => scene.clearGuide(), () => scene.startle(), () => scene.reset(), () => scene.exportText(), () => scene.redraw()]) {
    assert.throws(action, /disposed/);
  }
});

test('multiple controllers own independent listeners, clocks and teardown', () => {
  const env = environment(); const secondCanvas = env.makeCanvas();
  const first = mountGecko(env.canvas); const second = mountGecko(secondCanvas, { config: { seed: 51 } });
  first.guide(1, 1); second.guide(-1, -1); env.frame(0); env.frame(1000 / 60);
  assert.notDeepEqual(first.getSnapshot(), second.getSnapshot());
  first.dispose(); assert.equal(env.frames.size, 1); assert(secondCanvas.listenerCount > 0);
  const tick = second.getStatus().tick; env.frame(2000 / 60); assert.equal(second.getStatus().tick, tick + 1);
  second.dispose(); assert.equal(secondCanvas.listenerCount, 0); assert.equal(env.resources(), 0);
});

test('failed partial mount and missing Canvas leave no listeners, observers or RAF', () => {
  const env = environment({ failObserve: true });
  assert.throws(() => mountGecko(env.canvas), /setup failure/);
  assert.equal(env.resources(), 0);
  const unavailable = environment({ noCanvas: true });
  assert.throws(() => mountGecko(unavailable.canvas), /Canvas 2D is unavailable/);
  assert.equal(unavailable.resources(), 0);
});

test('consumer callback failure during setup or later phase transition rolls back owned resources', () => {
  const initial = environment();
  assert.throws(() => mountGecko(initial.canvas, { onStatus() { throw new Error('consumer setup failure'); } }), /consumer setup failure/);
  assert.equal(initial.resources(), 0);
  const env = environment(); let fail = false;
  const scene = mountGecko(env.canvas, { onStatus() { if (fail) throw new Error('consumer phase failure'); } });
  fail = true; scene.startle(); env.frame(0);
  assert.throws(() => env.frame(1000 / 60), /consumer phase failure/);
  assert.equal(scene.getStatus().disposed, true); assert.equal(env.resources(), 0);
});

test('invalid updates and mount options fail atomically before resource changes', () => {
  const env = environment(); const scene = mountGecko(env.canvas, { paused: true });
  const before = scene.getSnapshot(); const status = scene.getStatus();
  assert.throws(() => scene.update({ creepSpeed: Infinity }));
  assert.throws(() => scene.setView({ grid: { cols: 999, rows: 50 } }));
  assert.throws(() => scene.setView({ maxDpr: 3 }));
  assert.throws(() => scene.setPaused('yes'));
  assert.throws(() => scene.guide(NaN, 0));
  assert.deepEqual(scene.getSnapshot(), before);
  assert.deepEqual(scene.getStatus(), status);
  scene.dispose();
  for (const options of [{ paused: 'yes' }, { view: null }, { view: { neutral: 1 } }, { view: { grid: { cols: 112, rows: 49 } } }, { unknown: 1 }, { onStatus: 4 }, new Date(), { [Symbol('hidden')]: 1 }]) {
    const other = environment(); assert.throws(() => mountGecko(other.canvas, options)); assert.equal(other.resources(), 0);
  }
});

test('repeated mount/unmount has zero owned resources in the stub harness', () => {
  const env = environment();
  for (let i = 0; i < 20; i++) {
    const scene = mountGecko(env.canvas, { paused: i % 2 === 0 });
    scene.startle(); scene.reset(); scene.dispose();
    assert.equal(env.resources(), 0);
  }
});

test('reentrant status callback can pause during a five-tick catch-up without an extra simulation step', () => {
  const env = environment(); let scene; let pausedFromCallback = false;
  scene = mountGecko(env.canvas, { onStatus(status) {
    if (scene && status.phase === 'startle' && !status.paused && !pausedFromCallback) {
      pausedFromCallback = true; scene.setPaused(true);
    }
  } });
  scene.startle(); env.frame(0); env.frame(1000);
  assert.equal(scene.getStatus().tick, 1);
  assert.equal(scene.getStatus().paused, true);
  assert.equal(env.frames.size, 0);
  scene.setPaused(false); env.frame(2000);
  assert.equal(scene.getStatus().tick, 1, 'resuming starts a fresh clock');
  env.frame(2000 + 1000 / 60); assert.equal(scene.getStatus().tick, 2);
  scene.dispose(); assert.equal(env.resources(), 0);
});

function demoEnvironment(director = false, options = {}) {
  const env = environment(options);
  const ids = ['phase', 'pause', 'scene-help', 'action-status', 'fallback', 'fallback-message', 'text-frame',
    'reset', 'startle', 'rest', 'pace', 'pace-value', 'curl', 'curl-value', 'neutral', 'refresh-text', 'text-details'];
  const nodes = new Map([['gecko', env.canvas]]);
  function node(id) {
    const value = new Events(); value.id = id; value.textContent = ''; value.hidden = false; value.disabled = false;
    value.dataset = {}; value.attributes = new Map(); value.setAttribute = (key, data) => value.attributes.set(key, data);
    return value;
  }
  for (const id of ids) nodes.set(id, node(id));
  if(director){
    const directorIds=['director','scene-moonlit-wall','scene-lantern-hunt','scene-passing-shadow','population','tempo','boldness','reverse','show-routes','autonomy',
      'moth','return','inspect','scene-title','scene-beat','scene-progress','selected-name','selected-motive','selected-emotion','cooldown-note',
      'cast-mica','cast-pip','cast-slate','select-mica','select-pip','select-slate','role-mica','role-pip','role-slate'];
    for(const id of directorIds)nodes.set(id,node(id));
    env.canvas.attributes=new Map();env.canvas.setAttribute=(key,value)=>env.canvas.attributes.set(key,value);
  }
  const guides = [[0, -1], [-1, 0], [1, 0], [0, 1]].map((coords, i) => {
    const value = node(`guide-${i}`); value.dataset.guide = coords.join(','); return value;
  });
  env.document.getElementById = id => nodes.get(id) ?? null;
  env.document.querySelectorAll = selector => selector === '[data-guide]' ? guides : [...nodes.values(), ...guides];
  return { ...env, nodes, guides, controls: [...nodes.values()].filter(value => value !== env.canvas).concat(guides) };
}
let demoImport = 0;
async function loadDemo(env) {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: env.document });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: env.host });
  try { return await import(`../compiled/demo.js?host-test=${++demoImport}`); }
  finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else delete globalThis.document;
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete globalThis.window;
  }
}

test('actual demo host retains working controls across persisted pagehide/pageshow and preserves user pause', async () => {
  const env = demoEnvironment(); const demo = await loadDemo(env); const scene = demo.geckoDemo;
  assert(scene); env.nodes.get('pause').emit('click');
  assert.equal(scene.getStatus().paused, true);
  const controlListeners = env.controls.reduce((total, node) => total + node.listenerCount, 0);
  assert(controlListeners > 0);
  env.host.emit('pagehide', { persisted: true });
  assert.equal(scene.getStatus().pageSuspended, true);
  assert.equal(scene.getStatus().disposed, false);
  assert.equal(env.frames.size, 0);
  env.document.emit('visibilitychange');
  assert.equal(env.frames.size, 0, 'visibility alone must not revive a frozen page');
  env.host.emit('pageshow', { persisted: true });
  assert.equal(scene.getStatus().pageSuspended, false);
  assert.equal(scene.getStatus().paused, true);
  assert.equal(env.frames.size, 0);
  assert.equal(env.controls.reduce((total, node) => total + node.listenerCount, 0), controlListeners);
  env.nodes.get('startle').emit('click'); assert.equal(scene.getStatus().poster, 'curled');
  env.nodes.get('reset').emit('click'); assert.equal(scene.getStatus().poster, 'current');
  env.nodes.get('pause').emit('click'); assert.equal(scene.getStatus().paused, false); assert.equal(env.frames.size, 1);
  env.host.emit('pagehide', { persisted: false });
  assert.equal(scene.getStatus().disposed, true);
  assert.equal(env.resources(), 0);
  assert.equal(env.controls.reduce((total, node) => total + node.listenerCount, 0), 0);
});

test('actual demo bfcache freeze cancels work before visibility changes and resumes without catching up; navigation disposes', async () => {
  const env = demoEnvironment(); const demo = await loadDemo(env); const scene = demo.geckoDemo;
  assert(scene); env.guides[2].emit('click'); env.frame(0); env.frame(1000 / 60);
  const tick = scene.getStatus().tick; const savedFrame = [...env.frames.values()][0];
  env.nodes.get('startle').emit('click');
  env.host.emit('pagehide', { persisted: true });
  assert.equal(scene.getStatus().paused, false);
  assert.equal(scene.getStatus().pageSuspended, true);
  assert.equal(scene.getStatus().pendingInputs, 0);
  assert.equal(env.frames.size, 0);
  savedFrame(100_000); assert.equal(scene.getStatus().tick, tick);
  env.host.emit('pageshow', { persisted: true }); assert.equal(env.frames.size, 1);
  env.frame(100_000); assert.equal(scene.getStatus().tick, tick);
  env.frame(100_000 + 1000 / 60); assert.equal(scene.getStatus().tick, tick + 1);
  assert.equal(scene.getSnapshot().target, null);
  assert.notEqual(scene.getSnapshot().behavior.kind, 'startle', 'a pre-freeze pending startle must be discarded');
  assert.equal(scene.getStatus().droppedMilliseconds, 0);
  env.nodes.get('startle').emit('click'); assert.equal(scene.getStatus().pendingInputs, 1, 'controls remain usable after restore');
  env.host.emit('pagehide', { persisted: false });
  assert.equal(scene.getStatus().disposed, true); assert.equal(env.resources(), 0);
  assert.equal(env.controls.reduce((total, node) => total + node.listenerCount, 0), 0);
  env.host.emit('pageshow', { persisted: false }); assert.equal(env.resources(), 0);
});

test('opt-in director coalesces bounded cues and advances all residents through one host clock', () => {
  const env=environment(), scene=mountGecko(env.canvas,{director:{}});
  assert.equal(scene.getDirectorSnapshot().individuals.length,3);
  assert.equal(env.frames.size,1);
  for(let i=0;i<1000;i++){scene.guide(i%2?1:-1,.1);scene.direct({type:'moth'});}
  assert.equal(scene.getStatus().pendingInputs,2);
  env.frame(0);env.frame(1000/60);
  const state=scene.getDirectorSnapshot();
  assert.equal(state.tick,1);assert.equal(state.lastSequence,2);
  assert.deepEqual(state.individuals.map(a=>a.body.tick),[1,1,1]);
  assert.equal(state.lastAction.type,'moth');assert.equal(env.frames.size,1);
  scene.dispose();assert.equal(env.resources(),0);
});

test('director mobile pointer mapping follows the focused letterbox and freezes cue ownership', () => {
  const env=environment({width:400,height:400,dpr:3}),scene=mountGecko(env.canvas,{director:{}});
  const initial=scene.getDirectorSnapshot(),mica=initial.individuals[0];
  env.canvas.emit('pointerdown',{clientX:230,clientY:270,pointerType:'touch',buttons:1});
  env.frame(0);env.frame(1000/60);
  const pointer=scene.getDirectorSnapshot().pointer;
  assert(Math.abs(pointer.x-mica.body.position.x*mica.scale)<1e-12);
  assert(Math.abs(pointer.y-mica.body.position.y*mica.scale)<1e-12);
  assert.equal(scene.getStatus().dimensions.dpr,2);
  scene.reset();env.canvas.emit('pointerdown',{clientX:230,clientY:75,pointerType:'touch',buttons:1});
  assert.equal(scene.getStatus().pendingInputs,0,'letterbox margin is not wall guidance');
  scene.selectGecko(null);scene.guide(.05/3.3,.32/2.2);scene.selectGecko('mica');
  env.frame(0);env.frame(1000/60);
  assert.equal(scene.getDirectorSnapshot().lastAction.id,'pip','selection changes cannot retarget an already queued cue');
  scene.selectGecko(null);scene.direct({type:'moth',x:1.62/3.3,y:-.28/2.2});scene.selectGecko('mica');
  env.frame(2000/60);assert.equal(scene.getDirectorSnapshot().lastAction.id,'slate');
  scene.dispose();assert.equal(env.resources(),0);
});

test('director hidden/zero-size/bfcache suspension drops pending cues and clears non-lead guidance on resume', () => {
  const env=environment(),scene=mountGecko(env.canvas,{director:{autonomy:false}});
  scene.selectGecko('pip');scene.guide(.4,-.3);env.frame(0);env.frame(1000/60);
  assert(scene.getDirectorSnapshot().pointer);assert.equal(scene.getSnapshot().target,null);
  scene.direct({type:'shadow'});env.host.emit('pagehide',{persisted:true});env.hide(true);
  assert.equal(scene.getStatus().pendingInputs,0);assert.equal(env.frames.size,0);
  env.canvas.rect.width=0;env.resize();env.hide(false);env.host.emit('pageshow',{persisted:true});
  assert.equal(env.frames.size,0);const frozen=scene.getStatus().tick;
  env.canvas.rect.width=720;env.resize();env.frame(100_000);assert.equal(scene.getStatus().tick,frozen);
  env.frame(100_000+1000/60);
  const resumed=scene.getDirectorSnapshot();assert.equal(resumed.pointer,null);
  assert.equal(resumed.individuals[1].body.target,null);assert.equal(resumed.shadow.active,false);
  assert.equal(scene.getStatus().droppedMilliseconds,0);
  scene.dispose();assert.equal(env.resources(),0);
});

test('every reduced-motion director cue is a deliberate still, without scene/body ticks or hidden scheduling', () => {
  const env=environment({reduced:true}),scene=mountGecko(env.canvas,{director:{}});
  const before=scene.getDirectorSnapshot(),original=scene.exportText();
  for(const type of ['moth','shadow','inspect','return']){
    assert.deepEqual(scene.direct({type}),{outcome:'static'});
    assert.equal(scene.getStatus().directorPoster,type);
    assert.deepEqual(scene.getDirectorSnapshot(),before);assert.equal(env.frames.size,0);
  }
  scene.direct({type:'shadow'});assert.notEqual(scene.exportText(),original);
  scene.setPaused(true);scene.configureDirector({scene:'lantern-hunt',population:2,tempo:1.2});scene.reset({seed:71});
  assert.equal(scene.getDirectorSnapshot().tick,0);assert.equal(scene.getDirectorSnapshot().individuals.length,2);
  assert.equal(scene.getStatus().paused,true);assert.equal(env.frames.size,0);
  env.reduce(false);assert.equal(env.frames.size,0);scene.setPaused(false);assert.equal(env.frames.size,1);
  assert.equal(scene.getStatus().directorPoster,'none');
  scene.dispose();assert.equal(env.resources(),0);
});

test('contextual shadow reports busy and invalid director updates leave ownership and snapshots intact', () => {
  const env=environment(),scene=mountGecko(env.canvas,{director:{}});
  scene.direct({type:'shadow',id:'mica'});env.frame(0);env.frame(1000/60);
  assert.deepEqual(scene.direct({type:'shadow',id:'mica'}),{outcome:'ignored',reason:'busy'});
  const before=scene.getDirectorSnapshot(),resources=env.resources();
  for(const mutate of [()=>scene.configureDirector({population:4}),()=>scene.direct({type:'moth',x:.4}),
    ()=>scene.direct({type:'shadow',id:'other'}),()=>scene.direct({type:'return',x:2,y:0}),()=>scene.selectGecko('other')]){
    assert.throws(mutate);assert.deepEqual(scene.getDirectorSnapshot(),before);assert.equal(env.resources(),resources);
  }
  scene.selectGecko('slate');scene.direct({type:'moth'});scene.configureDirector({population:1});
  assert.equal(scene.getStatus().pendingInputs,0);env.frame(2000/60);
  assert.equal(scene.getDirectorSnapshot().selectedId,'mica');
  scene.dispose();
  for(const readOrMutate of [()=>scene.getDirectorSnapshot(),()=>scene.configureDirector({}),()=>scene.direct({type:'moth'}),()=>scene.selectGecko(null),()=>scene.exportScene()])assert.throws(readOrMutate,/disposed/);
  assert.equal(env.resources(),0);
});

test('director width floor and injected frame subscription retain bounded lifecycle ownership', () => {
  const env=environment({width:320,height:360});let subscriptions=0,releases=0,callback;
  const source={subscribe(fn){subscriptions++;callback=fn;return()=>{releases++;};}};
  const scene=mountGecko(env.canvas,{director:{},frameSource:source});
  assert.equal(scene.getStatus().tooSmall,false);assert.equal(subscriptions,1);assert.equal(env.frames.size,0);
  callback(0);callback(1000/60);assert.equal(scene.getDirectorSnapshot().tick,1);assert.equal(subscriptions,1);
  env.canvas.rect.width=319;env.resize();assert.equal(scene.getStatus().tooSmall,true);assert.equal(releases,1);
  env.canvas.rect.width=320;env.resize();assert.equal(subscriptions,2);
  scene.dispose();scene.dispose();assert.equal(releases,2);assert.equal(env.resources(),0);
});

test('actual director demo handlers select scenes and roles, report cooldown, and preserve controls across bfcache', async()=>{
  const env=demoEnvironment(true),demo=await loadDemo(env),scene=demo.geckoDemo;
  assert(scene);assert.equal(scene.getDirectorSnapshot().individuals.length,3);
  env.nodes.get('scene-lantern-hunt').emit('click');assert.equal(scene.getDirectorSnapshot().arc.scene,'lantern-hunt');
  env.nodes.get('select-pip').emit('click');assert.equal(scene.getDirectorSnapshot().selectedId,'pip');
  env.nodes.get('moth').emit('click');env.frame(0);env.frame(1000/60);
  assert.equal(scene.getDirectorSnapshot().lastAction.type,'moth');assert.equal(scene.getDirectorSnapshot().lastAction.id,'pip');
  env.nodes.get('startle').emit('click');env.frame(2000/60);
  assert.equal(env.nodes.get('startle').disabled,true);assert.equal(env.nodes.get('startle').textContent,'Taking a moment');
  env.nodes.get('role-slate').value='hunter';env.nodes.get('role-slate').emit('change');
  env.nodes.get('population').value='1';env.nodes.get('population').emit('input');
  env.nodes.get('role-mica').value='sentry';env.nodes.get('role-mica').emit('change');
  env.nodes.get('population').value='3';env.nodes.get('population').emit('input');
  assert.deepEqual(scene.getDirectorSnapshot().individuals.map(a=>a.role),['sentry','hunter','hunter']);
  env.nodes.get('pause').emit('click');const frozen=scene.getDirectorSnapshot();
  env.nodes.get('return').emit('click');assert.deepEqual(scene.getDirectorSnapshot(),frozen);
  assert.equal(scene.getStatus().directorPoster,'return');
  const listeners=env.controls.reduce((sum,n)=>sum+n.listenerCount,0);
  env.host.emit('pagehide',{persisted:true});env.host.emit('pageshow',{persisted:true});
  assert.equal(scene.getStatus().paused,true);assert.equal(env.controls.reduce((sum,n)=>sum+n.listenerCount,0),listeners);
  env.nodes.get('reset').emit('click');assert.equal(scene.getStatus().tick,0);assert.equal(env.frames.size,0);
  env.host.emit('pagehide',{persisted:false});assert.equal(env.resources(),0);
  assert.equal(env.controls.reduce((sum,n)=>sum+n.listenerCount,0),0);
});
