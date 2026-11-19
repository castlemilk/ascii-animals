import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { octopusDefinition } from '../../../src/animals/octopus.js';
import { CuttlefishArtwork, createMarineDirector } from '../../../src/animals/cuttlefish.js';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';

// These tests execute the canonical source, its real camera, chains, rasterizer,
// hit ownership and lifecycle against a simulated DOM/Canvas. They are not
// browser-pixel, touch-device, visual-recognition or performance acceptance.
const OPTIONS = Object.freeze({
  species: 'octopus', count: 1, scene: 'reactive', behaviors: ['hover'],
  size: 1.1, sizeVariation: 0, density: 1.2, followPointer: true,
  autoStart: false, glow: false, seed: 17, maxCells: 8192,
});
const SUPPORT = [0, 3, 7];
const PIN_TOLERANCE = 1e-6; // world units; authoring-record contact acceptance.

function mount(patch = {}, width = 900, height = 620, suppliedHost) {
  const host = suppliedHost || fakeBrowser();
  const canvas = host.canvas(width, height);
  const artwork = new CuttlefishArtwork(canvas, { ...OPTIONS, ...patch });
  return { host, canvas, artwork };
}

function advance(artwork, seconds, dt = .05) {
  const count = Math.ceil(seconds / dt);
  for (let i = 0; i < count; i++) artwork.advance(seconds / count);
}

function frameDigest(artwork) {
  const hash = createHash('sha256');
  const fields = [artwork.depth, artwork.tones, artwork.glyphs, artwork.kinds,
    artwork.owners, artwork.visibility, artwork.samples.subarray(0, artwork.sampleCount * 6)];
  for (const field of fields) hash.update(Buffer.from(field.buffer, field.byteOffset, field.byteLength));
  hash.update(JSON.stringify([artwork.sampleCount, artwork.getStats().reactionStage]));
  return hash.digest('hex');
}

function armDigest(state) {
  const hash = createHash('sha256');
  for (const chain of state.arms) hash.update(Buffer.from(chain.buffer, chain.byteOffset, chain.byteLength));
  return hash.digest('hex');
}

function worldPoint(fish, chain, point = 40) {
  const i = point * 3, x = (chain[i] - .30) * fish.size;
  const y = chain[i + 1] * fish.size, z = chain[i + 2] * fish.size;
  return [fish.worldX + x * fish.r00 + y * fish.r01 + z * fish.r02,
    fish.worldY + x * fish.r10 + y * fish.r11 + z * fish.r12,
    fish.worldZ + x * fish.r20 + y * fish.r21 + z * fish.r22];
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function assertChains(state) {
  assert.equal(state.arms.length, 8);
  assert.equal(state.lengths.length, 8);
  assert.equal(state.reachWeights.length, 8);
  assert(state.reachWeights.filter(value => value > 1e-8).length <= 2,
    'an invitation selects adjacent investigative arms, not all eight');
  for (let arm = 0; arm < 8; arm++) {
    const chain = state.arms[arm], length = state.lengths[arm] / 40;
    assert.equal(chain.length, 123);
    for (let axis = 0; axis < 3; axis++) assert.equal(chain[axis], state.roots[arm * 3 + axis]);
    let previous;
    for (let joint = 1; joint <= 40; joint++) {
      const vector = [0, 1, 2].map(axis => chain[joint * 3 + axis] - chain[(joint - 1) * 3 + axis]);
      assert(vector.every(Number.isFinite));
      assert(Math.abs(Math.hypot(...vector) - length) < 1e-12, `arm ${arm} link ${joint} stretches`);
      if (previous) {
        const cosine = vector.reduce((sum, value, axis) => sum + value * previous[axis], 0) / length ** 2;
        const angle = Math.acos(Math.max(-1, Math.min(1, cosine)));
        assert(angle <= .087 + 1e-10, `arm ${arm} joint ${joint} exceeds the existing bend limit`);
      }
      previous = vector;
    }
  }
}

function assertFiniteGeometry(artwork) {
  assert(artwork.sampleCount > 0 && artwork.sampleCount < 18000, 'species geometry has a bounded sample budget');
  assert(artwork.depth.length <= artwork.options.maxCells);
  for (const depth of artwork.depth) assert(depth === -Infinity || Number.isFinite(depth));
  for (const fish of artwork.fish) {
    assert([fish.worldX, fish.worldY, fish.worldZ, fish.r00, fish.r11, fish.r22].every(Number.isFinite));
    assertChains(fish.speciesState);
  }
}

function assertFiniteFrame(artwork) {
  assert(artwork.glyphCount > 20, 'the intended octopus must produce a nonempty tableau');
  assertFiniteGeometry(artwork);
}

function pointer(canvas, x, y, type = 'pointermove', pointerType = 'mouse') {
  canvas.emit(type, { clientX: canvas.rect.left + (x + .5) * canvas.rect.width,
    clientY: canvas.rect.top + (y + .5) * canvas.rect.height, pointerType });
}

test('exact octopus source remains SSR-safe and compatible with the existing classic bundler', () => {
  const sourceURL = new URL('../../../src/animals/octopus.js', import.meta.url);
  const output = execFileSync(process.execPath, ['--input-type=module', '-e',
    `const before = [typeof globalThis.window, typeof globalThis.document];
     const { octopusDefinition: d } = await import(${JSON.stringify(sourceURL.href)});
     console.log(JSON.stringify({ before, after: [typeof globalThis.window, typeof globalThis.document],
       id: d.id, frozen: Object.isFrozen(d), arms: d.create(.17).arms.length }));`], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(output), {
    before: ['undefined', 'undefined'], after: ['undefined', 'undefined'],
    id: 'octopus', frozen: true, arms: 8,
  });
  const source = readFileSync(sourceURL, 'utf8');
  const classic = source.replace(/^export (?=const )/gm, '');
  assert(!/^\s*(?:import|export)\s/m.test(classic), 'the shared generator accepts a self-contained species module');
  const sandbox = {};
  vm.runInNewContext(classic + '\nglobalThis.definition = octopusDefinition;', sandbox);
  assert.equal(sandbox.definition.id, octopusDefinition.id);
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.definition.create(.37))),
    JSON.parse(JSON.stringify(octopusDefinition.create(.37))));
});

test('den sampling remains finite, bounded and attached at desktop, portrait and coarse LOD', () => {
  for (const [width, height] of [[900, 620], [390, 640], [320, 240]]) {
    const { artwork: a } = mount({ size: 1.3, density: 1.45 }, width, height);
    const put = a._put;
    let observed = 0;
    a._put = function (x, y, z, light, kind = 0, seed = 0) {
      const b = octopusDefinition.bounds;
      assert([x, y, z, light, kind, seed].every(Number.isFinite));
      assert(x >= b.minX - 1e-9 && x <= b.maxX + 1e-9, 'local X escapes declared bounds');
      assert(Math.abs(y) <= b.maxY + 1e-9 && Math.abs(z) <= b.maxZ + 1e-9, 'local Y/Z escapes declared bounds');
      assert([0, 1, 2].includes(kind)); observed++;
      return put.call(this, x, y, z, light, kind, seed);
    };
    for (const patch of [{ ripple: .3, depthStrength: 0 }, { ripple: 2, depthStrength: 2 }, { density: .6, size: .35 }, { density: 1.5, size: 1.4 }]) {
      // The first version incorrectly applied a >20-glyph presence gate to
      // the optional .35/.6 extreme: baseline already gave 19 idle / 15 warning
      // glyphs at 320x240. That unsupported visual footprint is a geometry and
      // robustness case, not a passed readability claim. Intended size 1.3 /
      // density 1.45 mobile tableaux retain the original >20 presence gate.
      const check = patch.size === .35 ? assertFiniteGeometry : assertFiniteFrame;
      a.setOptions(patch); advance(a, .15); check(a);
      a.pulse(); advance(a, .4); check(a);
      a.restart();
    }
    assert(observed > 1000); a.destroy();
  }
});

test('rendering and resizing a fixed instant cannot advance investigation, chains, contacts or ink', () => {
  const { artwork: a, canvas } = mount();
  pointer(canvas, .16, .24); advance(a, 1.5);
  const frame = frameDigest(a), arms = armDigest(a.fish[0].speciesState);
  const state = JSON.stringify(a.fish[0].speciesState), time = a.time, elapsed = a.elapsed;
  for (let i = 0; i < 5; i++) { a.render(); a.resize(); }
  assert.equal(a.time, time); assert.equal(a.elapsed, elapsed);
  assert.equal(frameDigest(a), frame); assert.equal(armDigest(a.fish[0].speciesState), arms);
  assert.equal(JSON.stringify(a.fish[0].speciesState), state);
  a.pulse(); advance(a, .65);
  const ink = JSON.stringify(a.ink), reaction = JSON.stringify(a.fish[0].reaction), startled = frameDigest(a);
  for (let i = 0; i < 4; i++) a.render();
  assert.equal(JSON.stringify(a.ink), ink); assert.equal(JSON.stringify(a.fish[0].reaction), reaction);
  assert.equal(frameDigest(a), startled); a.destroy();
});

test('same seed and ordered pointer/reaction log replay exactly with extra presentation renders', () => {
  const one = mount(), two = mount();
  const a = one.artwork, b = two.artwork;
  assert.notEqual(a.fish[0].speciesState, b.fish[0].speciesState);
  for (let frame = 0; frame < 100; frame++) {
    for (const { artwork, canvas } of [one, two]) {
      if (frame === 5) pointer(canvas, .18, .20);
      if (frame === 27) canvas.emit('pointerleave');
      if (frame === 38) artwork.pulse();
      artwork.advance(.05);
    }
    if (frame % 3 === 0) { a.render(); a.render(); }
  }
  assert.equal(frameDigest(a), frameDigest(b));
  assert.equal(armDigest(a.fish[0].speciesState), armDigest(b.fish[0].speciesState));
  assert.deepEqual(a.ink, b.ink);
  assert.deepEqual(a.fish[0].speciesState, b.fish[0].speciesState);
  const isolated = frameDigest(b); a.restart(); assert.equal(frameDigest(b), isolated);
  a.destroy(); assert.equal(b.destroyed, false); b.destroy();
  const different = mount({ seed: 29 }), original = mount({ seed: 17 });
  advance(different.artwork, .3); advance(original.artwork, .3);
  assert.notEqual(armDigest(different.artwork.fish[0].speciesState), armDigest(original.artwork.fish[0].speciesState),
    'seeded identity must affect geometry, not merely metadata');
  different.artwork.destroy(); original.artwork.destroy();
});

test('an invitation notices first, unfolds selected arms, examines and releases on pointer cancellation', () => {
  const invited = mount(), quiet = mount();
  const a = invited.artwork, b = quiet.artwork;
  advance(a, .5); advance(b, .5);
  pointer(invited.canvas, .08, .20);
  a.advance(.05); b.advance(.05);
  let state = a.fish[0].speciesState;
  assert.equal(state.diagnostics.sequence, 'notice');
  assert(state.reachWeights.reduce((sum, value) => sum + value, 0) < .001,
    'a newly noticed cue must not immediately extend an investigative arm');
  advance(a, .25); advance(b, .25);
  assert.equal(state.diagnostics.sequence, 'notice');
  assert(state.reachWeights.reduce((sum, value) => sum + value, 0) < .001);
  advance(a, .75); advance(b, .75);
  assert.equal(state.diagnostics.sequence, 'unfold');
  assert(state.reachWeights.some(value => value > .01));
  const unfolding = armDigest(state);
  advance(a, 1.1); advance(b, 1.1);
  state = a.fish[0].speciesState;
  assert.equal(state.diagnostics.sequence, 'examine');
  assert(state.reachWeights.reduce((sum, value) => sum + value, 0) > .15);
  assert.notEqual(armDigest(state), unfolding, 'the examine phase changes actual arm geometry');
  assert.notEqual(armDigest(state), armDigest(b.fish[0].speciesState),
    'pointer influence must affect the rendered chains at the same seed and clock');
  assertChains(state);
  invited.canvas.emit('pointercancel'); a.advance(.05);
  assert.equal(state.diagnostics.sequence, 'peel-and-settle');
  const released = armDigest(state);
  advance(a, 1.3);
  assert.equal(state.cueActive, false);
  assert.equal(state.performance.explicit, false, 'the cancelled cue cannot hold the examine sequence');
  assert.notEqual(armDigest(state), released); assertChains(state);
  a.destroy(); b.destroy();
});

test('planted support tips stay at fixed world anchors while the mantle moves', t => {
  const { artwork: a } = mount();
  const firstTips = new Map(), firstAnchors = new Map(), pinnedFrames = new Map(SUPPORT.map(k => [k, 0]));
  const bodyStart = [a.fish[0].worldX, a.fish[0].worldY, a.fish[0].worldZ];
  let bodyTravel = 0, worstError = 0;
  for (let frame = 0; frame < 60; frame++) {
    a.advance(.05);
    const f = a.fish[0], s = f.speciesState;
    assert(s.contactWeights instanceof Float64Array && s.contactWeights.length === 8);
    assert(s.contacts instanceof Float64Array && s.contacts.length === 24);
    assert(s.contactLocal instanceof Float64Array && s.contactLocal.length === 24);
    bodyTravel = Math.max(bodyTravel, distance(bodyStart, [f.worldX, f.worldY, f.worldZ]));
    assertChains(s);
    for (const arm of SUPPORT) {
      const weight = s.contactWeights[arm]; assert(Number.isFinite(weight) && weight >= 0 && weight <= 1);
      if (weight !== 1) continue;
      const tip = worldPoint(f, s.arms[arm]);
      const anchor = Array.from(s.contacts.subarray(arm * 3, arm * 3 + 3));
      const error = distance(tip, anchor); worstError = Math.max(worstError, error);
      assert(error <= PIN_TOLERANCE, `support arm ${arm} misses its world anchor by ${error}`);
      if (!firstTips.has(arm)) { firstTips.set(arm, tip); firstAnchors.set(arm, anchor); }
      assert.deepEqual(anchor, firstAnchors.get(arm), `support arm ${arm} anchor follows the body`);
      assert(distance(tip, firstTips.get(arm)) <= PIN_TOLERANCE * 2,
        `support arm ${arm} skates in world space despite full contact`);
      pinnedFrames.set(arm, pinnedFrames.get(arm) + 1);
    }
  }
  for (const arm of SUPPORT) assert(pinnedFrames.get(arm) >= 20, `support arm ${arm} never establishes a sustained hold`);
  assert(bodyTravel > .01, 'stationary tips are only meaningful if the body actually moves');
  assert(Number.isFinite(a.fish[0].speciesState.diagnostics.maxContactError));
  assert(worstError <= PIN_TOLERANCE);
  t.diagnostic(JSON.stringify({ evidence: 'numerical world-contact measurement', frames: 60, dt: .05,
    pinnedFrames: Object.fromEntries(pinnedFrames), maxWorldError: worstError, maxBodyTravel: bodyTravel,
    tolerance: PIN_TOLERANCE }));
  a.destroy();
});

test('startle anticipates ink, releases contacts for the jet and replants arms at different recovery times', t => {
  const { artwork: a } = mount(); advance(a, 1);
  const initial = a.fish[0].speciesState.contactWeights;
  assert(initial && SUPPORT.every(k => initial[k] === 1));
  a.pulse();
  assert.equal(a.getStats().reactionStage, 'react'); assert.equal(a.ink.length, 0);
  advance(a, .20); assert.equal(a.ink.length, 0, 'no ink may precede the warning');
  advance(a, .40); assert.equal(a.getStats().reactionStage, 'spray'); assert(a.ink.length > 0);
  advance(a, .70); assert.equal(a.getStats().reactionStage, 'escape');
  assert(SUPPORT.every(k => a.fish[0].speciesState.contactWeights[k] < .001), 'a jet must release the substrate');
  const firstReplant = new Map();
  while (a.fish[0].reaction.active) {
    a.advance(.05); const f = a.fish[0], s = f.speciesState;
    assertChains(s);
    if (f.reaction.age < 3.25) continue;
    for (const arm of SUPPORT) if (s.contactWeights[arm] > .2 && !firstReplant.has(arm)) firstReplant.set(arm, f.reaction.age);
    assert(f.reaction.age < 9, 'shared startle must complete rather than latch indefinitely');
  }
  advance(a, .5);
  assert.equal(a.getStats().reactionStage, 'idle');
  assert(SUPPORT.every(k => firstReplant.has(k)), 'all supports participate in recovery');
  const arrivals = [...firstReplant.values()];
  assert(Math.max(...arrivals) - Math.min(...arrivals) >= .10, 'recovery must visibly stagger the supporting arms');
  assert(SUPPORT.every(k => a.fish[0].speciesState.contactWeights[k] === 1));
  t.diagnostic(JSON.stringify({ evidence: 'numerical reaction/contact sequence',
    firstReplantSeconds: Object.fromEntries(firstReplant), finalStage: a.getStats().reactionStage }));
  a.destroy();
});

test('den underlay outside the octopus remains empty water for hit ownership and touch startle', t => {
  const { artwork: a, canvas } = mount(); advance(a, .5);
  const marks = [], text = a.ctx.fillText;
  a.ctx.fillText = function (value, x, y, ...rest) { marks.push({ value, x, y }); return text.call(this, value, x, y, ...rest); };
  // Capture only the octopus draw callback: shared plankton/UI cannot satisfy
  // this assertion. Geometry still goes through the real canonical _put().
  a._activateFish(a.fish[0]); a._camera(a.time); a.sampleCount = 0;
  octopusDefinition.draw(a, a.time, a.fish[0].speciesState);
  a.ctx.fillText = text; a.render();
  const waterMarks = marks.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)
    && p.x >= 0 && p.x < a.width && p.y >= 0 && p.y < a.height && a._hitFish(p.x, p.y) < 0);
  assert(waterMarks.length >= 8, 'a visible den should provide several actual unowned backdrop marks');
  for (const mark of waterMarks.filter((_, i) => i % Math.max(1, Math.floor(waterMarks.length / 5)) === 0).slice(0, 5)) {
    canvas.emit('pointerdown', { clientX: mark.x, clientY: mark.y, pointerType: 'touch' });
    assert.equal(a.fish[0].reaction.active, false, 'touching a den-only mark must not startle the octopus');
  }
  const occupied = a.owners.findIndex((id, i) => id === 0 && a.visibility[i] >= .2);
  assert(occupied >= 0);
  canvas.emit('pointerdown', { clientX: (occupied % a.cols + .5) * a.cellW,
    clientY: (Math.floor(occupied / a.cols) + .5) * a.cellH, pointerType: 'touch' });
  assert.equal(a.fish[0].reaction.active, true, 'actual animal ownership still supports touch startle');
  t.diagnostic(JSON.stringify({ evidence: 'Canvas-command and mocked pointer dispatch',
    denTextMarks: marks.length, denMarksOutsideHitRegion: waterMarks.length, browserTested: false }));
  a.destroy();
});

test('den-specific pinning does not replace formations, cruise, orbit or shared director routes', () => {
  for (const patch of [{ formation: 'horizontal' }, { formation: 'vertical' }, { formation: 'diagonal' },
    { behaviors: ['cruise'] }, { behaviors: ['orbit'] }]) {
    const { artwork: a } = mount(patch); advance(a, .15);
    const before = [a.fish[0].worldX, a.fish[0].worldY, a.fish[0].worldZ];
    advance(a, .5);
    assert(distance(before, [a.fish[0].worldX, a.fish[0].worldY, a.fish[0].worldZ]) > .001);
    assert(a.fish[0].speciesState.contactWeights.every(value => value === 0)); a.destroy();
  }
  const host = fakeBrowser(), canvas = host.canvas(390, 500);
  const director = createMarineDirector(canvas, { scene: 'tidepool-investigation' },
    { ...OPTIONS, count: 1, speciesByAnimal: ['octopus'] });
  director.showDirectorStill('engage');
  const first = frameDigest(director), position = [director.fish[0].worldX, director.fish[0].worldY, director.fish[0].worldZ];
  director.showDirectorStill('explore');
  assert.notEqual(frameDigest(director), first);
  assert(distance(position, [director.fish[0].worldX, director.fish[0].worldY, director.fish[0].worldZ]) > .01);
  assert(director.fish[0].speciesState.contactWeights.every(value => value === 0));
  director.cueDirector({ type: 'invite', x: .2, y: .2 });
  assert.equal(director.getDirector().cue.active, true); assert.equal(director.paused, true);
  assert.equal(host.pending, 0); director.destroy();
});

test('reduced motion, pause, restart and deliberate redraw retain a static octopus without scheduling', () => {
  const host = fakeBrowser({ reducedMotion: true });
  const { artwork: a, canvas } = mount({ autoStart: true }, 390, 500, host);
  assert.equal(a.paused, true); assert.equal(host.pending, 0);
  const first = frameDigest(a), time = a.time;
  pointer(canvas, .22, .18); pointer(canvas, 0, 0, 'pointerdown', 'touch'); a.pulse();
  host.frame(5000); a.render();
  assert.equal(a.time, time); assert.equal(frameDigest(a), first); assert.equal(a.ink.length, 0);
  a.restart(); a.setOptions({ density: 1.35 });
  assert.equal(a.paused, true); assert.equal(host.pending, 0); assertFiniteFrame(a);
  a.setPaused(false); host.frame(); host.frame(); assert(a.time > 0);
  host.setReduced(true); assert.equal(a.paused, true); assert.equal(host.pending, 0);
  host.setReduced(false); assert.equal(a.paused, true); assert.equal(host.pending, 0);
  a.destroy();
});

test('resize and double disposal preserve resource bounds and leave a sibling octopus alive', () => {
  const host = fakeBrowser({ dpr: 4 });
  const one = mount({ autoStart: true, maxPixels: 524288, maxCells: 4096 }, 390, 500, host);
  const two = mount({ autoStart: true }, 900, 620, host);
  const a = one.artwork, b = two.artwork;
  assert.equal(host.pending, 1);
  one.canvas.rect.width = 0; a.resize(); assert.equal(a.depth.length, 0); assert.equal(host.pending, 1);
  one.canvas.rect.width = 1600; one.canvas.rect.height = 300; a.resize();
  assert(one.canvas.width * one.canvas.height <= 524288); assert(a.depth.length <= 4096);
  const stale = [a._move, a._touch, a._tick, a._windowResize, a._visibility, a._motionChange];
  a.destroy(); a.destroy();
  for (const callback of stale) callback({ clientX: 50, clientY: 50, pointerType: 'mouse', matches: true });
  a.render(); a.resize(); a.restart(); a.setPaused(false); a.pulse(); a.advance(.05);
  assert.equal(a.samples.length, 0); assert.equal(a.depth.length, 0); assert.equal(a.ink.length, 0);
  assert.equal(one.canvas.listenerCount, 0); assert.equal(a.getStats().destroyed, true);
  assert.equal(b.destroyed, false); assert.equal(host.pending, 1);
  host.frame(); host.frame(); assert(b.time > 0); assertFiniteFrame(b);
  b.destroy(); assert.equal(host.pending, 0);
  assert.equal(host.document.listenerCount + host.view.listenerCount + host.motion.listenerCount
    + one.canvas.listenerCount + two.canvas.listenerCount, 0);
  assert.equal(host.resizes.size + host.intersections.size, 0);
});
