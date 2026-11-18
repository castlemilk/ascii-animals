import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mantaDefinition} from '../src/animals/manta.js';
import {octopusDefinition} from '../src/animals/octopus.js';
const definitions={manta:mantaDefinition,octopus:octopusDefinition};
const report={moduleSweeps:{}};
const sumHash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('geometry sweeps: bounds, finite samples, LOD, eight fixed-length arms and joint limits', () => {
  for (const [name, definition] of Object.entries(definitions)) {
    let cases = 0, totalSamples = 0, maxSamples = 0, maxSegmentError = 0, maxJointAngle = 0;
    const samples = new Float64Array(18000 * 6);
    for (const seed of [.17, .73]) for (const lod of [1, 2, 3]) for (const ripple of [.3, 2])
      for (const time of [0, 1.35, 5.2]) for (const reaction of [[0, 0], [1, 0], [0, 1]]) {
        const state = definition.create(seed), b = definition.bounds;
        const host = {
          options: { ripple, formation: 'independent', scene: 'reactive', followPointer: true },
          activeFish: { id: 0, seed, behavior: 'curious' }, pointer: { x: seed < .5 ? -.42 : .42, y: .20, interest: 1 },
          reaction: { active: false }, sceneTime: time, geometryStep: lod, startleTension: reaction[0], escapeAmount: reaction[1],
          width: 900, height: 620, cx: 450, cyScreen: 297.6, scale: 100, objectScale: 1, worldX: 0, worldY: 0, worldZ: -.8,
          perspectiveStrength: .2, r00: 0, r10: 1, r20: 0, r01: -1, r11: 0, r21: 0, r02: 0, r12: 0, r22: 1,
          sampleCount: 0,
          _shade(x, y, z, detail = 0) { return .2 + .55 * Math.abs(z) / Math.max(.001, Math.hypot(x, y, z)) + detail; },
          _put(x, y, z, light, kind = 0, sampleSeed = 0) {
            assert([x, y, z, light, kind, sampleSeed].every(Number.isFinite));
            assert(x >= b.minX - 1e-9 && x <= b.maxX + 1e-9, name + ' X bounds');
            assert(Math.abs(y) <= b.maxY + 1e-9 && Math.abs(z) <= b.maxZ + 1e-9, name + ' Y/Z bounds');
            assert([0, 1, 2].includes(kind));
            assert(this.sampleCount < 18000, name + ' geometry budget');
            samples.set([x, y, z, light, kind, sampleSeed], this.sampleCount++ * 6);
          }
        };
        definition.pose(host, time, state, { position: [0, 0, -.8], forward: [1, 0, 0], bank: 0, reference: [0, 0, 1] });
        definition.draw(host, time, state);
        const firstCount = host.sampleCount;
        const firstHash = sumHash(Buffer.from(samples.buffer, 0, firstCount * 6 * 8));
        host.sampleCount = 0;
        definition.draw(host, time, state);
        assert.equal(host.sampleCount, firstCount);
        assert.equal(sumHash(Buffer.from(samples.buffer, 0, firstCount * 6 * 8)), firstHash, 'repeat render changes geometry');
        if (name === 'octopus') {
          assert.equal(state.arms.length, 8);
          assert(state.reachWeights.filter(weight => weight > 1e-8).length <= 2);
          for (let k = 0; k < 8; k++) {
            const points = state.arms[k], length = state.lengths[k] / 40;
            assert.equal(points.length, 123);
            for (let j = 0; j < 3; j++) assert.equal(points[j], state.roots[k * 3 + j]);
            let previous;
            for (let i = 1; i <= 40; i++) {
              const d = [0, 1, 2].map(j => points[i * 3 + j] - points[(i - 1) * 3 + j]);
              const error = Math.abs(Math.hypot(...d) - length);
              maxSegmentError = Math.max(maxSegmentError, error); assert(error < 1e-12);
              if (previous) {
                const cosine = d.reduce((v, n, j) => v + n * previous[j], 0) / (length * length);
                const angle = Math.acos(Math.max(-1, Math.min(1, cosine)));
                maxJointAngle = Math.max(maxJointAngle, angle); assert(angle <= .087 + 1e-10);
              }
              previous = d;
            }
          }
        } else {
          assert(Math.abs(state.diagnostics.wingSpan - 5.4) < 1e-12);
          assert(state.diagnostics.wingSpan > 4 * .91);
          assert.equal(state.diagnostics.tailRoot[0], -.88);
          assert(Math.abs(state.diagnostics.tailRoot[1]) < 1e-12);
          assert(state.diagnostics.tailTip[0] < -3.1);
          assert(state.diagnostics.maxWingDisplacement <= .9);
        }
        cases++; totalSamples += firstCount * 2; maxSamples = Math.max(maxSamples, firstCount);
      }
    report.moduleSweeps[name] = { cases, repeatedDraws: cases * 2, totalSamples, maxSamples, maxSegmentError, maxJointAngle };
  }
});

