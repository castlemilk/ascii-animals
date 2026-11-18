import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createPufferfish, pufferfishPoster, PUFFERFISH_REPLAY, stepPufferfish } from '../build/model.js';
import { samplePufferfish, posePufferfish } from '../build/geometry.js';
import { createPufferfishPainter, LEGACY_RENDERER_SHA256 } from '../build/legacy-painter.js';
import { fakeBrowser, legacy } from './fake-browser.mjs';

function samples(state, options) {
  const points = []; const result = samplePufferfish(state, point => points.push(point), options);
  return { points, result };
}
function painter(options) {
  const env = fakeBrowser();
  return { env, paint: createPufferfishPainter(env.canvas, legacy, options,
    () => env.canvas.ownerDocument.createElement('canvas')) };
}

test('historical renderer provenance is retained; current bridge needs no constructor or resources', () => {
  const raw = readFileSync(new URL('../../../test/fixtures/legacy-artwork.cjs', import.meta.url));
  assert.equal(createHash('sha256').update(raw).digest('hex'), LEGACY_RENDERER_SHA256);
  const { env, paint } = painter();
  assert.equal(env.resources().listeners, 0);
  assert.equal(env.resources().rafs, 0);
  assert.equal(env.resources().observedTargets, 0);
  paint.dispose();
});

test('original anatomy remains finite, bounded and attached through all phases and option extremes', () => {
  const counts = new Map();
  for (const seed of [0, 23, 0xffffffff]) for (const inflationScale of [1.3, 1.65, 1.8]) {
    let state = createPufferfish({ seed, inflationScale });
    for (let tick = 0; tick <= 1110; tick++) {
      if (tick) state = stepPufferfish(state, { tick, events: PUFFERFISH_REPLAY.filter(e => e.tick === tick) }).state;
      if (![0, 70, 110, 145, 180, 220, 270, 370, 550, 720, 830, 1110].includes(tick)) continue;
      for (const quality of ['small', 'standard', 'fine']) {
        const { points, result } = samples(state, { quality });
        assert.equal(points.length, result.count); assert.ok(result.count <= 16000);
        assert.equal(result.spineCount, 42);
        const previous = counts.get(quality); if (previous) assert.equal(result.count, previous);
        counts.set(quality, result.count);
        for (const point of points) {
          for (const key of ['x', 'y', 'z', 'light', 'seed']) assert.ok(Number.isFinite(point[key]));
          assert.ok(Math.abs(point.x) < 2.4 && Math.abs(point.y) < 1.8 && Math.abs(point.z) < 2.1);
          assert.ok(point.light >= 0 && point.light <= 1);
          assert.ok([0, 1, 2].includes(point.material));
        }
        const parts = new Set(points.map(p => p.part));
        assert.deepEqual([...parts].sort(), ['body', 'eye', 'fin', 'mouth', 'pupil', 'spine', 'tail'].sort());
        // Attachments must start within the body shell: each side has samples
        // at the growing shell, not merely detached tips outside its envelope.
        const pose = posePufferfish(state), fins = points.filter(p => p.part === 'fin');
        for (const side of [-1, 1]) assert.ok(fins.some(p => Math.sign(p.x) === side && Math.abs(p.x) <= .95 * .92 * pose.scale));
        const tail = points.filter(p => p.part === 'tail');
        assert.ok(tail.some(p => p.z > -.72 * pose.scale));
        const eyes = points.filter(p => p.part === 'eye');
        assert.ok(eyes.some(p => p.x < 0) && eyes.some(p => p.x > 0));
        assert.ok(points.some(p => p.part === 'pupil' && p.light < .05));
      }
    }
  }
});

test('geometry is observational, repeatable and statically frozen; fin phases are independent and continuous', () => {
  const initial = createPufferfish();
  const { points: a } = samples(initial, { quality: 'small' });
  const { points: b } = samples(initial, { quality: 'small' });
  assert.deepEqual(a, b); assert.equal(initial.tick, 0);
  const later = { ...initial, tick: 800, phase: { kind: 'holding', age: 0 } };
  assert.deepEqual(samples(later, { quality: 'small', staticPose: true }).points,
    samples(initial, { quality: 'small', staticPose: true }).points);
  const p0 = posePufferfish(initial), p1 = posePufferfish({ ...initial, tick: 1 });
  assert.notEqual(p0.leftFin, p0.rightFin);
  for (const key of ['bob', 'roll', 'leftFin', 'rightFin', 'tail']) assert.ok(Math.abs(p1[key] - p0[key]) < .06);
  assert.throws(() => samplePufferfish(initial, () => {}, { quality: 'ultra' }));
  assert.throws(() => samplePufferfish(initial, () => {}, { surprise: true }));
  assert.throws(() => posePufferfish({ ...initial, inflation: NaN }));
  assert.throws(() => posePufferfish({ ...initial, variation: Infinity }));
});

test('all supported views at minimum grid preserve finite output inside bounds at largest inflation', () => {
  const state = pufferfishPoster(createPufferfish({ inflationScale: 1.8 }), true);
  for (const view of ['front', 'left', 'right']) {
    const { env, paint } = painter({ view, quality: 'small' });
    paint.resize(360, 270, 1);
    const frame = paint.draw(state, true);
    assert.equal(frame.cols, 72); assert.equal(frame.rows, 40);
    assert.equal(frame.samples, samples(state, { quality: 'small' }).result.count, 'no near-plane sample loss');
    assert.ok(frame.glyphs > 200 && frame.glyphs < frame.cols * frame.rows);
    const lines = frame.text.split('\n');
    assert.equal(lines.length, 40); assert.ok(lines.every(line => line.length === 72));
    assert.match(frame.text, /^[\x20-\x7e\n]+$/);
    assert.ok(lines[0].trim() === '' && lines.at(-1).trim() === '', 'top/bottom clipping');
    assert.ok(lines.every(line => line[0] === ' ' && line.at(-1) === ' '), 'left/right clipping');
    assert.ok(env.canvas.width === 360 && env.canvas.height === 270);
    paint.dispose();
  }
});

test('DPR, enormous resize, invalid configuration, zero-size and disposal obey hard budgets', () => {
  const { env, paint } = painter({ quality: 'fine' });
  paint.resize(100000, 100000, 10);
  const state = createPufferfish();
  const frame = paint.draw(state);
  assert.ok(frame.cols <= 160 && frame.rows <= 90 && frame.cols * frame.rows <= 14400);
  assert.ok(env.canvas.width * env.canvas.height <= 3240000); assert.equal(frame.dpr, 2);
  const config = paint.getConfig();
  for (const bad of [null, { maxDpr: Infinity }, { quality: 'unknown' }, { view: 'back' }, { typo: 1 }]) assert.throws(() => paint.configure(bad));
  assert.equal(paint.getConfig(), config);
  assert.throws(() => paint.resize(NaN, 300, 1));
  assert.equal(paint.resize(0, 0, 1), false); assert.throws(() => paint.draw(state));
  paint.dispose(); paint.dispose(); assert.equal(env.canvas.width, 1);
  assert.throws(() => paint.draw(state)); assert.throws(() => paint.resize(900, 506, 1));
  assert.throws(() => paint.configure({ view: 'front' }));
});

test('identical explicit event log produces identical actual legacy cells across presentation grouping', () => {
  const outputs = [];
  for (const group of [1, 2, 5]) {
    let state = createPufferfish(); const { paint } = painter({ quality: 'small' });
    paint.resize(360, 270, 1);
    for (let tick = 1; tick <= 240; tick++) {
      state = stepPufferfish(state, { tick, events: PUFFERFISH_REPLAY.filter(e => e.tick === tick) }).state;
      if (tick % group === 0) paint.draw(state);
    }
    outputs.push({ state, cells: paint.draw(state).text }); paint.dispose();
  }
  assert.deepEqual(outputs[0], outputs[1]); assert.deepEqual(outputs[0], outputs[2]);
});
