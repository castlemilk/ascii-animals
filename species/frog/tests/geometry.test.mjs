import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrog, poseFrog, stepFrog } from '../generated/frog.mjs';
import { frogLandmarks, sampleFrog } from '../generated/geometry.mjs';

function collect(state, options = {}) {
  const samples = [];
  const result = sampleFrog(state, sample => samples.push(sample), options);
  return { samples, result };
}

test('original frog surfaces are bounded, finite and invariant in count through every behavior/view', () => {
  let count;
  let state = createFrog({ seed: 23 });
  const seen = new Set();
  for (let tick = 0; tick <= 130; tick++) {
    if (tick) state = stepFrog(state, tick, tick === 1
      ? [{ type: 'target', x: .7, y: -.5, tick, seq: 0 }, { type: 'leap', tick, seq: 1 }] : []).state;
    seen.add(state.behavior.kind);
    for (const view of ['front', 'left', 'right', 'profile']) {
      const { samples, result } = collect(state, { view });
      count ??= result.count;
      assert.equal(result.count, count);
      assert.equal(result.count, samples.length);
      assert(result.count <= 32000);
      assert(result.count > 10000, 'closed volumes sampled densely enough for the accepted grid');
      for (const [i, sample] of samples.entries()) {
        assert.equal(sample.sampleId, i);
        for (const key of ['x', 'y', 'z', 'light']) assert(Number.isFinite(sample[key]));
        assert(sample.light >= 0 && sample.light <= 1);
        assert([0, 1, 2].includes(sample.material));
        assert(Math.abs(sample.x) < 4.5 && sample.y > -3 && sample.y < 3.5 && Math.abs(sample.z) < 2);
        for (const axis of ['x', 'y', 'z']) assert(sample[axis] >= result.bounds.min[axis] && sample[axis] <= result.bounds.max[axis]);
      }
      assert.deepEqual(result.landmarks, frogLandmarks(state, { view }));
    }
  }
  assert.deepEqual([...seen].sort(), ['idle', 'interest', 'crouch', 'flight', 'landing', 'recovery', 'cooldown'].sort());
});

test('grounded limb tips remain planted under compression and all four limbs stay attached', () => {
  let state = createFrog();
  const groundedKinds = new Set(['idle', 'interest', 'crouch', 'landing', 'recovery', 'cooldown']);
  for (let tick = 0; tick < 120; tick++) {
    if (tick) state = stepFrog(state, tick, tick === 1 ? [{ type: 'leap', tick, seq: 0 }] : []).state;
    const pose = poseFrog(state), { result, samples } = collect(state);
    for (const [name, part] of [['rearLeft', 'rear-left'], ['rearRight', 'rear-right'], ['foreLeft', 'fore-left'], ['foreRight', 'fore-right']]) {
      const limb = result.landmarks[name];
      assert(samples.some(p => p.part === part && Math.hypot(p.x - limb.attachment.x, p.y - limb.attachment.y, p.z - limb.attachment.z) < .23));
      assert(Math.hypot(limb.attachment.x - result.landmarks.torso.x, limb.attachment.y - result.landmarks.torso.y, limb.attachment.z - result.landmarks.torso.z) < 1);
      const joints = [limb.attachment, limb.elbow, limb.ankle, limb.tip];
      for (let i = 1; i < joints.length; i++) assert(Math.hypot(joints[i].x - joints[i - 1].x, joints[i].y - joints[i - 1].y, joints[i].z - joints[i - 1].z) < .9);
      if (groundedKinds.has(state.behavior.kind)) assert(Math.abs(limb.tip.y - (pose.origin.y + .62 * pose.scale)) < 1e-12);
    }
    const eyes = result.landmarks;
    assert(eyes.eyeLeft.x < eyes.head.x && eyes.eyeRight.x > eyes.head.x);
    assert(eyes.eyeLeft.y < eyes.head.y && eyes.eyeRight.y < eyes.head.y);
  }
});

test('neutral-tone geometry preserves silhouette and stable IDs; disabling motion removes idle pulsation', () => {
  let state = createFrog({ seed: 119 });
  const first = collect(state, { motion: false });
  for (let tick = 1; tick <= 300; tick++) state = stepFrog(state, tick).state;
  assert.deepEqual(collect(state, { motion: false }), first);
  const colored = collect(state);
  const silhouette = collect(state, { silhouette: true });
  assert.equal(colored.result.count, silhouette.result.count);
  assert.deepEqual(colored.result.bounds, silhouette.result.bounds);
  for (let i = 0; i < silhouette.samples.length; i++) {
    const p = silhouette.samples[i], source = colored.samples[i];
    assert.equal(p.light, .72); assert.equal(p.material, 0);
    assert.deepEqual([p.x, p.y, p.z, p.part, p.sampleId], [source.x, source.y, source.z, source.part, source.sampleId]);
  }
});

test('extreme allowed anatomy options remain finite across static poses', () => {
  for (const size of [.75, 1.15]) for (const throatAmplitude of [0, .08]) for (const view of ['front', 'left', 'right', 'profile']) {
    const state = createFrog({ seed: 0xffffffff, config: { size, throatAmplitude } });
    for (const staticPose of ['rest', 'crouch', 'airborne', 'landed']) {
      const { result } = collect(state, { view, staticPose });
      assert(result.count <= 32000);
      for (const p of [result.bounds.min, result.bounds.max]) assert(Object.values(p).every(Number.isFinite));
    }
  }
  assert.throws(() => sampleFrog(createFrog(), null), /sink/);
  assert.throws(() => sampleFrog(createFrog(), () => {}, { view: 'dorsal' }), /view/);
});
