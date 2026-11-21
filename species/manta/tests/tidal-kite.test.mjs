import test from 'node:test';
import assert from 'node:assert/strict';
import { createMantaReef } from '../reef-artwork.mjs';
import { reefTestHost, cellDigest, visibleCellDigest, advance, ownedPoint, listenerCount, poseVector } from './reef-test-host.mjs';

// Numerical/lifecycle evidence only; the host does not rasterize browser text.
const manual = { autoStart: false, seed: 20261119, maxCells: 2048, reducedMotion: 'ignore' };
const modulePath = '../variants/tidal-kite/artwork.mjs';
async function mount(options = {}, width = 390, height = 500, hostOptions = {}) {
  const { createMantaTidalKite } = await import(modulePath);
  const host = reefTestHost(hostOptions), canvas = host.canvas(width, height);
  return { host, canvas, art: createMantaTidalKite(canvas, {}, { ...manual, ...options }) };
}
function emptyResources(host, ...canvases) {
  assert.equal(listenerCount(host, ...canvases), 0);
  assert.equal(host.pending + host.resizes.size + host.intersections.size, 0);
}
function finiteFrame(art) {
  assert(art.sampleCount > 0 && art.sampleCount <= 36000);
  assert(art.glyphCount > 20 && art.depth.length <= art.options.maxCells);
  assert(poseVector(art.reefPose).every(Number.isFinite));
  for (const depth of art.depth) assert(depth === -Infinity || Number.isFinite(depth));
}
function key(host, canvas, value, extra = {}) {
  const event = { key: value, code: value === ' ' ? 'Space' : value, target: canvas,
    defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
  host.document.activeElement = canvas; canvas.emit('keydown', event); return event;
}
function attributes(canvas) {
  const values = new Map(); canvas.style = { touchAction: '' };
  canvas.getAttribute = name => values.get(name) ?? null;
  canvas.hasAttribute = name => values.has(name);
  canvas.setAttribute = (name, value) => values.set(name, String(value));
  canvas.removeAttribute = name => values.delete(name);
}

test('import and variant lifetime leave Original geometry, state and cells isolated', async () => {
  const host = reefTestHost(), originalCanvas = host.canvas(), controlCanvas = host.canvas(), canvas = host.canvas();
  const original = createMantaReef(originalCanvas, {}, manual), control = createMantaReef(controlCanvas, {}, manual);
  const definition = original.fish[0].definition, state = original.fish[0].speciesState;
  const before = original.getReef(), frame = cellDigest(original);
  const { createMantaTidalKite } = await import(modulePath);
  const art = createMantaTidalKite(canvas, {}, manual), variantDefinition = art.fish[0].definition;
  assert.notEqual(variantDefinition, definition);
  assert.deepEqual(original.getReef(), before); assert.equal(cellDigest(original), frame);
  const variantState = art.fish[0].speciesState;
  art.setOptions({ palette: 'ultraviolet' });
  assert.equal(art.fish[0].definition, variantDefinition); assert.equal(art.fish[0].speciesState, variantState);
  art.setOptions({ seed: 92 }); assert.notEqual(art.fish[0].speciesState, variantState);
  const reseeded = art.fish[0].speciesState;
  art.restart(); assert.notEqual(art.fish[0].speciesState, reseeded);
  assert.equal(art.fish[0].definition, variantDefinition);
  art.invite({ x: -.4, y: .3 }); advance(art, .2); art.dispose();
  assert.equal(original.fish[0].definition, definition); assert.equal(original.fish[0].speciesState, state);
  assert.deepEqual(original.getReef(), before); assert.equal(cellDigest(original), frame);
  advance(original, .2); advance(control, .2);
  assert.deepEqual(original.getReef(), control.getReef()); assert.equal(cellDigest(original), cellDigest(control));
  assert.equal(original.options.density, 1.24, 'Original keeps its shipped defaults');
  original.destroy(); control.destroy(); emptyResources(host, originalCanvas, controlCanvas, canvas);
});

test('invalid options and interrupted attachment roll back retained resources', async () => {
  const { createMantaTidalKite } = await import(modulePath);
  const host = reefTestHost(), canvas = host.canvas(); attributes(canvas);
  for (const options of [null, [], { species: 'octopus' }, { count: 2 }, { scene: 'swimby' }, { seed: NaN }]) {
    assert.throws(() => createMantaTidalKite(canvas, {}, options)); emptyResources(host, canvas);
  }
  assert.throws(() => createMantaTidalKite(canvas, { duration: NaN }, manual)); emptyResources(host, canvas);
  const add = canvas.addEventListener.bind(canvas);
  canvas.addEventListener = (type, listener) => { if (type === 'keydown') throw new Error('attachment failed'); add(type, listener); };
  assert.throws(() => createMantaTidalKite(canvas, {}, manual), /attachment failed/);
  emptyResources(host, canvas); assert.equal(canvas.getAttribute('tabindex'), null); assert.equal(canvas.style.touchAction, '');
  canvas.addEventListener = add; canvas.setAttribute('tabindex', '-1'); canvas.style.touchAction = 'none';
  createMantaTidalKite(canvas, {}, manual).dispose();
  assert.equal(canvas.getAttribute('tabindex'), '-1'); assert.equal(canvas.style.touchAction, 'none'); emptyResources(host, canvas);
});

test('bank side and invitation coordinates change visible outcomes on a phone', async () => {
  const left = await mount(), right = await mount(), high = await mount(), low = await mount();
  assert.equal(left.art.bank(-1), true); assert.equal(right.art.bank(1), true);
  const target = { x: -.4, y: -.35 }; high.art.invite(target); target.x = .4;
  low.art.invite({ x: .4, y: .35 });
  for (const { art } of [left, right, high, low]) { advance(art, 2.7); finiteFrame(art); }
  assert(left.art.reefPose.bank < -.8 && right.art.reefPose.bank > .8);
  assert(left.art.reefPose.wingLoad < 0 && right.art.reefPose.wingLoad > 0);
  assert.notEqual(visibleCellDigest(left.art), visibleCellDigest(right.art));
  assert(high.art.reefPose.position[0] < low.art.reefPose.position[0] - 1);
  assert(high.art.reefPose.position[1] < low.art.reefPose.position[1] - 1);
  assert.deepEqual(high.art.getReef().invitationTarget, { x: -.4, y: -.35 });
  assert(Object.isFrozen(high.art.getReef().invitationTarget));
  for (const { art } of [left, right, high, low]) art.dispose();
});

test('both moments replay at 60 Hz through anticipation, response and settling', async () => {
  const a = await mount(), b = await mount(), stages = new Set();
  for (let tick = 0; tick < 960; tick++) {
    for (const { art } of [a, b]) {
      if (tick === 0) assert(art.invite({ x: .32, y: -.2 }));
      if (tick === 30) assert.equal(art.bank(-1), false, 'no overlap or queued response');
      if (tick === 420) assert(art.bank(-1));
      if (tick === 450) assert.equal(art.invite({ x: -.3, y: .1 }), false);
      art.advance(1 / 60);
    }
    if (tick % 7 === 0) b.art.render();
    const snapshot = a.art.getReef(); stages.add(`${snapshot.sequence}:${snapshot.stage}`);
    if (tick % 60 === 0) { finiteFrame(a.art); assert.equal(a.art.ink.length, 0); }
  }
  for (const [sequence, response] of [['glide-invitation', 'glide'], ['barrel-bank', 'bank']]) {
    for (const stage of ['anticipation', response, 'recover']) assert(stages.has(`${sequence}:${stage}`));
  }
  assert.equal(a.art.getReef().busy, false); assert.equal(a.art.getReef().sequence, 'current-glide');
  assert.deepEqual(a.art.getReef(), b.art.getReef()); assert.equal(cellDigest(a.art), cellDigest(b.art));
  const settled = await mount(); advance(settled.art, 16);
  assert.deepEqual(poseVector(a.art.reefPose), poseVector(settled.art.reefPose), 'response returns fully to the idle route');
  a.art.dispose(); b.art.dispose(); settled.art.dispose();
});

test('touch commits on matching release and rejects scroll, cancellation and secondary input', async () => {
  const { art, host, canvas } = await mount({}, 390, 500, { dpr: 2 });
  canvas.rect.left = 41; canvas.rect.top = 73;
  const tap = { clientX: 43, clientY: 75, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 };
  canvas.emit('pointerdown', tap); assert.equal(art.getReef().busy, false);
  canvas.emit('pointerup', { ...tap, pointerId: 8 }); assert.equal(art.getReef().busy, false);
  canvas.emit('pointerup', tap); assert.equal(art.getReef().sequence, 'glide-invitation');
  assert(Math.abs(art.getReef().invitationTarget.x - (2 / 390 - .5)) < 1e-12);
  for (const cancel of ['pointercancel', 'pointerleave', 'lostpointercapture', 'drag']) {
    art.restart(); canvas.emit('pointerdown', tap);
    if (cancel === 'drag') {
      canvas.emit('pointermove', { ...tap, clientY: 110 }); canvas.emit('pointermove', tap);
    } else canvas.emit(cancel, tap);
    canvas.emit('pointerup', tap); assert.equal(art.getReef().busy, false, cancel);
  }
  canvas.emit('pointerdown', { ...tap, isPrimary: false }); canvas.emit('pointerup', tap);
  assert.equal(art.getReef().busy, false);
  const point = ownedPoint(art), animalTap = { ...tap, clientX: point.x + 41, clientY: point.y + 73 };
  canvas.emit('pointerdown', animalTap); assert.equal(art.getReef().busy, false);
  canvas.emit('pointerup', animalTap); assert.equal(art.getReef().sequence, 'barrel-bank');
  const before = art.getReef();
  for (const target of [null, { x: NaN, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 0, extra: 1 }]) assert.throws(() => art.invite(target));
  assert.deepEqual(art.getReef(), before); art.dispose(); emptyResources(host, canvas);
});

test('keyboard stills remain static and respect host-consumed keys', async () => {
  for (const [width, height] of [[900, 620], [390, 500]]) {
    const { art, host, canvas } = await mount({}, width, height), frames = new Set();
    for (const still of ['glide', 'anticipation', 'bank', 'recover', 'invite']) {
      assert(art.showReefStill(still)); finiteFrame(art); frames.add(visibleCellDigest(art));
    }
    assert.equal(frames.size, 5);
    const clock = art.time;
    assert(key(host, canvas, 'ArrowLeft').defaultPrevented); assert.equal(art.getReef().side, -1);
    assert.equal(art.getReef().still, 'bank');
    key(host, canvas, 'ArrowRight'); assert.equal(art.getReef().side, 1);
    key(host, canvas, 'ArrowUp'); assert.equal(art.getReef().invitationTarget.y, -.3);
    key(host, canvas, 'ArrowDown'); assert.equal(art.getReef().invitationTarget.y, .25);
    key(host, canvas, 'g'); assert.equal(art.getReef().invitationTarget.x, .32);
    key(host, canvas, 'G', { shiftKey: true }); assert.equal(art.getReef().invitationTarget.x, -.32);
    assert.equal(art.getReef().still, 'invite');
    const snapshot = art.getReef(), raster = visibleCellDigest(art);
    for (const extra of [{ defaultPrevented: true }, { repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { target: {} }]) {
      key(host, canvas, 'ArrowRight', extra); assert.deepEqual(art.getReef(), snapshot);
    }
    assert.equal(key(host, canvas, 'Tab').defaultPrevented, false);
    host.document.activeElement = {};
    canvas.emit('keydown', { key: 'ArrowRight', target: canvas, preventDefault() { assert.fail('unfocused input consumed'); } });
    assert.deepEqual(art.getReef(), snapshot);
    art.render(); host.frame(90000); assert.equal(art.time, clock); assert.equal(visibleCellDigest(art), raster);
    assert.equal(art.paused, true); assert.equal(host.pending, 0);
    key(host, canvas, ' '); assert.equal(art.paused, false);
    key(host, canvas, 'Enter'); assert.equal(art.paused, true);
    key(host, canvas, 'Enter'); assert.equal(art.paused, false);
    key(host, canvas, 'Escape'); assert.equal(art.paused, true);
    art.dispose(); emptyResources(host, canvas);
  }
});

test('system reduced motion blocks playback, explicit stepping and option escape paths', async () => {
  const { art, host, canvas } = await mount({ reducedMotion: 'system' }, 390, 500, { reducedMotion: true });
  const clock = art.time;
  art.play(); art.setPaused(false); art.setOptions({ paused: false }); advance(art, .2);
  assert.equal(art.paused, true); assert.equal(art.time, clock); assert.equal(host.pending, 0);
  art.bank(-1); const bank = visibleCellDigest(art); art.invite({ x: .4, y: -.2 });
  assert.notEqual(visibleCellDigest(art), bank); assert.equal(art.getReef().still, 'invite');
  assert.equal(art.getReef().reducedMotion, true);
  host.setReduced(false); assert.equal(art.paused, true, 'system change alone does not resume playback');
  art.play(); art.advance(.1); assert(art.time > clock);
  host.setReduced(true); const stopped = art.time; art.play(); art.advance(.1);
  assert.equal(art.time, stopped); assert.equal(art.paused, true);
  art.dispose(); emptyResources(host, canvas);
  const running = await mount({ autoStart: true, reducedMotion: 'system' }, 390, 500, { reducedMotion: true });
  running.art.play(); running.art.setOptions({ paused: false }); running.host.frame(120000);
  assert.equal(running.host.pending, 0); assert.equal(running.art.time, 0);
  running.art.dispose(); emptyResources(running.host, running.canvas);
});

test('Original and alternative share one scheduler and stop work when unavailable', async () => {
  const { createMantaTidalKite } = await import(modulePath);
  const host = reefTestHost(), originalCanvas = host.canvas(), canvas = host.canvas(390, 500); attributes(canvas);
  const original = createMantaReef(originalCanvas, {}, { ...manual, autoStart: true });
  const art = createMantaTidalKite(canvas, {}, { ...manual, autoStart: true });
  assert.equal(host.pending, 1); assert.equal(canvas.getAttribute('tabindex'), '0'); assert.equal(canvas.style.touchAction, 'pan-y');
  host.frame(); host.frame(50); host.intersect(canvas, false);
  const offscreen = art.time, originalTime = original.time; host.frame(100);
  assert.equal(art.time, offscreen); assert(original.time > originalTime);
  original.setPaused(true); assert.equal(host.pending, 0);
  host.intersect(canvas, true); host.frame(120000); host.frame(50); assert(art.time - offscreen <= .1);
  host.hide(true); const hidden = art.time; host.frame(120000);
  assert.equal(host.pending, 0); assert.equal(art.time, hidden);
  host.hide(false); canvas.rect.width = 0; art.resize(); assert.equal(host.pending, 0);
  const zero = art.time; host.frame(120000); assert.equal(art.time, zero); assert.equal(art.depth.length, 0);
  canvas.rect.width = 390; art.resize(); assert.equal(host.pending, 1);
  art.dispose(); art.dispose(); assert.equal(art.disposed, true);
  assert.equal(canvas.getAttribute('tabindex'), null); assert.equal(canvas.style.touchAction, '');
  const snapshot = art.getReef(), time = art.time;
  art.play(); art.pause(); art.restart(); art.bank(1); art.invite({ x: 0, y: 0 }); art.setOptions({ seed: 22 });
  assert.equal(art.time, time); assert.deepEqual(art.getReef(), snapshot); assert.equal(canvas.listenerCount, 0);
  original.setPaused(false); assert.equal(host.pending, 1); host.frame(); host.frame(50); assert(original.time > originalTime);
  original.destroy(); emptyResources(host, originalCanvas, canvas);
});
