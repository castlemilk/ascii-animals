/** Integrated public factory + real scheduler, injected browser/preview doubles.
 * These tests establish lifecycle/input bookkeeping, not pixels or accessibility.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrogArtwork, posePondFrog } from '../../../lib/public/frog.js';
import { makeHost } from './fake-host.mjs';

function pondHost(options = {}) {
  const host = makeHost(options), base = host.previewFactory;
  host.reportedErrors = [];
  host.window.setTimeout = callback => { host.reportedErrors.push(callback); return 1; };
  host.previewFactory = canvas => {
    const p = base(canvas); p.pondDraws = []; p.pickId = null;
    p.drawPond = function(state, drawOptions) {
      if (this.disposed) throw new Error('pond draw after disposal');
      this.pondDraws.push({ state, options: drawOptions });
      return { glyphs: 0, samples: 17918 * state.actors.length, cols: 180, rows: 100, actors: state.actors.length };
    };
    p.pondTargetAt = point => ({ ...point });
    p.pickPondFrog = () => p.pickId;
    return p;
  };
  return host;
}
function mount(host = pondHost(), options = {}) {
  const canvas = host.canvas();
  const controller = createFrogArtwork(canvas, { director: { autonomy: false }, previewFactory: host.previewFactory, ...options });
  return { host, canvas, controller, preview: host.previews.at(-1) };
}
function noResources(host) {
  assert.equal(host.frames.size, 0); assert.equal(host.listenerCount, 0);
  assert(host.resizeObservers.every(x => x.disconnected && x.targets.size === 0));
  assert(host.intersectionObservers.every(x => x.disconnected && x.targets.size === 0));
}
const copy = value => JSON.parse(JSON.stringify(value));
const drawnPoses = preview => {
  const frame = preview.pondDraws.at(-1);
  return frame.state.actors.map(actor => posePondFrog(frame.state, actor, frame.options));
};

test('two ponds and the original frog share one browser frame source and clean up independently', () => {
  const host = pondHost(), a = mount(host), b = mount(host);
  const single = createFrogArtwork(host.canvas(), { previewFactory: host.previewFactory });
  assert.equal(host.frames.size, 1); assert.equal(single.getPondState(), null);
  assert.equal(a.controller.getPondState().actors.length, 3); assert.equal(b.controller.getPondState().actors.length, 3);
  host.flush(100); host.flush(134);
  assert.equal(a.controller.getPondState().tick, 2); assert.equal(b.controller.getPondState().tick, 2); assert.equal(single.getState().tick, 2);
  a.controller.pause(); const paused = a.controller.getPondState(); a.controller.pulse();
  host.flush(168); assert.equal(a.controller.getPondState(), paused); assert(b.controller.getPondState().tick > 2);
  b.controller.pause(); assert.equal(host.frames.size, 1); single.pause(); assert.equal(host.frames.size, 0);
  b.controller.restart(); assert.equal(b.controller.getStatus().paused, true); assert.equal(host.frames.size, 0);
  a.controller.play(); assert.equal(host.frames.size, 1); a.controller.dispose(); a.controller.dispose(); assert.equal(host.frames.size, 0);
  b.controller.play(); assert.equal(host.frames.size, 1); b.controller.dispose(); single.dispose(); noResources(host);
  assert.equal(a.preview.disposed, 1); assert.equal(b.preview.disposed, 1);
});

test('public pond timing replays the same command boundaries under 1/2/5-tick frame delivery', () => {
  const run = group => {
    const { host, controller } = mount(undefined, { seed: 23 }); host.flush(0);
    for (let tick = 0; tick < 600; tick += group) {
      if (tick === 0) controller.call();
      if (tick === 200) { controller.selectFrog(1); controller.hunt({ x: .4, y: -.2 }); }
      if (tick === 270) controller.ripple({ x: -.5, y: .3 });
      if (tick === 340) controller.selectFrog(2);
      if (tick === 410) controller.target({ x: 0, y: .55 });
      if (tick === 420) controller.leap();
      host.flush((tick + group) * 1000 / 60);
    }
    const state = copy(controller.getPondState()); assert.equal(state.tick, 600);
    controller.dispose(); noResources(host); return state;
  };
  const every = run(1); assert.deepEqual(run(2), every); assert.deepEqual(run(5), every);
});

test('director updates validate atomically, reset coherently and preserve explicit pause', () => {
  const { host, controller } = mount(); host.flush(0); host.flush(60); controller.pause();
  controller.selectFrog(1); controller.setRole(1, 'caller');
  const before = controller.getPondState();
  for (const patch of [{ count: 4 }, { count: 2, tempo: Infinity }, { roles: ['caller'] }, { scene: 'ocean' }, { count: undefined }]) {
    assert.throws(() => controller.updateDirector(patch)); assert.equal(controller.getPondState(), before); assert.equal(host.frames.size, 0);
  }
  controller.updateDirector({ count: 2, scene: 'stillwater', layout: 'shelter', tempo: .75 });
  const updated = controller.getPondState(); assert.equal(updated.tick, 0); assert.equal(updated.actors.length, 2);
  assert.equal(updated.config.roles[1], 'caller'); assert.equal(updated.config.tempo, .75); assert.equal(controller.getStatus().paused, true);
  assert.equal(updated.replies.length, 0); assert.equal(updated.ripples.length, 0); assert.equal(updated.firefly, null);
  controller.update({ jumpHeight: .6 }); assert.equal(controller.getPondState().bodyConfig.jumpHeight, .6); assert.equal(host.frames.size, 0);
  const config = controller.getPondState().config; controller.reset({ seed: 71 });
  assert.equal(controller.getPondState().seed, 71); assert.deepEqual(controller.getPondState().config, config); assert.equal(controller.getStatus().paused, true);
  controller.dispose(); noResources(host);
});

test('new director mode is opt-in and can be explicitly enabled without breaking the original factory', () => {
  const host = pondHost(), controller = createFrogArtwork(host.canvas(), { paused: true, previewFactory: host.previewFactory });
  assert.equal(controller.getPondState(), null); const before = controller.getState();
  for (const fn of [() => controller.selectFrog(0), () => controller.setRole(0, 'caller'), () => controller.call(), () => controller.hunt(), () => controller.ripple()]) assert.throws(fn);
  assert.equal(controller.getState(), before); controller.updateDirector({ count: 1, autonomy: false });
  assert.equal(controller.getPondState().actors.length, 1); assert.equal(controller.getStatus().paused, true); assert.equal(host.frames.size, 0);
  controller.dispose(); noResources(host);
});

test('selected ownership is explicit and queued calls, hunts and hops cannot be stolen by later selection', () => {
  const { host, controller } = mount(); host.flush(0);
  controller.selectFrog(0); controller.call(); controller.selectFrog(2);
  assert.equal(controller.getState(), controller.getPondState().actors[2].model);
  host.flush(20); const state = controller.getPondState();
  assert.equal(state.actors[0].motive.kind, 'call'); assert.notEqual(state.actors[2].motive.kind, 'call');
  const models = copy(state.actors.map(a => a.model)); controller.setRole(0, 'hunter');
  assert.deepEqual(controller.getPondState().actors.map(a => a.model), models); assert.equal(controller.getPondState().selectedId, 2);
  const prior = controller.getPondState(); assert.throws(() => controller.selectFrog(99)); assert.throws(() => controller.setRole(0, 'fox'));
  assert.equal(controller.getPondState(), prior);
  controller.reset(); host.flush(100); controller.selectFrog(1); controller.hunt({ x: .5, y: -.4 }); controller.selectFrog(2);
  host.flush(120); assert.equal(controller.getPondState().actors[1].motive.kind, 'track'); assert.notEqual(controller.getPondState().actors[2].motive.kind, 'track');
  controller.reset(); host.flush(200); controller.leap(); controller.selectFrog(2);
  host.flush(220); assert.equal(controller.getPondState().actors[0].model.jumps, 1); assert.equal(controller.getPondState().actors[2].model.jumps, 0);
  controller.dispose(); noResources(host);
});

test('occupied or unreachable aimed pads reject with feedback; clearing aim permits one nearest-free hop', () => {
  const notices = [], { host, controller } = mount(undefined, { onAction: message => notices.push(message) });
  for (const [index, kind] of ['occupied', 'unreachable'].entries()) {
    controller.reset(); host.flush(index * 100);
    const initial = controller.getPondState(), actor = initial.actors[0];
    const destination = kind === 'occupied' ? initial.pads[initial.actors[1].padId]
      : initial.pads.find(pad => !initial.actors.some(a => a.padId === pad.id) && Math.hypot(pad.point.x - actor.model.position.x, pad.point.y - actor.model.position.y) > initial.bodyConfig.maxDistance);
    assert(destination, `fixture has an ${kind} pad`);
    controller.target(destination.point); const noticeCount = notices.length; controller.leap(); host.flush(index * 100 + 20);
    const rejected = controller.getPondState();
    assert(rejected.actors.every(a => a.model.jumps === 0 && a.reservedPad === null), `${kind} aim must not silently redirect to another pad`);
    assert(notices.length > noticeCount, 'a rejected deliberate action reports feedback');
    assert.match(notices.at(-1), /occupied|reserved|reachable|available|free|distance/i);
  }
  controller.clearTarget(); controller.leap(); host.flush(140);
  const hopped = controller.getPondState(), actor = hopped.actors[0];
  assert.equal(actor.model.jumps, 1); assert.equal(actor.model.behavior.kind, 'crouch');
  assert.notEqual(actor.reservedPad, null); assert(!hopped.actors.some(other => other.padId === actor.reservedPad));
  controller.dispose(); noResources(host);
});

test('mounted normalized inputs reject atomically, including explicit null rather than omitted targets', () => {
  const { host, controller } = mount(); host.flush(0);
  controller.target({ x: .2, y: .1 }); controller.call();
  const initial = controller.getPondState(), queued = controller.getStatus();
  const invalid = [null, [], { x: NaN, y: 0 }, { x: 0, y: Infinity }, { x: 1.01, y: 0 }, { x: 0, y: -1.01 },
    { x: '0', y: 0 }, { x: 0 }, { x: 0, y: 0, extra: true }];
  for (const point of invalid) for (const method of ['target', 'hunt', 'ripple']) {
    assert.throws(() => controller[method](point), `${method} must validate ${JSON.stringify(point)}`);
    assert.equal(controller.getPondState(), initial); assert.equal(controller.getStatus().pendingInputs, queued.pendingInputs);
    assert.equal(controller.getStatus().coalescedInputs, queued.coalescedInputs); assert.equal(host.frames.size, 1);
  }
  host.flush(20); assert.equal(controller.getPondState().actors[0].motive.kind, 'call', 'failed input cannot replace the previously accepted action');
  controller.dispose(); noResources(host);
});

test('reduced-motion Call, Hunt and Ripple choose stills without ticks, travel, effects or scheduling', () => {
  const { host, canvas, controller, preview } = mount(pondHost({ reducedMotion: true }));
  const initial = copy(controller.getPondState()); assert.equal(host.frames.size, 0);
  for (const [action, still] of [[() => controller.call(), 'call'], [() => controller.hunt({ x: .4, y: -.2 }), 'hunt'], [() => controller.ripple({ x: 0, y: .2 }), 'ripple']]) {
    action(); const state = controller.getPondState();
    assert.equal(state.tick, 0); assert.deepEqual(state.actors.map(a => a.model.position), initial.actors.map(a => a.model.position));
    assert.equal(state.replies.length, 0); assert.equal(state.ripples.length, 0); assert.equal(host.frames.size, 0);
    assert.equal(preview.pondDraws.at(-1).options.pondStill, still);
    assert.equal(preview.pondDraws.at(-1).options.motion, false);
  }
  for (let i = 0; i < 1000; i++) canvas.fire('pointermove', { clientX: i % 700 });
  assert.equal(controller.getStatus().pendingInputs, 0); controller.play(); controller.pulse();
  assert.equal(controller.getPondState().tick, 0); assert.equal(host.frames.size, 0);
  controller.pause(); host.reduced(false); assert.equal(host.frames.size, 0);
  controller.dispose(); noResources(host);
});

test('pause freezes committed poses and deliberate pond stills persist through redraw without time or scheduling', () => {
  const { host, canvas, controller, preview } = mount(); host.flush(0); controller.call();
  for (const now of [20, 40, 60, 80, 100]) host.flush(now);
  controller.pause(); const frozen = copy(drawnPoses(preview)), tick = controller.getPondState().tick;
  assert(tick > 0); assert.equal(host.frames.size, 0);
  host.resize(canvas); controller.updatePreview({ view: 'right' }); controller.pause();
  assert.deepEqual(drawnPoses(preview), frozen, 'ordinary paused redraw retains the exact committed anatomical pose');
  for (const [action, still] of [[() => controller.call(), 'call'], [() => controller.hunt({ x: .6, y: -.2 }), 'hunt'], [() => controller.ripple({ x: -.1, y: .2 }), 'ripple']]) {
    const before = controller.getPondState(); action(); const after = controller.getPondState();
    assert.equal(after.tick, tick); assert.deepEqual(after.actors.map(a => a.model.position), before.actors.map(a => a.model.position));
    assert.deepEqual(after.ripples, before.ripples); assert.deepEqual(after.replies, before.replies); assert.equal(after.firefly, before.firefly);
    assert.equal(preview.pondDraws.at(-1).options.pondStill, still); assert.equal(preview.pondDraws.at(-1).options.motion, false);
    const selectedStill = copy(drawnPoses(preview));
    host.resize(canvas); controller.updatePreview({ view: 'left' }); controller.pause(); host.hidden(true); host.hidden(false);
    assert.equal(preview.pondDraws.at(-1).options.pondStill, still); assert.deepEqual(drawnPoses(preview), selectedStill);
    assert.equal(controller.getPondState().tick, tick); assert.equal(host.frames.size, 0);
  }
  controller.reset(); assert.equal(controller.getStatus().paused, true); assert.equal(controller.getPondState().tick, 0);
  assert.equal(preview.pondDraws.at(-1).options.pondStill, undefined); assert.equal(host.frames.size, 0);
  controller.dispose(); noResources(host);
});

test('restoring an undersized pond clears its fallback still only when motion may resume', () => {
  for (const preference of ['motion', 'paused', 'reduced']) {
    const { host, canvas, controller, preview } = mount(pondHost({ width: 280, height: 200, reducedMotion: preference === 'reduced' }), { paused: preference === 'paused' });
    assert(controller.getStatus().undersized); assert.equal(host.frames.size, 0);
    controller.call(); assert.equal(preview.pondDraws.at(-1).options.pondStill, 'call');
    canvas.rect.width = 900; canvas.rect.height = 600; host.resize(canvas);
    assert.equal(controller.getStatus().undersized, false);
    assert.equal(preview.pondDraws.at(-1).options.pondStill, preference === 'motion' ? undefined : 'call');
    assert.equal(preview.pondDraws.at(-1).options.motion, preference === 'motion');
    assert.equal(host.frames.size, preference === 'motion' ? 1 : 0);
    host.flush(0); host.flush(20); assert.equal(controller.getPondState().tick, preference === 'motion' ? 1 : 0);
    controller.dispose(); noResources(host);
  }
});

test('whole pond suspension drops pending actions and resumes with no social catch-up burst', () => {
  const { host, canvas, controller } = mount(undefined, { director: { autonomy: true } });
  host.flush(0); host.flush(60); controller.call(); controller.target({ x: .5, y: .2 });
  host.hidden(true); assert.equal(host.frames.size, 0); assert.equal(controller.getStatus().pendingInputs, 0);
  const suspended = controller.getPondState(); host.intersect(canvas, false); host.hidden(false); assert.equal(host.frames.size, 0);
  canvas.rect.width = 0; host.resize(canvas); host.intersect(canvas, true); assert.equal(host.frames.size, 0);
  controller.pause(); canvas.rect.width = 900; host.resize(canvas); assert.equal(host.frames.size, 0);
  assert.equal(controller.getPondState().tick, suspended.tick); controller.play();
  host.flush(100000); assert.equal(controller.getPondState().tick, suspended.tick, 'first resumed timestamp only establishes origin');
  host.flush(100020); assert.equal(controller.getPondState().tick, suspended.tick + 1);
  assert.equal(controller.getPondState().cueCount, suspended.cueCount, 'hidden wall time cannot advance director cues');
  controller.dispose(); noResources(host);
});

test('pond pointer and deliberate-action bursts stay within two coalesced inputs and five catch-up ticks', () => {
  const { host, canvas, controller } = mount(); host.flush(0);
  for (let i = 0; i < 10000; i++) canvas.fire('pointermove', { clientX: 40 + i % 900, clientY: 320 });
  controller.call(); controller.hunt({ x: .3, y: .2 }); controller.ripple({ x: -.2, y: .3 });
  assert(controller.getStatus().pendingInputs <= 2); assert(controller.getStatus().coalescedInputs > 9000);
  host.flush(10000); assert.equal(controller.getPondState().tick, 5); assert.equal(controller.getStatus().pendingInputs, 0);
  assert(controller.getStatus().droppedMilliseconds > 9900); assert(controller.getPondState().ripples.length <= 6);
  assert.equal(host.frames.size, 1); controller.dispose(); noResources(host);
});

test('owner-cell taps select one frog, drag cancellation is inert and focused keys route scene actions', () => {
  const { host, canvas, controller, preview } = mount(); host.flush(0);
  preview.pickId = 1;
  canvas.fire('pointerdown', { pointerType: 'touch', clientX: 200, clientY: 200 });
  canvas.fire('pointerup', { pointerType: 'touch', clientX: 202, clientY: 201 });
  assert.equal(controller.getPondState().selectedId, 1); assert.equal(controller.getPondState().actors[1].model.jumps, 0);
  preview.pickId = 2;
  canvas.fire('pointerdown', { pointerType: 'touch', clientX: 200, clientY: 200 });
  canvas.fire('pointermove', { pointerType: 'touch', clientX: 400, clientY: 300 });
  canvas.fire('pointerup', { pointerType: 'touch', clientX: 200, clientY: 200 });
  assert.equal(controller.getPondState().selectedId, 1, 'returning a drag to its origin is not a tap');
  const nested = canvas.fire('keydown', { key: '3', target: { tagName: 'SELECT' } }); assert.equal(nested.defaultPrevented, false);
  canvas.fire('keydown', { key: '3' }); assert.equal(controller.getPondState().selectedId, 2);
  const call = canvas.fire('keydown', { key: 'c' }); assert.equal(call.defaultPrevented, true);
  host.flush(20); assert.equal(controller.getPondState().actors[2].motive.kind, 'call');
  const tab = canvas.fire('keydown', { key: 'Tab' }); assert.equal(tab.defaultPrevented, false);
  controller.dispose(); noResources(host);
});

test('pond-change notifications follow changed state identities and callback failure releases the mount', () => {
  const seen = [], { host, controller } = mount(undefined, { onPondChange: state => seen.push(state) });
  assert(seen.length >= 1); const unique = new Set(seen); assert.equal(unique.size, seen.length);
  controller.updatePreview({ view: 'left' }); assert.equal(new Set(seen).size, seen.length, 'unchanged state redraw does not notify again');
  controller.selectFrog(1); assert.equal(seen.at(-1).selectedId, 1);
  controller.dispose(); const count = seen.length; host.reduced(true); host.hidden(true); assert.equal(seen.length, count); noResources(host);
  const failing = pondHost(), canvas = failing.canvas();
  assert.throws(() => createFrogArtwork(canvas, { director: {}, previewFactory: failing.previewFactory, onPondChange() { throw new Error('consumer rejected pond'); } }), /consumer rejected pond/);
  assert.equal(failing.previews[0].disposed, 1); noResources(failing);
});

test('consumer disposal stops later announcements and consumer pause ends the current catch-up batch', () => {
  const disposedHost = pondHost(), canvas = disposedHost.canvas(), notices = []; let disposable;
  disposable = createFrogArtwork(canvas, { director: { autonomy: false }, previewFactory: disposedHost.previewFactory,
    onPondChange() { disposable?.dispose(); }, onAction(message) { notices.push(message); } });
  disposable.selectFrog(1);
  assert(disposable.disposed); assert.equal(notices.length, 0, 'state callback disposal is terminal before the following action notice'); noResources(disposedHost);

  const host = pondHost(); let controller;
  controller = createFrogArtwork(host.canvas(), { director: { autonomy: false }, previewFactory: host.previewFactory,
    onAction(message) { if (/calls across the pond/i.test(message)) controller.pause(); } });
  host.flush(0); controller.call(); host.flush(10000);
  assert.equal(controller.getPondState().tick, 1, 'the first deliberate notice pauses before additional catch-up ticks');
  assert.equal(controller.getStatus().paused, true); assert.equal(controller.getStatus().pendingInputs, 0); assert.equal(host.frames.size, 0);
  controller.play(); host.flush(20000); assert.equal(controller.getPondState().tick, 1);
  host.flush(20020); assert.equal(controller.getPondState().tick, 2);
  controller.dispose(); noResources(host);
});

test('pond saved callbacks are inert after disposal and new methods reject post-disposal work', () => {
  const { host, canvas, controller, preview } = mount();
  const key = canvas.saved.get('keydown')[0], media = host.media.saved.get('change')[0];
  const observer = host.intersectionObservers[0].callback, resize = host.resizeObservers[0].callback;
  controller.dispose(); controller.dispose(); const draws = preview.pondDraws.length;
  assert.doesNotThrow(() => key({ target: canvas, key: 'c', preventDefault() {} })); assert.doesNotThrow(() => media({}));
  assert.doesNotThrow(() => observer([{ target: canvas, isIntersecting: true }])); assert.doesNotThrow(() => resize([]));
  assert.equal(preview.pondDraws.length, draws); assert.equal(preview.disposed, 1); assert(controller.disposed);
  for (const call of [() => controller.getPondState(), () => controller.updateDirector({ count: 1 }), () => controller.selectFrog(0), () => controller.setRole(0, 'caller'), () => controller.call(), () => controller.hunt(), () => controller.ripple()]) assert.throws(call, /disposed/);
  noResources(host);
});

test('offscreen direction publishes state and defers destructive resize until visible', () => {
  const snapshots = [];
  const {host, canvas, controller, preview} = mount(undefined, {paused:true, onPondChange:s=>snapshots.push(s)});
  host.intersect(canvas, false);
  const draws = preview.pondDraws.length, resizes = preview.resizes.length;
  canvas.rect.width=390; canvas.rect.height=480; host.resize(canvas);
  controller.updateDirector({scene:'stillwater', count:2});
  assert.equal(snapshots.at(-1).config.scene,'stillwater');
  assert.equal(snapshots.at(-1).actors.length,2);
  assert.equal(preview.resizes.length,resizes);
  assert.equal(preview.pondDraws.length,draws);
  controller.call();
  host.intersect(canvas,true);
  assert.equal(preview.resizes.length,resizes+1);
  assert.equal(preview.pondDraws.at(-1).options.pondStill,'call');
  assert.equal(host.frames.size,0);
  assert.equal(controller.getPondState().tick,0);
  controller.dispose(); noResources(host);
});

test('offscreen reduced motion cue selects a still without scheduling animation', () => {
  const {host, canvas, controller, preview}=mount();
  host.reduced(true); host.intersect(canvas,false);
  controller.leap();
  assert.equal(controller.getStatus().staticPose,'crouch');
  assert.equal(host.frames.size,0);
  host.intersect(canvas,true);
  assert.equal(preview.pondDraws.at(-1).options.staticPose,'crouch');
  assert.equal(controller.getPondState().tick,0);
  controller.dispose(); noResources(host);
});

test('requested draw reconciles lagging intersection after viewport resize, not actual offscreen canvas', () => {
  const {host, canvas, controller, preview}=mount(undefined,{paused:true});
  host.window.innerWidth=1000; host.window.innerHeight=800;
  let top=900;
  canvas.getBoundingClientRect=()=>({width:900,height:600,top,bottom:top+600,left:0,right:900});
  host.intersect(canvas,false);
  const draws=preview.pondDraws.length;
  host.resize(canvas); controller.updateDirector({scene:'stillwater'});
  assert.equal(preview.pondDraws.length,draws);
  assert.equal(host.frames.size,0);
  top=100; // viewport layout updated before IntersectionObserver delivery
  host.resize(canvas);
  assert.equal(controller.getStatus().offscreen,false);
  assert.equal(preview.pondDraws.at(-1).state.config.scene,'stillwater');
  assert.equal(preview.resizes.at(-1)[0],900);
  assert.equal(host.frames.size,0);
  assert.equal(controller.getPondState().tick,0);
  controller.dispose(); noResources(host);
});
