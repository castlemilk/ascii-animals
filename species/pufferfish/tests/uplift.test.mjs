/** Focused regression gates for the pufferfish art/response uplift.
 * These inspect pure state and real geometry; they are not visual/browser passes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPufferfish, pufferfishPoster, stepPufferfish } from '../build/model.js';
import { samplePufferfish } from '../build/geometry.js';
import { createPufferfishDirector, stepPufferfishDirector } from '../build/director.js';

function recover(options = {}, initial = 1) {
  let state = pufferfishPoster(createPufferfish(options), true);
  if (initial !== 1) state = { ...state, inflation: initial };
  state = stepPufferfish(state, { tick: 1, events: [{ type: 'retreat', tick: 1, seq: 0 }] }).state;
  const frames = [state];
  for (let age = 1; age <= state.config.recoveryTicks; age++) {
    state = stepPufferfish(state, { tick: state.tick + 1 }).state;
    frames.push(state);
  }
  return frames;
}
function points(state) {
  const samples = []; samplePufferfish(state, point => samples.push(point), { quality: 'fine', staticPose: true });
  return samples;
}
function extent(samples, part, axis) {
  const values = samples.filter(point => point.part === part).map(point => point[axis]);
  return Math.max(...values) - Math.min(...values);
}

test('deflation hesitates twice while remaining monotone, bounded and exactly the configured duration', () => {
  const frames = recover();
  const pauses = [];
  let start = -1;
  for (let index = 1; index < frames.length; index++) {
    const previous = frames[index - 1].inflation, value = frames[index].inflation;
    assert.ok(value >= 0 && value <= 1);
    assert.ok(value <= previous + 1e-12, 'deflation must not inflate again');
    assert.ok(previous - value < 0.011, 'default recovery does not introduce a visual snap');
    if (Math.abs(previous - value) < 1e-12 && value > .01 && value < .99) {
      if (start === -1) start = index;
    } else if (start !== -1) { pauses.push({ start, end: index - 1 }); start = -1; }
  }
  if (start !== -1) pauses.push({ start, end: frames.length - 1 });
  const perceptible = pauses.filter(pause => pause.end - pause.start + 1 >= 4);
  assert.equal(perceptible.length, 2, 'two short, separated pauses make recovery visibly hesitant');
  assert.ok(frames[perceptible[0].start].inflation > frames[perceptible[1].start].inflation,
    'recovery continues between the pauses');
  assert.equal(frames.at(-1).inflation, 0);
  assert.equal(frames.at(-1).phase.kind, 'cooldown');
  assert.equal(frames.at(-1).tick - frames[0].tick, frames[0].config.recoveryTicks);
});

test('short/long and partial recoveries retain endpoint, continuity and cannot be restarted by pressure', () => {
  for (const recoveryTicks of [6, 150, 3600]) for (const initial of [.12, .55, 1]) {
    const frames = recover({ recoveryTicks }, initial);
    assert.equal(frames[0].inflation, initial);
    assert.equal(frames.at(-1).inflation, 0);
    assert.equal(frames.at(-1).phase.kind, 'cooldown');
    for (let index = 1; index < frames.length; index++) {
      assert.ok(frames[index].inflation <= frames[index - 1].inflation + 1e-12);
    }
    let pressured = frames[0];
    for (let age = 1; age <= recoveryTicks; age++) {
      pressured = stepPufferfish(pressured, { tick: pressured.tick + 1,
        events: [{ type: 'approach', tick: pressured.tick + 1, seq: age }] }).state;
    }
    assert.equal(pressured.inflation, 0);
    assert.equal(pressured.phase.kind, 'cooldown');
    assert.equal(pressured.reactions, frames[0].reactions, 'pressure during recovery never re-arms inflation');
  }
});

test('inflation changes body proportions instead of applying a uniform scale', () => {
  const state = createPufferfish({ seed: 23 });
  const calm = points(state), inflated = points(pufferfishPoster(state, true));
  const ratios = ['x', 'y', 'z'].map(axis => extent(inflated, 'body', axis) / extent(calm, 'body', axis));
  assert.ok(Math.max(...ratios) - Math.min(...ratios) > .25,
    `body expansion must visibly reshape the silhouette: axis growth was ${ratios.join(', ')}`);
  assert.ok(ratios[1] > ratios[2] + .15, 'ventral expansion exceeds change in nose-to-tail length');
  for (const samples of [calm, inflated]) {
    const spines = samples.filter(point => point.part === 'spine');
    assert.ok(spines.length > 42 * 3, 'fine surface spine samples supplement the major spine roots');
  }
});

test('all public extreme gaze corners keep the iris and pupil attached to the sampled eyeball', () => {
  for (const quality of ['small', 'fine']) for (const inflated of [false, true]) {
    const state = pufferfishPoster(createPufferfish({ seed: 23 }), inflated);
    for (const x of [-1, 1]) for (const y of [-1, 1]) {
      const samples = [];
      samplePufferfish(state, sample => samples.push(sample), { quality, staticPose: true, gaze: { x, y } });
      for (const eyeId of [20_000, 24_000]) {
        // Seeds identify the same eye's original shell and overlaid cap. Derive
        // center/radius from that sampled shell, not a duplicate of its formula.
        const shell = samples.filter(sample => sample.part === 'eye' && sample.seed >= eyeId && sample.seed < eyeId + 1000);
        const center = Object.fromEntries(['x', 'y', 'z'].map(axis => {
          const values = shell.map(sample => sample[axis]);
          return [axis, (Math.min(...values) + Math.max(...values)) / 2];
        }));
        const radius = Math.max(...shell.map(sample => Math.hypot(sample.x - center.x, sample.y - center.y, sample.z - center.z)));
        const cap = samples.filter(sample => ['eye', 'pupil'].includes(sample.part)
          && sample.seed >= eyeId + 1000 && sample.seed < eyeId + 2000);
        assert.ok(shell.length > 0 && cap.length > 0);
        for (const sample of cap) {
          const distance = Math.hypot(sample.x - center.x, sample.y - center.y, sample.z - center.z);
          assert.ok(Number.isFinite(distance));
          assert.ok(distance <= radius + .009,
            `${quality}, inflation=${Number(inflated)}, gaze=${x},${y}: eye cap detached by ${(distance - radius).toFixed(6)}`);
        }
      }
    }
  }
});

const positionDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function stepDirector(state, events = []) {
  return stepPufferfishDirector(state, { tick: state.tick + 1, events }).state;
}

test('a quiet invitation anticipates, approaches, holds personal space and releases back to the reef', () => {
  let scene = createPufferfishDirector({ scene: 'reef', count: 1, curiosity: 1 }, { seed: 23 });
  const initial = scene.actors[0], target = { x: .45, y: -.25 }, checkpoints = new Map();
  for (let tick = 1; tick <= 480; tick++) {
    scene = stepDirector(scene, tick === 1 ? [{ tick, seq: 0, type: 'invite', ...target }] : []);
    assert.equal(scene.actors[0].state.reactions, 0, 'a quiet invitation does not frighten the fish');
    if ([20, 150, 180, 240, 300, 360, 361, 480].includes(tick)) checkpoints.set(tick, scene);
  }
  assert.ok(positionDistance(checkpoints.get(20).actors[0], initial) < .025,
    'the first third of a second reads as attention/braking rather than immediate travel');
  const arrived = checkpoints.get(150).actors[0];
  assert.ok(positionDistance(arrived, target) < positionDistance(initial, target) * .75,
    'after anticipation, the invited fish actually travels toward the invitation');
  assert.ok(positionDistance(arrived, target) > .10, 'the animal retains visible personal space');
  assert.ok(positionDistance(checkpoints.get(180).actors[0], checkpoints.get(300).actors[0]) < .035,
    'a short inspection hold gives the invitation a readable response before release');
  assert.notEqual(checkpoints.get(360).invitation, null);
  assert.equal(checkpoints.get(361).invitation, null);
  assert.notEqual(checkpoints.get(480).actors[0].motive, 'invited');
  assert.ok(positionDistance(checkpoints.get(300).actors[0], checkpoints.get(480).actors[0]) > .06,
    'after the invitation expires, the fish returns to its authored reef route');
});

test('startle recoil is local, recovery holds station and ordinary drift returns after cooldown', () => {
  let scene = createPufferfishDirector({ scene: 'reef', count: 2 }, { seed: 23 });
  let control = createPufferfishDirector({ scene: 'reef', count: 2 }, { seed: 23 });
  let largestRecoilDifference = 0, largestRecoveryStep = 0;
  const checkpoints = new Map();
  for (let tick = 1; tick <= 700; tick++) {
    const previous = scene.actors[1];
    const events = tick === 1 ? [{ tick, seq: 0, type: 'select', id: 1 }, { tick, seq: 1, type: 'approach' }]
      : tick === 181 ? [{ tick, seq: 2, type: 'retreat' }] : [];
    scene = stepDirector(scene, events); control = stepDirector(control);
    const actor = scene.actors[1];
    assert.deepEqual(scene.actors[0], control.actors[0], 'uncued neighbor follows its original route');
    if (tick <= 40) largestRecoilDifference = Math.max(largestRecoilDifference, positionDistance(actor, control.actors[1]));
    if (actor.state.phase.kind === 'recovering' && actor.state.phase.age > 12)
      largestRecoveryStep = Math.max(largestRecoveryStep, positionDistance(actor, previous));
    if ([108, 181, 330, 520, 600, 700].includes(tick)) checkpoints.set(tick, scene);
  }
  assert.ok(largestRecoilDifference > .025, 'selected fish visibly recoils away from its ordinary route');
  assert.equal(checkpoints.get(108).actors[1].state.phase.kind, 'holding');
  assert.equal(checkpoints.get(108).actors[1].state.reactions, 1);
  assert.ok(largestRecoveryStep < .0012, 'the deflating fish holds station instead of sliding along its route');
  assert.equal(checkpoints.get(520).actors[1].state.phase.kind, 'idle');
  assert.ok(positionDistance(checkpoints.get(600).actors[1], checkpoints.get(700).actors[1]) > .01,
    'normal drift resumes after recovery and cooldown');
});
