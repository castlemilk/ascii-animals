import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { CuttlefishArtwork } from '../src/animals/cuttlefish.js';
import { createCuttlefishStudy, CuttlefishStudyArtwork } from '../src/animals/cuttlefish-study.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';

// These checks use the real model/projection/cell rasterizer with a simulated
// DOM and Canvas command sink. They are not browser screenshots or FPS evidence.
// The concealment oracle is deliberately independent of the adapter's suffix
// count: execute the reviewed renderer with just its two arm loop limits set to
// eight in test memory. No candidate method or stored expected geometry is used.
const canonicalURL = new URL('../src/animals/cuttlefish.js', import.meta.url);
const canonicalSource = readFileSync(canonicalURL, 'utf8');
const sourceSHA256 = createHash('sha256').update(canonicalSource).digest('hex');
const supportedSources = new Map([
  ['c09382ee6847bdfc269d4b55bf44e24e92d7dd46fe53be7e46b34f6891c6b94f', 'public b8f222dab868821f27bf2a64a98434f3483fc8e6'],
  ['de98d21f593751cdd69e66b2425ff72c064508e9af1d856fb434dd60099d569d', 'reviewed V7.1 tree 7bf307ddaee15040f883262d2b3dd4907e5eb79e'],
  ['1db187baef39a9f32183ba149d1e284aecd8390cb7258cf63c2b3658e874db15', 'V7.1 with reviewed classic encounter framing only; arm-loop seam unchanged']
]);
const armsStart = canonicalSource.indexOf('\n    _arms(t) {');
const armsEnd = canonicalSource.indexOf('\n    _beak(t) {', armsStart);
assert(armsStart >= 0 && armsEnd > armsStart, 'The pinned arm method boundaries must be present.');
const originalArms = canonicalSource.slice(armsStart, armsEnd);
const armLoop = 'for (let k = 0; k < 10; k++)';
assert.equal(originalArms.split(armLoop).length - 1, 2, 'Review a changed arm-loop topology before updating this oracle.');
const eightArmSource = (canonicalSource.slice(0, armsStart)
  + originalArms.replaceAll(armLoop, 'for (let k = 0; k < 8; k++)')
  + canonicalSource.slice(armsEnd))
  .replace(/from (['"])(\.[^'"]+)\1/g, (_whole, quote, specifier) =>
    `from ${quote}${new URL(specifier, canonicalURL).href}${quote}`);
const { CuttlefishArtwork: EightArmReference } = await import(
  `data:text/javascript;base64,${Buffer.from(eightArmSource).toString('base64')}`);

const artworkOptions = {
  scene: 'reactive', species: 'cuttlefish', count: 1, behaviors: ['hover'],
  formation: 'independent', autoStart: false, paused: false, seed: 17019,
  speed: 1, ripple: 1.3, size: .86, sizeVariation: 0, density: .8,
  glow: false, maxCells: 8192
};
const studyOptions = { automatic: false, habitat: false, restrainedSkin: false, concealFeedingTentacles: true };

function mount(study = {}, artwork = {}, host = fakeBrowser(), size = [640, 460]) {
  const canvas = host.canvas(...size);
  const art = createCuttlefishStudy(canvas, { ...studyOptions, ...study }, { ...artworkOptions, ...artwork });
  return { host, canvas, art };
}
function cells(art) {
  const hash = createHash('sha256');
  // The canonical renderer intentionally leaves glyph/material bytes in empty
  // cells. They are never drawn. Canonicalize only these unowned storage slots;
  // every visible cell channel, depth and ownership remains compared exactly.
  const glyphs = art.glyphs.slice(), kinds = art.kinds.slice();
  for (let i = 0; i < art.owners.length; i++) if (art.owners[i] < 0) glyphs[i] = kinds[i] = 0;
  for (const buffer of [art.depth, art.tones, glyphs, kinds, art.owners, art.visibility])
    hash.update(Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength));
  return hash.digest('hex');
}
function logical(art) {
  return structuredClone({ study: art.getStudy(), time: art.time, elapsed: art.elapsed,
    pointer: art.pointer, ink: art.ink,
    fish: art.fish.map(f => ({ id: f.id, species: f.species, reaction: f.reaction,
      position: [f.worldX, f.worldY, f.worldZ],
      rotation: [f.r00, f.r01, f.r02, f.r10, f.r11, f.r12, f.r20, f.r21, f.r22],
      phase: f.phase, progress: f.progress })) });
}
function prepareArms(art, pose) {
  // Raw model samples should be independent of camera choice and study pose.
  // Give both implementations exactly the same local lighting and pose inputs.
  Object.assign(art, { time: pose.time, geometryStep: pose.lod,
    encounterGrip: pose.grip, startleTension: pose.tension, escapeAmount: pose.escape,
    lx: -.38, ly: -.48, lz: .790, hx: -.204, hy: -.258, hz: .944,
    vx: 0, vy: 0, vz: 1, depthAmount: 1.2 });
  art.options.ripple = 1.3;
}
function referenceSamples(art, pose) {
  prepareArms(art, pose);
  const previous = art._put, hadOwn = Object.hasOwn(art, '_put'), samples = [];
  art._put = (...sample) => samples.push(sample);
  try { art._arms(pose.time); }
  finally { if (hadOwn) art._put = previous; else delete art._put; }
  return samples;
}
function studySamples(art, pose) {
  prepareArms(art, pose);
  // Intercept only the canonical projection boundary. Intercepting the study's
  // own _put would bypass its raw-sample capture and fail to test concealment.
  const previous = CuttlefishArtwork.prototype._put, samples = [];
  CuttlefishArtwork.prototype._put = function (...sample) {
    if (this === art) samples.push(sample);
    else previous.apply(this, sample);
  };
  try { art._arms(pose.time); }
  finally { CuttlefishArtwork.prototype._put = previous; }
  return samples;
}
function equalSamples(actual, expected, description) {
  assert.equal(actual.length, expected.length, `${description}: emitted sample count`);
  for (let index = 0; index < expected.length; index++)
    assert.deepEqual(actual[index], expected[index], `${description}: raw sample ${index}`);
}

test('the study is an additive SSR-safe subclass on an exact reviewed renderer', t => {
  assert.equal(typeof globalThis.window, 'undefined');
  assert.equal(typeof globalThis.document, 'undefined');
  assert(supportedSources.has(sourceSHA256), 'Re-review the private adapter seam on a changed canonical source.');
  assert.equal(Object.getPrototypeOf(CuttlefishStudyArtwork.prototype), CuttlefishArtwork.prototype);
  t.diagnostic(JSON.stringify({ canonicalSource: supportedSources.get(sourceSHA256), sourceSHA256,
    oracle: 'exact canonical module; only two arm loop limits 10 to 8 changed in test memory', browserTested: false }));
});

test('concealment emits every inherited primary-arm sample exactly at all LODs and grip branches', t => {
  const host = fakeBrowser(), canvas = host.canvas(900, 620);
  const full = new CuttlefishArtwork(canvas, artworkOptions);
  const primary = new EightArmReference(host.canvas(900, 620), artworkOptions);
  const { art } = mount({}, {}, host, [900, 620]);
  let cases = 0, primarySamples = 0, feedingSamples = 0;
  const phases = [
    { time: 0, tension: 0, escape: 0 },
    { time: 2.4, tension: .65, escape: 0 },
    { time: 6.8, tension: .10, escape: .72 }
  ];
  try {
    for (const lod of [1, 2, 3]) for (const grip of [0, .5, 1]) for (const phase of phases) {
      const pose = { lod, grip, ...phase }, label = JSON.stringify(pose);
      const expected = referenceSamples(primary, pose), all = referenceSamples(full, pose);
      assert(expected.length > 500 && all.length > expected.length, `${label}: eight primaries and two feeding streams exist`);
      equalSamples(all.slice(0, expected.length), expected, `${label}: inherited primary-prefix order`);
      equalSamples(studySamples(art, pose), expected, `${label}: concealed output`);
      assert(expected.every(sample => sample.length === 6 && sample.every(Number.isFinite)));
      primarySamples += expected.length; feedingSamples += all.length - expected.length; cases++;
    }
    // Requested grip alone does not choose the branch: escape reduces it first.
    const thresholdPose = { lod: 2, grip: .0015, time: 4.1, tension: .3, escape: .8 };
    equalSamples(studySamples(art, thresholdPose), referenceSamples(primary, thresholdPose), 'effective-grip threshold');
    t.diagnostic(JSON.stringify({ cases: cases + 1, primarySamples, feedingSamples,
      preserved: 'raw positions, lighting, material and seeds of all eight primary arms',
      excluded: 'two final feeding-tentacle draw streams; no retraction animation claimed' }));
  } finally { full.destroy(); primary.destroy(); art.destroy(); }
});

test('disabling concealment reproduces the complete inherited arm stream', () => {
  const host = fakeBrowser(), full = new CuttlefishArtwork(host.canvas(640, 460), artworkOptions);
  const { art } = mount({ concealFeedingTentacles: false }, {}, host);
  try {
    for (const lod of [1, 2, 3]) for (const grip of [0, .5, 1]) {
      const pose = { lod, grip, time: 3.7, tension: .4, escape: .22 };
      equalSamples(studySamples(art, pose), referenceSamples(full, pose), JSON.stringify(pose));
    }
  } finally { full.destroy(); art.destroy(); }
});

test('an unexpected arm emission topology is rejected or shown in full, never silently cropped', () => {
  const { art } = mount();
  const original = CuttlefishArtwork.prototype._arms;
  const sentinel = [30, 31, 32, .5, 0, 987654];
  const pose = { lod: 2, grip: 0, time: 3.7, tension: .4, escape: .22 };
  const full = new CuttlefishArtwork(fakeBrowser().canvas(), artworkOptions);
  try {
    const expected = [...referenceSamples(full, pose), sentinel];
    CuttlefishArtwork.prototype._arms = function (time) { original.call(this, time); this._put(...sentinel); };
    let actual, rejected = false;
    try { actual = studySamples(art, pose); } catch (error) { assert(error instanceof Error); rejected = true; }
    if (!rejected) equalSamples(actual, expected, 'unknown topology fallback');
  } finally { CuttlefishArtwork.prototype._arms = original; art.destroy(); full.destroy(); }
});

test('seeded normalized events give identical states and cells for 1/2/5/6-tick render groups', t => {
  const events = new Map([
    [0, { type: 'investigate', x: .22, y: -.12 }],
    [420, { type: 'turn', x: -.24, y: .04 }],
    [732, { type: 'retreat', x: .28, y: -.07 }],
    [1400, { type: 'release' }]
  ]);
  const checkpoints = [60, 240, 414, 480, 660, 726, 780, 822, 858, 942, 1200, 1362, 1440];
  function replay(group) {
    const { art } = mount();
    const records = []; let tick = 0;
    try {
      for (const checkpoint of checkpoints) {
        while (tick < checkpoint) {
          if (events.has(tick)) assert.equal(art.cueStudy(events.get(tick)), true, `accepted event at tick ${tick}`);
          const nextEvent = [...events.keys()].find(eventTick => eventTick > tick) ?? Infinity;
          const step = Math.min(group, checkpoint - tick, nextEvent - tick);
          art.advance(step / 60); tick += step;
        }
        records.push({ tick, state: logical(art), cells: cells(art) });
      }
      return records;
    } finally { art.destroy(); }
  }
  const reference = replay(1);
  for (const group of [2, 5, 6]) assert.deepEqual(replay(group), reference, `group ${group}`);
  assert(new Set(reference.map(record => record.cells)).size > 5, 'authored phases must change visible cells');
  assert(reference.some(record => record.state.ink.length > 0), 'replay includes an actual emitted plume');
  t.diagnostic(JSON.stringify({ groups: [1, 2, 5, 6], ticks: checkpoints,
    statesAndCells: 'exact same-runtime equality', pixelsCompared: false }));
});

test('draw calls cannot advance study time, event state or the composed cell frame', () => {
  const { art } = mount({ habitat: true, restrainedSkin: true });
  try {
    art.cueStudy({ type: 'investigate', x: .2, y: -.1 });
    for (let i = 0; i < 80; i++) art.advance(1 / 60);
    const before = logical(art), frame = cells(art);
    for (let i = 0; i < 8; i++) art.render();
    assert.deepEqual(logical(art), before); assert.equal(cells(art), frame);
  } finally { art.destroy(); }
});

test('reduced-motion input, restart and stills preserve pause without scheduling animation', () => {
  const host = fakeBrowser({ reducedMotion: true }), canvas = host.canvas(390, 520);
  const { paused: _paused, ...options } = artworkOptions;
  const art = createCuttlefishStudy(canvas, { ...studyOptions, habitat: true }, { ...options, autoStart: true });
  try {
    assert.equal(art.paused, true); assert.equal(host.pending, 0);
    const clock = art.time;
    canvas.emit('pointermove', { clientX: 110, clientY: 120, pointerType: 'mouse' });
    host.frame(1000);
    assert.equal(art.time, clock, 'pointer hover cannot move a reduced-motion poster');
    canvas.emit('pointerdown', { clientX: 130, clientY: 125, pointerType: 'touch' });
    const tappedTime = art.time;
    canvas.emit('pointercancel'); canvas.emit('pointerleave');
    art.pulse(); host.frame(1000);
    assert.equal(art.time, tappedTime, 'a deliberate touch may seek a still but must not start a clock');
    assert.equal(art.paused, true); assert.equal(host.pending, 0);
    art.cueStudy({ type: 'investigate', x: .1, y: -.1 });
    assert.equal(art.paused, true); assert.equal(host.pending, 0);
    art.showStudyStill('turn', 1.2);
    assert.equal(art.paused, true); assert.equal(host.pending, 0);
    const still = cells(art), stillTime = art.time;
    host.frame(1000); art.render();
    assert.equal(cells(art), still); assert.equal(art.time, stillTime);
    art.restart(); art.setOptions({ density: .9 }); host.setReduced(false);
    assert.equal(art.paused, true); assert.equal(host.pending, 0);
  } finally { art.destroy(); }
  assert.equal(host.pending, 0);
  assert.equal(canvas.listenerCount + host.document.listenerCount + host.view.listenerCount + host.motion.listenerCount, 0);
});

test('hidden, offscreen and zero-size causes do not override the user pause state', () => {
  const { art, host, canvas } = mount({}, { autoStart: true });
  try {
    assert.equal(host.pending, 1);
    host.frame(); host.frame();
    host.hide(true); assert.equal(host.pending, 0);
    const hiddenTime = art.time; host.frame(1000); assert.equal(art.time, hiddenTime);
    art.setPaused(true); host.hide(false); assert.equal(host.pending, 0);
    art.setPaused(false); host.intersect(canvas, false); assert.equal(host.pending, 0);
    art.setPaused(true); host.intersect(canvas, true); assert.equal(host.pending, 0);
    canvas.rect.width = 0; art.resize(); assert.equal(host.pending, 0); assert.equal(art.depth.length, 0);
    assert.doesNotThrow(() => art.showStudyStill('investigate', 2), 'a zero-size still must not project an invalid viewport');
    assert.equal(host.pending, 0);
    canvas.rect.width = 390; canvas.rect.height = 520; art.resize();
    assert.equal(art.paused, true); assert.equal(host.pending, 0);
    assert(art.getStats().glyphs > 0, 'resize composes a meaningful static frame');
  } finally { art.destroy(); }
});

test('manual advancement remains bounded, explicit and independent of playback pause', () => {
  const { art } = mount({}, { paused: true });
  try {
    const time = art.time; art.advance(1 / 60); assert(art.time > time); assert.equal(art.paused, true);
    for (const bad of [-1, .101, NaN, Infinity]) assert.throws(() => art.advance(bad), RangeError);
    art.setOptions({ autoStart: true }); assert.throws(() => art.advance(1 / 60), /autoStart/);
  } finally { art.destroy(); }
});

test('invalid explicit still targets leave playback, state and cells untouched', () => {
  const { art } = mount();
  try {
    art.cueStudy({ type: 'turn' }); art.advance(.1);
    for (const point of [{ x: NaN, y: 0 }, { x: 0, y: Infinity }, { x: .51, y: 0 }, { x: 0, y: -.51 }, { x: 0, y: 0, surprise: true }]) {
      const state = logical(art), frame = cells(art), paused = art.paused;
      try { assert.equal(art.showStudyStill('investigate', 3.2, point), false, 'a rejected target must report failure'); }
      catch (error) { if (error instanceof assert.AssertionError) throw error; assert(error instanceof TypeError || error instanceof RangeError); }
      assert.deepEqual(logical(art), state); assert.equal(cells(art), frame); assert.equal(art.paused, paused);
    }
  } finally { art.destroy(); }
});

test('multiple instances remain independent and destruction removes every owned resource', () => {
  const host = fakeBrowser(), first = mount({}, { autoStart: true }, host), second = mount({}, { autoStart: true }, host);
  const before = logical(second.art), callbacks = [first.art._move, first.art._touch, first.art._leave];
  first.art.cueStudy({ type: 'pointer', x: .21, y: -.1 });
  first.art.cueStudy({ type: 'investigate', x: .21, y: -.1 });
  assert.deepEqual(logical(second.art), before);
  first.art.destroy(); first.art.destroy();
  assert.equal(first.canvas.listenerCount, 0); assert.equal(host.pending, 1);
  assert.equal(second.art.destroyed, false);
  const after = first.art.getStudy();
  for (const callback of callbacks) callback({ clientX: 120, clientY: 130, pointerType: 'touch' });
  first.art.cueStudy({ type: 'turn' }); first.art.pulse(); first.art.restart(); first.art.render();
  assert.deepEqual(first.art.getStudy(), after);
  second.art.destroy();
  assert.equal(second.canvas.listenerCount, 0); assert.equal(host.pending, 0);
  assert.equal(host.document.listenerCount + host.view.listenerCount + host.motion.listenerCount, 0);
  assert.equal(host.resizes.size + host.intersections.size, 0);
});

test('desktop and phone frames stay finite at the existing maximum population and cell budget', () => {
  for (const size of [[900, 620], [390, 520]]) {
    const { art } = mount({ habitat: true, restrainedSkin: true }, { count: 12, maxCells: 8192 }, fakeBrowser(), size);
    try {
      art.advance(.1);
      assert.equal(art.fish.length, 12); assert(art.fish.every(f => f.species === 'cuttlefish'));
      assert(art.getStats().glyphs > 0); assert(art.depth.length <= 8192);
      assert(art.sampleCount <= art.samples.length / 6);
      assert(art.fish.every(f => [f.worldX, f.worldY, f.worldZ, f.r00, f.r10, f.r20].every(Number.isFinite)));
      assert([...art.depth].every(value => value === -Infinity || Number.isFinite(value)));
    } finally { art.destroy(); }
  }
});
