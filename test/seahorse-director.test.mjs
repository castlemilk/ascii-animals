import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  createSeahorseArtwork,
  createSeahorseModel,
  normalizeSeahorseOptions,
  SEAHORSE_DEFAULTS
} from '../lib/public/seahorse.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';

const scenes = ['kelp-garden', 'tidal-duet', 'drift-passage'];
const motives = new Set(['arriving', 'anchored', 'drifting', 'inspecting', 'startled', 'recovering', 'duet', 'returning']);
const garden = { scene: 'kelp-garden', count: 3, choreography: 'hold', seed: 19 };
const firstId = model => model.getDirectorState().members[0].id;
function advance(model, ticks, batch = 600) {
  while (ticks > 0) { const n = Math.min(ticks, batch); model.advanceTicks(n); ticks -= n; }
}
function assertFrozen(value) {
  if (value && typeof value === 'object') {
    assert(Object.isFrozen(value), 'every public snapshot level is frozen');
    for (const child of Object.values(value)) assertFrozen(child);
  }
}
function assertAttached(member) {
  if (member.anchorId === null) return;
  assert(member.anchor, 'an attached member exposes its holdfast location');
  assert(Math.abs(member.tailTip.x - member.anchor.x) < 1e-9, 'attached tail x stays at the holdfast');
  assert(Math.abs(member.tailTip.y - member.anchor.y) < 1e-9, 'attached tail y stays at the holdfast');
}

test('director options are additive, deeply immutable, and isolated from caller-owned entries', () => {
  const defaults = normalizeSeahorseOptions();
  assert.equal(defaults.scene, 'study');
  assert.equal(defaults.count, 1);
  assert.equal(defaults.choreography, 'cycle');
  assert.equal(defaults.duration, 28);
  assert.equal(defaults.stagger, .8);
  assert.equal(defaults.current, .3);
  assert.equal(defaults.labels, false);
  assert.deepEqual(defaults.individuals, []);
  assertFrozen(SEAHORSE_DEFAULTS);
  assertFrozen(defaults);
  const individuals = [{ role: 'sentinel', scale: .85, facing: 'right' }, { role: 'explorer' }];
  const model = createSeahorseModel({ ...garden, individuals });
  individuals[0].role = 'dreamer';
  individuals[0].scale = 1.15;
  individuals.push({ role: 'partner' });
  assert.equal(model.getOptions().individuals.length, 2);
  assert.equal(model.getOptions().individuals[0].role, 'sentinel');
  assert.equal(model.getOptions().individuals[0].scale, .85);
  assertFrozen(model.getOptions());
  assertFrozen(model.getDirectorState());
  model.configure({ current: -.5, duration: undefined });
  assert.equal(model.getOptions().current, -.5);
  assert.equal(model.getOptions().duration, 28);
});

test('invalid director configuration is atomic, including nested individual options', () => {
  const model = createSeahorseModel(garden);
  model.advanceTicks(43);
  const before = { options: model.getOptions(), state: model.getState(), director: model.getDirectorState(), text: model.frame().text };
  const invalid = [
    { scene: 'school' }, { count: 0 }, { count: 5 }, { count: 1.5 }, { count: NaN },
    { choreography: 'parade' }, { duration: 15.9 }, { duration: 90.1 }, { duration: Infinity },
    { stagger: -.1 }, { stagger: 3.1 }, { current: -1.01 }, { current: 1.01 }, { current: NaN },
    { labels: 'yes' }, { individuals: {} }, { individuals: [null] },
    { individuals: Array.from({ length: 5 }, () => ({})) },
    { individuals: [{ role: 'leader' }] }, { individuals: [{ scale: .74 }] },
    { individuals: [{ scale: 1.21 }] }, { individuals: [{ scale: Infinity }] },
    { individuals: [{ facing: 'up' }] }, { individuals: [{ color: 'blue' }] },
    { count: 4, individuals: [{ role: 'sentinel' }, { scale: NaN }] },
    { scene: 'tidal-duet', speed: NaN }, { unknownDirector: true }
  ];
  for (const patch of invalid) {
    assert.throws(() => model.configure(patch));
    assert.deepEqual(model.getOptions(), before.options);
    assert.deepEqual(model.getState(), before.state);
    assert.deepEqual(model.getDirectorState(), before.director);
    assert.equal(model.frame().text, before.text);
  }
});

test('cycle scenes expose arrival, rest, depart and return; seeking never advances the integer clock', () => {
  for (const scene of scenes) {
    const model = createSeahorseModel({ scene, count: 2, duration: 20 });
    model.advanceTicks(79);
    const tick = model.getState().tick;
    for (const [progress, arc] of [[0, 'arrival'], [.179, 'arrival'], [.181, 'rest'], [.679, 'rest'], [.681, 'depart'], [.869, 'depart'], [.871, 'return'], [.999, 'return']]) {
      model.direct({ type: 'seek', progress });
      const state = model.getDirectorState();
      assert.equal(state.scene, scene);
      assert.equal(state.arc, arc, `${scene} at ${progress}`);
      assert(Math.abs(state.progress - progress) < .002, 'seek allows at most one integer-tick quantization');
      assert.equal(model.getState().tick, tick);
    }
    model.direct({ type: 'seek', progress: 1 });
    assert.equal(model.getDirectorState().arc, 'arrival');
    assert.equal(model.getDirectorState().progress, 0);
    assert.equal(model.getState().tick, tick);
  }
});

test('hold choreography stays in its composed rest stage as idle personality continues', () => {
  for (const scene of scenes) {
    const model = createSeahorseModel({ scene, count: 2, choreography: 'hold', duration: 16 });
    const before = model.frame().text;
    advance(model, 1700);
    const state = model.getDirectorState();
    assert.equal(state.arc, 'rest');
    assert.equal(state.progress, .42);
    assert.notEqual(model.frame().text, before, 'holding a scene does not freeze its autonomous poses');
  }
});

test('selection and member actions are validated before any simulation mutation', () => {
  const model = createSeahorseModel(garden);
  const members = model.getDirectorState().members;
  model.direct({ type: 'select', id: members[1].id });
  assert.equal(model.getDirectorState().selected, members[1].id);
  const before = { state: model.getState(), director: model.getDirectorState(), text: model.frame().text };
  for (const action of [null, [], 'release', {}, { type: 'swim' }, { type: 'select' }, { type: 'select', id: -1 }, { type: 'select', id: 100 }, { type: 'select', id: .5 }, { type: 'release', id: NaN }, { type: 'anchor', id: Infinity }, { type: 'inspect', id: 99 }, { type: 'seek', progress: -.01 }, { type: 'seek', progress: 1.01 }, { type: 'seek', progress: NaN }, { type: 'seek', progress: 'half' }, { type: 'release', unknown: true }]) {
    assert.throws(() => model.direct(action));
    assert.deepEqual(model.getState(), before.state);
    assert.deepEqual(model.getDirectorState(), before.director);
    assert.equal(model.frame().text, before.text);
  }
  model.configure({ count: 1 });
  const resized = model.getDirectorState();
  assert.equal(resized.members.length, 1);
  assert(resized.members.some(member => member.id === resized.selected), 'shrinking an ensemble keeps selection valid');
});

test('a command without an ID addresses the selected animal, while explicit IDs allow individual responses', () => {
  const model = createSeahorseModel(garden);
  const [first, second, third] = model.getDirectorState().members;
  model.direct({ type: 'select', id: second.id });
  model.direct({ type: 'inspect' });
  assert.equal(model.getDirectorState().members.find(member => member.id === second.id).motive.kind, 'inspecting');
  assert.notEqual(model.getDirectorState().members.find(member => member.id === first.id).motive.kind, 'inspecting');
  model.direct({ type: 'startle', id: third.id });
  assert.equal(model.getDirectorState().members.find(member => member.id === third.id).motive.kind, 'startled');
  assert.equal(model.getDirectorState().members.find(member => member.id === second.id).motive.kind, 'inspecting');
});

test('repeated active commands cannot keep an animal trapped in an interaction', () => {
  for (const [type, duration] of [['release', 240], ['anchor', 180], ['inspect', 180], ['startle', 240]]) {
    const once = createSeahorseModel(garden), repeated = createSeahorseModel(garden);
    const id = firstId(once);
    for (const model of [once, repeated]) model.direct({ type, id });
    for (let elapsed = 30; elapsed < duration; elapsed += 30) {
      once.advanceTicks(30); repeated.advanceTicks(30);
      repeated.direct({ type, id });
      assert.deepEqual(repeated.getDirectorState(), once.getDirectorState(), `${type} retrigger at ${elapsed} must not reset its age`);
    }
    once.advanceTicks(60); repeated.advanceTicks(60);
    const baseline = createSeahorseModel(garden);
    baseline.advanceTicks(once.getState().tick);
    assert.deepEqual(repeated.getDirectorState(), baseline.getDirectorState(), `${type} returns to authored behavior`);
    assert.equal(repeated.frame().text, once.frame().text);
  }
});

test('garden attachments remain exact under current, guide input and mirrored individuals', () => {
  const model = createSeahorseModel({
    ...garden, count: 4, current: 1,
    individuals: [
      { role: 'sentinel', facing: 'left' }, { role: 'sentinel', facing: 'right' },
      { role: 'dreamer', scale: .75 }, { role: 'explorer', scale: 1.2 }
    ]
  });
  for (let step = 0; step < 10; step++) {
    model.guide(Math.sin(step), Math.cos(step));
    model.advanceTicks(23);
    const state = model.getDirectorState();
    assert(state.members.some(member => member.anchorId !== null), 'a holdfast scene has a visible attached resident');
    for (const member of state.members) assertAttached(member);
  }
});

test('director replay is independent of tick batching and reset restores scene, selection and transient input', () => {
  const options = { scene: 'tidal-duet', count: 4, duration: 24, current: -.6, stagger: 1.25, seed: 51, individuals: [{ role: 'partner' }, { role: 'partner' }, { role: 'sentinel' }, { role: 'explorer' }] };
  function replay(batch) {
    const model = createSeahorseModel(options);
    advance(model, 137, batch);
    model.guide(.7, -.6);
    model.direct({ type: 'select', id: model.getDirectorState().members[2].id });
    model.direct({ type: 'release' });
    advance(model, 173, batch);
    model.direct({ type: 'seek', progress: .82 });
    advance(model, 71, batch);
    return model;
  }
  const batched = replay(600), stepped = replay(1);
  assert.deepEqual(batched.getState(), stepped.getState());
  assert.deepEqual(batched.getDirectorState(), stepped.getDirectorState());
  assert.equal(batched.frame().text, stepped.frame().text);
  batched.reset();
  const fresh = createSeahorseModel(options);
  assert.deepEqual(batched.getState(), fresh.getState());
  assert.deepEqual(batched.getDirectorState(), fresh.getDirectorState());
  assert.equal(batched.frame().text, fresh.frame().text);
});

test('new scene actions preserve the established 45/110/180 tick greeting timeline', () => {
  const model = createSeahorseModel({ scene: 'kelp-garden', count: 2, speed: 2 });
  model.greet();
  model.direct({ type: 'release' });
  model.advanceTicks(44); assert.equal(model.getPhase(), 'inspect');
  model.advanceTicks(1); assert.equal(model.getPhase(), 'curl');
  model.advanceTicks(65); assert.equal(model.getPhase(), 'settle');
  model.advanceTicks(70); assert.equal(model.getPhase(), 'idle');
});

test('composed scenes produce distinct bounded ASCII and finite member geometry at grid limits', () => {
  const text = new Set();
  for (const scene of ['study', ...scenes]) {
    const model = createSeahorseModel({ scene, count: 2, choreography: 'hold' });
    text.add(model.frame().text);
  }
  assert.equal(text.size, 4, 'the authored scenes are visually different logical compositions');
  for (const scene of scenes) for (const [columns, rows] of [[64, 36], [160, 100]]) {
    const model = createSeahorseModel({ scene, count: 4, columns, rows, scale: 1.3, current: -1, choreography: 'hold', labels: true });
    model.advanceTicks(117);
    const frame = model.frame(), state = model.getDirectorState();
    assert.equal(frame.cells.length, columns * rows);
    assert.equal(frame.text.split('\n').length, rows);
    assert(frame.text.split('\n').every(row => row.length === columns));
    assert(/^[\x20-\x7e\n]+$/.test(frame.text));
    assert(frame.cells.every(cell => Number.isFinite(cell.tone) && cell.tone >= 0 && cell.tone <= 9));
    assert.equal(state.members.length, 4);
    assert.equal(new Set(state.members.map(member => member.id)).size, 4);
    assert(Number.isFinite(state.current));
    for (const member of state.members) {
      for (const value of [member.x, member.y, member.scale, member.curl, member.tailTip.x, member.tailTip.y]) assert(Number.isFinite(value));
      assert(motives.has(member.motive.kind));
      assertAttached(member);
    }
    assertFrozen(state);
  }
});

test('directed anatomy landmarks and labels remain inside the world across narrow, wide and ensemble compositions', () => {
  function inspect(model, context) {
    const state = model.getDirectorState();
    const within = (point, label) => {
      assert(Math.abs(point.x) <= state.worldWidth / 2 + 1e-9, `${context}: ${label} x=${point.x} outside ${state.worldWidth}`);
      assert(Math.abs(point.y) <= state.worldHeight / 2 + 1e-9, `${context}: ${label} y=${point.y} outside ${state.worldHeight}`);
    };
    for (const member of state.members) {
      const co = Math.cos(member.rotation), si = Math.sin(member.rotation);
      const mirror = member.facing === 'left' ? 1 : -1;
      for (const [label, x, y] of [
        ['eye', -.36, -1.46],
        ['snout', -.91, -1.29 + member.attention * .42],
        ['coronet', -.35, -1.76]
      ]) {
        within({ x: member.x + (x * co - y * si) * member.scale * mirror, y: member.y + (x * si + y * co) * member.scale }, `${member.id} ${label}`);
      }
      within(member.tailTip, `${member.id} tail`);
      within({ x: member.x, y: member.y - 2.04 * member.scale }, `${member.id} label`);
      if (member.motive.kind === 'anchored') {
        assert.equal(member.anchorId, member.motive.anchorId, 'anchored motive identifies the actual completed grip');
        assert(member.anchor);
      }
      assertAttached(member);
    }
  }
  for (const scene of scenes) for (const count of [1, 4]) for (const [columns, rows] of [[64, 100], [160, 36], [160, 76]]) for (const facing of ['left', 'right']) {
    const model = createSeahorseModel({
      scene, count, columns, rows, scale: 1.3, facing, current: facing === 'left' ? -1 : 1, labels: true,
      individuals: Array.from({ length: count }, () => ({ scale: 1.2, facing }))
    });
    for (const progress of [.08, .42, .73, .93]) {
      const context = `${scene}/${count}/${columns}x${rows}/${facing}/${progress}`;
      model.direct({ type: 'seek', progress });
      inspect(model, context);
      for (const type of ['release', 'inspect']) {
        for (const member of model.getDirectorState().members) model.direct({ type, id: member.id }, true);
        inspect(model, `${context}/${type}`);
      }
    }
  }
});

test('poster actions are intentional static poses and do not advance simulation ticks', () => {
  const frames = new Set();
  for (const type of ['release', 'anchor', 'inspect', 'startle']) {
    const model = createSeahorseModel(garden);
    const before = model.getState().tick;
    model.direct({ type }, true);
    assert.equal(model.getState().tick, before);
    frames.add(model.frame().text);
    model.advanceTicks(300);
    const baseline = createSeahorseModel(garden);
    baseline.advanceTicks(300);
    assert.deepEqual(model.getDirectorState(), baseline.getDirectorState(), `${type} poster still recovers on subsequent explicit ticks`);
  }
  assert.equal(frames.size, 4, 'each static command has a visibly distinct character composition');
});

test('sequential poster commands replace the previous cue without reset, clock advancement or playback', () => {
  const sequence = ['release', 'anchor', 'inspect', 'startle', 'release'];
  const model = createSeahorseModel({ ...garden, paused: true });
  let previous = '';
  for (const type of sequence) {
    model.direct({ type }, true);
    const fresh = createSeahorseModel({ ...garden, paused: true });
    fresh.direct({ type }, true);
    assert.equal(model.getState().tick, 0);
    assert.deepEqual(model.getDirectorState(), fresh.getDirectorState());
    assert.equal(model.frame().text, fresh.frame().text);
    assert.notEqual(model.frame().text, previous, `${type} replaces the previous static pose`);
    previous = model.frame().text;
  }
  for (const reducedMotion of [false, true]) {
    const h = fakeBrowser({ reducedMotion }), canvas = h.canvas();
    const options = { ...garden, paused: !reducedMotion };
    const art = createSeahorseArtwork(canvas, options);
    h.intersect(canvas, true);
    previous = '';
    for (const type of sequence) {
      art.direct({ type });
      const fresh = createSeahorseModel(options);
      fresh.direct({ type }, true);
      assert.equal(art.getFrame().text, fresh.frame().text);
      assert.notEqual(art.getFrame().text, previous, `${type} is selectable while motion is blocked`);
      assert.equal(art.getStatus().tick, 0);
      assert.equal(art.getStatus().paused, true);
      assert.equal(h.pending, 0);
      previous = art.getFrame().text;
    }
    art.dispose();
    assert.equal(h.pending, 0);
  }
});

test('crossing zero current preserves continuous drift-passage positions', () => {
  const model = createSeahorseModel({ scene: 'drift-passage', count: 4, choreography: 'hold', stagger: 0, current: -.001 });
  model.direct({ type: 'seek', progress: .3 });
  const before = model.getDirectorState();
  model.configure({ current: .001 });
  const after = model.getDirectorState();
  assert.equal(after.progress, before.progress);
  assert.equal(model.getState().tick, 0);
  for (const previous of before.members) {
    const current = after.members.find(member => member.id === previous.id);
    assert(current);
    const movement = Math.hypot(current.x - previous.x, current.y - previous.y);
    assert(movement < .02, `visitor ${previous.id} moved ${movement} world units when current crossed zero`);
  }
});

test('paused and reduced-motion directors accept static actions without claiming scheduler ownership', () => {
  for (const reducedMotion of [false, true]) {
    const h = fakeBrowser({ reducedMotion }), canvas = h.canvas();
    const art = createSeahorseArtwork(canvas, { ...garden, paused: !reducedMotion });
    h.intersect(canvas, true);
    assert.equal(h.pending, 0);
    for (const type of ['release', 'anchor', 'inspect', 'startle']) {
      art.restart();
      const expected = createSeahorseModel({ ...garden, paused: !reducedMotion });
      expected.direct({ type }, true);
      art.direct({ type });
      assert.equal(art.getStatus().tick, 0);
      assert.equal(art.getFrame().text, expected.frame().text);
      assert.equal(art.getStatus().paused, true);
      assert.equal(h.pending, 0);
    }
    art.update({ current: -.5, labels: true });
    art.guide(1, -1);
    art.direct({ type: 'seek', progress: .6 });
    art.restart();
    assert.equal(h.pending, 0);
    if (reducedMotion) {
      art.play(); assert.equal(h.pending, 0);
      h.setReduced(false); assert.equal(h.pending, 1);
      h.setReduced(true); assert.equal(h.pending, 0);
    } else {
      art.play(); assert.equal(h.pending, 1);
    }
    art.dispose();
    assert.equal(h.pending, 0);
  }
});

test('canvas keyboard controls select, inspect, release and attach without global key handlers', () => {
  const h = fakeBrowser(), canvas = h.canvas();
  const art = createSeahorseArtwork(canvas, { ...garden, paused: true });
  h.intersect(canvas, true);
  h.document.activeElement = canvas;
  const ids = art.getDirectorState().members.map(member => member.id);
  let prevented = 0;
  const key = key => canvas.emit('keydown', { key, target: canvas, currentTarget: canvas, preventDefault() { prevented++; } });
  const selected = () => art.getDirectorState().selected;
  const initial = selected();
  h.view.emit('keydown', { key: 'ArrowRight', preventDefault() {} });
  assert.equal(selected(), initial, 'the page/window does not own artwork keyboard shortcuts');
  key('ArrowRight'); assert.equal(selected(), ids[1]);
  key('ArrowLeft'); assert.equal(selected(), ids[0]);
  key('ArrowLeft'); assert.equal(selected(), ids.at(-1));
  for (const [shortcut, type] of [['Enter', 'inspect'], ['r', 'release'], ['h', 'anchor']]) {
    art.restart();
    const expected = createSeahorseModel({ ...garden, paused: true });
    expected.direct({ type }, true);
    key(shortcut);
    assert.equal(art.getFrame().text, expected.frame().text);
    assert.equal(h.pending, 0);
    assert.equal(art.getStatus().tick, 0);
  }
  key(' '); assert.equal(art.getOptions().paused, false); assert.equal(h.pending, 1);
  key(' '); assert.equal(art.getOptions().paused, true); assert.equal(h.pending, 0);
  h.setReduced(true); key(' '); assert.equal(h.pending, 0);
  assert(prevented >= 9, 'handled navigation keys suppress page scrolling/default activation');
  art.dispose();
  assert.equal(canvas.listenerCount, 0);
  assert.equal(h.view.listenerCount, 0);
});

test('pointer cancellation and explicit clearGuide restore attention without waking a paused director', () => {
  const h = fakeBrowser(), canvas = h.canvas();
  const art = createSeahorseArtwork(canvas, { ...garden, paused: true });
  h.intersect(canvas, true);
  h.document.activeElement = canvas;
  const baseline = art.getFrame().text;
  const move = () => canvas.emit('pointermove', { clientX: canvas.rect.width * .8, clientY: canvas.rect.height * .2, pointerType: 'touch' });
  move();
  const expected = createSeahorseModel({ ...garden, paused: true });
  expected.guide(.6, -.6);
  assert.equal(art.getFrame().text, expected.frame().text);
  canvas.emit('pointercancel');
  assert.equal(art.getFrame().text, baseline);
  move(); canvas.emit('pointerleave'); assert.equal(art.getFrame().text, baseline);
  art.guide(.8, .7); art.clearGuide(); assert.equal(art.getFrame().text, baseline);
  canvas.emit('keydown', { key: 'ArrowUp', preventDefault() {} });
  canvas.emit('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(art.getFrame().text, baseline);
  assert.equal(art.getStatus().tick, 0);
  assert.equal(h.pending, 0);
  art.dispose();
});

test('new director commands remain inert after disposal and do not affect another shared-scheduler instance', () => {
  const h = fakeBrowser(), ca = h.canvas(), cb = h.canvas();
  const a = createSeahorseArtwork(ca, garden), b = createSeahorseArtwork(cb, { scene: 'tidal-duet', count: 2 });
  h.intersect(ca, true); h.intersect(cb, true);
  assert.equal(h.pending, 1);
  a.direct({ type: 'startle' });
  h.frame(); h.frame(30);
  a.dispose();
  const frozen = a.getDirectorState();
  a.direct({ type: 'release' });
  a.direct({ type: 'invalid', id: NaN });
  a.update({ count: 99 });
  a.restart();
  assert.deepEqual(a.getDirectorState(), frozen);
  assert.equal(ca.listenerCount, 0);
  assert.equal(h.pending, 1);
  b.pause(); assert.equal(h.pending, 0);
  b.direct({ type: 'inspect' }); assert.equal(h.pending, 0);
  b.dispose();
  assert.equal(h.resizes.size, 0);
  assert.equal(h.intersections.size, 0);
  assert.equal(h.motion.listenerCount, 0);
  assert.equal(h.document.listenerCount, 0);
  assert.equal(h.view.listenerCount, 0);
  assert.equal(cb.listenerCount, 0);
});

test('directed artworks borrow injected frame sources and release only their own subscriptions', () => {
  const callbacks = new Set();
  let disposeCalls = 0;
  const frameSource = {
    subscribe(callback) { callbacks.add(callback); return () => callbacks.delete(callback); },
    dispose() { disposeCalls++; callbacks.clear(); }
  };
  const h = fakeBrowser(), ca = h.canvas(), cb = h.canvas();
  const a = createSeahorseArtwork(ca, { ...garden, frameSource });
  const b = createSeahorseArtwork(cb, { ...garden, frameSource });
  h.intersect(ca, true); h.intersect(cb, true);
  assert.equal(callbacks.size, 2);
  assert.equal(h.pending, 0);
  a.direct({ type: 'release' }); a.dispose();
  assert.equal(callbacks.size, 1);
  assert.equal(disposeCalls, 0);
  b.pause(); assert.equal(callbacks.size, 0);
  b.direct({ type: 'inspect' }); assert.equal(callbacks.size, 0);
  b.play(); assert.equal(callbacks.size, 1);
  b.dispose(); assert.equal(callbacks.size, 0);
  assert.equal(disposeCalls, 0);
});

test('the director model imports and renders in a fresh process without DOM globals', () => {
  const moduleUrl = new URL('../lib/public/seahorse.js', import.meta.url).href;
  const script = `
    if (typeof window !== 'undefined' || typeof document !== 'undefined') throw Error('DOM unexpectedly present');
    const {createSeahorseModel} = await import(${JSON.stringify(moduleUrl)});
    const model = createSeahorseModel({scene:'tidal-duet',count:2});
    model.direct({type:'seek',progress:.4});
    model.direct({type:'inspect'},true);
    if (!model.frame().text || model.getDirectorState().members.length !== 2) throw Error('director failed');
  `;
  execFileSync(process.execPath, ['--input-type=module', '-e', script], { stdio: 'pipe' });
});
