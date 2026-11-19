import test from 'node:test';
import assert from 'node:assert/strict';
import { mantaDefinition } from '../src/animals/manta.js';

// PR31 intentionally changes the non-eye silhouette and materials. PR30's
// eye-removal-only byte oracle is superseded, not regenerated. Keep mode
// parity and anatomical invariants here; species/manta/tests adds the stronger
// forehead envelope, fin lag, bounded geometry and attachment sweeps.
function sample(lod, time, mode = 'ascii', objectScale = 1) {
  const state = mantaDefinition.create(.73), samples = [];
  const host = {
    options: { ripple: 1.3, formation: 'independent', scene: 'reactive', followPointer: true, mode },
    activeFish: { id: 0, seed: .73, behavior: 'curious' },
    pointer: { x: .42, y: .2, interest: 1 },
    sceneTime: time, geometryStep: lod, startleTension: .3, escapeAmount: .2, objectScale,
    _shade(x, y, z, detail = 0) {
      return .2 + .55 * Math.abs(z) / Math.max(.001, Math.hypot(x, y, z)) + detail;
    },
    _put(...point) {
      assert(point.every(Number.isFinite));
      assert(point[5] < 25700, 'removed decorative eye samples must not return');
      samples.push(point.map(value => Number(value.toFixed(9))));
    },
  };
  mantaDefinition.pose(host, time, state, {
    position: [0, 0, -.8], forward: [1, 0, 0], bank: 0, reference: [0, 0, 1],
  });
  mantaDefinition.draw(host, time, state);
  return { samples, state };
}

test('uplifted manta preserves dorsal no-eye, wing, tail and attached lobe invariants', () => {
  assert.equal(mantaDefinition.ink, false);
  for (const lod of [1, 2, 3]) for (const time of [0, 5.2]) {
    const { samples, state } = sample(lod, time);
    assert(samples.length > 1000 && samples.length <= 18000);
    assert.equal(state.diagnostics.sampleCount, samples.length);
    assert(Math.abs(state.diagnostics.wingSpan - 5.4) < 1e-12);
    assert.equal(state.diagnostics.tailRoot[0], -.88);
    assert(state.diagnostics.tailTip[0] < -3.1);
    const { lobeRoots: roots, lobeTips: tips } = state.diagnostics;
    for (const offset of [0, 3]) {
      assert(roots[offset] >= .8 && roots[offset] <= 1.06);
      assert(Math.abs(roots[offset + 1]) <= .315);
      assert(tips[offset] - roots[offset] > .4);
      assert(Math.sign(roots[offset + 1]) === Math.sign(tips[offset + 1]));
    }
    const forehead = samples.filter(([x, y]) => x >= .71 && x <= .94 && Math.abs(y) >= .22 && Math.abs(y) <= .43);
    assert(forehead.length > 0);
    assert(forehead.every(([, , z]) => z < .145));
  }
});

test('manta local anatomy is shared by ASCII and particle modes at small and large scale', () => {
  const expected = sample(1, 5.2).samples;
  for (const mode of ['ascii', 'points']) for (const scale of [.45, 1, 1.8]) {
    assert.deepEqual(sample(1, 5.2, mode, scale).samples, expected);
  }
});
