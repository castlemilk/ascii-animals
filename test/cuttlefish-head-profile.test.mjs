import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { fakeBrowser } from './helpers/fake-browser.mjs';
import { captureHeadEnvelope, headEnvelopeAt } from './helpers/cuttlefish-profile.mjs';

// The old pinched head fails the shoulder test; exact V3 fails the new anterior
// growth test. CUTTLEFISH_HEAD_SOURCE selects either immutable negative control.
const source = process.env.CUTTLEFISH_HEAD_SOURCE
  ? pathToFileURL(process.env.CUTTLEFISH_HEAD_SOURCE)
  : new URL('../src/animals/cuttlefish.js', import.meta.url);
const { CuttlefishArtwork } = await import(source.href);
const v3 = JSON.parse(readFileSync(new URL('./fixtures/cuttlefish-crown-v3-oracle.json', import.meta.url), 'utf8'));

function mounted() {
  const browser = fakeBrowser();
  const art = new CuttlefishArtwork(browser.canvas(1000, 650), {
    species: 'cuttlefish', count: 1, size: 1, sizeVariation: 0, seed: 7,
    autoStart: false, paused: true, glow: false,
  });
  art.geometryStep = 1; art._cacheNormals();
  return art;
}
function mantleRings(art, time) {
  const put = art._put, head = art._head, eye = art._eye, points = [];
  try {
    art._head = () => {}; art._eye = () => {};
    art._put = (x, y, z, light, kind) => {
      if (kind === 0 && x <= .49 + 1e-10) points.push([x, y, z]);
    };
    art._body(time);
  } finally { art._put = put; art._head = head; art._eye = eye; }
  const groups = new Map();
  for (const point of points) {
    const key = point[0].toFixed(8), ring = groups.get(key) || [];
    ring.push(point); groups.set(key, ring);
  }
  const rings = [...groups.values()].map(points => ({ x: points[0][0],
    a: (Math.max(...points.map(p => p[1])) - Math.min(...points.map(p => p[1]))) / 2,
    b: (Math.max(...points.map(p => p[2])) - Math.min(...points.map(p => p[2]))) / 2,
  })).sort((a, b) => a.x - b.x);
  if (typeof head === 'function') return rings;
  // The older combined _body has overlapping mantle/head samples near .30..49.
  // Recover its mantle stations from the observed posterior spacing rather
  // than mistakenly counting the old head's zero-radius rear pole as mantle.
  const start = rings[0].x, step = rings[1].x - start;
  return rings.filter(ring => Math.abs((ring.x - start) / step - Math.round((ring.x - start) / step)) < 1e-6);
}
const nearest = (rings, x) => rings.reduce((a, b) => Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a);

test('anterior mantle carries substantial width and depth through the shoulder into the head', t => {
  const art = mounted(), records = [];
  try {
    const head = captureHeadEnvelope(art), eye = headEnvelopeAt(head, .78);
    assert(head.every(ring => ring.residual < 1e-8), 'measured head skin supports a stable transverse envelope');
    for (const time of [0, 2.4, 6.8]) {
      const rings = mantleRings(art, time), peak = nearest(rings, -.55), shoulder = nearest(rings, .49);
      const front = rings.filter(ring => ring.x >= -.55);
      const minimumWidthRatio = Math.min(...front.map(ring => ring.a / peak.a));
      const minimumDepthRatio = Math.min(...front.map(ring => ring.b / peak.b));
      records.push({ time, posteriorPeak: peak, shoulder, eye,
        minimumWidthRatio, minimumDepthRatio,
        shoulderWidthRatio: shoulder.a / peak.a, shoulderDepthRatio: shoulder.b / peak.b });
    }
    t.diagnostic(JSON.stringify({ anteriorProfile: records }));
    for (const record of records) {
      // Allow normal procedural breathing/skin relief. This rejects the old
      // shoulder at only ~44% width/~47% depth without prescribing a new curve.
      assert(record.minimumWidthRatio >= .88, 'anterior mantle must not narrow into a pinched neck');
      assert(record.minimumDepthRatio >= .90, 'anterior mantle must retain its depth at the shoulder');
      assert(record.eye.a >= record.shoulder.a * .93, 'head width must continue the mantle shoulder');
      assert(record.eye.b >= record.shoulder.b * .93, 'head depth must continue the mantle shoulder');
      assert(record.eye.a <= record.posteriorPeak.a * 1.25, 'broader head must not become an oversized lateral bulb');
      assert(record.eye.b <= record.posteriorPeak.b * 1.20, 'broader head must not become a swollen sphere');
    }
  } finally { art.destroy(); }
});

test('head skin grows gradually in both width and depth through the eye region toward the arm roots', t => {
  const art = mounted(), records = [];
  try {
    assert.equal(v3.sourceCommit, '8931bcc568cb5272f3a7b5eab0532c6c95c92858');
    assert.deepEqual(v3.headProfiles.map(profile => profile.depthStrength), [0, 1.2, 2]);
    for (const baseline of v3.headProfiles) {
      assert.deepEqual(baseline.landmarks.map(point => point.x), [.30, .40, .50, .56, .65, .78, .90, 1, 1.02]);
      art.setOptions({ depthStrength: baseline.depthStrength });
      const head = captureHeadEnvelope(art, 2.4, { includeCrownBase: true });
      assert(head.every(ring => ring.residual < 1e-8), 'measure the actual elliptical head skin around the socket');
      const landmarks = baseline.landmarks.map(({ x, a, b }) => ({ x, ...headEnvelopeAt(head, x), baseline: { a, b } }));
      const eye = headEnvelopeAt(head, .78), crown = headEnvelopeAt(head, 1.02);
      const dense = Array.from({ length: 85 }, (_, i) => ({ x: .60 + i * .005, ...headEnvelopeAt(head, .60 + i * .005) }));
      const quarters = [.60, .705, .81, .915, 1.02].map(x => headEnvelopeAt(head, x));
      const axes = ['a', 'b'].map(axis => {
        const totalGrowth = dense.at(-1)[axis] - dense[0][axis];
        const localGains = dense.slice(0, -10).map((point, i) => dense[i + 10][axis] - point[axis]);
        return { axis: axis === 'a' ? 'lateral' : 'dorsoventral',
          eyeRadius: eye[axis], crownRadius: crown[axis], eyeToRootRatio: crown[axis] / eye[axis],
          minimumV3Ratio: Math.min(...landmarks.map(point => point[axis] / point.baseline[axis])),
          totalGrowth, minimumStepGain: Math.min(...dense.slice(1).map((point, i) => point[axis] - dense[i][axis])),
          maximumGrowthOver05XInEyeRadii: Math.max(...localGains) / eye[axis],
          maximumWindowShare: totalGrowth > 1e-8 ? Math.max(...localGains) / totalGrowth : null,
          quarterShares: quarters.slice(1).map((point, i) => totalGrowth > 1e-8 ? (point[axis] - quarters[i][axis]) / totalGrowth : null) };
      });
      records.push({ depthStrength: baseline.depthStrength, landmarks, eye, crown, axes,
        sectionAreaRatio: crown.a * crown.b / (eye.a * eye.b) });
    }
    t.diagnostic(JSON.stringify({ anteriorHeadGrowth: records,
      acceptanceBasis: 'Authored visual continuity budgets, not measurements of species anatomy or the reference photos.' }));
    for (const record of records) {
      assert(record.crown.a > .50 && record.crown.b > .30, 'the arm-root station retains a substantial head section');
      for (const axis of record.axes) {
        const context = `${axis.axis}, depth ${record.depthStrength}`;
        assert(axis.minimumV3Ratio >= 1 - 1e-8, `${context}: keep at least the approved V3 head section at every fixed station`);
        // At the native desktop camera, this modest gain gives about a cell
        // or more across the full section. Both directions matter: thickening
        // only the arms, or only the head's Y radius, cannot pass this test.
        assert(axis.eyeToRootRatio >= 1.06, `${context}: head volume must visibly increase ahead of the eye`);
        assert(axis.eyeToRootRatio <= 1.15, `${context}: avoid an oversized flared collar`);
        assert(axis.minimumStepGain >= -1e-8, `${context}: the head must not narrow again before the root join`);
        assert(axis.maximumGrowthOver05XInEyeRadii <= .035, `${context}: a short local bulge cannot replace gradual growth`);
        assert(axis.maximumWindowShare <= .35, `${context}: no .05X interval may contain most of the growth`);
        assert(axis.quarterShares.every(share => share >= .10), `${context}: distribute growth through and ahead of the eye region`);
      }
    }
  } finally { art.destroy(); }
});
