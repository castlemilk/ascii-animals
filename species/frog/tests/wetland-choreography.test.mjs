/** Species-local motion invariants. No browser or raster-performance claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrog, poseFrog, stepFrog } from '../generated/frog.mjs';
import { frogLandmarks, frogMouthPoint, sampleFrogPose } from '../generated/geometry.mjs';
import { createFrogPond, stepFrogPond, posePondFrog, pondPointToWorld } from '../generated/pond.mjs';
import { tongueMotion, tonguePoint, tongueTarget, insectHover } from '../generated/choreography.mjs';

const limbNames = ['rearLeft', 'rearRight', 'foreLeft', 'foreRight'];
const separation = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const step = (state, actions = []) => stepFrogPond(state, state.tick + 1,
  actions.map((action, i) => ({ ...action, tick: state.tick + 1, seq: state.lastSeq + i + 1 })));

test('crouch stores motion above four fixed contact points in every view', () => {
  for (const view of ['front', 'left', 'right', 'profile']) {
    let state = createFrog();
    const before = frogLandmarks(state, { view });
    for (let tick = 1; tick <= 14; tick++) {
      state = stepFrog(state, tick, tick === 1 ? [{ type: 'leap', tick, seq: 0 }] : []).state;
      const current = frogLandmarks(state, { view });
      for (const limb of limbNames) assert(separation(current[limb].tip, before[limb].tip) < 1e-12,
        `${view}/${limb}: a planted toe must not slide in x, y or z`);
    }
    assert(frogLandmarks(state, { view }).head.y > before.head.y + .18,
      'the body visibly lowers while the contacts remain fixed');
  }
});

test('hindlegs extend early in the arc and gather before the landing', () => {
  let state = createFrog(); const extensions = new Map();
  for (let tick = 1; tick <= 60; tick++) {
    state = stepFrog(state, tick, tick === 1 ? [{ type: 'leap', tick, seq: 0 }] : []).state;
    if (state.behavior.kind === 'flight') extensions.set(state.behavior.age, poseFrog(state).extension);
  }
  assert(extensions.get(12) > .9, 'a launched frog must unfold rather than hold its sitting pose');
  assert(extensions.get(36) < .3, 'limbs gather on the descending half');
  assert(extensions.get(40) < .05, 'the pose approaches contact without a late limb snap');
});

test('hunt is planted before contact, carries its catch back, and fully recovers', () => {
  let state = createFrogPond({ director: { autonomy: false } });
  state = step(state, [{ type: 'hunt', frogId: 1, x: .7, y: -.5 }]).state;
  const phases = new Set(); let contactSeen = false, previousReturn = Infinity, fixedFeet;
  let returnSamples = 0;
  for (let n = 0; n < 290; n++) {
    const actor = state.actors[1], motive = actor.motive;
    phases.add(motive.kind);
    if (motive.kind === 'strike') {
      assert(['idle', 'interest'].includes(actor.model.behavior.kind), 'feeding waits for approach landing/recovery');
      const envelope = tongueMotion(motive.age, motive.duration);
      const pose = posePondFrog(state, actor);
      const feet = sampleFrogPose(pose, () => {}).landmarks;
      fixedFeet ??= feet;
      for (const limb of limbNames) assert.deepEqual(feet[limb].tip, fixedFeet[limb].tip);
      if (!envelope.contact) assert.notEqual(state.firefly?.phase, 'caught', 'prey cannot disappear before contact');
      if (state.firefly?.phase === 'caught') {
        contactSeen = true;
        const ground = pondPointToWorld(state.firefly.point);
        const insect = insectHover({ ...ground, y: ground.y + .62 * pose.scale }, pose.scale,
          state.tick - motive.age + Math.ceil(motive.duration * .3), 1, true);
        for (const view of ['front', 'left', 'right', 'profile']) {
          const mouth = frogMouthPoint(pose, view);
          const aim = tongueTarget(mouth, insect, pose.scale);
          assert(Math.hypot(aim.x - mouth.x, aim.y - mouth.y) <= 1.65 * pose.scale + 1e-12);
          assert.deepEqual(tonguePoint(mouth, aim, envelope.reach, 0, pose.scale), mouth,
            'tongue root follows the exact transformed mouth');
          if (envelope.reach === 1) assert(separation(tonguePoint(mouth, aim, 1, 1, pose.scale), aim) < 1e-12,
            'the visible pre-contact insect and attached return start at the same bounded point');
        }
        if (envelope.phase === 'return') {
          assert(envelope.reach < previousReturn, 'attached prey must return continuously, not teleport');
          previousReturn = envelope.reach; returnSamples++;
        }
      }
    }
    state = step(state).state;
  }
  assert(contactSeen); assert(returnSamples >= 10);
  for (const phase of ['track', 'hop', 'strike', 'settle', 'rest']) assert(phases.has(phase));
  assert.equal(state.firefly, null); assert.equal(state.actors[1].motive.kind, 'rest');
  assert.equal(tongueMotion(0, 30).reach, 0); assert.equal(tongueMotion(30, 30).reach, 0);
});

test('long valid body timings retain the insect through landing and never catch in midair', () => {
  let state = createFrogPond({ config: { crouchTicks: 60, flightTicks: 90, landingTicks: 36,
    recoveryTicks: 120, cooldownTicks: 120 }, director: { autonomy: false } });
  state = step(state, [{ type: 'hunt', frogId: 1, x: .7, y: -.5 }]).state;
  let caught = false;
  for (let tick = 0; tick < 600; tick++) {
    state = step(state).state;
    if (state.firefly?.phase === 'caught') {
      caught = true;
      assert(['idle', 'interest'].includes(state.actors[1].model.behavior.kind));
    }
  }
  assert(caught, 'an allowed slow leap must not outlive its prey before the strike');
  assert.equal(state.firefly, null); assert.equal(state.actors[1].motive.kind, 'rest');
});

test('a blocked approach visibly misses instead of touching an uncaught insect', () => {
  let state = createFrogPond({ director: { autonomy: false } });
  state = step(state, [{ type: 'hunt', frogId: 1, x: .7, y: -.5 }]).state;
  state = step(state, [{ type: 'hop', frogId: 0, padId: 4 }]).state;
  let missSeen = false, peakSeen = false;
  while (state.tick < 160) {
    const result = step(state); state = result.state;
    missSeen ||= result.notices.includes('Pip strikes; the firefly slips away.');
    const actor = state.actors[1], motive = actor.motive;
    assert.notEqual(state.firefly?.phase, 'caught', 'a blocked approach never invents a catch');
    if (motive.kind !== 'strike' || motive.age !== 9) continue;
    peakSeen = true;
    const pose = posePondFrog(state, actor), ground = pondPointToWorld(state.firefly.point);
    const hover = insectHover({ ...ground, y: ground.y + .62 * pose.scale }, pose.scale, state.tick, 1, true);
    const envelope = tongueMotion(motive.age, motive.duration, state.firefly.phase === 'hover');
    assert.equal(envelope.contact, false);
    assert.equal(envelope.reach, .65);
    for (const view of ['front', 'left', 'right', 'profile']) {
      const mouth = frogMouthPoint(pose, view), prey = tongueTarget(mouth, hover, pose.scale);
      const tip = tonguePoint(mouth, prey, envelope.reach, 1, pose.scale);
      assert(Math.hypot(tip.x - prey.x, tip.y - prey.y) > .1 * pose.scale,
        `${view}: the missed tongue visibly stops short of the still-free insect`);
    }
  }
  assert(missSeen && peakSeen);
  assert.equal(state.firefly, null); assert.equal(state.actors[1].motive.kind, 'rest');
});

test('splash starts at the latched touchdown, once, and busy input cannot restart the hop', () => {
  let state = createFrogPond({ director: { autonomy: false } });
  const destination = state.pads[4];
  state = step(state, [{ type: 'hop', frogId: 0, padId: destination.id }]).state;
  let splashes = 0;
  for (let tick = 0; tick < 180; tick++) {
    const before = state;
    const result = step(state, tick < 10 ? [{ type: 'hop', frogId: 0, padId: 3 }] : []);
    state = result.state;
    if (tick < 10) assert.equal(result.ignoredActions, 1);
    for (const ripple of state.ripples.filter(r => r.kind === 'landing' && r.age === 0)) {
      splashes++;
      assert.equal(before.actors[0].model.behavior.kind, 'flight');
      assert.equal(state.actors[0].model.behavior.kind, 'landing');
      assert.deepEqual(ripple.point, state.actors[0].model.position);
      assert(Math.hypot(ripple.point.x - destination.point.x, ripple.point.y - destination.point.y) < 1e-12);
    }
    if (['crouch', 'flight'].includes(state.actors[0].model.behavior.kind)) assert.equal(state.ripples.length, 0);
  }
  assert.equal(splashes, 1); assert.equal(state.actors[0].model.jumps, 1); assert.equal(state.ripples.length, 0);
});
