import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwl, makeOwlPoster, normalizeOwlPointer, resolveOwlOptions, OWL_DEFAULTS } from '../build/owl.js';
import { renderOwlGrid } from '../build/preview.js';

const event = (tick, seq, type, extra = {}) => ({ tick, seq, type, ...extra });
const log = new Map([
  [30, [event(30, 0, 'attention', { x: .8, y: -.35 })]],
  [90, [event(90, 1, 'react')]], [91, [event(91, 2, 'react')]],
  [210, [event(210, 3, 'leave')]],
  [330, [event(330, 4, 'attention', { x: -.8, y: .2 })]],
  [390, [event(390, 5, 'leave')]],
]);
function run(group) {
  const owl = createOwl();
  for (let from = 0; from < 420; from += group) {
    for (let tick = from + 1; tick <= Math.min(420, from + group); tick++) owl.advance(tick, log.get(tick) || []);
    const before = owl.getState(); owl.sample(); renderOwlGrid(before, { cols: 64, rows: 36 }); assert.equal(owl.getState(), before);
  }
  return { state: owl.getState(), text: renderOwlGrid(owl.getState()).text };
}
test('explicit event log replays identically under 1/2/5-tick render grouping', () => {
  assert.deepEqual(run(1), run(2)); assert.deepEqual(run(2), run(5));
});
test('different seeds change identity while equal seeds and reset repeat exactly', () => {
  const a = createOwl({ seed: 7 }), b = createOwl({ seed: 89 });
  assert.notEqual(a.getState().phaseOffset, b.getState().phaseOffset);
  a.advance(1); const first = a.getState(); a.reset(); a.advance(1); assert.deepEqual(a.getState(), first);
  assert.equal(b.getState().tick, 0);
});
test('ordered reaction completes once, repeated triggers are ignored through recovery/cooldown', () => {
  const owl = createOwl(); const phases = []; let accepted = 0, ignored = 0;
  for (let tick = 1; tick <= 290; tick++) {
    const r = owl.advance(tick, [event(tick, tick - 1, 'react')]);
    accepted += r.acceptedReactions; ignored += r.ignoredReactions;
    const b = r.state.behavior, name = b.kind === 'response' ? b.phase : b.kind;
    if (phases.at(-1) !== name) phases.push(name);
  }
  assert.deepEqual(phases.slice(0, 6), ['blink', 'ruffle', 'stretch', 'recovery', 'cooldown', 'blink']);
  assert.equal(accepted, 2); assert.equal(accepted + ignored, 290);
});
test('response timings and local wing envelopes meet the declared seam', () => {
  const owl = createOwl({ idleAmplitude: 0 }); let last;
  const states = new Map();
  for (let tick = 1; tick <= 284; tick++) {
    last = owl.advance(tick, tick === 1 ? [event(1, 0, 'react')] : []).state; states.set(tick, last);
    for (const key of ['blink', 'ruffle', 'leftWing', 'rightWing']) assert.ok(last[key] >= 0 && last[key] <= 1);
  }
  assert.equal(states.get(18).behavior.phase, 'blink'); assert.equal(states.get(19).behavior.phase, 'ruffle');
  assert.equal(states.get(55).behavior.phase, 'stretch'); assert.equal(states.get(115).behavior.kind, 'recovery');
  assert.equal(states.get(163).behavior.kind, 'cooldown'); assert.equal(states.get(283).behavior.kind, 'idle');
  assert.equal(states.get(162).leftWing, 0); assert.equal(states.get(162).rightWing, 0);
  assert.notEqual(states.get(78).leftWing, states.get(78).rightWing);
  assert.equal(last.headYawDeg, 0); assert.equal(last.headPitchDeg, 0);
});
test('attention clamps normalized input, head limits hold, and root/feet remain perched', () => {
  const owl = createOwl({ headYawLimitDeg: 45, headPitchLimitDeg: 20 });
  const anchors = owl.sample().landmarks;
  for (let tick = 1; tick <= 900; tick++) {
    const s = owl.advance(tick, [event(tick, tick, 'attention', { x: tick < 450 ? 1e9 : -1e9, y: 5 })]).state;
    assert.ok(Math.abs(s.headYawDeg) <= 45); assert.ok(Math.abs(s.headPitchDeg) <= 20);
    if (tick % 45 === 0) {
      const g = owl.sample(); assert.deepEqual(g.landmarks.root, anchors.root);
      assert.deepEqual(g.landmarks.footLeft, anchors.footLeft); assert.deepEqual(g.landmarks.footRight, anchors.footRight);
    }
  }
  assert.equal(owl.getState().attention.x, -1);
});
test('every malformed batch rejects atomically, including invalid tail after valid first event', () => {
  const owl = createOwl(), before = owl.getState();
  const bad = [null, {}, Array(17).fill(event(1, 0, 'react')), [event(0, 0, 'react')], [event(1, 0, 'unknown')],
    [event(1, 0, 'attention', { x: NaN, y: 0 })], [event(1, 0, 'attention', { x: Infinity, y: 0 })],
    [event(1, 0, 'attention', { x: '1', y: 0 })], [event(1, -.5, 'react')], [event(1, 0, 'react', { typo: true })],
    [event(1, 1, 'react'), event(1, 1, 'leave')], [event(1, 0, 'react'), event(1, 1, 'attention', { x: 0, y: NaN })]];
  for (const batch of bad) { assert.throws(() => owl.advance(1, batch)); assert.equal(owl.getState(), before); }
  for (const tick of [0, 2, -.5, NaN, Infinity, '1']) { assert.throws(() => owl.advance(tick)); assert.equal(owl.getState(), before); }
  owl.advance(1, [event(1, 4, 'leave')]);
  assert.throws(() => owl.advance(2, [event(2, 3, 'react')]), /sequence/);
});
test('last attention/leave in a tick wins and only one same-tick reaction starts', () => {
  const owl = createOwl();
  const r = owl.advance(1, [event(1, 0, 'attention', { x: .6, y: .1 }), event(1, 1, 'leave'), event(1, 2, 'react'), event(1, 3, 'react')]);
  assert.equal(r.state.attention.active, false); assert.equal(r.acceptedReactions, 1); assert.equal(r.ignoredReactions, 1);
});
test('options validate all boundaries and unknown keys without coercion or allocation changes', () => {
  for (const options of [null, [], { seed: -1 }, { seed: 1.2 }, { seed: 2 ** 32 }, { seed: '7' },
    { headYawLimitDeg: 46 }, { headPitchLimitDeg: Infinity }, { attentionSmoothing: NaN }, { attentionSmoothing: 0 },
    { blinkTicks: 11 }, { cooldownTicks: 601 }, { schemaVersion: 2 }, { featherContrast: 1.1 }, { typo: 1 }, { seed: undefined }]) {
    assert.throws(() => createOwl(options));
  }
  const owl = createOwl(); assert.deepEqual(owl.getOptions(), OWL_DEFAULTS);
  const before = owl.getState(); assert.throws(() => owl.update({ seed: 9 })); assert.throws(() => owl.update({ headYawLimitDeg: 8, cooldownTicks: 0 }));
  assert.equal(owl.getState(), before);
});
test('public option resolver has no externally injectable unvalidated base', () => {
  // JS permits extra arguments; the removed second parameter is ignored entirely.
  const config = resolveOwlOptions({}, { ...OWL_DEFAULTS, schemaVersion: 2, seed: -1, headYawLimitDeg: 999 });
  assert.deepEqual(config, OWL_DEFAULTS);
  assert.throws(() => resolveOwlOptions({ seed: -1 }));
});
test('update preserves tick, sequence, cycle and seed; reset is explicit; snapshots are deeply immutable', () => {
  const owl = createOwl(); owl.advance(1, [event(1, 0, 'react')]);
  const cycle = owl.getState().cycle; owl.update({ reactionStrength: .2, blinkTicks: 24 });
  assert.deepEqual(owl.getState().cycle, cycle); assert.equal(owl.getState().tick, 1); assert.equal(owl.getState().lastSequence, 0);
  assert.throws(() => { owl.getState().attention.x = .8; }); assert.throws(() => { owl.getOptions().seed = 9; });
  assert.throws(() => owl.reset(NaN)); assert.equal(owl.getState().tick, 1);
  owl.reset(13); assert.equal(owl.getState().tick, 0); assert.equal(owl.getState().lastSequence, -1); assert.equal(owl.getOptions().seed, 13);
  assert.equal(owl.getOptions().blinkTicks, 24);
});
test('static posters are deliberate complete poses and never advance core state', () => {
  const owl = createOwl(), before = owl.getState();
  const react = makeOwlPoster(before, { kind: 'react' });
  assert.ok(react.leftWing > .5); assert.equal(react.tick, 0); assert.equal(owl.getState(), before);
  const left = makeOwlPoster(before, { kind: 'attention', x: -2, y: 1 });
  assert.equal(left.headYawDeg, -34); assert.equal(left.headPitchDeg, 12);
  assert.throws(() => makeOwlPoster(before, { kind: 'attention', x: NaN, y: 1 }));
  assert.equal(makeOwlPoster(react, { kind: 'rest' }).leftWing, 0);
});
test('CSS pointer normalization ignores backing/DPR, rejects nonfinite rects and handles zero size', () => {
  const rect = { left: 40, top: 80, width: 300, height: 200 };
  assert.deepEqual(normalizeOwlPointer(190, 180, rect), { x: 0, y: 0 });
  assert.deepEqual(normalizeOwlPointer(-5, 1000, rect), { x: -1, y: 1 });
  assert.equal(normalizeOwlPointer(1, 1, { ...rect, width: 0 }), null);
  assert.throws(() => normalizeOwlPointer(NaN, 1, rect));
  assert.throws(() => normalizeOwlPointer(1, 1, { ...rect, height: Infinity }));
});
test('disposal is idempotent, all mutations/snapshots reject, and another instance continues', () => {
  const a = createOwl(), b = createOwl(); a.dispose(); a.dispose(); assert.equal(a.disposed, true);
  for (const call of [() => a.advance(1), () => a.reset(), () => a.update({}), () => a.getState(), () => a.getOptions(), () => a.sample()]) assert.throws(call, /disposed/);
  assert.equal(b.advance(1).state.tick, 1); assert.equal(b.disposed, false);
});
