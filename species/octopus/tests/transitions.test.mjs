import test from 'node:test';
import assert from 'node:assert/strict';
import { CuttlefishArtwork, createMarineDirector } from '../../../src/animals/cuttlefish.js';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';

// Regression checks for actual canonical-source arm chains and the existing
// public input listeners. The DOM/Canvas host is simulated: these measurements
// do not establish browser pixels, real-device input delivery, or visual taste.
// Fixed in advance of the fixes: a <= .003 s input-boundary step may move an
// arm point by at most .01 local units; pulse() without elapsed time must move
// no chain point at all. Tiny adjacent target positions have the same .01
// continuity budget. These limits are not derived from observed passing values.
const STEP = .01;
const TRANSITION_BUDGET = .01;
const OPTIONS = Object.freeze({
  species: 'octopus', count: 1, scene: 'reactive', formation: 'independent',
  behaviors: ['hover'], size: 1.1, sizeVariation: 0, density: 1.2,
  followPointer: true, autoStart: false, glow: false, seed: 17, speed: 1,
  maxCells: 8192,
});

function mount(t, directed = false) {
  const host = fakeBrowser();
  const canvas = host.canvas(900, 620);
  const artwork = directed
    ? createMarineDirector(canvas, { scene: 'tidepool-investigation' },
      { ...OPTIONS, behaviors: [...OPTIONS.behaviors], speciesByAnimal: ['octopus'] })
    : new CuttlefishArtwork(canvas, { ...OPTIONS, behaviors: [...OPTIONS.behaviors] });
  if (t) t.after(() => artwork.destroy());
  return { host, canvas, artwork };
}

function ticks(artwork, count, dt = STEP) {
  for (let i = 0; i < count; i++) artwork.advance(dt);
}

function invite(canvas, x = .08, y = .20) {
  const { width, height, left, top } = canvas.rect;
  canvas.emit('pointermove', {
    clientX: left + (x + .5) * width,
    clientY: top + (y + .5) * height,
    pointerType: 'mouse',
  });
}

const species = artwork => artwork.fish[0].speciesState;
const points = artwork => species(artwork).arms.map(chain => Float64Array.from(chain));

function maximumDelta(one, two) {
  assert.equal(one.length, 8);
  assert.equal(two.length, 8);
  let maximum = 0;
  for (let arm = 0; arm < 8; arm++) {
    assert.equal(one[arm].length, two[arm].length);
    for (let point = 0; point < one[arm].length; point += 3) {
      const delta = Math.hypot(one[arm][point] - two[arm][point],
        one[arm][point + 1] - two[arm][point + 1],
        one[arm][point + 2] - two[arm][point + 2]);
      assert(Number.isFinite(delta));
      maximum = Math.max(maximum, delta);
    }
  }
  return maximum;
}

function startExamine(artwork, canvas) {
  ticks(artwork, 50);
  invite(canvas);
  ticks(artwork, 200);
  assert.equal(species(artwork).performance.sequence, 'examine');
  assert(species(artwork).diagnostics.attention > .3);
}

test('a second discovery retriggers examination without leaving the canvas', t => {
  const { artwork, canvas } = mount(t);
  ticks(artwork, 50);
  invite(canvas);
  ticks(artwork, 650);
  const state = species(artwork), firstStart = state.cueStart;
  assert.equal(state.performance.sequence, 'rest');
  assert.equal(state.performance.reach, 0);
  assert.equal(state.cueActive, true);

  invite(canvas, -.20, .18);
  artwork.advance(.001);
  assert.equal(state.performance.sequence, 'notice');
  assert(state.cueStart > firstStart, 'remaining over the canvas must not permanently consume its invitation');
  ticks(artwork, 200);
  assert.equal(state.performance.sequence, 'examine');
  assert(state.diagnostics.attention > .3, 'the second cue must affect the arm geometry, not just its label');
  assert(state.reachWeights.some(value => value > .15));
});

test('rapid reacquisition waits for the current peel without collapsing a reaching arm', t => {
  const { artwork, canvas } = mount(t);
  startExamine(artwork, canvas);
  canvas.emit('pointerleave');
  ticks(artwork, 10);
  const before = points(artwork);
  invite(canvas);
  artwork.advance(.001);
  const delta = maximumDelta(before, points(artwork));
  assert(delta < TRANSITION_BUDGET, `reacquisition jumps an arm by ${delta}`);
  assert.equal(species(artwork).performance.sequence, 'peel-and-settle');
  assert(species(artwork).performance.reach > .8, 'an unfinished peel cannot be reset to zero reach');

  ticks(artwork, 110);
  assert.equal(species(artwork).performance.sequence, 'notice');
  ticks(artwork, 200);
  assert.equal(species(artwork).performance.sequence, 'examine');
  assert(species(artwork).diagnostics.attention > .3);
  t.diagnostic(JSON.stringify({ stepSeconds: .001, maximumArmPointDelta: delta, budget: TRANSITION_BUDGET }));
});

test('a startle begins at the current examine pose before its warning gathers the arms', t => {
  const { artwork, canvas } = mount(t);
  startExamine(artwork, canvas);
  const before = points(artwork), time = artwork.time;
  artwork.pulse();
  const delta = maximumDelta(before, points(artwork));
  assert.equal(artwork.time, time);
  assert.equal(artwork.fish[0].reaction.age, 0);
  assert.equal(delta, 0, 'pulse() cannot teleport an arm before time has advanced');
  assert.equal(species(artwork).performance.sequence, 'gather');
  assert.equal(artwork.ink.length, 0);

  ticks(artwork, 20);
  assert.equal(artwork.getStats().reactionStage, 'react');
  assert(species(artwork).performance.reach > 0 && species(artwork).performance.reach < 1);
  assert.equal(artwork.ink.length, 0, 'gathering precedes the established ink phase');
  t.diagnostic(JSON.stringify({ elapsedSeconds: 0, maximumArmPointDelta: delta, requiredDelta: 0 }));
});

test('an explicit cue takes over an autonomous probe through a continuous peel', t => {
  const { artwork, canvas } = mount(t);
  ticks(artwork, 500);
  assert.equal(species(artwork).performance.sequence, 'examine');
  assert(species(artwork).diagnostics.attention > .3);
  const before = points(artwork);
  invite(canvas);
  artwork.advance(.001);
  const delta = maximumDelta(before, points(artwork));
  assert(delta < TRANSITION_BUDGET, `taking over an autonomous probe jumps an arm by ${delta}`);
  assert.equal(species(artwork).performance.sequence, 'peel-and-settle');
  assert(species(artwork).performance.reach > .3);

  ticks(artwork, 120);
  assert.equal(species(artwork).performance.sequence, 'notice');
  ticks(artwork, 200);
  assert.equal(species(artwork).performance.sequence, 'examine');
  assert(species(artwork).diagnostics.attention > .3);
  t.diagnostic(JSON.stringify({ stepSeconds: .001, maximumArmPointDelta: delta, budget: TRANSITION_BUDGET }));
});

test('finishing a cancelled invitation cannot snap into the autonomous clock phase', t => {
  const { artwork, canvas } = mount(t);
  ticks(artwork, 50);
  invite(canvas);
  ticks(artwork, 400);
  canvas.emit('pointerleave');
  artwork.advance(.001);
  ticks(artwork, 1148, .001);
  assert(species(artwork).performance.reach < .0001);
  const before = points(artwork);
  artwork.advance(.003);
  const boundaryDelta = maximumDelta(before, points(artwork));
  assert(boundaryDelta < TRANSITION_BUDGET, `release-to-autonomy boundary jumps an arm by ${boundaryDelta}`);
  assert(species(artwork).performance.reach < .001,
    'finishing the peel must not restore the unrelated automatic reach at full strength');

  let previous = points(artwork), maximum = boundaryDelta;
  for (let i = 0; i < 350; i++) {
    artwork.advance(.003);
    const next = points(artwork);
    maximum = Math.max(maximum, maximumDelta(previous, next));
    previous = next;
  }
  assert(maximum < TRANSITION_BUDGET, `resuming autonomous behaviour jumps an arm by ${maximum}`);
  assert(species(artwork).performance.reach > .01, 'autonomous movement must resume rather than remain disabled');
  t.diagnostic(JSON.stringify({ stepSeconds: .003, boundaryDelta,
    maximumResumeDelta: maximum, budget: TRANSITION_BUDGET }));
});

test('delaying a secondary arm stays continuous when the target crosses straight ahead', t => {
  // Find the straight-ahead cue using actual projected target geometry, so
  // small legitimate camera refinements do not require a magic screen pixel.
  function sample(x) {
    const { artwork, canvas } = mount();
    try {
      invite(canvas, x, .20);
      ticks(artwork, 60, .02);
      return { lateralTarget: species(artwork).target[1], points: points(artwork) };
    } finally { artwork.destroy(); }
  }
  let lo = -.05, hi = .05;
  assert(sample(lo).lateralTarget > 0 && sample(hi).lateralTarget < 0);
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (sample(mid).lateralTarget > 0) lo = mid;
    else hi = mid;
  }
  const center = (lo + hi) / 2;
  const one = sample(center - .000001), two = sample(center + .000001);
  assert(one.lateralTarget > 0 && two.lateralTarget < 0);
  const delta = maximumDelta(one.points, two.points);
  assert(delta < TRANSITION_BUDGET, `crossing the leading-arm boundary jumps geometry by ${delta}`);
  t.diagnostic(JSON.stringify({ normalizedTargetSeparation: .000002,
    maximumArmPointDifference: delta, budget: TRANSITION_BUDGET }));
});

test('the shared marine director retains its established startle and ink phase timings', t => {
  const { artwork } = mount(t, true);
  ticks(artwork, 50);
  assert.equal(artwork.getDirector().enabled, true);
  assert.equal(artwork.cueDirector({ type: 'disturb', id: 1 }), true);
  const checkpoints = [
    [0, 'react'], [33, 'react'], [35, 'spray'], [93, 'spray'],
    [95, 'escape'], [324, 'escape'], [326, 'recover'],
    [879, 'recover'], [881, 'idle'],
  ];
  let current = 0;
  for (const [tick, expected] of checkpoints) {
    ticks(artwork, tick - current);
    current = tick;
    assert.equal(artwork.getStats().reactionStage, expected, `director reaction stage at ${tick * STEP} s`);
    assert(species(artwork).contactWeights.every(weight => weight === 0),
      'the solo den must not anchor an octopus on a shared director route');
    assert.equal(species(artwork).diagnostics.habitat, false);
    if (tick <= 33) assert.equal(artwork.ink.length, 0);
    if (tick === 35) assert(artwork.ink.length > 0);
  }
  assert.equal(artwork.fish[0].reaction.active, false);
  t.diagnostic(JSON.stringify({ fixedStepSeconds: STEP,
    unchangedBoundarySeconds: [.34, .94, 3.25, 8.8], checkpoints }));
});
