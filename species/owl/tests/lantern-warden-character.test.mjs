// Executed logical grids, not browser screenshots or performance measurements.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createOwl } from '../build/owl.js';
import { createOwlDirector as createOriginalDirector } from '../build/director.js';
import { renderOwlGrid as renderOriginal } from '../build/preview.js';
import { renderOwlDirectorGrid as composeOriginal } from '../build/composition.js';
import { createOwlDirector, makeOwlDirectorPoster } from '../build/variants/lantern-warden/director.js';
import { renderOwlGrid } from '../build/variants/lantern-warden/preview.js';
import { renderOwlDirectorGrid } from '../build/variants/lantern-warden/composition.js';
import { owlInkRuns } from '../build/variants/lantern-warden/palette.js';

const phone = { cols: 64, rows: 36 };
const hash = text => createHash('sha256').update(text).digest('hex');
const visible = grid => grid.text.replace(/\s/g, '').length;
// Captured independently before the additive port: Original at 3b5ffcce7bea;
// authored proposal from Library ZIP SHA-256 7c3ec8c4388717861353c7b386e8639468d336273a743b68ff267af56da72eb6.
const fixtures = [
  { name: 'Original', create: createOriginalDirector, render: renderOriginal, compose: composeOriginal,
    neutral: ['d906c86c58b1055d647ee2e0c5ffbf37a2008ddfe67ebdf9259c4e794c792d8d', 'ca4b62d4c6e52deee1e30f1957a055b7c034395429223b2062300d1a8e665ccb'],
    rustle: '7aac5ffb82cf8dc366da410d1f1c673c75a1a84ceccd08a6ae1ebe79fcd1b5f5',
    flight: '305485428142bc56e4d802df1f70d63feabe1e9f5b518acf31461145557a94ed',
    duet: 'fadcc12b41a36931b5d5d2ff3439e6dc44d4b4ee1fbda1049babff58d9004b01' },
  { name: 'Lantern Warden', create: createOwlDirector, render: renderOwlGrid, compose: renderOwlDirectorGrid,
    neutral: ['b5024cf5b9242929a05266ca42916438eff3482ba3d397071728d7fc512beec0', '699ea1a8e3513e925061f6c8e3cc1cd67aa9f476611918f65ef72845fa602869'],
    rustle: 'a9fe1af937225822fea7132feb298804f62dcb6441806afa4bc8c452a8ba814c',
    flight: '0b2c0388dcad4a5dee62a0dd2d0aa5e6b97ada77051ee8d5f4aef0bfc6f92468',
    duet: '54bb880ed9bb85834755be77f37e1d1da13d46444cd4ad00c9769cccaa05ccd3' },
];

for (const fixture of fixtures) test(`${fixture.name} retains its independently captured art and cue replay`, () => {
  const owl = createOwl({ seed: 7 });
  for (const [i, options] of [phone, { cols: 96, rows: 54 }].entries())
    assert.equal(hash(fixture.render(owl.getState(), options).text), fixture.neutral[i]);
  owl.dispose();
  for (const cue of [{ kind: 'rustle', x: -.85, y: -.3 }, { kind: 'flight', x: .85, y: -.6 }]) {
    const director = fixture.create({ count: 1, autonomous: false, alertness: 1 }, { seed: 7 });
    const frames = [];
    for (let tick = 1; tick <= 361; tick++) {
      const state = director.advance(tick, tick === 1 ? [{ tick, seq: 0, type: 'cue', cue }] : []).state;
      if (tick % 12 === 1) frames.push(fixture.render(state.actors[0].pose, phone).text);
    }
    assert.equal(hash(frames.join('\n\n')), fixture[cue.kind]);
    director.dispose();
  }
  const duet = fixture.create({ count: 2, autonomous: false }, { seed: 7 });
  assert.equal(hash(fixture.compose(duet.getState(), { cols: 80, rows: 90 }).text), fixture.duet);
  duet.dispose();
});

function performance(kind, x, y, repeat = false) {
  const director = createOwlDirector({ count: 1, autonomous: false, alertness: 1 });
  const poses = [];
  for (let tick = 1; tick <= 361; tick++) {
    const inputs = tick === 1 ? [{ tick, seq: 0, type: 'cue', cue: { kind, x, y } }]
      : repeat && tick === 100 ? [{ tick, seq: 1, type: 'cue', cue: { kind, x: -x, y: -y } }] : [];
    const result = director.advance(tick, inputs);
    if (repeat && tick === 100) assert.equal(result.ignoredCues, 1);
    poses.push(result.state.actors[0].pose);
  }
  director.dispose();
  return poses;
}

test('private character keeps phone anchors and semantic negative space with a visible contrast option', () => {
  const owl = createOwl(), grid = renderOwlGrid(owl.getState(), phone);
  const silhouette = renderOwlGrid(owl.getState(), { ...phone, silhouette: true });
  assert.equal(visible(grid), 343);
  assert.notEqual(grid.text, renderOriginal(owl.getState(), phone).text);
  assert.equal(visible(silhouette), grid.occupied);
  assert.deepEqual(silhouette.samples, grid.samples);
  assert.deepEqual(silhouette.parts, grid.parts);
  assert.equal(owlInkRuns(grid).map(run => run.text).join(''), grid.text);
  for (const headYawDeg of [-45, 0, 45]) for (const headPitchDeg of [-20, 0, 20]) {
    const turned = renderOwlGrid({ ...owl.getState(), headYawDeg, headPitchDeg }, phone);
    const cells = turned.text.replaceAll('\n', '');
    for (const side of ['left', 'right']) assert(turned.samples.some((sample, i) =>
      sample?.part === `pupil-${side}` && sample.material === 'highlight' && cells[i] === '@'));
  }
  const soft = createOwl({ featherContrast: 0 }), bold = createOwl({ featherContrast: 1 });
  const a = renderOwlGrid(soft.getState(), phone), b = renderOwlGrid(bold.getState(), phone);
  const before = a.text.replaceAll('\n', ''), after = b.text.replaceAll('\n', '');
  const changed = [...before].flatMap((char, i) => char !== after[i] ? [i] : []);
  assert(changed.length >= 5 && changed.length <= 20);
  for (const i of changed) assert.equal(a.parts[i], 'body');
  assert.deepEqual(a.parts, b.parts);
  for (const instance of [owl, soft, bold]) instance.dispose();
});

test('aim changes travel and height after a planted anticipation and before a settled return', () => {
  const near = performance('flight', .2, -.8), far = performance('flight', .8, -.8);
  const low = performance('flight', .8, .8);
  const max = (poses, key) => Math.max(...poses.map(pose => pose.presentation[key]));
  assert(max(far, 'travel') > max(near, 'travel') + .25);
  assert(max(far, 'lift') > max(low, 'lift') + .15);
  for (const poses of [near, far, low]) {
    assert(poses[26].presentation.crouch > 0 && poses[26].presentation.airborne === 0);
    assert(poses[90].presentation.airborne > .9);
    assert(poses[228].presentation.feetReach > .9);
    assert(poses[280].presentation.crouch > 0);
    assert(Object.values(poses[340].presentation).every(value => value === 0));
  }
  assert.notEqual(renderOwlGrid(near[152], phone).text, renderOwlGrid(far[152], phone).text);
  assert.notEqual(renderOwlGrid(far[152], phone).text, renderOwlGrid(low[152], phone).text);
});

test('centre hop is symmetric and rejected flight cues cannot redirect a committed excursion', () => {
  const centre = performance('flight', 0, -.4), left = performance('flight', -.8, -.4);
  const right = performance('flight', .8, -.4), repeated = performance('flight', .8, -.4, true);
  const infinitesimal = performance('flight', .00001, -.4);
  for (let i = 0; i < centre.length; i++) {
    assert.equal(centre[i].presentation.travel, 0);
    assert.equal(Math.abs(centre[i].presentation.bankDeg), 0);
    assert.equal(Math.abs(centre[i].presentation.headRollDeg), 0);
    assert.equal(centre[i].leftWing, centre[i].rightWing);
    assert(Math.abs(left[i].presentation.travel + right[i].presentation.travel) < 1e-12);
    assert(Math.abs(left[i].leftWing - right[i].rightWing) < 1e-12);
    assert(Math.abs(infinitesimal[i].presentation.bankDeg) < .001);
    assert.deepEqual(repeated[i].presentation, right[i].presentation);
  }
});

test('minimum frame retains both eyes and clear edges at every extreme flight aim', () => {
  for (const x of [-1, 1]) for (const y of [-1, 1]) {
    const poses = performance('flight', x, y);
    for (let i = 0; i < poses.length; i += 12) {
      const grid = renderOwlGrid(poses[i], phone), lines = grid.text.split('\n');
      assert.equal(lines[0].trim(), ''); assert.equal(lines.at(-1).trim(), '');
      assert(lines.every(line => line[0] === ' ' && line.at(-1) === ' '));
      const cells = grid.text.replaceAll('\n', '');
      for (const side of ['left', 'right']) assert(grid.samples.some((sample, index) =>
        sample?.part === `pupil-${side}` && sample.material === 'highlight' && cells[index] === '@'));
      for (const part of ['head', 'face', 'body', 'beak', 'perch']) assert(grid.parts.includes(part));
    }
  }
});

test('listen counter-cants before its directional hold and settles with planted feet', () => {
  const right = performance('rustle', 1, -.4), left = performance('rustle', -1, -.4);
  assert(right[12].presentation.headRollDeg < -3.5 && right[12].presentation.headRollDeg > -4.5);
  assert(left[12].presentation.headRollDeg > 3.5 && left[12].presentation.headRollDeg < 4.5);
  assert(Math.abs(right[17].headYawDeg) < 1);
  assert(right[80].headYawDeg > 25 && left[80].headYawDeg < -25);
  assert.equal(right[60].presentation.headRollDeg, right[90].presentation.headRollDeg);
  assert(Math.abs(right[270].headYawDeg) < Math.abs(right[80].headYawDeg) * .1);
  for (const pose of [...right, ...left]) {
    assert.equal(pose.presentation.travel, 0);
    assert.equal(pose.presentation.lift, 0);
    assert.equal(pose.presentation.airborne, 0);
  }
});

test('render grouping does not change explicit-tick replay and stopped flight leaves simulation untouched', () => {
  const results = [];
  for (const group of [1, 2, 5]) {
    const director = createOwlDirector({ count: 1, autonomous: false }, { seed: 31 });
    for (let tick = 1; tick <= 361; tick++) {
      director.advance(tick, tick === 1 ? [{ tick, seq: 0, type: 'cue', cue: { kind: 'flight', x: -.7, y: .4 } }] : []);
      if (tick % group === 0) renderOwlDirectorGrid(director.getState(), phone);
    }
    const state = director.getState();
    const poster = makeOwlDirectorPoster(state, { kind: 'flight', x: 1, y: -1 });
    assert.equal(poster.actors[0].simulation, state.actors[0].simulation);
    for (const key of ['airborne', 'lift', 'travel']) assert.equal(poster.actors[0].pose.presentation[key], 0);
    assert(poster.actors[0].pose.leftWing > .5);
    results.push({ state, text: renderOwlDirectorGrid(state, phone).text });
    director.dispose();
  }
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2]);
});
