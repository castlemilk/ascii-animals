/** Director integration uses accounting doubles and canonical renderer calls, not browser pixels. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mountPufferfish } from '../build/controller.js';
import { createPufferfishPainter } from '../build/legacy-painter.js';
import { createPufferfishDirector, pufferfishDirectorPoster, selectPufferfishActor } from '../build/director.js';
import { createScheduler } from '../../../src/core/scheduler.js';
import { fakeBrowser, legacy } from './fake-browser.mjs';

const mount = (env, options = {}) => mountPufferfish(env.canvas, legacy, {
  render: { quality: 'small' }, director: { scene: 'reef', count: 3 }, ...options,
});
const pointerAt = (canvas, x, y, pointerType = 'mouse') => ({ pointerType,
  clientX: canvas.rect.left + (x + 1) * canvas.rect.width / 2,
  clientY: canvas.rect.top + (y + 1) * canvas.rect.height / 2 });
function keyOn(target, key, values = {}) {
  let prevented = false;
  target.emit('keydown', { key, repeat: false, altKey: false, ctrlKey: false, metaKey: false,
    preventDefault() { prevented = true; }, ...values });
  return prevented;
}
function pointOwnedBy(env, state, id) {
  const painter = createPufferfishPainter(env.createCanvas(), legacy, { quality: 'small' });
  painter.resize(env.canvas.rect.width, env.canvas.rect.height, env.win.devicePixelRatio);
  const frame = painter.drawScene(state, true);
  try {
    for (let row = 0; row < frame.rows; row++) for (let col = 0; col < frame.cols; col++) {
      const x = (col + 0.5) / frame.cols * 2 - 1, y = (row + 0.5) / frame.rows * 2 - 1;
      if (painter.hitActor(x, y) === id) return { x, y };
    }
    assert.fail(`actor ${id} has no selectable visible cell`);
  } finally { painter.dispose(); }
}
function tap(canvas, point, overrides = {}, endDelta = {}) {
  const down = { ...pointerAt(canvas, point.x, point.y, 'touch'), pointerId: 4,
    button: 0, isPrimary: true, ...overrides };
  canvas.emit('pointerdown', down);
  canvas.emit('pointerup', { ...down, ...endDelta });
}
function accountScheduler(env) {
  const scheduler = createScheduler({ requestFrame: callback => env.win.requestAnimationFrame(callback),
    cancelFrame: id => env.win.cancelAnimationFrame(id) });
  let subscribed = 0, released = 0, disposed = 0;
  return { scheduler,
    source: {
      subscribe(callback) {
        subscribed++; const unsubscribe = scheduler.subscribe(callback);
        return () => { released++; unsubscribe(); };
      },
      dispose() { disposed++; scheduler.dispose(); },
    },
    stats: () => ({ subscribed, released, disposed }),
  };
}
function released(env) {
  const resources = env.resources();
  assert.equal(resources.rafs, 0); assert.equal(resources.listeners, 0); assert.equal(resources.observedTargets, 0);
}

test('a three-actor director owns one borrowed subscription and leaves another artwork alive on disposal', () => {
  const env = fakeBrowser(), source = accountScheduler(env);
  const a = mount(env, { frameSource: source.source });
  const otherCanvas = env.createCanvas();
  const b = mountPufferfish(otherCanvas, legacy, { director: { scene: 'current', count: 3 },
    render: { quality: 'small' }, frameSource: source.source });
  assert.equal(source.scheduler.size, 2); assert.equal(env.rafs.size, 1);
  env.flush(0); env.flush(17);
  assert.equal(a.getDirectorSnapshot().actors.length, 3); assert.equal(a.getDirectorSnapshot().tick, 1);
  assert.equal(b.getDirectorSnapshot().actors.length, 3); assert.equal(b.getDirectorSnapshot().tick, 1);
  a.destroy(); a.destroy();
  assert.equal(source.scheduler.size, 1); assert.equal(env.rafs.size, 1); assert.equal(source.stats().disposed, 0);
  env.flush(34); assert.equal(b.getDirectorSnapshot().tick, 2); assert.equal(a.getDirectorSnapshot().tick, 1);
  b.destroy(); assert.equal(source.scheduler.size, 0); assert.equal(source.stats().disposed, 0);
  released(env); source.scheduler.dispose();
});

test('default solo consumers remain solo when director is omitted and original reset/configuration API still works', () => {
  const env = fakeBrowser(); const solo = mountPufferfish(env.canvas, legacy, { paused: true, render: { quality: 'small' } });
  assert.equal(solo.getDirectorSnapshot(), null); assert.equal(solo.getStatus().director, null);
  assert.equal(solo.getSnapshot().version, 'pufferfish-v1');
  solo.approach(); assert.equal(solo.getStatus().phase, 'holding');
  assert.equal(solo.getSnapshot().tick, 0);
  solo.configure({ dwellTicks: 50 }); solo.reset(15);
  assert.equal(solo.getSnapshot().config.dwellTicks, 50); assert.equal(solo.getSnapshot().config.seed, 15);
  assert.equal(solo.getStatus().userPaused, true);
  solo.destroy(); released(env);
});

test('paused, reduced-motion and compact directors allow deliberate static focus/actions with zero ticks/subscriptions', () => {
  for (const condition of ['paused', 'reduced', 'compact']) {
    const env = fakeBrowser(condition === 'reduced' ? { reduced: true }
      : condition === 'compact' ? { rect: { left: 0, top: 0, width: 340, height: 255 } } : {});
    const source = accountScheduler(env);
    const controller = mount(env, { frameSource: source.source, paused: condition === 'paused' });
    controller.selectActor(2); controller.invite(0.2, -0.2); controller.approach();
    assert.equal(controller.getDirectorSnapshot().tick, 0);
    assert.equal(controller.getStatus().director.selected, 2);
    assert.equal(controller.getStatus().phase, 'holding');
    assert.equal(controller.getStatus().director.actors[2].phase, 'holding');
    assert.equal(controller.getStatus().director.actors[2].motive, 'defensive');
    assert.equal(controller.getStatus().director.actors[2].threat, 1);
    assert.ok(controller.getDirectorSnapshot().actors.every(actor => actor.state.phase.kind === 'idle'));
    assert.equal(source.scheduler.size, 0); assert.equal(env.rafs.size, 0);
    controller.retreat(); assert.equal(controller.getStatus().phase, 'idle');
    controller.reset(); controller.configureDirector({ scene: 'shadow' });
    assert.equal(controller.getDirectorSnapshot().tick, 0);
    assert.equal(controller.getStatus().director.scene, 'shadow');
    assert.equal(source.scheduler.size, 0); assert.equal(env.rafs.size, 0);
    controller.destroy(); released(env); source.scheduler.dispose();
  }
});

test('director updates reset deterministically, species updates retain direction, and render updates preserve simulation', () => {
  const env = fakeBrowser(); const controller = mount(env, { paused: true,
    director: { scene: 'current', count: 3, current: -0.6 }, species: { seed: 23 } });
  controller.selectActor(2); controller.invite(0.2, -0.2);
  controller.configureDirector({ count: 2 });
  assert.equal(controller.getDirectorSnapshot().config.count, 2); assert.equal(controller.getDirectorSnapshot().selected, 0);
  assert.deepEqual(controller.getDirectorSnapshot().config.roles, ['explorer', 'sentinel']);
  controller.configure({ wobble: 0.3 });
  assert.equal(controller.getDirectorSnapshot().config.scene, 'current');
  assert.equal(controller.getDirectorSnapshot().config.current, -0.6);
  assert.equal(controller.getDirectorSnapshot().speciesConfig.wobble, 0.3);
  const state = controller.getDirectorSnapshot();
  controller.configureRender({ mode: 'points' });
  assert.deepEqual(controller.getDirectorSnapshot(), state, 'render changes preserve every simulation field; object identity is not an API guarantee');
  controller.reset(44);
  assert.equal(controller.getDirectorSnapshot().speciesConfig.seed, 44);
  assert.equal(controller.getDirectorSnapshot().config.scene, 'current');
  assert.equal(controller.getStatus().userPaused, true); assert.equal(env.rafs.size, 0);
  controller.destroy(); released(env);
});

test('a touch tap selects its visible owner and empty water invites without advancing a static scene', () => {
  const env = fakeBrowser(), controller = mount(env, { paused: true });
  const point = pointOwnedBy(env, controller.getDirectorSnapshot(), 2);
  assert.ok(Math.abs(point.x) > 0.1, 'the visible target is not the centered actor');
  tap(env.canvas, point);
  assert.equal(controller.getDirectorSnapshot().selected, 2);
  assert.equal(controller.getDirectorSnapshot().tick, 0);
  const raw = controller.getDirectorSnapshot();
  tap(env.canvas, { x: -0.98, y: -0.98 });
  assert.equal(controller.getStatus().director.actors[2].motive, 'invited');
  assert.equal(controller.getStatus().phase, 'idle');
  assert.equal(controller.getDirectorSnapshot(), raw, 'a still invitation changes presentation only');
  assert.equal(env.rafs.size, 0);
  controller.destroy(); released(env);
});

test('touch drags, nonprimary/right-button contacts and canceled contacts cannot select an actor', () => {
  const env = fakeBrowser(), controller = mount(env, { paused: true });
  const point = pointOwnedBy(env, controller.getDirectorSnapshot(), 2);
  const target = pointerAt(env.canvas, point.x, point.y, 'touch');
  tap(env.canvas, point, {}, { clientX: target.clientX + 25 });
  tap(env.canvas, point, { isPrimary: false });
  tap(env.canvas, point, { button: 2 });
  tap(env.canvas, point, {}, { pointerId: 5 });
  const contact = { ...target, pointerId: 4, button: 0, isPrimary: true };
  env.canvas.emit('pointerdown', contact); env.canvas.emit('pointercancel', contact);
  env.canvas.emit('pointerup', contact);
  assert.equal(controller.getDirectorSnapshot().selected, 0);
  assert.equal(controller.getDirectorSnapshot().tick, 0);
  assert.equal(controller.getStatus().director.actors[0].motive, 'exploring');
  assert.equal(env.rafs.size, 0);
  controller.destroy(); released(env);
});

test('canvas keys select/invite/approach/retreat/pause/reset while page keys and modified repeats stay untouched', () => {
  const env = fakeBrowser(), controller = mount(env, { paused: true, species: { seed: 23 } });
  const state = controller.getDirectorSnapshot();
  for (const target of [env.win, env.doc]) for (const key of ['3', 'i', 'a', 'Escape', ' ', 'r'])
    assert.equal(keyOn(target, key), false);
  for (const modifier of [{ repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }])
    assert.equal(keyOn(env.canvas, '3', modifier), false);
  assert.equal(keyOn(env.canvas, '?'), false);
  assert.equal(controller.getDirectorSnapshot(), state);
  assert.equal(keyOn(env.canvas, '3'), true); assert.equal(controller.getDirectorSnapshot().selected, 2);
  assert.equal(keyOn(env.canvas, 'I'), true); assert.equal(controller.getStatus().director.actors[2].motive, 'invited');
  assert.equal(keyOn(env.canvas, 'A'), true); assert.equal(controller.getStatus().director.actors[2].phase, 'holding');
  assert.ok(controller.getStatus().director.actors.slice(0, 2).every(actor => actor.phase === 'idle'));
  assert.equal(keyOn(env.canvas, 'Escape'), true); assert.equal(controller.getStatus().phase, 'idle');
  assert.equal(keyOn(env.canvas, ' '), true); assert.equal(controller.getStatus().userPaused, false); assert.equal(env.rafs.size, 1);
  assert.equal(keyOn(env.canvas, ' '), true); assert.equal(controller.getStatus().userPaused, true); assert.equal(env.rafs.size, 0);
  assert.equal(keyOn(env.canvas, 'r'), true);
  assert.equal(controller.getDirectorSnapshot().tick, 0); assert.equal(controller.getDirectorSnapshot().selected, 0);
  assert.equal(controller.getDirectorSnapshot().speciesConfig.seed, 23); assert.equal(controller.getStatus().userPaused, true);
  controller.destroy(); released(env);
});

test('malformed director updates/selections/invitations reject atomically without dropping healthy resources', () => {
  const env = fakeBrowser(); const controller = mount(env);
  const state = controller.getDirectorSnapshot();
  for (const invalid of [null, { count: 4 }, { scene: 'unknown' }, { roles: null }, { tempo: NaN }, { typo: true }])
    assert.throws(() => controller.configureDirector(invalid));
  for (const invalid of [-1, 3, 1.5, NaN, '1']) assert.throws(() => controller.selectActor(invalid));
  for (const xy of [[NaN, 0], [0, Infinity], [-1.01, 0], [0, 1.01]]) assert.throws(() => controller.invite(...xy));
  assert.equal(controller.getDirectorSnapshot(), state); assert.equal(env.rafs.size, 1);
  assert.equal(controller.getStatus().destroyed, false);
  controller.destroy(); released(env);
});

test('pointer at a noncenter actor drives that actor and leaving clears the scene target', () => {
  const env = fakeBrowser(); const controller = mount(env);
  controller.selectActor(2); env.flush(0);
  for (let i = 1; i <= 40; i++) {
    const actor = controller.getDirectorSnapshot().actors[2];
    env.canvas.emit('pointermove', pointerAt(env.canvas, actor.x, actor.y));
    env.flush(i * (1000 / 60));
  }
  assert.equal(controller.getDirectorSnapshot().actors[2].state.reactions, 1);
  assert.equal(controller.getDirectorSnapshot().actors[0].state.reactions, 0);
  env.canvas.emit('pointerleave'); env.flush(41 * (1000 / 60));
  assert.equal(controller.getDirectorSnapshot().pointer, null);
  assert.equal(controller.getDirectorSnapshot().invitation, null);
  assert.equal(controller.getDirectorSnapshot().actors[2].state.phase.kind, 'recovering');
  controller.destroy(); released(env);
});

test('director input flood remains two pending slots and suspension clears proximity before resume', () => {
  const env = fakeBrowser(); const controller = mount(env);
  for (let i = 0; i < 1000; i++) {
    env.canvas.emit('pointermove', pointerAt(env.canvas, 0.1, 0)); controller.invite(0.3, -0.2);
  }
  assert.ok(controller.getStatus().pendingInputs <= 2);
  env.visibility(true);
  controller.approach(); controller.invite(0, 0);
  assert.equal(env.rafs.size, 0);
  env.visibility(false); env.flush(1000); env.flush(1017);
  assert.equal(controller.getDirectorSnapshot().pointer, null);
  assert.equal(controller.getDirectorSnapshot().invitation, null);
  assert.equal(controller.getDirectorSnapshot().actors.reduce((sum, actor) => sum + actor.state.reactions, 0), 0);
  controller.destroy(); released(env);
});

test('pause or a live reduced-motion change followed by a still retreat cannot revive an earlier invitation', () => {
  for (const cause of ['pause', 'reduced']) {
    const env = fakeBrowser(), controller = mount(env);
    controller.selectActor(1); env.flush(0); controller.invite(0.3, -0.2); env.flush(17);
    assert.equal(controller.getDirectorSnapshot().invitation.id, 1);
    const tick = controller.getDirectorSnapshot().tick;
    if (cause === 'pause') controller.setPaused(true); else env.reduce(true);
    assert.equal(controller.getDirectorSnapshot().invitation, null, 'suspension immediately forgets transient invitation');
    assert.equal(controller.retreat().kind, 'static-poster');
    assert.equal(controller.getDirectorSnapshot().tick, tick); assert.equal(env.rafs.size, 0);
    if (cause === 'pause') controller.setPaused(false); else env.reduce(false);
    env.flush(1000); env.flush(1017);
    const resumed = controller.getDirectorSnapshot();
    assert.equal(resumed.tick, tick + 1); assert.equal(resumed.invitation, null);
    assert.equal(resumed.pointer, null); assert.equal(resumed.approach, null);
    assert.notEqual(resumed.actors[1].motive, 'invited');
    controller.destroy(); released(env);
  }
});

test('leaving the canvas before activating an invitation button does not discard the later deliberate action', () => {
  const env = fakeBrowser(), controller = mount(env);
  env.flush(0); controller.selectActor(1);
  env.canvas.emit('pointerleave'); controller.invite(0.3, -0.2); env.flush(17);
  assert.equal(controller.getDirectorSnapshot().invitation.id, 1);
  assert.equal(controller.getDirectorSnapshot().actors[1].motive, 'invited');
  assert.equal(controller.getDirectorSnapshot().pointer, null);
  controller.destroy(); released(env);
});

test('an explicit retreat wins a coalesced controller frame even when approach and invitation arrive afterward', () => {
  for (const leaveBetweenActions of [false, true]) {
    const env = fakeBrowser(), controller = mount(env, { director: { scene: 'shadow', count: 3 } });
    env.flush(0);
    const actor = controller.getDirectorSnapshot().actors[0];
    env.canvas.emit('pointermove', pointerAt(env.canvas, actor.x, actor.y));
    controller.retreat();
    if (leaveBetweenActions) env.canvas.emit('pointerleave');
    controller.approach(); controller.invite(0.2, -0.2);
    assert.ok(controller.getStatus().pendingInputs <= 2);
    env.flush(17);
    const state = controller.getDirectorSnapshot();
    assert.equal(state.tick, 1); assert.equal(state.pointer, null); assert.equal(state.invitation, null);
    assert.equal(state.approach, null); assert.equal(state.quietUntil, 241);
    assert.ok(state.actors.every(item => item.state.phase.kind === 'idle' && item.state.reactions === 0 && item.threat === 0));
    controller.destroy(); released(env);
  }
});

test('director callback reconfiguration invalidates old catch-up work while preserving one borrowed subscription', () => {
  const env = fakeBrowser(), source = accountScheduler(env); let controller, changed = false;
  controller = mount(env, { frameSource: source.source, onChange(status) {
    if (status.tick > 0 && !changed) { changed = true; controller.configureDirector({ scene: 'shadow', count: 1 }); }
  } });
  env.flush(0); controller.approach(); env.flush(1000);
  assert.equal(changed, true);
  assert.equal(controller.getDirectorSnapshot().tick, 0);
  assert.equal(controller.getDirectorSnapshot().config.scene, 'shadow');
  assert.equal(controller.getDirectorSnapshot().config.count, 1);
  assert.equal(source.scheduler.size, 1); assert.equal(env.rafs.size, 1);
  env.flush(2000); assert.equal(controller.getDirectorSnapshot().tick, 0);
  controller.destroy(); released(env); source.scheduler.dispose();
});

test('canonical scene drawing bounds combined samples/cells at all populations and returns visible actor ownership', () => {
  for (const scene of ['reef', 'current', 'shadow']) for (const count of [1, 2, 3]) {
    const env = fakeBrowser(); const painter = createPufferfishPainter(env.canvas, legacy, { quality: 'fine' });
    painter.resize(900, 506, 2);
    const initial = createPufferfishDirector({ scene, count, size: 1.1, spacing: 1.2 });
    const inflated = pufferfishDirectorPoster(initial, true);
    const frame = painter.drawScene(inflated, true);
    assert.equal(frame.actorCount, count); assert.ok(frame.samples > 0 && frame.samples <= 16000);
    assert.ok(frame.cols <= 160 && frame.rows <= 90);
    assert.ok(frame.width <= 1200 && frame.height <= 675 && frame.dpr <= 2);
    assert.match(frame.text, /^[\x20-\x7e\n]+$/);
    assert.equal(frame.text.split('\n').length, frame.rows);
    assert.ok(frame.text.split('\n').every(line => line.length === frame.cols));
    const visible = new Set();
    for (let row = 0; row < frame.rows; row++) for (let col = 0; col < frame.cols; col++) {
      const owner = painter.hitActor((col + 0.5) / frame.cols * 2 - 1, (row + 0.5) / frame.rows * 2 - 1);
      if (owner !== null) { assert.ok(owner >= 0 && owner < count); visible.add(owner); }
    }
    assert.equal(visible.size, count, `${scene}/${count}: every actor has actual visible ownership`);
    assert.equal(painter.hitActor(-0.98, -0.98), null);
    painter.configure({ mode: 'points' });
    const points = painter.drawScene(inflated, true);
    assert.equal(points.samples, frame.samples); assert.equal(points.text, frame.text, 'presentation mode does not alter logical glyphs');
    painter.dispose();
  }
});

test('narrow trios keep every inflated selection pickable with bounded geometry and continuous presentation scaling', () => {
  const env = fakeBrowser(), painter = createPufferfishPainter(env.canvas, legacy, { quality: 'fine' });
  const initial = createPufferfishDirector({ scene: 'reef', count: 3, size: 1.1, spacing: 1.2 }, { inflationScale: 1.8 });
  const centers = initial.actors.map(actor => [actor.x, actor.y]);
  const scales = [];
  for (const [width, height] of [[360, 360], [390, 540], [520, 390], [610, 458], [700, 525]]) {
    painter.resize(width, height, 2);
    for (const selected of [0, 1, 2]) {
      const scene = pufferfishDirectorPoster(selectPufferfishActor(initial, selected), true);
      const frame = painter.drawScene(scene, true);
      assert.ok(frame.sceneScale >= 0.72 && frame.sceneScale <= 1);
      if (width <= 520) assert.equal(frame.sceneScale, 0.72);
      if (width === 700) assert.equal(frame.sceneScale, 1);
      if (selected === 0) scales.push(frame.sceneScale);
      assert.ok(frame.samples <= 16000 && frame.cols <= 160 && frame.rows <= 90);
      const seen = new Set();
      for (let row = 0; row < frame.rows; row++) for (let col = 0; col < frame.cols; col++) {
        const owner = painter.hitActor((col + 0.5) / frame.cols * 2 - 1, (row + 0.5) / frame.rows * 2 - 1);
        if (owner !== null) seen.add(owner);
      }
      assert.deepEqual([...seen].sort(), [0, 1, 2], `${width}px, inflated actor ${selected}: all actual grid owners remain selectable`);
      for (let row = 0; row < frame.rows; row++) {
        const y = (row + 0.5) / frame.rows * 2 - 1;
        assert.equal(painter.hitActor(-0.999, y), null, 'no actor reaches the left clipped grid edge');
        assert.equal(painter.hitActor(0.999, y), null, 'no actor reaches the right clipped grid edge');
      }
      assert.deepEqual(scene.actors.map(actor => [actor.x, actor.y]), centers, 'layout scaling does not move normalized input targets');
    }
  }
  assert.ok(scales[3] > scales[2] && scales[3] < scales[4]);
  painter.resize(390, 540, 2);
  assert.equal(painter.drawScene(createPufferfishDirector({ count: 2 }), true).sceneScale, 1);
  assert.equal(painter.draw(initial.actors[0].state, true).sceneScale, 1, 'original solo geometry is unaffected');
  painter.dispose();
});
