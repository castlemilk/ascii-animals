import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createArtwork } from 'ascii-animals-review';
import { CuttlefishArtwork } from 'ascii-animals-review/cuttlefish';
import { createMarineMovementArtwork } from 'ascii-animals-review/movement/marine';
import { MovementMarineEngine } from '../lib/movement/marine-engine.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';

// Built-package integration with the actual marine geometry, projection and
// ownership raster. Canvas/DOM/time are simulated: these are not browser pixel,
// visual-quality, real touch-device or assistive-technology acceptance tests.
const species = ['cuttlefish', 'manta', 'octopus'];
const paths = [
  { path: 'horizontal' }, { path: 'vertical' },
  { path: 'diagonal', diagonalSlope: 'down' },
  { path: 'diagonal', diagonalSlope: 'up' }, { path: 'free' }
];
const artworkDefaults = {
  count: 1, size: .45, sizeVariation: 0, seed: 37, scene: 'reactive',
  formation: 'independent', followPointer: true, density: .6,
  maxCells: 4096, glow: false, speed: 1, autoStart: false
};
const journeyDefaults = {
  enabled: true, seed: 123, timing: { mode: 'duration', seconds: 24 },
  repeat: false, edgePadding: 24, lingerSeconds: 0, staggerSeconds: .5
};
const receipt = { browserTested: false, finiteConfigurations: 0, offscreenSeams: 0, disabledParityCases: 0 };

function mount(movement = {}, artwork = {}, size = [640, 460], host = fakeBrowser()) {
  const canvas = host.canvas(...size);
  const engine = new MovementMarineEngine(canvas, { ...journeyDefaults, ...movement }, { ...artworkDefaults, ...artwork });
  return { host, canvas, engine };
}
function digest(engine, visibleOnly = false) {
  const hash = createHash('sha256');
  for (const buffer of [engine.depth, engine.tones, engine.glyphs, engine.kinds, engine.owners, engine.visibility]) {
    // Native glyph/kind slots outside occupied cells deliberately retain prior
    // contents. Different render cadences may leave different unused values;
    // they never participate in the visible raster and are not frame evidence.
    const values = visibleOnly && (buffer === engine.glyphs || buffer === engine.kinds)
      ? buffer.map((value, index) => engine.depth[index] === -Infinity ? 0 : value) : buffer;
    hash.update(Buffer.from(values.buffer, values.byteOffset, values.byteLength));
  }
  return hash.digest('hex');
}
function poses(engine) {
  return engine.fish.map(fish => [fish.worldX, fish.worldY, fish.worldZ,
    fish.r00, fish.r10, fish.r20, fish.r01, fish.r11, fish.r21]);
}
function points(snapshot) { return snapshot.members.map(member => [member.x, member.y]); }
function assertFinite(engine, context = '') {
  assert(poses(engine).flat().every(Number.isFinite), `${context}: finite world poses`);
  assert(engine.getMovementState().members.every(member => [member.x, member.y, member.heading, member.progress].every(Number.isFinite)), `${context}: finite journey samples`);
  for (const value of engine.depth) assert(value === -Infinity || Number.isFinite(value), `${context}: finite depth values`);
  assert(engine.depth.length <= engine.options.maxCells, `${context}: grid budget`);
  assert(engine.sampleCount <= engine.samples.length / 6, `${context}: sample budget`);
}
function assertNoOwnedCells(engine, context) {
  assert(!engine.owners.some(owner => owner >= 0), `${context}: complete silhouette must be outside the viewport`);
}
function advance(engine, seconds, step = .1) {
  const count = Math.ceil(seconds / step);
  for (let i = 0; i < count; i++) engine.advance(seconds / count);
}
function touchOwnedCell(canvas, engine, owner = 0) {
  const cells = [];
  for (let i = 0; i < engine.owners.length; i++) if (engine.owners[i] === owner) cells.push(i);
  assert(cells.length > 0, `actor ${owner} must own visible cells before interacting`);
  const index = cells[Math.floor(cells.length / 2)];
  canvas.emit('pointerdown', {
    pointerType: 'touch', button: 0,
    clientX: (index % engine.cols + .5) * engine.cellW,
    clientY: (Math.floor(index / engine.cols) + .5) * engine.cellH
  });
}
function resources(host, canvases = []) {
  return host.pending + host.document.listenerCount + host.view.listenerCount + host.motion.listenerCount
    + host.resizes.size + host.intersections.size + canvases.reduce((sum, canvas) => sum + canvas.listenerCount, 0);
}

test('movement marine factory is an SSR-safe built package consumer with no second authored director', () => {
  assert.equal(typeof globalThis.window, 'undefined');
  assert.equal(typeof globalThis.document, 'undefined');
  const host = fakeBrowser(), canvas = host.canvas(640, 460);
  const art = createMarineMovementArtwork(canvas, journeyDefaults, artworkDefaults);
  assert.equal(typeof art.configureMovement, 'function');
  assert.equal(typeof art.advance, 'function');
  assert.equal(art.species, 'cuttlefish');
  assert.equal(art.getMovementOptions().count, 1);
  assert.deepEqual(art.getMovementOptions().cast, ['cuttlefish']);
  assert.equal('setDirector' in art, false, 'the public factory must not expose a competing pose director');
  art.seekMovement(720);
  assert(art.getStats().glyphs > 0);
  art.dispose();
  assert.equal(art.disposed, true);
  assert.equal(resources(host, [canvas]), 0);
});

test('disabled journeys retain native rendered cells, movement, ownership and interaction', () => {
  const scenarios = [
    { count: 1, scene: 'swimby', formation: 'independent' },
    { count: 3, scene: 'reactive', formation: 'diagonal' }
  ];
  for (const animal of species) for (const scenario of scenarios) {
    const aHost = fakeBrowser(), bHost = fakeBrowser();
    const aCanvas = aHost.canvas(640, 460), bCanvas = bHost.canvas(640, 460);
    const options = { ...artworkDefaults, ...scenario, species: animal };
    const native = new CuttlefishArtwork(aCanvas, options);
    const bridge = new MovementMarineEngine(bCanvas, { enabled: false }, options);
    try {
      assert.equal(digest(bridge), digest(native), `${animal}: initial cells`);
      for (let frame = 0; frame < 16; frame++) {
        if (frame === 2) for (const canvas of [aCanvas, bCanvas]) canvas.emit('pointermove', { pointerType: 'mouse', clientX: 420, clientY: 120 });
        if (frame === 5) { native.pulse(); bridge.pulse(); }
        native.advance(.05); bridge.advance(.05);
        assert.equal(digest(bridge), digest(native), `${animal} ${scenario.scene} frame ${frame}`);
        assert.deepEqual(poses(bridge), poses(native));
        assert.deepEqual(bridge.ink, native.ink);
      }
      assert.equal(bridge.getMovementState().tick, 0, 'disabled movement must not advance a hidden journey');
      native.setPaused(true); bridge.setPaused(true);
      native.setOptions({ density: .8 }); bridge.setOptions({ density: .8 });
      native.restart(); bridge.restart();
      assert.equal(digest(bridge), digest(native));
      receipt.disabledParityCases++;
    } finally { native.destroy(); bridge.destroy(); }
  }
  // Check the ordinary public façade too, rather than using the internal class
  // as the sole oracle for the opt-in factory's natural/default behavior.
  const aHost = fakeBrowser(), bHost = fakeBrowser();
  const native = createArtwork(aHost.canvas(), artworkDefaults);
  const bridge = createMarineMovementArtwork(bHost.canvas(), {}, artworkDefaults);
  for (let frame = 0; frame < 4; frame++) { native.advance(.05); bridge.advance(.05); }
  assert.deepEqual(bridge.getStats(), native.getStats());
  native.dispose(); bridge.dispose();
});

test('all marine species travel finite routes in both directions at landscape and portrait sizes', () => {
  for (const animal of species) for (const path of paths) for (const direction of ['forward', 'reverse']) {
    for (const size of [[640, 360], [320, 560]]) {
      const context = `${animal} ${path.path}/${path.diagonalSlope ?? ''} ${direction} ${size.join('x')}`;
      const { engine } = mount({ ...path, direction }, { species: animal }, size);
      try {
        const duration = engine.getMovementState().durationTicks;
        for (const progress of [0, .25, .5, .75, 1]) {
          engine.seekMovement(Math.round(duration * progress));
          assertFinite(engine, context);
          if (progress === .5) assert(engine.glyphCount > 0, `${context}: actual geometry must cross the viewport`);
        }
        receipt.finiteConfigurations++;
      } finally { engine.destroy(); }
    }
  }
});

test('full native silhouettes clear both endpoints and repeat boundaries at maximum body size', () => {
  for (const animal of species) for (const path of paths) for (const direction of ['forward', 'reverse']) {
    const { engine } = mount({ ...path, direction, repeat: true, edgePadding: 0 },
      { species: animal, size: 1.4, depthStrength: 2 }, [640, 360]);
    const context = `${animal} ${path.path}/${path.diagonalSlope ?? ''} ${direction}`;
    try {
      const duration = engine.getMovementState().durationTicks;
      for (const tick of [0, 1, duration - 1, duration, duration + 1]) {
        engine.seekMovement(tick);
        assertNoOwnedCells(engine, `${context} tick ${tick}`);
        assertFinite(engine, context);
      }
      receipt.offscreenSeams++;
    } finally { engine.destroy(); }
  }
});

test('live reversal preserves current position and then retraces the same route', () => {
  for (const animal of species) {
    const { engine } = mount({ path: 'free' }, { species: animal });
    try {
      engine.seekMovement(700);
      const earlier = points(engine.getMovementState());
      engine.advance(.1);
      const current = points(engine.getMovementState()), world = engine.fish.map(fish => [fish.worldX, fish.worldY, fish.worldZ]);
      engine.reverseMovement();
      assert.deepEqual(points(engine.getMovementState()), current);
      assert.deepEqual(engine.fish.map(fish => [fish.worldX, fish.worldY, fish.worldZ]), world);
      assert.equal(engine.getMovementState().playbackDirection, -1);
      engine.advance(.1);
      assert.deepEqual(points(engine.getMovementState()), earlier);
    } finally { engine.destroy(); }
  }
});

test('lanes alter lateral placement and cast changes are derived from artwork without changing formation', () => {
  const { engine } = mount({ lanes: 1, staggerSeconds: 0 },
    { count: 3, species: 'cuttlefish', size: .35, formation: 'independent' }, [960, 640]);
  try {
    engine.seekMovement(720);
    const before = points(engine.getMovementState());
    engine.configureMovement({ lanes: 3 });
    const after = engine.getMovementState();
    assert.notDeepEqual(points(after), before, 'lanes must change visible route placement');
    assert.deepEqual(after.members.map(member => member.lane), [0, 1, 2]);
    assert.equal(engine.options.formation, 'independent');
    engine.setOptions({ count: 2, speciesByAnimal: ['manta', 'octopus'] });
    assert.equal(engine.getMovementOptions().count, 2);
    assert.deepEqual(engine.getMovementOptions().cast, ['manta', 'octopus']);
    assert.deepEqual(engine.getMovementState().members.map(member => member.profile), ['manta', 'octopus']);
    assert.equal(engine.getMovementState().tick, 720);
  } finally { engine.destroy(); }
});

test('fixed tick grouping preserves actual geometry and native reaction state', () => {
  const one = mount({ path: 'free' }, { species: 'octopus' });
  const batch = mount({ path: 'free' }, { species: 'octopus' });
  try {
    for (const item of [one, batch]) {
      item.engine.seekMovement(720);
      touchOwnedCell(item.canvas, item.engine);
    }
    for (let group = 0; group < 12; group++) {
      for (let tick = 0; tick < 6; tick++) one.engine.advance(1 / 60);
      batch.engine.advance(.1);
      assert.deepEqual(one.engine.getMovementState(), batch.engine.getMovementState());
      assert.deepEqual(poses(one.engine), poses(batch.engine));
      assert.deepEqual(one.engine.ink, batch.engine.ink);
      assert.equal(digest(one.engine, true), digest(batch.engine, true), `presentation group ${group}`);
    }
  } finally { one.engine.destroy(); batch.engine.destroy(); }
});

test('invalid constructor input rejects before allocation and invalid updates remain atomic', () => {
  const host = fakeBrowser(), canvas = host.canvas();
  let requests = 0;
  const context = canvas.getContext;
  canvas.getContext = (...args) => { requests++; return context(...args); };
  const invalid = [null, [], 'horizontal', { unknown: true }, { enabled: 'yes' }, { path: 'circle' },
    { direction: 'backward' }, { seed: 1.2 }, { lanes: 0 }, { lanes: 13 }, { lingerSeconds: -1 },
    { timing: { mode: 'duration', seconds: NaN } }, { timing: { mode: 'speed', pixelsPerSecond: 0 } },
    { edgePadding: Infinity }, { count: 2 }, { cast: ['manta'] }, { profile: 'manta' }, { silhouetteRadius: 100 }];
  for (const patch of invalid) {
    assert.throws(() => createMarineMovementArtwork(canvas, patch, artworkDefaults));
    assert.equal(requests, 0);
    assert.equal(resources(host, [canvas]), 0);
  }
  const { engine } = mount();
  try {
    engine.seekMovement(720);
    const state = engine.getMovementState(), options = engine.getArtworkOptions(), config = engine.getMovementOptions(), frame = digest(engine);
    for (const patch of invalid) {
      assert.throws(() => engine.configureMovement(patch));
      assert.deepEqual(engine.getMovementState(), state);
      assert.deepEqual(engine.getMovementOptions(), config);
      assert.equal(digest(engine), frame);
    }
    for (const patch of [null, [], { unknown: 3 }, { unknown: undefined }, { size: NaN }, { count: 13 }, { paused: 'false' }, { species: 'shark' }]) {
      assert.throws(() => engine.setOptions(patch));
      assert.deepEqual(engine.getArtworkOptions(), options);
      assert.deepEqual(engine.getMovementState(), state);
      assert.equal(digest(engine), frame);
    }
  } finally { engine.destroy(); }
});

test('known undefined artwork and journey patches preserve existing values', () => {
  const { engine } = mount({ edgePadding: 128 }, { size: 1.1, speed: 1.6 });
  try {
    engine.seekMovement(720);
    const before = engine.getArtworkOptions(), movement = engine.getMovementOptions(), state = engine.getMovementState();
    engine.setOptions({ size: undefined, speed: undefined });
    assert.deepEqual(engine.getArtworkOptions(), before);
    assert.deepEqual(engine.getMovementState(), state);
    engine.configureMovement({ edgePadding: undefined, staggerSeconds: undefined });
    assert.deepEqual(engine.getMovementOptions(), movement);
    assert.deepEqual(engine.getMovementState(), state);
  } finally { engine.destroy(); }
});

test('native owned-cell touch retains manta no-ink, octopus ink and recovery into the moving route', () => {
  for (const animal of ['manta', 'octopus']) {
    const { engine, canvas } = mount({}, { species: animal, behaviors: ['hover'] });
    try {
      engine.seekMovement(720);
      touchOwnedCell(canvas, engine);
      assert.equal(engine.fish[0].reaction.active, true, `${animal}: touch must target the visible animal`);
      assert.equal(engine.fish[0].reaction.reason, 'touch');
      advance(engine, .7);
      if (animal === 'manta') assert.equal(engine.ink.length, 0);
      else assert(engine.ink.length > 0, 'octopus retains its native ink response');
      advance(engine, 8.2);
      assert.equal(engine.fish[0].reaction.active, false);
      assert.equal(engine.getMovementState().tick, 720 + 534, 'movement continues beneath native recovery');
      assertFinite(engine);
    } finally { engine.destroy(); }
  }
});

test('reactive pointer invitation changes actual world pose and cannot advance a paused scene', () => {
  const interested = mount({}, { species: 'cuttlefish', followPointer: true });
  const untouched = mount({}, { species: 'cuttlefish', followPointer: true });
  try {
    for (const item of [interested, untouched]) item.engine.seekMovement(720);
    interested.canvas.emit('pointermove', { pointerType: 'mouse', clientX: 560, clientY: 80 });
    for (let frame = 0; frame < 8; frame++) { interested.engine.advance(.1); untouched.engine.advance(.1); }
    assert.deepEqual(interested.engine.getMovementState(), untouched.engine.getMovementState(), 'invitation is local to the species, not a route rewrite');
    assert.notDeepEqual(poses(interested.engine), poses(untouched.engine));
    interested.engine.setPaused(true);
    const state = interested.engine.getMovementState(), frame = digest(interested.engine);
    interested.canvas.emit('pointermove', { pointerType: 'mouse', clientX: 80, clientY: 420 });
    interested.engine.render(); interested.host.frame(10000);
    assert.deepEqual(interested.engine.getMovementState(), state);
    assert.equal(digest(interested.engine), frame);
  } finally { interested.engine.destroy(); untouched.engine.destroy(); }
});

test('paused and reduced mounts show a static animal, redraw on resize, and never move from passive input', () => {
  const host = fakeBrowser({ reducedMotion: true }), canvas = host.canvas(640, 460);
  const art = createMarineMovementArtwork(canvas, journeyDefaults, { ...artworkDefaults, autoStart: true });
  try {
    assert.equal(art.getStats().paused, true);
    assert.equal(art.reducedMotion, true);
    assert.equal(art.getMovementState().tick, 0);
    assert(art.getStats().glyphs > 0, 'reduced motion must show more than empty offscreen entry water');
    assert.equal(host.pending, 0);
    art.play(); art.render(); host.frame(10000);
    canvas.emit('pointermove', { pointerType: 'mouse', clientX: 400, clientY: 80 });
    canvas.emit('pointerdown', { pointerType: 'touch', clientX: 320, clientY: 220 });
    assert.equal(art.getMovementState().tick, 0);
    assert.equal(art.getStats().paused, true);
    canvas.rect.width = 320; canvas.rect.height = 560; art.resize();
    art.configureMovement({ path: 'vertical', timing: { mode: 'speed', pixelsPerSecond: 100 } });
    assert.equal(art.getMovementState().tick, 0);
    assert(art.getStats().glyphs > 0);
    assert.equal(host.pending, 0);
    host.setReduced(false);
    assert.equal(art.getStats().paused, true, 'removing reduction must not auto-resume');
    art.play(); assert.equal(host.pending, 1);
    host.frame(); host.frame(50);
    assert.equal(art.getMovementState().tick, 3);
    art.pause(); const frozen = art.getMovementState().tick;
    art.render(); art.render(); art.resize(); host.frame(10000);
    assert.equal(art.getMovementState().tick, frozen);
    art.restart(); assert.equal(art.getStats().paused, true); assert.equal(art.getMovementState().tick, 0);
    assert(art.getStats().glyphs > 0);
  } finally { art.dispose(); }
  assert.equal(resources(host, [canvas]), 0);
});

test('explicit pause updates honor reduced motion, then can release the same latch as play()', () => {
  const host = fakeBrowser({ reducedMotion: true });
  const canvas = host.canvas(640, 460);
  const art = createMarineMovementArtwork(canvas, journeyDefaults, { ...artworkDefaults, autoStart: true });
  try {
    art.update({ paused: false });
    assert.equal(art.getStats().paused, true);
    assert.equal(host.pending, 0);
    host.setReduced(false);
    assert.equal(art.getStats().paused, true, 'leaving reduction does not auto-resume');
    art.update({ paused: false });
    assert.equal(art.getStats().paused, false);
    assert.equal(host.pending, 1);
    host.frame(); host.frame(50);
    assert.equal(art.getMovementState().tick, 3);
    art.update({ paused: true });
    assert.equal(art.getStats().paused, true);
    assert.equal(host.pending, 0);
  } finally { art.dispose(); }
  assert.equal(resources(host, [canvas]), 0);
});

test('zero-tick manual redraw preserves a still and reduced motion blocks explicit manual advancement', () => {
  const { engine, host } = mount({}, { paused: true });
  try {
    engine.showMovementStill(.6);
    const simulation = engine.getMovementState(), displayed = engine.getMovementDisplay(), frame = digest(engine);
    engine.advance(0); engine.advance(1 / 6000);
    assert.deepEqual(engine.getMovementState(), simulation);
    assert.deepEqual(engine.getMovementDisplay(), displayed);
    assert.equal(digest(engine), frame);
    engine.reverseMovement();
    assert.deepEqual(points(engine.getMovementDisplay()), points(displayed));
    assert.equal(engine.getMovementDisplay().playbackDirection, -1);
    host.setReduced(true);
    const reduced = engine.getMovementState(), nativeTime = engine.time;
    engine.advance(.1);
    assert.deepEqual(engine.getMovementState(), reduced);
    assert.equal(engine.time, nativeTime);
    assert.equal(host.pending, 0);
  } finally { engine.destroy(); }
});

test('independent mounts share one scheduler and clean up hidden, zero-sized and disposed state', () => {
  const host = fakeBrowser(), first = host.canvas(640, 460), second = host.canvas(640, 460);
  const a = createMarineMovementArtwork(first, journeyDefaults, { ...artworkDefaults, autoStart: true });
  const b = createMarineMovementArtwork(second, journeyDefaults, { ...artworkDefaults, autoStart: true });
  try {
    assert.equal(host.pending, 1);
    host.frame(); host.frame(50);
    assert.equal(a.getMovementState().tick, 3); assert.equal(b.getMovementState().tick, 3);
    a.pause(); host.frame(50);
    assert.equal(a.getMovementState().tick, 3); assert.equal(b.getMovementState().tick, 6);
    host.hide(true); assert.equal(host.pending, 0); const hidden = b.getMovementState().tick;
    host.frame(50000); host.hide(false); host.frame(); assert.equal(b.getMovementState().tick, hidden);
    second.rect.width = 0; second.rect.height = 0; b.resize();
    assert.equal(host.pending, 0); host.frame(50000); assert.equal(b.getMovementState().tick, hidden);
    second.rect.width = 640; second.rect.height = 460; b.resize();
    assert.equal(host.pending, 1);
    a.dispose(); a.dispose();
    assert.equal(first.listenerCount, 0); assert.equal(host.pending, 1);
    const before = a.getMovementState();
    a.configureMovement({ path: 'free' }); a.seekMovement(999); a.reverseMovement(); a.restart(); a.resize();
    assert.deepEqual(a.getMovementState(), before);
    assert.equal(before.disposed, true);
    host.frame(); host.frame(50); assert(b.getMovementState().tick > hidden);
  } finally { a.dispose(); b.dispose(); }
  assert.equal(resources(host, [first, second]), 0);
});

test.after(() => console.log('MOVEMENT_MARINE_RECEIPT ' + JSON.stringify(receipt)));
