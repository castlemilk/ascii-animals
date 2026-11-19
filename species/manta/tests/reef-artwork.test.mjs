import test from 'node:test';
import assert from 'node:assert/strict';
import { createMantaReef } from '../reef-artwork.mjs';
import { reefTestHost, cellDigest, visibleCellDigest, advance, ownedPoint, listenerCount, poseVector } from './reef-test-host.mjs';

const manual = { autoStart: false, seed: 20261119, maxCells: 4096, reducedMotion: 'ignore' };
function mount(reef = {}, artwork = {}, width = 900, height = 620, hostOptions = {}) {
  const host = reefTestHost(hostOptions), canvas = host.canvas(width, height);
  const art = createMantaReef(canvas, reef, { ...manual, ...artwork });
  return { host, canvas, art };
}
function finiteFrame(art) {
  assert(art.sampleCount > 0 && art.sampleCount <= 36000, 'bounded sampled geometry');
  assert(art.glyphCount > 20, 'more than a token visible fragment');
  assert(art.depth.length <= art.options.maxCells);
  for (const depth of art.depth) assert(depth === -Infinity || Number.isFinite(depth));
  for (const fish of art.fish) {
    const matrix = [fish.r00, fish.r01, fish.r02, fish.r10, fish.r11, fish.r12, fish.r20, fish.r21, fish.r22];
    assert([...matrix, fish.worldX, fish.worldY, fish.worldZ].every(Number.isFinite));
    for (let column = 0; column < 3; column++) {
      assert(Math.abs(Math.hypot(matrix[column], matrix[column + 3], matrix[column + 6]) - 1) < 1e-9);
    }
  }
}

test('invalid construction allocates no retained browser resources', () => {
  const host = reefTestHost(), canvas = host.canvas();
  for (const reef of [{ current: 2 }, { duration: NaN }, { habitat: 'yes' }, { unknown: true }]) {
    assert.throws(() => createMantaReef(canvas, reef, manual));
    assert.equal(listenerCount(host, canvas), 0);
    assert.equal(host.pending + host.resizes.size + host.intersections.size, 0);
  }
  for (const artwork of [{ species: 'octopus' }, { count: 2 }, { speciesByAnimal: ['manta', 'octopus'] },
    { formation: 'horizontal' }, { scene: 'swimby' }, { seed: NaN }]) {
    assert.throws(() => createMantaReef(canvas, {}, { ...manual, ...artwork }));
    assert.equal(listenerCount(host, canvas), 0);
    assert.equal(host.pending + host.resizes.size + host.intersections.size, 0);
  }
});

test('undefined artwork fields retain study defaults and remain omitted on updates', () => {
  const regular = mount();
  const omitted = mount({ current: undefined, duration: undefined, habitat: undefined }, {
    count: undefined, species: undefined, size: undefined, density: undefined,
    formation: undefined, scene: undefined, behaviors: undefined, followPointer: undefined
  });
  assert.deepEqual(omitted.art.options, regular.art.options);
  assert.equal(omitted.art.fish.length, 1);
  assert.equal(omitted.art.fish[0].species, 'manta');
  assert.equal(omitted.art.options.density, 1.24);
  assert.equal(omitted.art.options.size, 1.08);
  assert.equal(cellDigest(omitted.art), cellDigest(regular.art));
  const before = omitted.art.getReef(), raster = cellDigest(omitted.art);
  omitted.art.setOptions({ count: undefined, species: undefined, density: undefined, size: undefined });
  omitted.art.setReef({ current: undefined, duration: undefined, habitat: undefined });
  assert.deepEqual(omitted.art.getReef(), before);
  assert.deepEqual(omitted.art.options, regular.art.options);
  assert.equal(cellDigest(omitted.art), raster);
  regular.art.destroy(); omitted.art.destroy();
});

test('reef patches are atomic and preserve geometry identity, playback and inherited typed choices', () => {
  const { art } = mount();
  art.setPaused(true);
  const before = art.getReef(), raster = cellDigest(art), state = art.fish[0].speciesState;
  for (const patch of [{ current: -.6, duration: NaN }, { habitat: 0 }, { surprise: true }]) {
    assert.throws(() => art.setReef(patch));
    assert.deepEqual(art.getReef(), before); assert.equal(cellDigest(art), raster);
  }
  for (const patch of [{ count: 2 }, { species: 'octopus' }, { formation: 'diagonal' }]) {
    assert.throws(() => art.setOptions(patch));
    assert.equal(art.fish[0].species, 'manta'); assert.equal(art.fish.length, 1);
    assert.equal(art.fish[0].speciesState, state); assert.equal(cellDigest(art), raster);
  }
  art.setReef({ current: -.4, habitat: false });
  assert.equal(art.getReef().options.current, -.4);
  assert.equal(art.getReef().options.habitat, false);
  assert.equal(art.paused, true); assert.equal(art.fish[0].speciesState, state);
  assert(Object.isFrozen(art.getReef())); assert(Object.isFrozen(art.getReef().options));
  art.setOptions({ mode: 'points', palette: 'ultraviolet', density: 1.2 });
  assert.equal(art.options.mode, 'points'); assert.equal(art.options.palette, 'ultraviolet');
  assert.equal(art.paused, true); finiteFrame(art); art.destroy();
});

test('all authored stills change real cells without advancing time or subscribing to animation', () => {
  for (const [width, height] of [[900, 620], [390, 500]]) {
    const { art, host } = mount({}, {}, width, height);
    const frames = new Set();
    for (const still of ['glide', 'anticipation', 'bank', 'recover']) {
      art.showReefStill(still);
      assert.equal(art.paused, true); assert.equal(host.pending, 0);
      assert.equal(art.getReef().still, still);
      const clock = art.time, snapshot = art.getReef(), frame = cellDigest(art);
      finiteFrame(art); frames.add(frame);
      art.render(); art.render(); host.frame(12000);
      assert.equal(art.time, clock); assert.deepEqual(art.getReef(), snapshot);
      assert.equal(cellDigest(art), frame, 'rendering is not a simulation step');
    }
    assert.equal(frames.size, 4, 'four still controls must not relabel a single pose');
    art.bank(-1);
    assert.equal(art.paused, true); assert.equal(art.getReef().still, 'bank');
    assert.equal(host.pending, 0);
    art.setPaused(false); assert.equal(art.getReef().still, null);
    art.destroy();
  }
});

test('representative still cells are independent of earlier pointer, current and response history', () => {
  for (const [width, height] of [[900, 620], [390, 500]]) {
    const fresh = mount({ current: -.4 }, {}, width, height);
    const history = mount({ current: -.4 }, {}, width, height);
    for (const still of ['glide', 'anticipation', 'bank', 'recover']) {
      fresh.art.showReefStill(still);
      const expected = visibleCellDigest(fresh.art);
      for (const age of [.2, 1.6, 6.2]) {
        history.art.restart(); history.art.setPaused(false);
        history.canvas.emit('pointermove', {
          clientX: width * .85, clientY: height * .22, pointerType: 'touch'
        });
        advance(history.art, .6, 10);
        history.art.setReef({ current: .6 });
        advance(history.art, .2, 10);
        history.art.setReef({ current: -.4 });
        history.art.bank(1); advance(history.art, age, 10);
        assert.equal(history.art.fish[0].reaction.active, true);
        const clock = history.art.time;
        history.art.showReefStill(still);
        assert.equal(history.art.time, clock, 'representative composition does not advance playback');
        assert.equal(history.art.paused, true); assert.equal(history.host.pending, 0);
        assert.equal(history.art.fish[0].reaction.active, false, 'the earlier reaction cannot contaminate or resume under the still');
        assert.equal(history.art.pointer.active, false); assert.equal(history.art.pointer.interest, 0);
        assert.equal(history.art.startleTension, 0); assert.equal(history.art.escapeAmount, 0);
        assert.equal(history.art.ink.length, 0);
        assert.equal(visibleCellDigest(history.art), expected,
          `${width}x${height} ${still} must not retain geometry/tones from response age ${age}`);
      }
    }
    fresh.art.destroy(); history.art.destroy();
  }
});

test('duration edits preserve the current route pose, fin clock and in-flight current easing', () => {
  for (const motion of [.6, 1.2]) for (const responseAge of [null, 1.6, 6.2]) {
    const { art } = mount({ duration: 32 }, { motion });
    advance(art, 5, 10);
    if (responseAge !== null) { art.bank(-1); advance(art, responseAge, 10); }
    art.setReef({ current: -.7 }); advance(art, 1, 10);
    const vector = poseVector(art.reefPose), raster = cellDigest(art);
    const before = art.getReef(), playback = art.time, finTime = art.mantaMotion.time;
    assert.notEqual(before.current, before.options.current, 'fixture must contain an unfinished current transition');
    for (const duration of [80, 20, 44]) {
      art.setReef({ duration });
      assert.equal(art.time, playback); assert.equal(art.getReef().clock, before.clock);
      assert.equal(art.mantaMotion.time, finTime, 'retiming travel must not reset the wing wave');
      assert.equal(art.getReef().current, before.current, 'duration must not restart or jump current easing');
      assert.equal(art.getReef().responseAge, before.responseAge);
      const after = poseVector(art.reefPose);
      assert(Math.hypot(...after.map((value, index) => value - vector[index])) < 1e-10);
      assert.equal(cellDigest(art), raster, 'retiming must preserve the displayed cells at the update instant');
    }
    art.advance(.1);
    assert(art.getReef().current < before.current, 'existing easing continues toward the requested current');
    assert(art.time > playback);
    art.restart(); assert.equal(art.time, 0); finiteFrame(art);
    art.destroy();
  }
});

test('fixed tick event logs replay identically with extra draws and keep instances isolated', () => {
  const one = mount(), two = mount();
  const a = one.art, b = two.art;
  for (let tick = 0; tick < 180; tick++) {
    for (const { art, canvas } of [one, two]) {
      if (tick === 12) canvas.emit('pointermove', { clientX: 660, clientY: 250, pointerType: 'mouse' });
      if (tick === 30) art.bank(-1);
      if (tick === 75) art.setReef({ current: -.7 });
      if (tick === 100) canvas.emit('pointercancel');
      art.advance(1 / 60);
    }
    if (tick % 2 === 0) b.render();
    if (tick % 5 === 0) { b.render(); b.render(); }
  }
  assert.equal(cellDigest(a), cellDigest(b));
  assert.deepEqual(a.getReef(), b.getReef());
  assert.notEqual(a.fish[0].speciesState, b.fish[0].speciesState);
  const untouched = b.getReef(), frame = cellDigest(b);
  a.advance(.1); a.destroy();
  assert.equal(b.destroyed, false); assert.deepEqual(b.getReef(), untouched);
  assert.equal(cellDigest(b), frame); b.destroy();
});

test('one barrel bank stays bounded and ink-free through anticipation, response and slow recovery', () => {
  const { art } = mount();
  advance(art, 2); art.bank(1);
  const stages = new Set();
  for (let tick = 0; tick <= 528; tick++) {
    const reef = art.getReef(); stages.add(reef.stage);
    assert.equal(art.ink.length, 0); assert.equal(art.getStats().inkGlyphs, 0);
    assert(Number.isFinite(reef.clock));
    if (tick === 90) {
      const before = art.getReef(), raster = cellDigest(art);
      art.bank(-1);
      assert.deepEqual(art.getReef(), before, 'a repeated trigger may not rewind the active response');
      assert.equal(cellDigest(art), raster);
    }
    if (tick % 30 === 0) finiteFrame(art);
    if (tick < 528) art.advance(1 / 60);
  }
  assert(stages.has('anticipation') && stages.has('bank') && stages.has('recover'));
  // Floating-point accumulation may leave the host a fraction of a tick short.
  art.advance(1 / 60);
  assert.equal(art.fish[0].reaction.active, false);
  assert.equal(art.getReef().sequence, 'current-glide');
  art.bank(-1); assert.equal(art.fish[0].reaction.active, true);
  art.destroy();
});

test('pointer and touch use actual owner cells, preserve CSS coordinates, and cancel attention', () => {
  const { art, canvas } = mount({}, {}, 390, 500, { dpr: 2 });
  canvas.rect.left = 41; canvas.rect.top = 73;
  canvas.emit('pointerdown', { clientX: 42, clientY: 74, pointerType: 'touch' });
  assert.equal(art.fish[0].reaction.active, false, 'empty water is not a hit on the animal');
  const point = ownedPoint(art);
  canvas.emit('pointerdown', { clientX: point.x + 41, clientY: point.y + 73, pointerType: 'touch' });
  assert.equal(art.fish[0].reaction.active, true);
  assert.equal(art.getReef().sequence, 'barrel-bank');
  assert(Math.abs(art.pointer.tx - (point.x / 390 - .5)) < 1e-12);
  canvas.emit('pointermove', { clientX: 320, clientY: 200, pointerType: 'touch' });
  advance(art, .2);
  assert(art.pointer.interest > 0);
  canvas.emit('pointercancel');
  assert.equal(art.pointer.active, false); assert.equal(art.pointer.tx, 0); assert.equal(art.pointer.ty, 0);
  art.destroy();
});

test('live reduced motion, explicit pause, visibility and zero-size suspension compose without catch-up', () => {
  const { host, canvas, art } = mount({}, { autoStart: true, reducedMotion: 'system' }, 390, 500,
    { reducedMotion: true });
  assert.equal(art.paused, true); assert.equal(host.pending, 0); finiteFrame(art);
  art.bank(1); art.restart(); art.setReef({ current: -.3 });
  canvas.emit('pointermove', { clientX: 300, clientY: 230, pointerType: 'mouse' });
  assert.equal(art.paused, true); assert.equal(host.pending, 0);
  art.setPaused(false); assert.equal(host.pending, 1);
  host.frame(); host.frame(50); const running = art.time;
  assert(running > 0);
  host.hide(true); assert.equal(host.pending, 0); host.frame(120000);
  assert.equal(art.time, running);
  host.hide(false); host.frame(); assert.equal(art.time, running, 'no hidden-time catch-up');
  host.intersect(canvas, false); assert.equal(host.pending, 0);
  host.setReduced(true); assert.equal(art.paused, true);
  host.intersect(canvas, true); host.setReduced(false); assert.equal(host.pending, 0);
  art.setPaused(false); canvas.rect.width = 0; art.resize();
  assert.equal(host.pending, 0); assert.equal(art.depth.length, 0);
  const clock = art.time;
  host.frame(120000); assert.equal(art.time, clock);
  art.setPaused(true); canvas.rect.width = 390; art.resize();
  assert.equal(art.paused, true); assert.equal(host.pending, 0); finiteFrame(art);
  art.destroy(); assert.equal(listenerCount(host, canvas), 0);
  assert.equal(host.pending + host.resizes.size + host.intersections.size, 0);
});

test('paused resizing preserves the chosen state and bounds portrait, wide and coarse rendering', () => {
  for (const [width, height] of [[320, 240], [390, 500], [1600, 300]]) {
    const { art, host, canvas } = mount({ current: -1 }, { density: 1.5, maxCells: 2048 }, width, height,
      { dpr: 3 });
    art.showReefStill('bank');
    const before = art.getReef(), clock = art.time, identity = art.fish[0].speciesState;
    finiteFrame(art);
    canvas.rect.width += 19; canvas.rect.height += 31; art.resize();
    assert.equal(art.time, clock); assert.deepEqual(art.getReef(), before);
    assert.equal(art.fish[0].speciesState, identity);
    assert.equal(host.pending, 0); assert.equal(art.paused, true);
    assert(art.canvas.width * art.canvas.height <= art.options.maxPixels);
    assert(art.dpr <= art.options.maxDpr); finiteFrame(art);
    art.destroy();
  }
});

test('multiple mounts share scheduling and dispose independently with safe later calls', () => {
  const host = reefTestHost(), one = host.canvas(390, 500), two = host.canvas(900, 620);
  const a = createMantaReef(one, {}, { ...manual, autoStart: true });
  const b = createMantaReef(two, {}, { ...manual, autoStart: true });
  assert.equal(host.pending, 1, 'the study must reuse the existing per-window scheduler');
  host.frame(); host.frame(50);
  a.destroy(); a.destroy();
  const disposed = a.getReef(), frozenTime = a.time;
  a.bank(1); a.showReefStill('recover'); a.setReef({ current: -.5 }); a.setOptions({ size: 1.1 });
  a.restart(); a.advance(.1); a.resize(); a.render(); a.setPaused(false);
  assert.equal(a.time, frozenTime); assert.deepEqual(a.getReef(), disposed);
  assert.equal(a.samples.length, 0); assert.equal(one.listenerCount, 0);
  assert.equal(host.pending, 1); assert.equal(b.destroyed, false);
  const before = b.time; host.frame(50); assert(b.time > before);
  b.destroy();
  assert.equal(listenerCount(host, one, two), 0);
  assert.equal(host.pending + host.resizes.size + host.intersections.size, 0);
});
