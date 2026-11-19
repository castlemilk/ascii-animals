import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeahorseModel, createSeahorseArtwork } from '../lib/public/seahorse.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';

// Behaviour gates for the eelgrass revision. These exercise public snapshots
// and logical cells, not private formulas, raster font output or browser pixels.
const hold = {
  scene: 'kelp-garden', count: 1, choreography: 'hold', columns: 160, rows: 76,
  current: 1, seed: 19, individuals: [{ role: 'sentinel' }]
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const member = model => model.getDirectorState().members[0];

function assertContact(m, label = '') {
  assert.notEqual(m.anchorId, null, `${label}: completed grip remains present`);
  assert(m.anchor, `${label}: completed grip exposes a position`);
  assert(distance(m.tailTip, m.anchor) < 1e-9, `${label}: tail endpoint stays on its hold`);
}

function advance(model, ticks, batch = 600) {
  while (ticks > 0) {
    const n = Math.min(ticks, batch);
    model.advanceTicks(n);
    ticks -= n;
  }
}

function assertGentleStep(before, after, label) {
  assert(distance(before, after) < .05 * after.scale,
    `${label}: root moved ${distance(before, after) / after.scale} body units in one tick`);
  assert(Math.abs(before.rotation - after.rotation) < .025,
    `${label}: rotation changed ${Math.abs(before.rotation - after.rotation)} radians in one tick`);
}

test('a held tail follows a moving eelgrass hold with contact exact on every tick', () => {
  for (const facing of ['left', 'right']) {
    const model = createSeahorseModel({ ...hold, facing });
    const first = member(model);
    assertContact(first, `${facing}/initial`);
    let excursion = 0;
    for (let tick = 1; tick <= 360; tick++) {
      model.advanceTicks(1);
      const m = member(model);
      assertContact(m, `${facing}/${tick}`);
      excursion = Math.max(excursion, distance(m.anchor, first.anchor));
      if (tick % 60 === 0) {
        // The animal can cover the exact contact cell. A nearby visible part of
        // the same habitat must still exist; this is a coarse logical guard,
        // with contact occlusion and recognisability reserved for visual review.
        const frame = model.frame(), state = model.getDirectorState();
        const col = (m.anchor.x / state.worldWidth + .5) * (frame.columns - 1);
        const row = (m.anchor.y / state.worldHeight + .5) * (frame.rows - 1);
        assert(frame.cells.some((cell, index) => cell.layer === 'kelp' && cell.glyph !== ' ' &&
          Math.hypot(index % frame.columns - col, Math.floor(index / frame.columns) - row) < 4),
        `${facing}/${tick}: visible eelgrass remains near the hold`);
      }
    }
    assert(excursion > .02 * first.scale, `${facing}: hold is a moving plant, not a fixed marker`);
  }
});

test('release prepares while held, lets go, then recovers its grip without a positional jump', () => {
  for (const facing of ['left', 'right']) {
    const model = createSeahorseModel({ ...hold, facing });
    const baseline = createSeahorseModel({ ...hold, facing });
    let previous = member(model), largestExcursion = 0;
    model.direct({ type: 'release' });
    assert.equal(member(model).motive.kind, 'anchored', 'held preparation preserves the completed-contact motive');
    for (let tick = 0; tick <= 240; tick++) {
      if (tick) { model.advanceTicks(1); baseline.advanceTicks(1); }
      const m = member(model);
      if (tick <= 24) assertContact(m, `${facing}/held preparation/${tick}`);
      if (tick === 90) assert.equal(m.anchorId, null, `${facing}: active passage releases the hold`);
      if (tick >= 210) assertContact(m, `${facing}/recovered grip/${tick}`);
      if (m.anchorId !== null) assertContact(m, `${facing}/${tick}`);
      assertGentleStep(previous, m, `${facing}/release/${tick}`);
      largestExcursion = Math.max(largestExcursion, distance(m, member(baseline)) / m.scale);
      previous = m;
    }
    assert(largestExcursion > .08, `${facing}: release produces visible body travel`);
    assert.deepEqual(model.getDirectorState(), baseline.getDirectorState(), 'cue has no residual offset at tick 240');
    assert.equal(model.frame().text, baseline.frame().text);
  }
});

test('deliberate inspection pivots from the tail and recovers without releasing its blade', () => {
  for (const facing of ['left', 'right']) {
    const options = { ...hold, facing, current: -.6 };
    const model = createSeahorseModel(options), baseline = createSeahorseModel(options);
    for (const m of [model, baseline]) m.guide(facing === 'left' ? -.8 : .8, -.35);
    model.direct({ type: 'inspect' });
    assert.equal(member(model).motive.kind, 'inspecting');
    let previous = member(model), attentionChange = 0;
    for (let tick = 0; tick <= 180; tick++) {
      if (tick) { model.advanceTicks(1); baseline.advanceTicks(1); }
      const m = member(model), base = member(baseline);
      assertContact(m, `${facing}/inspection/${tick}`);
      assertGentleStep(previous, m, `${facing}/inspection/${tick}`);
      attentionChange = Math.max(attentionChange, Math.abs(m.attention - base.attention), Math.abs(m.rotation - base.rotation));
      previous = m;
    }
    assert(attentionChange > .04, `${facing}: inspection visibly directs the snout/body`);
    assert.deepEqual(model.getDirectorState(), baseline.getDirectorState());
    assert.equal(model.frame().text, baseline.frame().text);
  }
});

test('current bracing retains contact, responds against either current direction, and releases its tension', () => {
  for (const current of [-1, 1]) {
    const model = createSeahorseModel({ ...hold, current });
    const baseline = createSeahorseModel({ ...hold, current });
    model.direct({ type: 'startle' });
    assert.equal(member(model).motive.kind, 'startled');
    let previous = member(model), opposedRotation = 0;
    for (let tick = 0; tick <= 240; tick++) {
      if (tick) { model.advanceTicks(1); baseline.advanceTicks(1); }
      const m = member(model), base = member(baseline);
      assertContact(m, `current ${current}/brace/${tick}`);
      assertGentleStep(previous, m, `current ${current}/brace/${tick}`);
      opposedRotation = Math.max(opposedRotation, -(m.rotation - base.rotation) * current);
      previous = m;
    }
    assert(opposedRotation > .04, `current ${current}: body visibly braces against signed flow`);
    assert.deepEqual(model.getDirectorState(), baseline.getDirectorState());
    assert.equal(model.frame().text, baseline.frame().text);
  }
});

test('release, approach and brace retain deterministic state and cells across 1/2/5 tick grouping', () => {
  function replay(batch) {
    const model = createSeahorseModel({
      ...hold, count: 4, seed: 97, current: -.7, duration: 31,
      individuals: [{ role: 'sentinel' }, { role: 'sentinel', facing: 'right' },
        { role: 'sentinel', scale: .8 }, { role: 'sentinel', facing: 'right' }]
    });
    const frames = [];
    const events = [
      [37, () => model.direct({ type: 'release', id: 1 })],
      [83, () => { model.guide(.8, -.4); model.direct({ type: 'inspect', id: 0 }); }],
      [150, () => model.direct({ type: 'startle', id: 2 })],
      [220, () => model.direct({ type: 'anchor', id: 3 })],
      [310, () => model.clearGuide()],
      [600, () => {}]
    ];
    let tick = 0;
    for (const [next, action] of events) {
      advance(model, next - tick, batch); tick = next; action();
      frames.push({ state: model.getState(), director: model.getDirectorState(), frame: model.frame() });
    }
    return frames;
  }
  const expected = replay(1);
  assert.deepEqual(replay(2), expected);
  assert.deepEqual(replay(5), expected);
});

test('cues entered during a free route join and recover without snapping to a forced hold', () => {
  for (const scene of ['kelp-garden', 'tidal-duet', 'drift-passage']) {
    for (const progress of [.3, .72, .9]) {
      for (const [type, duration] of [['release', 240], ['inspect', 180], ['startle', 240]]) {
        const options = { ...hold, scene, count: 2, choreography: 'cycle', individuals: [{ role: 'partner' }, { role: 'partner' }] };
        const model = createSeahorseModel(options), baseline = createSeahorseModel(options);
        for (const m of [model, baseline]) m.direct({ type: 'seek', progress });
        const before = member(model);
        model.direct({ type });
        assertGentleStep(before, member(model), `${scene}/${progress}/${type}/entry`);
        // Check the last recovery tick against the ordinary route at the exact
        // same clock. A fully held sentinel can regrip; a passing/paired animal
        // must not be snapped off a forced hold when the finite cue expires.
        advance(model, duration - 1); advance(baseline, duration - 1);
        const lastCue = member(model);
        model.advanceTicks(1); baseline.advanceTicks(1);
        assertGentleStep(lastCue, member(model), `${scene}/${progress}/${type}/completion`);
        assert.deepEqual(model.getDirectorState(), baseline.getDirectorState());
      }
    }
  }
});

test('moving plant contact remains continuous as signed current crosses zero', () => {
  const model = createSeahorseModel({ ...hold, current: -.001 });
  model.advanceTicks(133);
  const before = member(model), tick = model.getState().tick;
  model.configure({ current: .001 });
  const after = member(model);
  assertContact(before); assertContact(after);
  assert.equal(model.getState().tick, tick);
  assert(distance(before.anchor, after.anchor) < .01 * after.scale, 'the plant does not snap when flow reverses');
  assert(distance(before, after) < .02 * after.scale, 'the attached animal follows the same continuous change');
});

test('eelgrass gestures stay static through reduced motion, resize, visibility and disposal', () => {
  const h = fakeBrowser({ reducedMotion: true }), canvas = h.canvas(390, 660);
  const art = createSeahorseArtwork(canvas, hold);
  h.intersect(canvas, true);
  for (const type of ['release', 'anchor', 'inspect', 'startle']) {
    art.direct({ type });
    const snapshot = art.getDirectorState();
    assert.equal(art.getStatus().tick, 0);
    assert.equal(h.pending, 0);
    canvas.rect.width = 0; canvas.rect.height = 0; art.resize();
    h.hide(true); h.hide(false); h.intersect(canvas, false); h.intersect(canvas, true);
    canvas.rect.width = 947; canvas.rect.height = 707; art.resize();
    assert.deepEqual(art.getDirectorState(), snapshot, `${type}: presentation changes do not advance a cue`);
    assert.equal(h.pending, 0);
  }
  art.pause(); h.setReduced(false); art.restart();
  assert.equal(h.pending, 0, 'clearing system preference keeps requested pause');
  art.dispose(); art.dispose();
  const frozen = art.getDirectorState();
  art.direct({ type: 'release' }); art.guide(.9, -.4); art.play(); art.resize();
  assert.deepEqual(art.getDirectorState(), frozen);
  assert.equal(canvas.listenerCount, 0);
  assert.equal(h.pending, 0);
  assert.equal(h.resizes.size + h.intersections.size + h.motion.listenerCount + h.document.listenerCount + h.view.listenerCount, 0);
});
