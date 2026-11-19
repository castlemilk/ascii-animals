import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mantaDefinition } from '../../../src/animals/manta.js';

function geometry({ time = 0, lod = 1, seed = .17, ripple = 1.3, motion,
  tension = 0, escape = 0 } = {}) {
  const state = mantaDefinition.create(seed), points = [];
  const host = {
    options: { ripple, formation: 'independent', scene: 'reactive', followPointer: false },
    activeFish: { id: 0, seed, behavior: 'hover' }, pointer: { x: 0, y: 0, interest: 0 },
    reaction: { active: false }, sceneTime: time, geometryStep: lod,
    startleTension: tension, escapeAmount: escape, mantaMotion: motion,
    _shade(x, y, z, detail = 0) {
      return .4 + .45 * z / Math.max(.001, Math.hypot(x, y, z)) + detail;
    },
    _put(...values) { points.push(values); }
  };
  mantaDefinition.pose(host, time, state, {
    position: [0, 0, -.8], forward: [0, -1, .1], bank: 0, reference: [0, 0, 1]
  });
  mantaDefinition.draw(host, time, state);
  return { host, state, points };
}

test('reef manta keeps attached landmarks, finite samples and the existing bounded work budget', () => {
  const bounds = mantaDefinition.bounds;
  for (const lod of [1, 2, 3]) for (const time of [0, 1.4, 3.3, 5.6])
    for (const turn of [-.75, 0, .75]) for (const open of [0, 1]) {
      const { points, state } = geometry({ lod, time, ripple: 2, escape: 1,
        motion: { time, wingEnergy: 1.1, turn, lobeOpen: open, dihedral: .2 } });
      assert(points.length > 1000 && points.length <= 18000, 'retain the established per-animal geometry cap');
      for (const [x, y, z, light, kind, seed] of points) {
        assert([x, y, z, light, kind, seed].every(Number.isFinite));
        assert(x >= bounds.minX && x <= bounds.maxX);
        assert(Math.abs(y) <= bounds.maxY && Math.abs(z) <= bounds.maxZ);
        assert([0, 1, 2].includes(kind));
      }
      assert(Math.abs(state.diagnostics.wingSpan - 5.4) < 1e-12);
      assert.equal(state.diagnostics.tailRoot[0], -.88);
      assert.equal(Math.abs(state.diagnostics.tailRoot[1]), 0); // Signed zero is the same attachment.
      assert.equal(state.diagnostics.tailRoot[2], -.012);
      const roots = state.diagnostics.lobeRoots, tips = state.diagnostics.lobeTips;
      assert.equal(roots.length, 6); assert.equal(tips.length, 6);
      for (const offset of [0, 3]) {
        assert(roots[offset] >= .8 && roots[offset] <= 1.06, 'lobe root inside the terminal head');
        assert(Math.abs(roots[offset + 1]) <= .315 && Math.abs(roots[offset + 2]) < .1);
        assert(tips[offset] - roots[offset] > .4, 'both cephalic lobes project in front of the head');
        assert(Math.sign(roots[offset + 1]) === Math.sign(tips[offset + 1]));
      }
      assert(roots[1] < 0 && roots[4] > 0, 'opposed cephalic attachments');
    }
});

test('the dorsal face contains no raised eye discs while cephalic lobes remain present', () => {
  for (const lod of [1, 2, 3]) for (const time of [0, 1.3, 2.6, 5.6]) {
    const { points } = geometry({ lod, time });
    // Anatomical region previously occupied by the two raised circular eyes.
    // This is a geometric envelope invariant, not an exact source/pixel hash.
    const foreheadSides = points.filter(([x, y]) => x >= .71 && x <= .94 && Math.abs(y) >= .22 && Math.abs(y) <= .43);
    assert(foreheadSides.length > 0);
    assert(foreheadSides.every(([, , z]) => z < .145), 'do not reintroduce dorsal protruding eye discs');
    for (const side of [-1, 1]) {
      assert(points.some(([x, y]) => x > 1.3 && y * side > .16), 'both forward cephalic tips survive LOD');
    }
  }
});

test('flexible tips and trailing edges lag the leading fin rather than rotating as a rigid triangle', () => {
  const heights = { innerLeading: [], outerLeading: [], innerTrailing: [] };
  const innerSpan = -.825, outerSpan = -2.7;
  for (let index = 0; index <= 75; index++) {
    const time = index * .06;
    const { points } = geometry({ time, lod: 1 });
    const atSpan = span => points.filter(([, y]) => Math.abs(y - span) < 1e-9);
    const inner = atSpan(innerSpan), outer = atSpan(outerSpan);
    const extremeHeight = (samples, leading) => {
      const x = (leading ? Math.max : Math.min)(...samples.map(point => point[0]));
      return Math.max(...samples.filter(point => Math.abs(point[0] - x) < 1e-9).map(point => point[2]));
    };
    heights.innerLeading.push(extremeHeight(inner, true));
    heights.outerLeading.push(extremeHeight(outer, true));
    heights.innerTrailing.push(extremeHeight(inner, false));
  }
  const peakTime = values => values.indexOf(Math.max(...values)) * .06;
  const leading = peakTime(heights.innerLeading);
  const tipLag = peakTime(heights.outerLeading) - leading;
  const trailingLag = peakTime(heights.innerTrailing) - leading;
  assert(tipLag > .45 && tipLag < 1.8, 'spanwise wave travels from base toward tip');
  assert(trailingLag > .15 && trailingLag < .9, 'anterior edge leads the trailing edge');
});

test('repeated sampling does not advance geometry and study lobes respond without moving their roots', () => {
  const a = geometry({ time: 2.6, motion: { time: 2.6, wingEnergy: .7, turn: .3, lobeOpen: 0, dihedral: .15 } });
  const hash = values => createHash('sha256').update(JSON.stringify(values)).digest('hex');
  const before = hash(a.points);
  const copy = [];
  a.host._put = (...values) => copy.push(values);
  mantaDefinition.draw(a.host, 2.6, a.state);
  assert.equal(hash(copy), before);
  const b = geometry({ time: 2.6, motion: { time: 2.6, wingEnergy: .7, turn: .3, lobeOpen: 1, dihedral: .15 } });
  assert.deepEqual(a.state.diagnostics.lobeRoots, b.state.diagnostics.lobeRoots);
  assert.notDeepEqual(a.state.diagnostics.lobeTips, b.state.diagnostics.lobeTips);
  assert.notEqual(hash(a.points), hash(b.points), 'attention must change visible lobe geometry');
});
