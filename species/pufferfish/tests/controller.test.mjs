import test from 'node:test';
import assert from 'node:assert/strict';
import { mountPufferfish, normalizePufferfishPointer } from '../build/controller.js';
import { fakeBrowser, legacy } from './fake-browser.mjs';

const mount = (environment, options = {}) => mountPufferfish(environment.canvas, legacy,
  { render: { quality: 'small' }, ...options });
const nearPointer = env => ({ pointerType: 'mouse', clientX: env.canvas.rect.left + env.canvas.rect.width / 2,
  clientY: env.canvas.rect.top + env.canvas.rect.height / 2 });
const expectReleased = env => {
  const resources = env.resources();
  assert.equal(resources.rafs, 0); assert.equal(resources.listeners, 0); assert.equal(resources.observedTargets, 0);
};

test('pointer normalization uses CSS rectangle, handles reflow/outside/zero size, and rejects invalid values', () => {
  const rect = { left: 100, top: 200, width: 800, height: 400 };
  assert.deepEqual(normalizePufferfishPointer(500, 400, rect), { type: 'pointer', x: 0, y: 0, aspect: 2 });
  assert.deepEqual(normalizePufferfishPointer(300, 300, rect), { type: 'pointer', x: -0.5, y: -0.5, aspect: 2 });
  assert.deepEqual(normalizePufferfishPointer(1200, 400, rect), { type: 'retreat' });
  assert.deepEqual(normalizePufferfishPointer(300, 100, rect), { type: 'retreat' });
  assert.equal(normalizePufferfishPointer(0, 0, { ...rect, width: 0 }), null);
  assert.equal(normalizePufferfishPointer(0, 0, { ...rect, height: 0 }), null);
  assert.equal(normalizePufferfishPointer(0, 0, { ...rect, width: 8000, height: 100 }), null);
  for (const [x, y, value] of [[NaN, 0, rect], [0, Infinity, rect], [0, 0, { ...rect, width: -1 }],
    [0, 0, { ...rect, top: NaN }], ['100', 0, rect]]) assert.throws(() => normalizePufferfishPointer(x, y, value));
});

test('each suspension cause cancels RAF and clearing one cause cannot clear an independent pause', () => {
  const env = fakeBrowser(); const controller = mount(env);
  assert.equal(env.rafs.size, 1);
  controller.setPaused(true);
  assert.equal(env.rafs.size, 0);
  for (const [enter, leave, key] of [
    [() => env.visibility(true), () => env.visibility(false), 'hidden'],
    [() => env.intersect(env.canvas, false), () => env.intersect(env.canvas, true), 'offscreen'],
    [() => env.reduce(true), () => env.reduce(false), 'reducedMotion'],
    [() => env.resize(env.canvas, { width: 0 }), () => env.resize(env.canvas, { width: 900 }), 'zeroSized'],
    [() => env.resize(env.canvas, { width: 320 }), () => env.resize(env.canvas, { width: 900 }), 'compact'],
  ]) {
    enter(); assert.equal(controller.getStatus()[key], true); assert.equal(env.rafs.size, 0);
    leave(); assert.equal(controller.getStatus()[key], false); assert.equal(env.rafs.size, 0);
    assert.equal(controller.getStatus().userPaused, true);
  }
  controller.setPaused(false); assert.equal(env.rafs.size, 1);
  env.visibility(true); assert.equal(env.rafs.size, 0);
  env.visibility(false); assert.equal(env.rafs.size, 1);
  controller.destroy(); expectReleased(env);
});

test('initial reduced/hidden/zero/compact states perform no autonomous scheduling', () => {
  for (const settings of [
    { reduced: true }, { hidden: true }, { rect: { left: 0, top: 0, width: 0, height: 300 } },
    { rect: { left: 0, top: 0, width: 320, height: 300 } },
  ]) {
    const env = fakeBrowser(settings); const controller = mount(env);
    assert.equal(env.rafs.size, 0); assert.equal(controller.getStatus().tick, 0);
    env.flush(100000); assert.equal(controller.getStatus().tick, 0);
    controller.destroy(); expectReleased(env);
  }
});

test('a compact viewport retains deliberate static touch/keyboard alternatives without a RAF', () => {
  const env = fakeBrowser({ rect: { left: 0, top: 0, width: 340, height: 255 } });
  const controller = mount(env);
  assert.equal(controller.getStatus().compact, true);
  assert.equal(controller.approach().kind, 'static-poster');
  assert.equal(controller.getStatus().phase, 'holding');
  assert.equal(controller.retreat().kind, 'static-poster');
  assert.equal(controller.getStatus().phase, 'idle');
  assert.equal(controller.getSnapshot().tick, 0);
  assert.equal(env.rafs.size, 0);
  controller.destroy(); expectReleased(env);
});

test('pause persists through configure/reset/static actions and ordinary pointer movement cannot defeat it', () => {
  const env = fakeBrowser(); const controller = mount(env, { paused: true });
  const initial = controller.getSnapshot();
  assert.deepEqual(controller.approach(), { kind: 'static-poster', phase: 'holding' });
  assert.equal(controller.getSnapshot(), initial, 'static actions leave pure simulation snapshot untouched');
  assert.equal(controller.getStatus().phase, 'holding');
  assert.deepEqual(controller.retreat(), { kind: 'static-poster', phase: 'idle' });
  env.canvas.emit('pointermove', nearPointer(env));
  controller.configure({ seed: 44 }); controller.configureRender({ view: 'front' }); controller.reset(45);
  assert.equal(controller.getStatus().userPaused, true); assert.equal(controller.getStatus().tick, 0);
  assert.equal(controller.getSnapshot().config.seed, 45); assert.equal(env.rafs.size, 0);
  controller.destroy(); expectReleased(env);
});

test('live reduced-motion changes show static alternatives without unpausing or creating autonomous work', () => {
  const env = fakeBrowser(); const controller = mount(env);
  env.flush(0); controller.approach(); env.flush(17);
  assert.equal(controller.getSnapshot().tick, 1);
  env.reduce(true);
  assert.equal(controller.getStatus().phase, 'idle'); assert.equal(env.rafs.size, 0);
  const tick = controller.getStatus().tick;
  env.canvas.emit('pointermove', nearPointer(env));
  assert.equal(controller.approach().kind, 'static-poster');
  assert.equal(controller.getStatus().phase, 'holding'); assert.equal(env.rafs.size, 0);
  env.flush(5000); assert.equal(controller.getStatus().tick, tick);
  controller.setPaused(true); env.reduce(false);
  assert.equal(env.rafs.size, 0); assert.equal(controller.getStatus().userPaused, true);
  controller.reset(); assert.equal(env.rafs.size, 0);
  controller.destroy(); expectReleased(env);
});

test('pointer/action floods occupy at most two slots; touch does not synthesize hover; hidden input cannot startle on return', () => {
  const env = fakeBrowser(); const controller = mount(env);
  for (let i = 0; i < 5000; i++) env.canvas.emit('pointermove', nearPointer(env));
  for (let i = 0; i < 2000; i++) controller.approach();
  assert.equal(controller.getStatus().pendingInputs, 2);
  assert.equal(controller.getStatus().coalescedInputs, 6998);
  env.flush(0); env.flush(17);
  assert.equal(controller.getStatus().pendingInputs, 0); assert.equal(controller.getSnapshot().phase.kind, 'approach');
  env.visibility(true);
  for (let i = 0; i < 100; i++) env.canvas.emit('pointermove', nearPointer(env));
  assert.equal(controller.approach().kind, 'suspended');
  env.visibility(false); env.flush(10000); env.flush(10017);
  assert.equal(controller.getSnapshot().phase.kind, 'idle');
  env.canvas.emit('pointermove', { ...nearPointer(env), pointerType: 'touch' });
  assert.equal(controller.getStatus().pendingInputs, 0);
  controller.destroy(); expectReleased(env);
});

test('a long frame is capped at five ticks and dropped time is accounted, while resume resets its clock', () => {
  const env = fakeBrowser(); const controller = mount(env);
  env.flush(0); controller.approach(); env.flush(1000);
  assert.equal(controller.getSnapshot().tick, 5);
  assert.ok(Math.abs(controller.getStatus().droppedMilliseconds - 55 * (1000 / 60)) < 1e-6);
  assert.equal(env.rafs.size, 1);
  controller.setPaused(true); const before = controller.getSnapshot().tick;
  env.flush(100000); controller.setPaused(false); env.flush(200000);
  assert.equal(controller.getSnapshot().tick, before, 'first resumed callback establishes a fresh wall clock');
  env.flush(200017); assert.equal(controller.getSnapshot().tick, before + 1);
  controller.destroy(); expectReleased(env);
});

test('pointer leave, cancel, lost capture and window blur become safe normalized retreat events', () => {
  for (const type of ['pointerleave', 'pointercancel', 'lostpointercapture', 'blur']) {
    const env = fakeBrowser(); const controller = mount(env);
    env.flush(0); controller.approach(); env.flush(17);
    assert.equal(controller.getSnapshot().phase.kind, 'approach');
    (type === 'blur' ? env.win : env.canvas).emit(type);
    env.flush(34);
    assert.equal(controller.getSnapshot().phase.kind, 'idle');
    assert.equal(controller.getSnapshot().pointer.active, false);
    assert.equal(controller.getStatus().pendingInputs, 0);
    controller.destroy(); expectReleased(env);
  }
});

test('pointer coordinates do not depend on backing-store DPR and resizing changes CSS normalization', () => {
  const snapshots = [];
  for (const dpr of [1, 2, 3]) {
    const env = fakeBrowser({ dpr }); const controller = mount(env);
    env.flush(0);
    env.canvas.emit('pointermove', { pointerType: 'mouse', clientX: 12 + 900 * 0.55, clientY: 20 + 506 * 0.6 });
    env.flush(17); snapshots.push(controller.getSnapshot().pointer);
    assert.ok(env.canvas.width <= 1800, 'DPR backing-store bound is independent of input');
    env.resize(env.canvas, { left: 70, top: 90, width: 720, height: 540 });
    env.canvas.emit('pointermove', { pointerType: 'mouse', clientX: 430, clientY: 360 });
    env.flush(100); env.flush(117);
    assert.deepEqual(controller.getSnapshot().pointer, { active: true, x: 0, y: 0, aspect: 4 / 3 });
    controller.destroy(); expectReleased(env);
  }
  assert.deepEqual(snapshots[1], snapshots[0]); assert.deepEqual(snapshots[2], snapshots[0]);
});

test('invalid configuration leaves the running state and render output unchanged', () => {
  const env = fakeBrowser(); const controller = mount(env, { paused: true });
  const state = controller.getSnapshot(), text = controller.exportText();
  assert.throws(() => controller.configure({ seed: NaN }));
  assert.throws(() => controller.configureRender({ quality: 'unknown' }));
  assert.throws(() => controller.configureRender({ maxDpr: 3 }));
  assert.throws(() => controller.configureRender({ typo: true }));
  assert.throws(() => controller.setPaused('yes'));
  assert.equal(controller.getSnapshot(), state); assert.equal(controller.exportText(), text);
  assert.equal(controller.getStatus().userPaused, true); assert.equal(env.rafs.size, 0);
  controller.destroy(); expectReleased(env);
});

test('null render patches are rejected as malformed before merging', () => {
  const env = fakeBrowser(); const controller = mount(env, { paused: true });
  try { assert.throws(() => controller.configureRender(null)); }
  finally { controller.destroy(); expectReleased(env); }
});

test('partial construction failures roll back owned listeners, observers and RAF', () => {
  for (const settings of [
    { noCanvas: true }, { noAtlas: true }, { failObserver: 'intersection' },
    { failObserve: 'resize' }, { failObserve: 'intersection' },
  ]) {
    const env = fakeBrowser(settings);
    assert.throws(() => mount(env));
    expectReleased(env);
  }
  const env = fakeBrowser();
  assert.throws(() => mount(env, { onChange() { throw new Error('consumer setup callback failed'); } }));
  expectReleased(env);
});

test('throwing onChange disposes a running instance and reports the original failure', () => {
  const env = fakeBrowser(); const errors = [];
  const controller = mount(env, {
    onChange(status) { if (status.tick > 0) throw new Error('consumer transition callback failed'); },
    onError(error) { errors.push(error); },
  });
  env.flush(0); controller.approach(); env.flush(17);
  assert.equal(controller.getStatus().destroyed, true);
  assert.match(controller.getStatus().failure, /consumer transition callback failed/);
  assert.equal(errors.length, 1); expectReleased(env);
});

test('destroy is idempotent and stale RAF/observer/font callbacks cannot write after disposal', async () => {
  const env = fakeBrowser({ fonts: true }); const controller = mount(env);
  const callbacks = [...env.rafs.values()]; const status = controller.getStatus();
  controller.destroy(); controller.destroy(); expectReleased(env);
  const before = env.resources();
  for (const callback of callbacks) callback(1000);
  for (const observer of env.observers) observer.fire([{ target: env.canvas, isIntersecting: true }], true);
  env.resolveFonts(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(env.resources(), before);
  assert.equal(controller.getStatus().tick, status.tick);
  assert.equal(controller.getStatus().destroyed, true);
  assert.equal(controller.getStatus().running, false);
  assert.throws(() => controller.reset(), /disposed/);
  assert.throws(() => controller.configure({ seed: 1 }), /disposed/);
  assert.throws(() => controller.configureRender({ view: 'front' }), /disposed/);
  assert.throws(() => controller.setPaused(true), /disposed/);
  assert.throws(() => controller.approach(), /disposed/);
  assert.throws(() => controller.retreat(), /disposed/);
  assert.throws(() => controller.exportText(), /disposed/);
});

test('two instances own independent resources and repeated mounts leave no listeners or observers', () => {
  const env = fakeBrowser(); const first = mount(env);
  const otherCanvas = env.createCanvas({ left: 40, top: 70, width: 720, height: 540 });
  const second = mountPufferfish(otherCanvas, legacy, { render: { quality: 'small' } });
  assert.equal(env.rafs.size, 2);
  first.destroy(); assert.equal(env.rafs.size, 1);
  assert.equal(env.canvas.listenerCount, 0); assert.ok(otherCanvas.listenerCount > 0);
  env.flush(0); second.approach(); env.flush(17);
  assert.equal(second.getSnapshot().phase.kind, 'approach'); assert.equal(first.getSnapshot().tick, 0);
  second.destroy(); expectReleased(env);
  for (let i = 0; i < 10; i++) {
    const controller = mount(env); controller.destroy(); expectReleased(env);
  }
});

test('a transition callback that pauses stops the same catch-up frame immediately', () => {
  const env = fakeBrowser(); let controller;
  controller = mount(env, { onChange(status) { if (status.tick === 1 && !status.userPaused) controller.setPaused(true); } });
  env.flush(0); controller.approach(); env.flush(1000);
  try {
    assert.equal(controller.getStatus().userPaused, true);
    assert.equal(controller.getSnapshot().tick, 1, 'remaining catch-up ticks must not run after pause');
    assert.equal(env.rafs.size, 0);
  } finally { controller.destroy(); expectReleased(env); }
});

test('a transition callback that destroys prevents any further tick in that frame', () => {
  const env = fakeBrowser(); let controller;
  controller = mount(env, { onChange(status) { if (status.tick === 1) controller.destroy(); } });
  env.flush(0); controller.approach(); env.flush(1000);
  assert.equal(controller.getStatus().destroyed, true);
  assert.equal(controller.getSnapshot().tick, 1, 'disposal prohibits subsequent state writes');
  expectReleased(env);
});

test('reset/configure from a transition callback invalidates the old catch-up frame and wall-clock accumulator', () => {
  for (const kind of ['reset', 'configure']) {
    const env = fakeBrowser(); let controller, changed = false;
    controller = mount(env, { onChange(status) {
      if (status.tick === 1 && !changed) {
        changed = true;
        if (kind === 'reset') controller.reset(77);
        else controller.configure({ seed: 77 });
      }
    } });
    env.flush(0); controller.approach(); env.flush(1000);
    try {
      assert.equal(controller.getSnapshot().tick, 0, `${kind} should end the previous simulation run immediately`);
      assert.equal(controller.getSnapshot().config.seed, 77);
      assert.equal(controller.getSnapshot().pointer.active, false);
      assert.equal(env.rafs.size, 1);
      env.flush(2000);
      assert.equal(controller.getSnapshot().tick, 0, 'first callback in the new run establishes its fresh clock');
      env.flush(2017); assert.equal(controller.getSnapshot().tick, 1);
      assert.equal(controller.getSnapshot().phase.kind, 'idle');
    } finally { controller.destroy(); expectReleased(env); }
  }
});
