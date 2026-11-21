import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createCrabModel as createOriginalModel, createCrabArtwork as createOriginalArtwork, normalizeCrabOptions } from '../lib/public/crab.js';
import { createTidepoolTrouperModel as createCrabModel, createTidepoolTrouperArtwork as createCrabArtwork } from '../lib/public/crab/variants/tidepool-trouper.js';
import { createCrabStudy } from '../lib/public/crab/variants/tidepool-trouper-study.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';

// Logical-model and mocked-adapter acceptance. These tests do not establish
// browser appearance, touch hardware, screen-reader output or frame rate.
// Keep the pre-existing contact-continuity gate: <=6% of full foot spread/tick.
const TOE_TRAVEL_FRACTION = 0.06;
const owned = frame => frame.cells.flatMap((cell, index) => cell.layer === 'crab'
  && cell.owner === 0 && cell.glyph !== ' '
  ? [{ x: (index % frame.columns) / (frame.columns - 1) * 2 - 1,
       y: Math.floor(index / frame.columns) / (frame.rows - 1) * 2 - 1 }] : []);
const centerX = frame => {
  const cells = owned(frame);
  assert(cells.length > 50, 'exercise a visible crab');
  return cells.reduce((sum, cell) => sum + cell.x, 0) / cells.length;
};
const advance = (model, ticks, batch = 1) => {
  while (ticks > 0) { const n = Math.min(ticks, batch); model.advanceTicks(n); ticks -= n; }
};
const studyHarness = extra => {
  let tick = 0;
  const options = normalizeCrabOptions(extra);
  const study = createCrabStudy(() => options, () => tick);
  return { study, options, get tick() { return tick; }, advance(ticks) {
    for (let i = 0; i < ticks; i++) { tick++; study.step(); }
  } };
};
const mounted = extra => {
  const h = fakeBrowser(), canvas = h.canvas(672, 500);
  const art = createCrabArtwork(canvas, { paused: true, ...extra });
  h.intersect(canvas, true);
  return { h, canvas, art };
};

test('Tidepool Trouper: study forage moves toward the selected sand destination and retains it after release', () => {
  const neutral = centerX(createCrabModel({ sway: 0 }).frame());
  const results = [];
  for (const direction of [-1, 1]) {
    const model = createCrabModel({ sway: 0 });
    model.guide(direction * 0.8, 0.65);
    model.cue('forage');
    model.clearGuide();
    model.advanceTicks(180);
    results.push(centerX(model.frame()));
    assert.equal(model.getPhase(), 'idle');
    assert.equal(model.getScene().guide.active, false);
  }
  assert(results[0] < neutral - 0.10, 'left input must produce leftward travel');
  assert(results[1] > neutral + 0.10, 'right input must produce rightward travel');
  assert(results[1] - results[0] > 0.3, 'input changes the outcome, not just a gaze glyph');
  const near = createCrabModel({ sway: 0 });
  near.guide(0.12, 0.65); near.cue('forage'); near.clearGuide(); near.advanceTicks(180);
  assert(centerX(near.frame()) < results[1] - 0.10,
    'a nearer destination produces a shorter strut on the same side');
});

test('Tidepool Trouper: study signal selects a different leading claw, while root and all toes stay grounded', () => {
  const frames = [];
  for (const direction of [-1, 1]) {
    const model = createCrabModel({ sway: 0 });
    model.guide(direction * 0.8, -0.2);
    model.cue('signal');
    model.clearGuide();
    model.advanceTicks(75);
    frames.push(model.frame().text);
    const h = studyHarness({ sway: 0 }), initial = h.study.snapshot();
    h.study.guide(direction * 0.8, -0.2);
    h.study.cue('signal');
    h.study.clearGuide();
    h.advance(75);
    const response = h.study.snapshot();
    assert.equal(response.x, initial.x, 'the feint is a planted display');
    assert(response.feet.every(foot => foot.planted));
    assert.deepEqual(response.feet, initial.feet, 'weight moves over fixed ground contacts');
    const nearReach = direction < 0 ? response.leftReach : response.rightReach;
    const farReach = direction < 0 ? response.rightReach : response.leftReach;
    assert(nearReach > farReach + 0.1, 'the input-side claw leads the feint');
    h.advance(105);
    const recovered = h.study.snapshot();
    assert.equal(recovered.action, null, 'the feint releases its bounded action');
    assert.equal(recovered.leftReach, 0);
    assert.equal(recovered.rightReach, 0);
    assert.deepEqual(recovered.feet, initial.feet, 'settling does not move support contacts');
  }
  assert(frames[0] !== frames[1], 'left/right feints must differ in logical geometry');
});

test('Tidepool Trouper: both study cues preserve the existing notice/defend/settle/idle boundaries and cooldown', () => {
  for (const action of ['forage', 'signal']) {
    const model = createCrabModel({ sway: 0 });
    model.guide(0.6, 0.5);
    model.cue(action);
    assert.equal(model.getPhase(), 'notice', `${action}: starts with anticipation`);
    model.advanceTicks(44);
    assert.equal(model.getPhase(), 'notice');
    const started = model.getState().responseTick;
    model.cue(action === 'forage' ? 'signal' : 'forage');
    model.greet();
    assert.equal(model.getState().responseTick, started, 'repeated input cannot restart an active action');
    model.advanceTicks(1);
    assert.equal(model.getPhase(), 'defend');
    model.advanceTicks(64);
    assert.equal(model.getPhase(), 'defend');
    model.advanceTicks(1);
    assert.equal(model.getPhase(), 'settle');
    model.advanceTicks(69);
    assert.equal(model.getPhase(), 'settle');
    model.advanceTicks(1);
    assert.equal(model.getPhase(), 'idle');
  }
});

for (const speed of [0.25, 1, 2]) {
  test(`Tidepool Trouper: study strut preserves support contacts and finishes swings at speed ${speed}`, () => {
    const h = studyHarness({ speed, sway: 0 });
    let previous = h.study.snapshot(), contacts = 0, swings = 0, travel = 0;
    const spread = Math.max(...previous.feet.map(foot => foot.x))
      - Math.min(...previous.feet.map(foot => foot.x));
    const toeLimit = spread * TOE_TRAVEL_FRACTION;
    for (const direction of [1, -1]) {
      h.study.guide(direction * 0.8, 0.55);
      h.study.cue('forage');
      h.study.clearGuide();
      h.advance(20);
      let early = h.study.snapshot();
      assert.equal(early.x, previous.x, 'anticipation loads the body before travel');
      assert(early.feet.every(foot => foot.planted));
      previous = early;
      for (let i = 20; i < 190; i++) {
        h.advance(1);
        const current = h.study.snapshot();
        if (Math.abs(current.x - previous.x) > 1e-6) {
          travel++;
          assert(current.feet.filter(foot => foot.planted).length >= 4,
            'travelling body retains at least four supports');
        }
        for (let index = 0; index < current.feet.length; index++) {
          const before = previous.feet[index], after = current.feet[index];
          const movement = Math.hypot(after.x - before.x,
            (after.y - after.lift) - (before.y - before.lift));
          assert(movement <= toeLimit + 1e-12,
            `toe ${index} jumped ${movement} at tick ${h.tick}; gate ${toeLimit}`);
          if (before.planted && after.planted) {
            assert.equal(after.x, before.x, 'a planted toe cannot skate horizontally');
            assert.equal(after.y, before.y, 'a planted toe cannot skate vertically');
            contacts++;
          }
          if (!after.planted && after.lift > 0) swings++;
        }
        previous = current;
      }
      assert(previous.feet.every(foot => foot.planted && foot.lift === 0),
        'settling finishes every airborne foot');
    }
    assert(travel > 30 && swings > 20 && contacts > 100,
      'exercise actual movement, swing and stance rather than a frozen pose');
  });
}

test('Tidepool Trouper: study action log replays equal states and cells in 1-, 2- and 5-tick batches', () => {
  const replay = batch => {
    const model = createCrabModel({ seed: 31, sway: 0 });
    const checkpoints = [];
    const record = () => checkpoints.push({ state: model.getState(), scene: model.getScene(), frame: model.frame() });
    model.guide(0.7, 0.65); model.cue('forage');
    advance(model, 18, batch); record();
    model.clearGuide();
    advance(model, 57, batch); record();
    advance(model, 105, batch); record();
    model.guide(-0.8, -0.3); model.cue('signal'); model.clearGuide();
    advance(model, 30, batch); record();
    advance(model, 50, batch); record();
    advance(model, 100, batch); record();
    model.guide(-0.7, 0.65); model.cue('forage');
    advance(model, 180, batch); record();
    return checkpoints;
  };
  assert.deepEqual(replay(2), replay(1));
  assert.deepEqual(replay(5), replay(1));
});

test('Tidepool Trouper: existing sway and curious options remain meaningful without restarting travel or sliding toes', () => {
  const still = studyHarness({ sway: 0 }), swaying = studyHarness({ sway: 0.4 });
  const planted = swaying.study.snapshot().feet;
  still.advance(120); swaying.advance(120);
  assert.equal(still.study.snapshot().lean, 0);
  assert(Math.abs(swaying.study.snapshot().lean) > 0.01, 'sway visibly changes the idle counter-lean');
  assert.equal(swaying.study.snapshot().x, still.study.snapshot().x);
  assert.deepEqual(swaying.study.snapshot().feet, planted, 'idle weight shifts over stationary feet');
  const quiet = studyHarness({ behavior: 'scuttle', sway: 0 });
  const curious = studyHarness({ behavior: 'curious', sway: 0 });
  quiet.study.guide(0.15, 0.05); curious.study.guide(0.15, 0.05);
  const ordinary = quiet.study.snapshot(), interested = curious.study.snapshot();
  assert(interested.gazeX > ordinary.gazeX, 'curious attention responds more strongly');
  assert(interested.left > ordinary.left + 0.05, 'the interested claw has a distinct posture');
  curious.advance(120);
  assert.equal(curious.study.snapshot().action, null, 'hover does not create an endless action chain');
  assert.equal(curious.study.snapshot().x, interested.x);
  assert.deepEqual(curious.study.snapshot().feet, interested.feet);
});

test('Tidepool Trouper: paused study cues are distinct static posters and never acquire animation work', () => {
  const { h, art } = mounted();
  try {
    const neutral = art.getFrame().text;
    art.guide(0.7, 0.65); art.cue('forage');
    const strut = art.getFrame().text;
    assert.notEqual(strut, neutral);
    assert.equal(art.getStatus().tick, 0);
    assert.equal(h.pending, 0);
    art.guide(-0.7, -0.25); art.cue('signal'); art.clearGuide();
    const feint = art.getFrame().text;
    assert.notEqual(feint, strut, 'a deliberate second command replaces the still pose');
    h.frame(30000);
    assert.equal(art.getFrame().text, feint);
    assert.equal(art.getStatus().tick, 0);
    assert.equal(h.pending, 0);
  } finally { art.dispose(); }
});

test('Tidepool Trouper: study canvas taps distinguish visible crab from sand and preserve accepted touch actions', () => {
  const { h, art, canvas } = mounted();
  try {
    const frame = art.getFrame(), neutral = frame.text;
    const sand = frame.cells.findIndex((cell, i) => cell.layer === 'sand'
      && i % frame.columns > frame.columns * 0.7);
    assert(sand >= 0, 'fixture has visible sand to the right');
    const at = index => ({ isPrimary: true, pointerType: 'touch', pointerId: 1, button: 0,
      clientX: ((index % frame.columns) + 0.5) / frame.columns * canvas.rect.width,
      clientY: (Math.floor(index / frame.columns) + 0.5) / frame.rows * canvas.rect.height });
    const tap = index => { const point = at(index); canvas.emit('pointerdown', point); canvas.emit('pointerup', point); };
    canvas.emit('pointerdown', at(sand));
    canvas.emit('pointercancel', at(sand));
    canvas.emit('pointerup', at(sand));
    assert.equal(art.getFrame().text, neutral, 'A cancelled scroll remains neutral.');
    tap(sand);
    const strut = art.getFrame().text;
    assert.notEqual(strut, neutral);
    canvas.emit('pointercancel', { pointerType: 'touch' });
    assert(art.getFrame().text === strut, 'release changes guidance, not the accepted poster');
    assert.equal(art.getScene().guide.active, false);
    const next = art.getFrame();
    const body = next.cells.findIndex(cell => cell.layer === 'crab' && cell.owner === 0 && cell.glyph !== ' ');
    assert(body >= 0);
    tap(body);
    assert.notEqual(art.getFrame().text, strut, 'a creature hit invokes the different feint moment');
    assert.equal(art.getStatus().tick, 0);
    assert.equal(h.pending, 0);
  } finally { art.dispose(); }
});

test('Tidepool Trouper: phone letterboxing and DPR use the same displayed glyph positions for hit ownership', () => {
  const h = fakeBrowser({ dpr: 2 }), canvas = h.canvas(350, 360);
  canvas.rect.left = 47; canvas.rect.top = 83;
  const ctx = canvas.getContext('2d'), marks = [];
  ctx.fillText = (glyph, x, y) => { marks.push({ glyph, x, y }); };
  const art = createCrabArtwork(canvas, { paused: true });
  try {
    h.intersect(canvas, true);
    const frame = art.getFrame(), cells = frame.cells.filter(cell => cell.glyph !== ' ');
    assert.equal(marks.length, cells.length, 'record the adapter’s actual draw coordinates');
    assert.equal(canvas.width, 700); assert.equal(canvas.height, 720);
    assert(marks.every(mark => mark.x >= 0 && mark.x <= 350 && mark.y > 15 && mark.y < 345),
      'the phone has unused top/bottom letterbox space');
    const initial = art.getFrame().text;
    const tap = (clientX, clientY) => {
      const event = { isPrimary: true, pointerType: 'touch', pointerId: 1, button: 0, clientX, clientY };
      canvas.emit('pointerdown', event); canvas.emit('pointerup', event);
    };
    tap(canvas.rect.left + 175, canvas.rect.top + 5);
    assert(art.getFrame().text === initial, 'a padding tap must not invent a sand or crab hit');
    assert.equal(art.getStatus().phase, 'idle');
    const hit = cells.findIndex(cell => cell.layer === 'crab' && cell.owner === 0);
    assert(hit >= 0);
    const rendered = marks[hit];
    tap(canvas.rect.left + rendered.x, canvas.rect.top + rendered.y);
    assert.equal(art.getScene().actors[0].behavior.kind, 'signal',
      'the actual drawn crab glyph maps back to the creature, including padding and CSS offset');
    assert.equal(art.getStatus().phase, 'defend');
    assert.equal(art.getStatus().tick, 0);
    assert.equal(h.pending, 0);
  } finally { art.dispose(); }
});

test('Tidepool Trouper: hidden and offscreen study inputs do not draw or acquire scheduler work', () => {
  const { h, art, canvas } = mounted({ paused: false });
  let draws = 0;
  const ctx = canvas.getContext('2d'), previousFill = ctx.fillRect;
  ctx.fillRect = (...args) => { draws++; previousFill(...args); };
  try {
    h.intersect(canvas, false);
    const before = draws;
    for (let i = 0; i < 200; i++) canvas.emit('pointermove', {
      isPrimary: true, clientX: 100 + i, clientY: 200 });
    art.guide(0.5, 0.5); art.cue('forage'); art.pulse(); art.clearGuide();
    assert.equal(draws, before, 'an offscreen canvas should not rasterize on pointer traffic');
    assert.equal(h.pending, 0);
    const tick = art.getStatus().tick;
    h.frame(60000);
    assert.equal(art.getStatus().tick, tick);
    h.hide(true);
    h.intersect(canvas, true);
    const hiddenDraws = draws;
    art.guide(-0.5, -0.3); art.cue('signal');
    assert.equal(draws, hiddenDraws);
    assert.equal(h.pending, 0);
    h.hide(false);
    assert.equal(h.pending, 1);
    h.frame(60000);
    assert.equal(art.getStatus().tick, tick, 'resume must not replay hidden wall time');
  } finally { art.dispose(); }
});

test('Tidepool Trouper: reduced motion stays authoritative through keyboard moments and pause/visibility changes', () => {
  const h = fakeBrowser({ reducedMotion: true }), canvas = h.canvas(672, 500);
  const art = createCrabArtwork(canvas);
  try {
    h.intersect(canvas, true);
    const key = key => canvas.emit('keydown', { key, preventDefault() {} });
    key('ArrowRight'); key('f');
    const strut = art.getFrame().text;
    key('ArrowLeft'); key('s');
    assert.notEqual(art.getFrame().text, strut);
    key(' '); art.play(); art.restart(); art.update({ palette: 'rose' });
    assert.equal(art.getStatus().tick, 0);
    assert.equal(h.pending, 0);
    art.pause(); h.intersect(canvas, false); h.setReduced(false); h.intersect(canvas, true);
    assert.equal(h.pending, 0, 'clearing system/visibility causes must preserve explicit pause');
    art.play(); assert.equal(h.pending, 1);
    h.setReduced(true); assert.equal(h.pending, 0);
    h.frame(60000); assert.equal(art.getStatus().tick, 0);
  } finally { art.dispose(); }
});


const assertReleased = (h, canvas) => {
  assert.equal(h.pending, 0, 'no animation request survives disposal');
  assert.equal(canvas.listenerCount, 0, 'no artwork input listener survives disposal');
  assert.equal(h.document.listenerCount, 0);
  assert.equal(h.motion.listenerCount, 0);
  assert.equal(h.view.listenerCount, 0);
  assert.equal(h.resizes.size, 0);
  assert.equal(h.intersections.size, 0);
};

test('Tidepool Trouper: Original and variant coexist without changing each other or owning separate RAF loops', () => {
  const h = fakeBrowser(), originalCanvas = h.canvas(), variantCanvas = h.canvas();
  const original = createOriginalArtwork(originalCanvas, { paused: true, seed: 23 });
  const variant = createCrabArtwork(variantCanvas, { paused: true, seed: 23 });
  try {
    h.intersect(originalCanvas, true); h.intersect(variantCanvas, true);
    const originalFrame = original.getFrame(), originalOptions = original.getOptions();
    assert.notEqual(variant.getFrame().text, originalFrame.text, 'the opt-in visibly differs from Original');
    variant.guide(0.8, 0.5); variant.cue('forage');
    variant.update({ palette: 'rose', facing: 'right' });
    variant.guide(-0.8, -0.2); variant.cue('signal'); variant.clearGuide();
    assert.deepEqual(original.getFrame(), originalFrame, 'variant input and palette stay instance-local');
    assert.deepEqual(original.getOptions(), originalOptions);
    assert.equal(original.getStatus().phase, 'idle');
    original.play(); variant.play();
    assert.equal(h.pending, 1, 'the same window retains one shared RAF request');
    h.frame(); h.frame(20);
    assert(original.getStatus().tick > 0 && variant.getStatus().tick > 0);
    const originalTick = original.getStatus().tick;
    variant.dispose(); variant.dispose();
    assert.equal(variantCanvas.listenerCount, 0);
    assert.equal(h.resizes.size, 1); assert.equal(h.intersections.size, 1);
    assert.equal(h.pending, 1, 'disposing the variation cannot stop Original');
    h.frame(20);
    assert(original.getStatus().tick > originalTick, 'Original continues advancing after the variant releases');
  } finally { variant.dispose(); original.dispose(); }
  assertReleased(h, originalCanvas);
  assert.equal(variantCanvas.listenerCount, 0);
});

test('Tidepool Trouper: repeated same-canvas factory handoff keeps one controller and honors playback policy', () => {
  const h = fakeBrowser(), canvas = h.canvas(350, 360);
  let art;
  const cases = [
    { create: createOriginalArtwork, paused: false, reduced: false },
    { create: createCrabArtwork, paused: false, reduced: true },
    { create: createOriginalArtwork, paused: true, reduced: false },
    { create: createCrabArtwork, paused: true, reduced: false },
    { create: createOriginalArtwork, paused: false, reduced: false },
    { create: createCrabArtwork, paused: false, reduced: false },
  ];
  try {
    for (const { create, paused, reduced } of cases) {
      if (art) {
        art.dispose();
        art.play(); art.resize(); art.pulse(); art.guide(0.8, 0.4);
        art.update({ palette: 'rose', paused: false });
      }
      assertReleased(h, canvas);
      h.setReduced(reduced);
      art = create(canvas, { paused });
      assert.equal(art.canvas, canvas, 'the caller reuses one owned canvas');
      assert.equal(h.resizes.size, 1); assert.equal(h.intersections.size, 1);
      assert.equal(h.document.listenerCount, 1); assert.equal(h.motion.listenerCount, 1);
      h.intersect(canvas, true);
      assert.equal(art.getStatus().paused, paused || reduced);
      assert.equal(h.pending, paused || reduced ? 0 : 1);
      h.frame(); h.frame(20);
      assert.equal(art.getStatus().tick > 0, !paused && !reduced);
      art.restart();
      assert.equal(art.getStatus().tick, 0);
      assert.equal(art.getStatus().paused, paused || reduced, 'restart preserves user and system motion policy');
    }
  } finally { art?.dispose(); }
  assertReleased(h, canvas);
});

test('Tidepool Trouper: a caller-owned frame source survives variant disposal and remains usable by Original', () => {
  const callbacks = new Set();
  let disposeCalls = 0;
  const frameSource = {
    subscribe(callback) { callbacks.add(callback); return () => callbacks.delete(callback); },
    dispose() { disposeCalls++; callbacks.clear(); },
  };
  const h = fakeBrowser(), variantCanvas = h.canvas(), originalCanvas = h.canvas();
  const variant = createCrabArtwork(variantCanvas, { frameSource });
  const original = createOriginalArtwork(originalCanvas, { frameSource });
  try {
    h.intersect(variantCanvas, true); h.intersect(originalCanvas, true);
    assert.equal(callbacks.size, 2, 'each active controller owns one subscription');
    assert.equal(h.pending, 0, 'the borrowed source does not acquire an extra browser RAF');
    for (const now of [0, 20]) for (const callback of [...callbacks]) callback(now);
    assert(variant.getStatus().tick > 0 && original.getStatus().tick > 0);
    variant.dispose();
    assert.equal(callbacks.size, 1);
    assert.equal(disposeCalls, 0, 'a controller cannot dispose the caller’s source');
    const before = original.getStatus().tick;
    for (const callback of [...callbacks]) callback(40);
    assert(original.getStatus().tick > before);
  } finally { variant.dispose(); original.dispose(); }
  assert.equal(callbacks.size, 0);
  assert.equal(disposeCalls, 0);
  assertReleased(h, originalCanvas);
  assert.equal(variantCanvas.listenerCount, 0);
});

test('Tidepool Trouper: unsupported theatre/count configuration is rejected atomically', () => {
  for (const options of [{ scene: 'forage' }, { scene: 'signals' }, { scene: 'tide' }, { count: 2 }]) {
    assert.throws(() => createCrabModel(options));
    assert.doesNotThrow(() => createOriginalModel(options), 'Original retains its theatre and resident options');
  }
  const model = createCrabModel({ seed: 13 });
  model.guide(0.8, 0.5); model.cue('forage'); model.advanceTicks(60);
  const snapshot = () => ({ options: model.getOptions(), state: model.getState(), scene: model.getScene(), frame: model.frame() });
  const before = snapshot();
  for (const patch of [
    { scene: 'forage', seed: 29, palette: 'rose' },
    { count: 2, scale: 1.2, paused: true },
    { columns: 81, speed: NaN },
  ]) {
    assert.throws(() => model.configure(patch));
    assert.deepEqual(snapshot(), before, 'failed configuration preserves the active gesture and validated options');
  }
  model.configure({ scene: 'study', count: 1, palette: 'lagoon' });
  assert.equal(model.getOptions().palette, 'lagoon');
  const { h, canvas, art } = mounted();
  try {
    const frame = art.getFrame();
    assert.throws(() => art.update({ scene: 'forage', paused: false, palette: 'rose' }));
    assert.deepEqual(art.getFrame(), frame);
    assert.equal(art.getOptions().paused, true, 'failed update cannot change playback intent');
    assert.equal(h.pending, 0);
  } finally { art.dispose(); }
  assertReleased(h, canvas);
});

test('Tidepool Trouper: failed construction rolls back resources without poisoning the next Original mount', () => {
  const h = fakeBrowser(), canvas = h.canvas();
  const Observer = h.view.IntersectionObserver;
  h.view.IntersectionObserver = class { constructor() { throw new Error('variant observer failed'); } };
  assert.throws(() => createCrabArtwork(canvas), /variant observer failed/);
  assertReleased(h, canvas);
  h.view.IntersectionObserver = Observer;
  const original = createOriginalArtwork(canvas);
  try {
    h.intersect(canvas, true); h.frame(); h.frame(20);
    assert(original.getStatus().tick > 0);
  } finally { original.dispose(); }
  assertReleased(h, canvas);
  canvas.getContext = () => null;
  assert.throws(() => createCrabArtwork(canvas), /Canvas2D unavailable/);
  assertReleased(h, canvas);
});

test('Tidepool Trouper: private module imports and samples without browser globals or public export changes', () => {
  const variantUrl = new URL('../lib/public/crab/variants/tidepool-trouper.js', import.meta.url).href;
  const originalUrl = new URL('../lib/public/crab.js', import.meta.url).href;
  const script = `
    import assert from 'node:assert/strict';
    for (const key of ['window', 'document', 'requestAnimationFrame', 'ResizeObserver', 'IntersectionObserver']) {
      Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error(key + ' accessed in server import'); } });
    }
    const original = await import(${JSON.stringify(originalUrl)});
    const originalExports = Object.keys(original);
    const variant = await import(${JSON.stringify(variantUrl)});
    assert.equal(typeof variant.createTidepoolTrouperArtwork, 'function');
    const model = variant.createTidepoolTrouperModel({ seed: 7 });
    model.guide(0.6, 0.4); model.cue('forage'); model.advanceTicks(72);
    assert.equal(model.frame().cells.length, 120 * 50);
    assert.deepEqual(Object.keys(original), originalExports);
    assert.equal('createTidepoolTrouperArtwork' in original, false);
    process.stdout.write('server-safe');
  `;
  assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8', timeout: 10000,
  }), 'server-safe');
});
