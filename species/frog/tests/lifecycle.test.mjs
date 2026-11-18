/** Resource and input bookkeeping with injected browser doubles, not browser evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mountFrog } from '../generated/controller.mjs';
import { poseFrog } from '../generated/frog.mjs';
import { makeHost } from './fake-host.mjs';

function mounted(hostOptions = {}, options = {}) {
  const host = makeHost(hostOptions), canvas = host.canvas();
  const controller = mountFrog(canvas, { previewFactory: host.previewFactory, ...options });
  return { host, canvas, controller, preview: host.previews[0] };
}
function released(host) {
  assert.equal(host.frames.size, 0, 'no owned RAF');
  assert.equal(host.listenerCount, 0, 'no owned listeners');
  assert.ok(host.resizeObservers.every(x => x.targets.size === 0 && x.disconnected), 'resize observers disconnected');
  assert.ok(host.intersectionObservers.every(x => x.targets.size === 0 && x.disconnected), 'intersection observers disconnected');
}

test('pause survives reset/configuration and all environmental gates; resumed clock has no hidden catch-up', () => {
  const { host, controller } = mounted();
  assert.equal(host.frames.size, 1); host.flush(100); host.flush(134);
  assert.equal(controller.getState().tick, 2);
  controller.setPaused(true); const frozen = controller.getState();
  controller.leap(); assert.equal(controller.getState(), frozen); assert.equal(host.frames.size, 0);
  controller.reset({ seed: 17 }); assert.equal(controller.getState().seed, 17); assert.equal(controller.getState().tick, 0);
  controller.updateConfig({ size: .9 }); assert.equal(controller.getState().config.size, .9);
  host.reduced(true); host.hidden(true); host.reduced(false); host.hidden(false);
  assert.equal(controller.getStatus().paused, true); assert.equal(host.frames.size, 0);
  controller.setPaused(false); assert.equal(host.frames.size, 1);
  host.flush(100000); assert.equal(controller.getState().tick, 0);
  host.flush(100017); assert.equal(controller.getState().tick, 1);
  const before = controller.getState();
  assert.throws(() => controller.updateConfig({ size: Infinity }), /finite/);
  assert.equal(controller.getState(), before); assert.equal(controller.getStatus().paused, false);
  controller.dispose(); released(host);
});

test('reduced motion mounts static; pointer traffic cannot schedule motion; explicit actions only switch poses', () => {
  const { host, canvas, controller, preview } = mounted({ reducedMotion: true });
  assert.equal(host.frames.size, 0); assert.equal(preview.draws.at(-1).options.motion, false);
  for (let i = 0; i < 1000; i++) canvas.fire('pointermove', { clientX: i % 600 });
  assert.equal(controller.getStatus().pendingInputs, 0); assert.equal(controller.getState().tick, 0);
  controller.leap(); assert.equal(controller.getStatus().staticPose, 'crouch');
  assert.equal(preview.draws.at(-1).options.staticPose, 'crouch');
  controller.target({ x: .4, y: .1 }); assert.equal(preview.draws.at(-1).options.staticPose, 'crouch');
  controller.leap(); assert.equal(controller.getStatus().staticPose, 'airborne');
  assert.equal(controller.getState().jumps, 0); assert.equal(controller.getState().tick, 0); assert.equal(host.frames.size, 0);
  controller.setPaused(true); host.reduced(false); assert.equal(host.frames.size, 0);
  controller.setPaused(false); assert.equal(host.frames.size, 1);
  host.reduced(true); assert.equal(host.frames.size, 0);
  controller.reset(); assert.equal(controller.getStatus().staticPose, 'rest'); assert.equal(host.frames.size, 0);
  controller.dispose(); released(host);
});

test('chosen static pose persists across view changes, resize, target updates and visibility redraws', () => {
  const { host, canvas, controller, preview } = mounted();
  controller.setStaticPose('airborne');
  assert.equal(preview.draws.at(-1).options.staticPose, 'airborne');
  assert.equal(controller.getStatus().paused, true); assert.equal(host.frames.size, 0);
  controller.updatePreview({ view: 'left' });
  assert.equal(preview.draws.at(-1).options.staticPose, 'airborne', 'view redraw keeps selected static pose');
  canvas.rect.width = 800; host.resize(canvas);
  assert.equal(preview.draws.at(-1).options.staticPose, 'airborne', 'resize keeps selected static pose');
  controller.target({ x: .2, y: -.1 });
  assert.equal(preview.draws.at(-1).options.staticPose, 'airborne', 'target redraw keeps selected static pose');
  host.hidden(true); host.hidden(false);
  assert.equal(preview.draws.at(-1).options.staticPose, 'airborne', 'visibility redraw keeps selected static pose');
  assert.equal(host.frames.size, 0);
  controller.reset(); assert.equal(controller.getStatus().staticPose, 'rest');
  controller.dispose(); released(host);
});

test('user pause freezes the visible pose including an active target gaze', () => {
  const { host, controller, preview } = mounted();
  controller.target({ x: .7, y: .1 }); host.flush(0); host.flush(20);
  const before = preview.draws.at(-1), beforePose = poseFrog(before.state, before.options);
  controller.setPaused(true);
  const after = preview.draws.at(-1), afterPose = poseFrog(after.state, after.options);
  assert.deepEqual(afterPose, beforePose, 'Pause must not turn the eyes away or contract the throat');
  assert.equal(host.frames.size, 0);
  controller.dispose(); released(host);
});

test('hidden/offscreen/zero-size causes compose and do not defeat explicit pause', () => {
  const { host, canvas, controller } = mounted();
  controller.target({ x: .5, y: 0 }); controller.leap();
  host.hidden(true); assert.equal(host.frames.size, 0); assert.equal(controller.getStatus().pendingInputs, 0);
  host.intersect(canvas, false); host.hidden(false); assert.equal(host.frames.size, 0);
  canvas.rect.width = 0; host.resize(canvas); host.intersect(canvas, true);
  assert.equal(host.frames.size, 0); assert.equal(canvas.width, 1); assert.equal(canvas.height, 1);
  controller.setPaused(true); canvas.rect.width = 900; host.resize(canvas);
  assert.equal(host.frames.size, 0); assert.equal(controller.getStatus().zeroSize, false);
  controller.setPaused(false); assert.equal(host.frames.size, 1);
  canvas.rect.width = 200; host.resize(canvas); assert.equal(controller.getStatus().undersized, true); assert.equal(host.frames.size, 0);
  controller.leap(); assert.equal(controller.getState().tick, 0); assert.equal(host.frames.size, 0);
  canvas.rect.width = 900; host.resize(canvas); assert.equal(host.frames.size, 1);
  controller.dispose(); released(host);
});

test('bounded RAF catch-up and pointer coalescing preserve one latest target plus one leap', () => {
  const { host, canvas, controller } = mounted();
  host.flush(0);
  for (let i = 0; i < 10000; i++) canvas.fire('pointermove', { clientX: 40 + (i % 900), clientY: 320 });
  controller.target({ x: .7, y: .2 }); controller.leap(); controller.leap();
  assert.equal(controller.getStatus().pendingInputs, 2);
  assert.ok(controller.getStatus().coalescedInputs >= 10000);
  host.flush(10000);
  assert.equal(controller.getState().tick, 5);
  assert.equal(controller.getState().jumps, 1); assert.equal(controller.getState().lastSeq, 1);
  assert.deepEqual(controller.getState().target, { x: .7, y: .2 });
  assert.ok(controller.getStatus().droppedMilliseconds > 9900);
  assert.equal(controller.getStatus().pendingInputs, 0); assert.equal(host.frames.size, 1);
  host.hidden(true); host.hidden(false); host.flush(20000);
  assert.equal(controller.getState().tick, 5, 'resume establishes new wall-time origin');
  controller.dispose(); released(host);
});

test('touch tap is deliberate; cancel, leave, lost capture and dragged gestures do not leap', () => {
  const { host, canvas, controller } = mounted();
  host.flush(0);
  for (const cancellation of ['pointercancel', 'pointerleave', 'lostpointercapture']) {
    canvas.fire('pointerdown', { pointerType: 'touch', clientX: 220, clientY: 230 });
    canvas.fire(cancellation, { pointerType: 'touch' });
    canvas.fire('pointerup', { pointerType: 'touch', clientX: 220, clientY: 230 });
    assert.equal(controller.getStatus().pendingInputs <= 1, true); host.flush(controller.getState().tick * 20 + 20);
    assert.equal(controller.getState().jumps, 0);
  }
  canvas.fire('pointerdown', { pointerType: 'touch', clientX: 220, clientY: 230 });
  canvas.fire('pointerup', { pointerType: 'touch', clientX: 320, clientY: 280 });
  host.flush(100); assert.equal(controller.getState().jumps, 0);
  // Returning to the start does not turn a drag into an intentional tap.
  canvas.fire('pointerdown', { pointerType: 'touch', clientX: 220, clientY: 230 });
  canvas.fire('pointermove', { pointerType: 'touch', clientX: 320, clientY: 280 });
  canvas.fire('pointerup', { pointerType: 'touch', clientX: 220, clientY: 230 });
  host.flush(120); assert.equal(controller.getState().jumps, 0, 'drag path must be considered');
  canvas.fire('pointerdown', { pointerType: 'touch', clientX: 220, clientY: 230 });
  canvas.fire('pointerup', { pointerType: 'touch', clientX: 222, clientY: 231 });
  host.flush(140); assert.equal(controller.getState().jumps, 1);
  controller.dispose(); released(host);
});

test('keyboard input is scoped to the focused canvas and leaves native form keys alone', () => {
  const { host, canvas, controller } = mounted(); host.flush(0);
  const ignored = canvas.fire('keydown', { key: ' ', target: { tagName: 'BUTTON' } });
  assert.equal(ignored.defaultPrevented, false); assert.equal(controller.getStatus().pendingInputs, 0);
  const arrow = canvas.fire('keydown', { key: 'ArrowRight' });
  assert.equal(arrow.defaultPrevented, true);
  const enter = canvas.fire('keydown', { key: 'Enter' });
  assert.equal(enter.defaultPrevented, true); host.flush(20); assert.equal(controller.getState().jumps, 1);
  canvas.fire('keydown', { key: 'Enter', repeat: true });
  assert.equal(controller.getStatus().pendingInputs, 0);
  const tab = canvas.fire('keydown', { key: 'Tab' }); assert.equal(tab.defaultPrevented, false);
  const modified = canvas.fire('keydown', { key: 'ArrowLeft', ctrlKey: true }); assert.equal(modified.defaultPrevented, false);
  const escape = canvas.fire('keydown', { key: 'Escape' }); assert.equal(escape.defaultPrevented, true);
  host.flush(40); assert.equal(controller.getState().target, null);
  controller.dispose(); released(host);
});

test('two instances own separate resources; double disposal and post-disposal API calls are consistent', () => {
  const host = makeHost(), a = host.canvas(), b = host.canvas();
  const first = mountFrog(a, { previewFactory: host.previewFactory });
  const second = mountFrog(b, { previewFactory: host.previewFactory });
  assert.equal(host.frames.size, 2); first.dispose(); first.dispose();
  assert.equal(host.previews[0].disposed, 1); assert.equal(host.frames.size, 1);
  assert.equal(a.listenerCount, 0); assert.ok(b.listenerCount > 0);
  assert.equal(first.getStatus().disposed, true);
  for (const call of [() => first.reset(), () => first.leap(), () => first.target({ x: 0, y: 0 }),
    () => first.setPaused(false), () => first.setStaticPose('rest'), () => first.updateConfig({ size: 1 }),
    () => first.updatePreview({ view: 'front' }), () => first.getState(), () => first.exportText(), () => first.clearTarget()]) assert.throws(call, /disposed/);
  host.flush(0); host.flush(20); assert.equal(second.getState().tick, 1);
  second.dispose(); released(host);
});

test('saved callbacks are inert after disposal, including media changes and keyboard handlers', () => {
  const messages = [], { host, canvas, controller, preview } = mounted({}, { onAction: value => messages.push(value) });
  const mediaCallback = host.media.saved.get('change')[0], keyCallback = canvas.saved.get('keydown')[0];
  const frame = [...host.frames.values()][0], resize = host.resizeObservers[0].callback, intersection = host.intersectionObservers[0].callback;
  controller.dispose(); const draws = preview.draws.length, messagesBefore = messages.length;
  assert.doesNotThrow(() => frame(1000)); assert.doesNotThrow(() => resize([]));
  assert.doesNotThrow(() => intersection([{ target: canvas, isIntersecting: true }]));
  assert.doesNotThrow(() => mediaCallback({ type: 'change' }));
  assert.equal(messages.length, messagesBefore, 'disposed media callback cannot announce');
  assert.doesNotThrow(() => keyCallback({ target: canvas, key: 'Enter', preventDefault() {}, repeat: false }));
  assert.equal(preview.draws.length, draws); released(host);
});

test('partial setup and draw failures release every acquired resource', () => {
  for (const failure of ['resizeFailure', 'intersectionFailure', 'previewDrawFailure']) {
    const host = makeHost({ [failure]: true }), canvas = host.canvas();
    assert.throws(() => mountFrog(canvas, { previewFactory: host.previewFactory }), /fake/);
    assert.equal(host.previews[0].disposed, 1); released(host);
  }
  const { host, controller } = mounted({}, { onAction() { throw new Error('consumer failed'); } });
  assert.throws(() => controller.leap(), /consumer failed/);
  assert.equal(controller.getStatus().disposed, true); released(host);
});
