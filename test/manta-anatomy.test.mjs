import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mantaDefinition } from '../src/animals/manta.js';

// Captured from b8f222dab868821f27bf2a64a98434f3483fc8e6 before the edit,
// excluding ONLY the old eye-disc samples (seeds >= 25700). These snapshots
// protect the complete wing/body/tail/lobe geometry, shading, order and seeds.
// Quantizing to 1e-9 avoids irrelevant last-bit libm differences; this is a
// geometry check, not a browser-pixel or biological-accuracy assertion.
const fixtures = [
  [1, 0, 13669, '03de39f7719bdca7ce4e59eeaedab8294c91e433aa923765f6e725bed2d23ed5'],
  [1, 5.2, 13669, '59af52b03f5543672e053f78ec6821f6deed62ebf81ef33689fc9128bbc69f59'],
  [2, 0, 4193, '380cf12331351181f5e4380d9f59a26f5fedcf62e781b3f44c42c58a3e2fb4ec'],
  [2, 5.2, 4193, '6d6a28f2e75f1bb238312d847380a2f1c8d34380f28e0ed3c9821abfaef72bf1'],
  [3, 0, 2531, '7fa3f1d68128c62d2149ebb871004235726fcc689145552805850840b429e745'],
  [3, 5.2, 2531, '59f8d34b9799632947f036722deb15ee93cb2d57e4504cd38bbafa8d0f971d78'],
];

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

test('manta eye removal preserves every non-eye sample at all three LODs and two motion phases', () => {
  for (const [lod, time, count, hash] of fixtures) {
    const { samples, state } = sample(lod, time);
    assert.equal(samples.length, count);
    assert.equal(createHash('sha256').update(JSON.stringify(samples)).digest('hex'), hash);
    assert.equal(state.diagnostics.sampleCount, count);
    assert(Math.abs(state.diagnostics.wingSpan - 5.4) < 1e-12);
    assert.equal(state.diagnostics.tailRoot[0], -.88);
    assert(state.diagnostics.tailTip[0] < -3.1);
    for (const side of [-1, 1]) {
      // Both cephalic lobes still reach ahead of the disc and retain their root.
      const lobe = samples.filter(point => point[5] >= 24000 + (side + 1) * 400
        && point[5] < 24400 + (side + 1) * 400);
      assert(lobe.some(point => Math.abs(point[0] - .86) < 1e-9));
      assert(lobe.some(point => Math.abs(point[0] - 1.35) < 1e-9));
      assert(lobe.every(point => Math.sign(point[1]) === side));
    }
  }
});

test('manta local anatomy is shared by ASCII and particle modes at small and large scale', () => {
  const expected = sample(1, 5.2).samples;
  for (const mode of ['ascii', 'points']) for (const scale of [.45, 1, 1.8]) {
    assert.deepEqual(sample(1, 5.2, mode, scale).samples, expected);
  }
});
