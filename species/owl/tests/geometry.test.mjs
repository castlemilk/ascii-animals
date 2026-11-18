import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOwlGeometry, OWL_SURFACE_LIMIT } from '../build/geometry.js';
import { renderOwlGrid, GLYPHS } from '../build/preview.js';
import { createOwl } from '../build/owl.js';

const config = Object.freeze({ schemaVersion: 1, seed: 7, headYawLimitDeg: 34, headPitchLimitDeg: 12,
  attentionSmoothing: .10, idleAmplitude: .30, reactionStrength: .85, featherContrast: .55,
  blinkIntervalTicks: 240, blinkTicks: 18, ruffleTicks: 36, stretchTicks: 60, recoveryTicks: 48, cooldownTicks: 120 });
const neutral = Object.freeze({ species: 'owl', version: 1, config, tick: 0, lastSequence: -1,
  phaseOffset: 0, attention: Object.freeze({ x: 0, y: 0, active: false }),
  behavior: Object.freeze({ kind: 'idle', sinceTick: 0 }), cycle: null,
  headYawDeg: 0, headPitchDeg: 0, blink: 0, ruffle: 0, leftWing: 0, rightWing: 0, breath: 0 });

test('owl geometry keeps planted roots and constant shoulder-to-tip length across accepted poses', () => {
  const reference = buildOwlGeometry(neutral);
  for (const headYawDeg of [-45, -34, 0, 34, 45]) {
    for (const headPitchDeg of [-20, 0, 20]) {
      for (const extension of [0, .37, 1]) {
        const geometry = buildOwlGeometry({ ...neutral, headYawDeg, headPitchDeg,
          leftWing: extension, rightWing: 1 - extension, ruffle: extension, breath: extension });
        assert.ok(geometry.surfaces.length <= OWL_SURFACE_LIMIT);
        for (const key of ['root', 'neck', 'footLeft', 'footRight', 'shoulderLeft', 'shoulderRight']) {
          assert.deepEqual(geometry.landmarks[key], reference.landmarks[key]);
        }
        for (const side of ['Left', 'Right']) {
          const a = geometry.landmarks[`shoulder${side}`], b = geometry.landmarks[`wingTip${side}`];
          assert.ok(Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1]) - .69) < 1e-12);
        }
        for (const surface of geometry.surfaces) {
          for (const key of ['cx', 'cy', 'z', 'rx', 'ry', 'depth', 'rotation', 'tone', 'pattern']) assert.ok(Number.isFinite(surface[key]));
          assert.ok(surface.rx > 0 && surface.ry > 0);
          assert.ok(surface.tone >= 0 && surface.tone <= 1);
          const halfWidth = Math.abs(Math.cos(surface.rotation)) * surface.rx + Math.abs(Math.sin(surface.rotation)) * surface.ry;
          const halfHeight = Math.abs(Math.sin(surface.rotation)) * surface.rx + Math.abs(Math.cos(surface.rotation)) * surface.ry;
          assert.ok(Math.abs(surface.cx) + halfWidth < 1.104, 'fits the narrowest accepted physical width');
          assert.ok(surface.cy - halfHeight > -1.18 && surface.cy + halfHeight < 1.22, 'fits fixed vertical framing');
        }
      }
    }
  }
});

test('minimum grid preserves both eye apertures, dark pupils, beak, wings, feet and body at extreme head poses', () => {
  for (const headYawDeg of [-45, 0, 45]) {
    for (const headPitchDeg of [-20, 0, 20]) {
      const grid = renderOwlGrid({ ...neutral, headYawDeg, headPitchDeg }, { cols: 64, rows: 36 });
      const counts = new Map();
      for (const part of grid.parts) counts.set(part, (counts.get(part) ?? 0) + 1);
      for (const part of ['eye-left', 'eye-right']) assert.ok(counts.get(part) >= 8, part);
      for (const part of ['pupil-left', 'pupil-right']) assert.ok(counts.get(part) >= 4, part);
      for (const part of ['beak', 'wing-left', 'wing-right', 'foot-left', 'foot-right', 'body', 'head', 'face']) assert.ok(counts.get(part) > 0, part);
      const geometry = buildOwlGeometry({ ...neutral, headYawDeg, headPitchDeg });
      assert.ok(geometry.landmarks.eyeRight[0] - geometry.landmarks.eyeLeft[0] > .28);
    }
  }
});

test('actual glyph text is equal-width printable ASCII with an explicit union repertoire', () => {
  for (const dimensions of [{ cols: 64, rows: 36 }, { cols: 96, rows: 54 }, { cols: 160, rows: 90 }]) {
    const grid = renderOwlGrid(neutral, dimensions);
    const rows = grid.text.split('\n');
    assert.equal(rows.length, dimensions.rows);
    assert.ok(rows.every(row => row.length === dimensions.cols));
    assert.match(grid.text, /^[\x20-\x7e\n]+$/);
    assert.ok([...grid.text].every(char => char === '\n' || GLYPHS.includes(char)));
    assert.equal(grid.samples.length, dimensions.cols * dimensions.rows);
    assert.equal(grid.parts.length, grid.samples.length);
    assert.equal(grid.occupied, grid.samples.filter(Boolean).length);
    const silhouette = renderOwlGrid(neutral, { ...dimensions, silhouette: true });
    assert.match(silhouette.text, /^[ #\n]+$/);
  }
});

test('fixed framing leaves a clear border through ruffle, stretch and extreme supported turns', () => {
  for (const dimensions of [{ cols: 64, rows: 36 }, { cols: 64, rows: 38 }, { cols: 160, rows: 90 }]) {
    for (const headYawDeg of [-45, 0, 45]) {
      const grid = renderOwlGrid({ ...neutral, headYawDeg, headPitchDeg: 20, leftWing: 1, rightWing: 1, ruffle: 1 }, dimensions);
      const rows = grid.text.split('\n');
      assert.equal(rows[0].trim(), ''); assert.equal(rows.at(-1).trim(), '');
      assert.ok(rows.every(row => row[0] === ' ' && row.at(-1) === ' '));
    }
  }
});

test('sampling is deterministic, immutable and does not modify original state', () => {
  const before = JSON.stringify(neutral);
  const first = renderOwlGrid(neutral), second = renderOwlGrid(neutral);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(neutral), before);
  assert.ok(Object.isFrozen(first)); assert.ok(Object.isFrozen(first.parts)); assert.ok(Object.isFrozen(first.samples));
  assert.ok(first.samples.filter(Boolean).every(Object.isFrozen));
  const geometry = buildOwlGeometry(neutral);
  assert.ok(Object.isFrozen(geometry)); assert.ok(Object.isFrozen(geometry.surfaces));
  assert.ok(geometry.surfaces.every(Object.isFrozen)); assert.ok(Object.isFrozen(geometry.landmarks));
  assert.ok(Object.values(geometry.landmarks).every(Object.isFrozen));
});

test('closed eyes are an actual alternate glyph pose and do not remove the orbital landmarks', () => {
  const open = renderOwlGrid(neutral, { cols: 64, rows: 36 });
  const closed = renderOwlGrid({ ...neutral, blink: 1 }, { cols: 64, rows: 36 });
  assert.notEqual(open.text, closed.text);
  assert.ok(closed.text.includes('----'));
  assert.equal(closed.parts.includes('pupil-left'), false);
  assert.equal(closed.parts.includes('pupil-right'), false);
  assert.ok(closed.parts.includes('eye-left') && closed.parts.includes('eye-right'));
});

test('full maximum-amplitude behavior sequence retains geometry bounds and perch attachment', () => {
  const owl = createOwl({ headYawLimitDeg: 45, headPitchLimitDeg: 20, reactionStrength: 1, idleAmplitude: 1,
    blinkTicks: 60, ruffleTicks: 120, stretchTicks: 180, recoveryTicks: 180, cooldownTicks: 600 });
  const stages = new Set();
  const feet = owl.sample().landmarks;
  for (let tick = 1; tick <= 1220; tick++) {
    const events = tick === 1 ? [{ tick, seq: 0, type: 'attention', x: 1, y: -1 }]
      : tick === 60 ? [{ tick, seq: 1, type: 'react' }]
      : tick === 1200 ? [{ tick, seq: 2, type: 'leave' }] : [];
    const { state } = owl.advance(tick, events);
    stages.add(state.behavior.kind === 'response' ? state.behavior.phase : state.behavior.kind);
    if (tick % 5) continue;
    const geometry = owl.sample();
    assert.deepEqual(geometry.landmarks.footLeft, feet.footLeft);
    assert.deepEqual(geometry.landmarks.footRight, feet.footRight);
    const grid = renderOwlGrid(state, { cols: 64, rows: 36 });
    assert.ok(grid.occupied > 300 && grid.occupied < 1600);
    assert.ok(grid.samples.filter(Boolean).every(p => Number.isFinite(p.z) && p.tone >= 0 && p.tone <= 1));
    const rows = grid.text.split('\n');
    assert.equal(rows[0].trim(), ''); assert.equal(rows.at(-1).trim(), '');
    assert.ok(rows.every(row => row[0] === ' ' && row.at(-1) === ' '));
  }
  assert.deepEqual([...stages].sort(), ['approach', 'blink', 'cooldown', 'idle', 'recovery', 'ruffle', 'stretch']);
  owl.dispose();
});

test('invalid grid sizes, aspect, unknown keys and nonfinite anatomy reject before output allocation', () => {
  for (const cols of [0, 63, 161, 64.5, NaN, Infinity, '96']) assert.throws(() => renderOwlGrid(neutral, { cols }));
  for (const rows of [0, 35, 91, 36.5, NaN, Infinity, '54']) assert.throws(() => renderOwlGrid(neutral, { rows }));
  for (const cellAspect of [0, .44, .71, NaN, Infinity, '.55']) assert.throws(() => renderOwlGrid(neutral, { cellAspect }));
  assert.throws(() => renderOwlGrid(neutral, { cols: 64, rows: 90 }), /physical aspect/);
  assert.throws(() => renderOwlGrid(neutral, { cols: 160, rows: 36 }), /physical aspect/);
  assert.throws(() => renderOwlGrid(neutral, { glyphs: '<script>' }), /Unknown/);
  assert.throws(() => renderOwlGrid(neutral, { silhouette: 'yes' }));
  for (const patch of [{ headYawDeg: 46 }, { headPitchDeg: -21 }, { headYawDeg: NaN }, { leftWing: -1 },
    { ruffle: 1.1 }, { blink: Infinity }, { breath: NaN }, { config: { featherContrast: 2 } }]) {
    assert.throws(() => buildOwlGeometry({ ...neutral, ...patch }));
  }
});
