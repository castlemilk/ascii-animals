import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createTurtleArtwork, createTurtleModel, normalizeTurtleOptions } from '../lib/public/turtle.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';

// Numerical, input-routing and resource-ownership tests. This host does not
// implement browser layout, native input, Canvas pixels, or performance tracing.
const sceneOptions = { scene: 'reef-passage', count: 3 };
const advance = (model, ticks, group = 600) => {
  while (ticks > 0) { const n = Math.min(ticks, group); model.advanceTicks(n); ticks -= n; }
};
function mounted(options = {}, browserOptions = {}) {
  const h = fakeBrowser(browserOptions), canvas = h.canvas();
  const art = createTurtleArtwork(canvas, { ...sceneOptions, ...options });
  h.intersect(canvas, true);
  return { h, canvas, art };
}
const pose = member => [member.x, member.y, member.depth, member.heading, member.bank, member.stroke];

test('director validates nested overrides atomically, including sparse arrays and invalid batches', () => {
  const m = createTurtleModel(sceneOptions); m.stage('linger'); m.select(1); m.inspect(.2, .1);
  const options = m.getOptions(), state = m.getState(), director = m.getDirectorState(), frame = m.frame().text;
  const invalid = [
    { count: 0 }, { count: 6 }, { count: 2.5 }, { count: Infinity },
    { current: NaN }, { current: Symbol() }, { depth: 1.01 }, { spacing: .59 },
    { arrivalSeconds: 0 }, { lingerSeconds: 46 }, { departureSeconds: Infinity },
    { scene: 'flock' }, { route: 'spiral' }, { director: 'auto' }, { showLabels: 1 },
    { count: 5, individuals: new Array(2) }, { individuals: [undefined] },
    { individuals: [{ id: 0 }, { id: 0, role: 'navigator' }] },
    { individuals: [{ id: -1 }] }, { individuals: [{ id: 5 }] },
    { individuals: [{ id: 1.5 }] }, { individuals: [{ id: 0, role: 'hunter' }] },
    { individuals: [{ id: 0, label: '<b>reef</b>' }] }, { individuals: [{ id: 0, label: 'a\nlabel' }] },
    { individuals: [{ id: 0, label: 'a'.repeat(19) }] }, { individuals: [{ id: 0, size: NaN }] },
    { individuals: [{ id: 0, interest: 2 }] }, { individuals: [{ id: 0, callback() {} }] },
    { scene: 'blue-drift', count: 5, individuals: [null] }
  ];
  for (const patch of invalid) {
    assert.throws(() => m.configure(patch));
    assert.equal(m.getOptions(), options, 'invalid input must not install a new config');
    assert.deepEqual(m.getState(), state);
    assert.deepEqual(m.getDirectorState(), director);
  }
  assert.equal(m.frame().text, frame);
});

test('caller arrays and returned snapshots cannot mutate member identities or configuration', () => {
  const input = [{ id: 0, label: 'Neri', role: 'explorer', size: 1.1, interest: .8 }];
  const m = createTurtleModel({ ...sceneOptions, individuals: input });
  input[0].label = 'Changed'; input.push({ id: 1, role: 'drifter' });
  const config = m.getOptions(), d = m.getDirectorState();
  assert.equal(config.individuals.length, 1); assert.equal(d.members[0].label, 'Neri');
  for (const value of [config, config.individuals, config.individuals[0], d, d.members, d.members[0], d.members[0].reaction, d.marker]) assert(Object.isFrozen(value));
  assert.throws(() => { config.individuals[0].label = 'Mutation'; });
  assert.throws(() => { d.members[0].x = 99; });
  assert.equal(m.getDirectorState().members[0].label, 'Neri');
});

test('count changes retain surviving identities, clamp selection, and restore configured inactive members', () => {
  const m = createTurtleModel({ ...sceneOptions, count: 5, individuals: [{ id: 4, label: 'Reef Scout', role: 'explorer' }] });
  m.stage('linger'); m.select(4);
  const first = m.getDirectorState().members.slice(0, 2).map(({ id, label, role }) => ({ id, label, role }));
  m.configure({ count: 2 });
  assert.equal(m.getDirectorState().selectedId, 1);
  assert.deepEqual(m.getDirectorState().members.map(({ id, label, role }) => ({ id, label, role })), first);
  assert.throws(() => m.select(4)); assert.throws(() => m.inspect(0, 0, 4));
  m.configure({ count: 5 });
  assert.equal(m.getDirectorState().members[4].label, 'Reef Scout');
  assert.equal(m.getDirectorState().members[4].role, 'explorer');
  assert.deepEqual(m.getDirectorState().members.map(m => m.id), [0, 1, 2, 3, 4]);
  m.direct('study'); assert.equal(m.getDirectorState().members.length, 1); assert.equal(m.getDirectorState().selectedId, 0);
});

test('scene presets retain consumer choices and produce distinct, bounded compositions', () => {
  const m = createTurtleModel({ seed: 29, palette: 'lagoon', paused: true, scale: 1.15, individuals: [{ id: 0, label: 'Ada' }] });
  const frames = [];
  for (const scene of ['reef-passage', 'seagrass-stop', 'blue-drift']) {
    m.direct(scene); m.stage('linger');
    const o = m.getOptions(), d = m.getDirectorState();
    assert.equal(o.seed, 29); assert.equal(o.palette, 'lagoon'); assert.equal(o.scale, 1.15); assert.equal(o.paused, true);
    assert.equal(d.members[0].label, 'Ada'); assert.equal(d.scene, scene); assert.equal(d.phase, 'linger');
    assert(d.members.length >= 1 && d.members.length <= 5);
    frames.push(m.frame().text);
  }
  assert.equal(new Set(frames).size, 3);
  const before = m.getDirectorState(); assert.throws(() => m.direct('unknown')); assert.deepEqual(m.getDirectorState(), before);
});

test('same tick/event log gives identical director states and cells across 1/2/5-tick presentation groups', () => {
  function replay(group) {
    const m = createTurtleModel({ scene: 'seagrass-stop', count: 5, seed: 41 }); m.stage('linger');
    const events = new Map([
      [30, () => { m.select(2); m.guide(.15, -.2); m.inspect(.15, -.2); }],
      [91, () => m.configure({ speed: 1.4, current: .6 })],
      [155, () => m.configure({ route: 'arc' })],
      [220, () => m.clearGuide()],
      [360, () => { m.select(4); m.inspect(-.2, .3); }]
    ]);
    for (let tick = 0; tick < 480; tick++) {
      events.get(tick)?.(); m.advanceTicks(1);
      if ((tick + 1) % group === 0) m.frame();
    }
    return { state: m.getState(), director: m.getDirectorState(), frame: m.frame() };
  }
  const one = replay(1); assert.deepEqual(replay(2), one); assert.deepEqual(replay(5), one);
  const a = createTurtleModel({ ...sceneOptions, seed: 41 }), b = createTurtleModel({ ...sceneOptions, seed: 42 });
  a.stage('linger'); b.stage('linger'); assert.notEqual(a.frame().text, b.frame().text);
});

test('batched tick advance is equivalent and reset restores the configured scene without stale reactions', () => {
  const options = { scene: 'blue-drift', count: 5, seed: 99, speed: .75, director: 'hold' };
  const a = createTurtleModel(options), b = createTurtleModel(options);
  advance(a, 1200, 1); advance(b, 1200, 600); assert.deepEqual(a.getDirectorState(), b.getDirectorState());
  a.inspect(.4, -.2, 2); a.configure({ current: -.5 }); a.reset();
  const fresh = createTurtleModel({ ...options, current: -.5 });
  assert.deepEqual(a.getState(), fresh.getState()); assert.deepEqual(a.getDirectorState(), fresh.getDirectorState());
  assert.equal(a.frame().text, fresh.frame().text);
});

test('arrival, linger and departure joins are continuous; loop teleport occurs only beyond the visible stage', () => {
  for (const scene of ['reef-passage', 'seagrass-stop', 'blue-drift']) for (const route of ['shelf', 'channel', 'arc']) {
    const m = createTurtleModel({ scene, route, count: 5, speed: 2, arrivalSeconds: 4, lingerSeconds: 6, departureSeconds: 4 });
    let previous = m.getDirectorState(), loops = 0; const acts = new Set([previous.phase]);
    for (let tick = 0; tick < 860; tick++) {
      m.advanceTicks(1); const next = m.getDirectorState(); acts.add(next.phase);
      for (let id = 0; id < 5; id++) {
        const a = previous.members[id], b = next.members[id];
        assert(pose(b).every(Number.isFinite)); assert(b.depth >= 0 && b.depth <= 1);
        if (next.cycle !== previous.cycle) {
          assert(Math.abs(a.x) > 1.55 && Math.abs(b.x) > 1.55, 'loop reset must remain offstage');
        } else assert(Math.hypot(a.x - b.x, a.y - b.y) < .12, 'visible route must not teleport between ticks');
      }
      if (next.cycle !== previous.cycle) loops++;
      previous = next;
    }
    assert(loops >= 1); assert.deepEqual([...acts], ['arrival', 'linger', 'departure']);
  }
});

test('hold preserves the act while local motives continue; once finishes without another arrival', () => {
  const m = createTurtleModel({ scene: 'seagrass-stop', count: 5, director: 'hold' });
  const start = m.getDirectorState(), text = m.frame().text;
  advance(m, 600); const held = m.getDirectorState();
  assert.equal(held.elapsed, start.elapsed); assert.equal(held.phase, 'linger'); assert.notEqual(m.frame().text, text);
  const once = createTurtleModel({ ...sceneOptions, director: 'once', arrivalSeconds: 4, lingerSeconds: 6, departureSeconds: 4 });
  advance(once, 900); assert.equal(once.getDirectorState().phase, 'complete');
  advance(once, 600); assert.equal(once.getDirectorState().phase, 'complete'); assert.equal(once.getDirectorState().cycle, 0);
});

test('autonomous roles produce distinct stroke, inspection, glide and surfacing states', () => {
  const m = createTurtleModel({ scene: 'seagrass-stop', count: 5, director: 'hold' });
  const motions = new Set(); let sawDifferentStrokes = false;
  for (let t = 0; t < 20; t++) {
    m.advanceTicks(60); const members = m.getDirectorState().members;
    members.forEach(member => motions.add(member.motion));
    sawDifferentStrokes ||= new Set(members.map(member => member.stroke.toFixed(5))).size > 1;
  }
  for (const expected of ['stroking', 'gliding', 'inspecting', 'surfacing']) assert(motions.has(expected), `missing autonomous ${expected}`);
  assert(sawDifferentStrokes);
});

test('signed current contributes coherently to every traveler while preserving distinct motives', () => {
  const east = createTurtleModel({ ...sceneOptions, director: 'hold', current: 1 });
  const west = createTurtleModel({ ...sceneOptions, director: 'hold', current: -1 });
  advance(east, 300); advance(west, 300);
  const a = east.getDirectorState().members, b = west.getDirectorState().members;
  for (let id = 0; id < a.length; id++) assert(a[id].x > b[id].x + .05, 'east current should add eastward displacement to every lane');
  assert.equal(new Set(a.map(member => member.role)).size, 3);
  assert.notDeepEqual(a.map(member => member.stroke), b.map(member => member.stroke));
});

test('deliberate inspection targets one member, respects cooldown, and recovers to the route', () => {
  const a = createTurtleModel({ ...sceneOptions, director: 'hold' }), reference = createTurtleModel({ ...sceneOptions, director: 'hold' });
  a.inspect(.6, -.1, 1); assert.equal(a.getDirectorState().members[1].reaction.kind, 'inspect');
  assert(a.getDirectorState().members.filter(m => m.id !== 1).every(m => m.reaction.kind === 'none'));
  advance(a, 90); advance(reference, 90); assert.equal(a.getDirectorState().members[1].reaction.kind, 'bank');
  assert.notDeepEqual(pose(a.getDirectorState().members[1]), pose(reference.getDirectorState().members[1]));
  a.inspect(-.6, .1, 1); assert.equal(a.getDirectorState().members[1].reaction.kind, 'bank', 'active inspection must not restart');
  advance(a, 70); assert.equal(a.getDirectorState().members[1].reaction.kind, 'recover');
  a.clearGuide(); advance(a, 120); assert.equal(a.getDirectorState().members[1].reaction.kind, 'none');
  a.inspect(0, 0, 1); assert.equal(a.getDirectorState().members[1].reaction.kind, 'none', 'cooldown must remain effective after recovery');
  advance(a, 60); a.inspect(0, 0, 1); assert.equal(a.getDirectorState().members[1].reaction.kind, 'inspect');
  for (const value of [NaN, Infinity, '0', Symbol()]) assert.throws(() => a.inspect(value, 0));
});

test('maximum ensembles produce bounded printable cells and visible owners on boundary grids', () => {
  for (const [columns, rows] of [[80, 32], [120, 50], [180, 90]]) for (const scene of ['reef-passage', 'seagrass-stop', 'blue-drift']) {
    const m = createTurtleModel({ scene, count: 5, columns, rows, scale: .6, depth: 1, showLabels: true, showRoute: true });
    m.stage('linger'); const f = m.frame();
    assert.equal(f.cells.length, columns * rows); assert.equal(f.text.split('\n').length, rows);
    assert(f.text.split('\n').every(row => row.length === columns)); assert.match(f.text, /^[\x20-\x7e\n]+$/);
    assert(f.cells.every(c => Number.isFinite(c.tone) && c.tone >= 0 && c.tone <= 9 && (c.ownerId === null || Number.isInteger(c.ownerId) && c.ownerId >= 0 && c.ownerId < 5)));
    for (let id = 0; id < 5; id++) assert(f.cells.some(c => c.ownerId === id), `member ${id} must retain visible glyphs`);
  }
});

test('paused and reduced-motion composition changes produce deliberate posters without clock or scheduler work', () => {
  for (const reducedMotion of [false, true]) {
    const { h, art } = mounted({ paused: !reducedMotion }, { reducedMotion });
    const before = art.getFrame().text, tick = art.getStatus().tick;
    art.update({ route: 'channel', spacing: 1.6, depth: 1 });
    assert.notEqual(art.getFrame().text, before, 'static composition controls must redraw their changed composition');
    assert.equal(art.getStatus().tick, tick); assert.equal(h.pending, 0);
    const changed = art.getFrame().text; art.inspect(.25, -.2, 1);
    assert.notEqual(art.getFrame().text, changed); assert.equal(art.getDirectorState().members[1].reaction.kind, 'bank');
    const posters = new Set();
    for (const act of ['arrival', 'linger', 'departure']) { art.stage(act); posters.add(art.getFrame().text); assert.equal(art.getStatus().tick, tick); assert.equal(h.pending, 0); }
    assert.equal(posters.size, 3);
    art.direct('blue-drift'); art.restart(); assert(art.getStatus().paused); assert.equal(art.getStatus().tick, 0); assert.equal(h.pending, 0);
    art.dispose();
  }
});

test('touch down uses its own CSS coordinates and the visible owner without a prior pointer move', () => {
  const { art, canvas } = mounted({ paused: true, showLabels: false });
  canvas.rect.left = 37; canvas.rect.top = 81;
  const f = art.getFrame(), index = f.cells.findIndex(cell => cell.ownerId === 2); assert(index >= 0);
  const col = index % f.columns, row = Math.floor(index / f.columns);
  const x = col / (f.columns - 1), y = row / (f.rows - 1);
  canvas.emit('pointerdown', { pointerType: 'touch', clientX: canvas.rect.left + x * canvas.rect.width, clientY: canvas.rect.top + y * canvas.rect.height, button: 0 });
  assert.equal(art.getDirectorState().selectedId, 2); assert.equal(art.getDirectorState().members[2].reaction.kind, 'bank');
  assert.equal(art.getStatus().tick, 0); assert(art.getStatus().paused);
  art.select(1);
  canvas.emit('pointerdown', { pointerType: 'touch', clientX: canvas.rect.left + 2, clientY: canvas.rect.top + 2, button: 0 });
  assert.equal(art.getDirectorState().selectedId, 1, 'open water invites the selected turtle');
  assert(art.getDirectorState().marker.x < -.9); assert(art.getDirectorState().marker.y < -.9);
  const state = art.getDirectorState();
  canvas.emit('pointerdown', { clientX: 100, clientY: 200, button: 2 }); assert.deepEqual(art.getDirectorState(), state);
  art.dispose();
});

test('pointer storms are coalesced and incidental movement cannot animate or replace a static poster', () => {
  const { h, canvas, art } = mounted(); art.stage('linger');
  let draws = 0; canvas.getContext('2d').fillRect = () => { draws++; };
  for (let i = 0; i < 1000; i++) canvas.emit('pointermove', { clientX: i % canvas.rect.width, clientY: 250 });
  assert.equal(draws, 0); h.frame(); h.frame(20); assert.equal(draws, 1);
  const expectedX = (999 % canvas.rect.width) / canvas.rect.width * 2 - 1;
  assert.equal(art.getDirectorState().marker.x, expectedX);
  art.pause(); const text = art.getFrame().text, tick = art.getStatus().tick;
  canvas.emit('pointermove', { clientX: 40, clientY: 40 }); h.frame(10000);
  assert.equal(art.getFrame().text, text); assert.equal(art.getStatus().tick, tick); assert.equal(h.pending, 0);
  art.dispose();
});

test('hover guidance clears on leave, cancel, lost capture or pausing; deliberate guides survive hover cancellation', () => {
  for (const event of ['pointerleave', 'pointercancel', 'lostpointercapture']) {
    const { h, canvas, art } = mounted(); art.stage('linger');
    canvas.emit('pointermove', { clientX: 500, clientY: 300 }); h.frame();
    assert(art.getDirectorState().marker.active); canvas.emit(event); assert.equal(art.getDirectorState().marker.active, false);
    canvas.emit('pointermove', { clientX: 600, clientY: 300 }); h.frame(); art.pause(); canvas.emit(event); art.play();
    assert.equal(art.getDirectorState().marker.active, false);
    art.pause(); art.guide(.3, -.2); canvas.emit(event); assert.deepEqual(art.getDirectorState().marker, { x: .3, y: -.2, active: true });
    art.dispose();
  }
});

test('focused-canvas keyboard actions are scoped, preserve pause, and do not trap Tab or modified keys', () => {
  const { canvas, art, h } = mounted({ paused: true });
  let prevented = 0; const key = (name, extras = {}) => canvas.emit('keydown', { key: name, preventDefault() { prevented++; }, ...extras });
  key('Tab'); key(' '); key('ArrowLeft', { ctrlKey: true }); assert.equal(prevented, 0);
  key('ArrowRight'); key('ArrowUp'); assert.equal(prevented, 2); assert(art.getDirectorState().marker.active);
  key('Enter'); assert.equal(art.getDirectorState().members[0].reaction.kind, 'bank');
  assert.equal(art.getStatus().tick, 0); assert.equal(h.pending, 0);
  key('Escape'); assert.equal(art.getDirectorState().marker.active, false); art.dispose();
});

test('one-pass browser director releases its subscription and can be restarted without a catch-up jump', () => {
  const { art, h } = mounted({ director: 'once', speed: 2, arrivalSeconds: 4, lingerSeconds: 6, departureSeconds: 4 });
  for (let i = 0; i < 85; i++) h.frame(100);
  assert.equal(art.getStatus().act, 'complete'); assert.equal(h.pending, 0);
  const tick = art.getStatus().tick; h.frame(100000); assert.equal(art.getStatus().tick, tick);
  art.restart(); assert.equal(art.getStatus().tick, 0); assert.equal(h.pending, 1);
  h.frame(100000); assert.equal(art.getStatus().tick, 0); h.frame(20); assert(art.getStatus().tick <= 2);
  art.dispose();
});

test('borrowed source, semantic subscribers and stale callbacks are isolated after disposal', () => {
  const h = fakeBrowser(), c = h.canvas(); let frameCallback, unsubscribes = 0, sourceDisposals = 0;
  const source = { subscribe(fn) { frameCallback = fn; return () => { unsubscribes++; }; }, dispose() { sourceDisposals++; } };
  const art = createTurtleArtwork(c, { ...sceneOptions, frameSource: source }); h.intersect(c, true); art.stage('linger');
  let notices = 0; const stop = art.subscribe(() => { notices++; }); assert.equal(notices, 1);
  art.select(1); assert(notices > 1); stop(); const stopped = notices;
  art.select(2); assert.equal(notices, stopped);
  const stale = frameCallback; art.dispose(); art.dispose();
  assert.equal(unsubscribes, 1); assert.equal(sourceDisposals, 0); assert.equal(c.listenerCount, 0);
  assert.equal(h.resizes.size, 0); assert.equal(h.intersections.size, 0); assert.equal(h.document.listenerCount, 0); assert.equal(h.motion.listenerCount, 0);
  const state = art.getDirectorState(); stale(1e9); art.direct('blue-drift'); art.stage('arrival'); art.inspect(0, 0); art.select(0); art.guide(1, 1); art.clearGuide(); art.restart();
  assert.deepEqual(art.getDirectorState(), state); assert.equal(h.pending, 0);
  art.subscribe(() => { throw Error('must never run after disposal'); })();
});

test('invalid sources and failed subscriptions leave no controller-owned resources', () => {
  const h = fakeBrowser(), c = h.canvas();
  for (const frameSource of [null, {}, { subscribe: 1 }]) assert.throws(() => createTurtleArtwork(c, { frameSource }));
  assert.equal(c.listenerCount, 0);
  delete h.view.IntersectionObserver;
  assert.throws(() => createTurtleArtwork(c, { ...sceneOptions, frameSource: { subscribe() { throw Error('subscribe failed'); } } }), /subscribe failed/);
  assert.equal(c.listenerCount, 0); assert.equal(h.resizes.size, 0); assert.equal(h.document.listenerCount, 0); assert.equal(h.motion.listenerCount, 0); assert.equal(h.pending, 0);
});

test('turtle subpath remains SSR-safe and root runtime exports match newly declared runtime values', () => {
  const url = new URL('../lib/public/turtle.js', import.meta.url).href;
  const rootUrl = new URL('../lib/index.js', import.meta.url).href;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `for (const key of ['window','document','navigator']) Object.defineProperty(globalThis,key,{get(){throw Error(key+' read during SSR import')}}); const m=await import(${JSON.stringify(url)}); const root=await import(${JSON.stringify(rootUrl)}); for(const [name,value] of Object.entries(m)) if(root[name]!==value) throw Error('Missing or different root export '+name); console.log(JSON.stringify(Object.keys(m).sort())); m.createTurtleModel({scene:'blue-drift',count:2}).frame();`], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), ['TURTLE_DEFAULTS', 'createTurtleArtwork', 'createTurtleModel', 'normalizeTurtleOptions'].sort());
});
