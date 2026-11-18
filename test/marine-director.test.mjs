import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { CuttlefishArtwork, createMarineDirector, normalizeMarineDirector } from '../src/animals/cuttlefish.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';

// Numerical integration checks: real canonical geometry/projection/rasterization,
// simulated DOM, Canvas commands and time. These do not certify browser pixels.
const scenes = ['reef-rendezvous', 'upwelling-ballet', 'tidepool-investigation'];
const chapters = ['arrive', 'engage', 'explore', 'depart'];
const cast = ['manta', 'octopus', 'cuttlefish'];
const options = {
  species: 'manta', speciesByAnimal: cast, count: 3, behaviors: ['hover', 'hover', 'curious'],
  scene: 'reactive', formation: 'independent', size: .8, sizeVariation: .2,
  density: .9, maxCells: 8192, glow: false, autoStart: false, speed: 1, seed: 17
};
function mount(config = {}, patch = {}, host = fakeBrowser()) {
  const canvas = host.canvas(640, 460);
  const artwork = createMarineDirector(canvas, config, { ...options, ...patch });
  return { host, canvas, artwork };
}
function digest(a) {
  const hash = createHash('sha256');
  for (const values of [a.depth, a.tones, a.glyphs, a.kinds, a.owners, a.visibility]) {
    hash.update(Buffer.from(values.buffer, values.byteOffset, values.byteLength));
  }
  return hash.digest('hex');
}
function poses(a) {
  return a.fish.map(f => [f.worldX, f.worldY, f.worldZ, f.r00, f.r10, f.r20, f.r01, f.r11, f.r21]);
}
function advance(a, seconds, step = .05) {
  const count = Math.ceil(seconds / step);
  for (let i = 0; i < count; i++) a.advance(seconds / count);
}
function assertFiniteFrame(a) {
  assert(a.glyphCount > 0, 'a deliberate scene tableau should contain a visible animal');
  assert(a.depth.length <= a.options.maxCells);
  assert(a.sampleCount <= a.samples.length / 6);
  assert(poses(a).flat().every(Number.isFinite));
  for (const depth of a.depth) assert(depth === -Infinity || Number.isFinite(depth));
}
const receipt = { scenes: {}, strictInvalidCases: 0, replay: {}, browserTested: false };

test('director imports are SSR-safe and strict configuration is immutable and atomic', () => {
  assert.equal(typeof globalThis.window, 'undefined');
  assert.equal(typeof globalThis.document, 'undefined');
  assert.equal(CuttlefishArtwork.directorScenes.length, 3);
  assert(Object.isFrozen(CuttlefishArtwork.directorScenes));
  assert.deepEqual(CuttlefishArtwork.directorScenes.map(scene => scene.id), scenes);
  for (const scene of CuttlefishArtwork.directorScenes) {
    assert(Object.isFrozen(scene)); assert(Object.isFrozen(scene.chapters)); assert.equal(scene.chapters.length, 4);
  }
  const requested = { scene: scenes[0], roles: ['guide', 'forager', 'sentinel'] };
  const normalized = normalizeMarineDirector(requested);
  assert(Object.isFrozen(normalized)); assert(Object.isFrozen(normalized.roles));
  requested.roles[0] = 'companion'; assert.equal(normalized.roles[0], 'guide');
  assert.equal(normalized.duration, 40); assert.equal(normalized.current, .35);
  const h = fakeBrowser(), canvas = h.canvas();
  const invalid = [
    { scene: 'not-a-scene' }, { surprise: true }, { duration: 19 }, { duration: 81 },
    { duration: NaN }, { current: Infinity }, { current: -1.01 }, { spread: .64 },
    { intimacy: 1.51 }, { autonomy: -1 }, { focus: 0 }, { focus: 1.5 }, { focus: 13 },
    { roles: ['unknown'] }, { roles: new Array(2) }, { roles: Array(13).fill('guide') },
    { backdrop: 'yes' }
  ];
  for (const patch of invalid) {
    assert.throws(() => normalizeMarineDirector(patch));
    assert.throws(() => createMarineDirector(canvas, patch, options));
    assert.equal(h.pending, 0); assert.equal(canvas.listenerCount, 0);
    assert.equal(h.document.listenerCount + h.view.listenerCount + h.motion.listenerCount, 0);
    assert.equal(h.resizes.size + h.intersections.size, 0);
    receipt.strictInvalidCases++;
  }
  const a = createMarineDirector(canvas, { roles: ['guide', 'forager', 'sentinel'] }, options);
  a.showDirectorStill('explore');
  const before = a.getDirector(), hash = digest(a), state = a.fish[1].speciesState;
  for (const patch of invalid) {
    assert.throws(() => a.setDirector(patch)); assert.deepEqual(a.getDirector(), before);
    assert.equal(digest(a), hash); assert.equal(a.fish[1].speciesState, state);
  }
  assert.throws(() => a.cueDirector({ type: 'invite', x: NaN, y: 0 }));
  assert.throws(() => a.cueDirector({ type: 'invite', x: 0, y: Infinity }));
  assert.throws(() => a.cueDirector({ type: 'invite', x: .51, y: 0 }));
  assert.throws(() => a.cueDirector({ type: 'disturb', id: 0 }));
  assert.throws(() => a.cueDirector({ type: 'unknown' }));
  assert.deepEqual(a.getDirector(), before); assert.equal(digest(a), hash);
  a.destroy();
});

test('all authored scenes have four distinct, finite composed chapters', () => {
  const allScenePoses = new Set();
  for (const scene of scenes) {
    const { artwork: a, host } = mount({ scene, backdrop: false });
    const frames = new Set(), scenePoses = new Set(), motives = new Set();
    for (const chapter of chapters) {
      a.showDirectorStill(chapter);
      const state = a.getDirector();
      assert.equal(state.scene, scene); assert.equal(state.chapter, chapter); assert.equal(state.enabled, true);
      assert.equal(state.members.length, 3); assert.equal(a.paused, true); assert.equal(host.pending, 0);
      assert(state.progress >= 0 && state.progress <= 1); assert(Number.isFinite(state.time));
      assertFiniteFrame(a);
      for (const member of state.members) {
        assert.equal(typeof member.motive, 'string'); assert(member.motive.length > 0);
        assert.equal(typeof member.phase, 'string'); motives.add(member.motive);
      }
      frames.add(digest(a)); scenePoses.add(JSON.stringify(poses(a)));
      const frozenTime = a.time, frozenDirector = a.getDirector(), frozenFrame = digest(a);
      a.render(); a.render(); host.frame(5000);
      assert.equal(a.time, frozenTime); assert.deepEqual(a.getDirector(), frozenDirector); assert.equal(digest(a), frozenFrame);
    }
    assert.equal(frames.size, 4, 'chapters must change actual rendered geometry, not only labels');
    assert.equal(scenePoses.size, 4); assert(motives.size > 1);
    allScenePoses.add([...scenePoses].join('|'));
    receipt.scenes[scene] = { distinctChapterFrames: frames.size, distinctPoses: scenePoses.size, distinctMotives: motives.size };
    a.destroy();
  }
  assert.equal(allScenePoses.size, 3, 'the three named scenes must not share identical pose sequences');
});

test('authored demo tableaux retain separate visible members at desktop and portrait sizes', () => {
  // Actual demo casts and settings. These loose geometric guards cover the
  // central-overlap defect found by inspecting native renders; they are not
  // pixel-perfect goldens or proof that every possible user cast is attractive.
  const presets = [
    { scene: 'reef-rendezvous', cast: ['manta', 'octopus', 'cuttlefish'], roles: ['guide', 'forager', 'sentinel'],
      size: .8, variation: .2, duration: 40, current: .35, spread: 1, intimacy: 1, autonomy: 1 },
    { scene: 'upwelling-ballet', cast: ['manta', 'manta', 'manta', 'cuttlefish', 'octopus'], roles: ['guide', 'companion', 'guide', 'sentinel', 'forager'],
      size: .65, variation: .25, duration: 44, current: .65, spread: 1.15, intimacy: .75, autonomy: 1.2 },
    { scene: 'tidepool-investigation', cast: ['octopus', 'cuttlefish', 'octopus'], roles: ['forager', 'sentinel', 'companion'],
      size: .8, variation: .18, duration: 48, current: .15, spread: 1, intimacy: 1.25, autonomy: 1 }
  ];
  let tableaux = 0, minimumOwnerGlyphs = Infinity, maximumBoxOverlap = 0;
  for (const preset of presets) for (const [width, height] of [[900, 620], [390, 500]]) {
    const host = fakeBrowser();
    const a = createMarineDirector(host.canvas(width, height), {
      scene: preset.scene, duration: preset.duration, current: preset.current, spread: preset.spread,
      intimacy: preset.intimacy, autonomy: preset.autonomy, roles: preset.roles
    }, { ...options, species: preset.cast[0], speciesByAnimal: preset.cast, count: preset.cast.length,
      behaviors: preset.cast.map(() => 'auto'), size: preset.size, sizeVariation: preset.variation,
      density: 1.2, motion: 1.2, depthStrength: 1.2, maxCells: 65536, seed: 20261118 });
    for (const chapter of ['engage', 'explore']) {
      a.showDirectorStill(chapter);
      assert.equal(a.getStats().visibleCount, preset.cast.length);
      const boxes = preset.cast.map(() => ({ count: 0, left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }));
      for (let i = 0; i < a.owners.length; i++) {
        const box = boxes[a.owners[i]];
        if (!box || a.visibility[i] < .1) continue;
        const x = i % a.cols, y = Math.floor(i / a.cols);
        box.count++; box.left = Math.min(box.left, x); box.top = Math.min(box.top, y);
        box.right = Math.max(box.right, x + 1); box.bottom = Math.max(box.bottom, y + 1);
      }
      const context = `${preset.scene} ${chapter} ${width}x${height}`;
      for (const box of boxes) {
        assert(box.count >= 24, `${context}: each intended member needs more than a token visible fragment`);
        assert(box.left > 0 && box.top > 0 && box.right < a.cols && box.bottom < a.rows,
          `${context}: deliberate encounter/exploration stills should keep the cast inside the viewport`);
        minimumOwnerGlyphs = Math.min(minimumOwnerGlyphs, box.count);
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const p = boxes[i], q = boxes[j];
        const overlap = Math.max(0, Math.min(p.right, q.right) - Math.max(p.left, q.left))
          * Math.max(0, Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top));
        const smaller = Math.min((p.right - p.left) * (p.bottom - p.top), (q.right - q.left) * (q.bottom - q.top));
        maximumBoxOverlap = Math.max(maximumBoxOverlap, overlap / smaller);
        assert(overlap / smaller < .45, `${context}: the authored cast must not collapse into one central mass`);
      }
      assertFiniteFrame(a); tableaux++;
    }
    a.destroy(); assert.equal(host.pending, 0);
  }
  receipt.readability = { tableaux, minimumOwnerGlyphs, maximumBoxOverlap };
});

test('individual roles and autonomy alter scene performance without replacing arm topology', () => {
  const { artwork: a } = mount({ scene: 'tidepool-investigation', roles: ['guide', 'forager', 'sentinel'] });
  a.showDirectorStill('explore');
  const before = a.getDirector(), firstFrame = digest(a), armState = a.fish[1].speciesState;
  assert.deepEqual(before.members.map(member => member.role), ['guide', 'forager', 'sentinel']);
  assert(new Set(before.members.map(member => member.motive)).size > 1);
  a.setDirector({ roles: ['sentinel', 'guide', 'forager'] });
  a.showDirectorStill('explore');
  assert.deepEqual(a.getDirector().members.map(member => member.role), ['sentinel', 'guide', 'forager']);
  assert.notEqual(digest(a), firstFrame, 'roles should affect rendered behavior');
  assert.equal(a.fish[1].speciesState, armState, 'director role choices should not recreate geometry state');
  a.setDirector({ autonomy: 0 }); a.showDirectorStill('explore'); const restrained = digest(a);
  a.setDirector({ autonomy: 1.5 }); a.showDirectorStill('explore');
  assert.notEqual(digest(a), restrained, 'autonomy should visibly affect the performance');
  assert.equal(armState.arms.length, 8);
  for (const chain of armState.arms) assert.equal(chain.length, 123);
  a.destroy();
});

test('fixed ordered director input replays exactly, and instances retain independent state', () => {
  for (const scene of scenes) {
    const one = mount({ scene, duration: 20 }), two = mount({ scene, duration: 20 });
    const a = one.artwork, b = two.artwork;
    a.showDirectorStill('engage'); b.showDirectorStill('engage');
    a.setPaused(false); b.setPaused(false);
    for (let frame = 0; frame < 18; frame++) {
      for (const artwork of [a, b]) {
        if (frame === 2) artwork.cueDirector({ type: 'invite', x: .28, y: .15 });
        if (frame === 7) artwork.setDirector({ focus: 2 });
        if (frame === 12) artwork.cueDirector({ type: 'release' });
        artwork.advance(.05);
      }
    }
    assert.equal(digest(a), digest(b)); assert.deepEqual(a.getDirector(), b.getDirector());
    assert.notEqual(a.fish[1].speciesState, b.fish[1].speciesState);
    const untouched = b.getDirector(); a.advance(.1); assert.deepEqual(b.getDirector(), untouched);
    receipt.replay[scene] = digest(b);
    a.destroy(); assert.equal(b.destroyed, false); b.destroy();
  }
});

test('persistent invitation, release and focus affect scene attention without overwriting configuration', () => {
  const { artwork: a } = mount({ scene: 'tidepool-investigation', focus: 2 });
  const { artwork: b } = mount({ scene: 'tidepool-investigation', focus: 2 });
  for (const art of [a, b]) { art.showDirectorStill('explore'); art.setPaused(false); }
  const config = a.getDirector().config;
  a.cueDirector({ type: 'invite', x: .31, y: .22 });
  for (let i = 0; i < 12; i++) { a.advance(.05); b.advance(.05); }
  assert.equal(a.getDirector().focused, 2); assert.deepEqual(a.getDirector().config, config);
  assert.notEqual(digest(a), digest(b), 'a sustained invitation should change actual geometry or poses');
  const attentive = a.getDirector().members[1].motive;
  a.cueDirector({ type: 'release' }); advance(a, .6);
  assert.notEqual(a.getDirector().members[1].motive, attentive, 'release should restore an autonomous motive');
  a.setDirector({ focus: 1 }); assert.equal(a.getDirector().focused, 1);
  a.showDirectorStill('explore'); const stillTime = a.getDirector().time;
  a.cueDirector({ type: 'invite', x: -.2, y: .12 });
  assert.equal(a.getDirector().cue.active, true);
  a.cueDirector({ type: 'release' });
  assert.equal(a.getDirector().cue.active, false); assert.equal(a.getDirector().cue.interest, 0);
  assert.equal(a.getDirector().time, stillTime); assert.equal(a.paused, true);
  a.setOptions({ motion: 0 }); a.setPaused(false);
  a.cueDirector({ type: 'invite', x: .2, y: -.12 });
  a.advance(.1); const stationaryTime = a.getDirector().time;
  assert(a.getDirector().cue.interest > .9);
  a.cueDirector({ type: 'release' }); advance(a, 4, .1);
  assert.equal(a.getDirector().time, stationaryTime, 'motion zero holds the authored scene clock');
  assert(a.getDirector().cue.interest < .001, 'attention must settle in real elapsed time even while travel is stopped');
  a.destroy(); b.destroy();
});

test('director disturbance respects focused owner, manta no-ink, octopus ink and recovery', () => {
  for (const [focus, species] of [[1, 'manta'], [2, 'octopus']]) {
    const { artwork: a } = mount({ scene: 'reef-rendezvous', focus });
    a.showDirectorStill('explore');
    a.cueDirector({ type: 'disturb', id: focus });
    assert(a.fish.every(fish => !fish.reaction.active), 'a disturbance must not animate a paused tableau');
    a.setPaused(false); a.cueDirector({ type: 'disturb' });
    assert.equal(a.fish.filter(fish => fish.reaction.active).length, 1);
    assert.equal(a.fish[focus - 1].species, species); assert(a.fish[focus - 1].reaction.active);
    advance(a, .65);
    if (species === 'manta') {
      assert.equal(a.ink.length, 0); assert.equal(a.getStats().inkGlyphs, 0);
    } else {
      assert(a.ink.length > 0); assert(a.getStats().inkGlyphs > 0, 'octopus ink must reach the actual raster draw pass');
      assert(a.ink.every(particle => particle.lightInk === true));
      assert(a.ink.every(particle => particle.directorInk === true && particle.life >= 3 && particle.life <= 4),
        'director ink has its own finite lifetime without changing the classic emitter');
      assert.equal(a.fish[1].speciesState.diagnostics.mode, 'cup');
    }
    advance(a, .85);
    if (species === 'octopus') assert.equal(a.fish[1].speciesState.diagnostics.mode, 'stream');
    advance(a, 3.3, .1);
    if (species === 'octopus') assert.equal(a.getStats().inkGlyphs, 0, 'directed ink must leave the composition readable by 4.8 seconds');
    advance(a, 4.2, .1);
    assert.equal(a.fish[focus - 1].reaction.active, false);
    assertFiniteFrame(a); a.destroy();
  }
});

test('generated browser global matches canonical director stills and ordered input simulation', async () => {
  const source = await readFile(new URL('../dist/artwork.js', import.meta.url), 'utf8');
  const snapshot = value => JSON.parse(JSON.stringify(value));
  for (const scene of scenes) {
    const globalHost = fakeBrowser(), moduleHost = fakeBrowser();
    const scope = vm.createContext({ window: globalHost.view, console });
    vm.runInContext(source, scope, { filename: 'generated-artwork.js' });
    const GlobalArtwork = globalHost.view.CuttlefishArtwork;
    assert.equal(typeof GlobalArtwork.prototype.setDirector, 'function', 'regenerate the compatibility artifact from canonical source');
    assert.deepEqual(snapshot(GlobalArtwork.directorScenes), snapshot(CuttlefishArtwork.directorScenes));
    const global = new GlobalArtwork(globalHost.canvas(640, 460), options);
    const module = new CuttlefishArtwork(moduleHost.canvas(640, 460), options);
    for (const artwork of [global, module]) {
      artwork.setDirector({ scene, focus: 2, roles: ['guide', 'forager', 'sentinel'] });
      artwork.showDirectorStill('engage');
      artwork.cueDirector({ type: 'invite', x: .28, y: .15 });
    }
    assert.equal(digest(global), digest(module));
    assert.deepEqual(snapshot(global.getDirector()), snapshot(module.getDirector()));
    for (const artwork of [global, module]) artwork.setPaused(false);
    for (let frame = 0; frame < 12; frame++) {
      for (const artwork of [global, module]) {
        if (frame === 2) artwork.cueDirector({ type: 'disturb' });
        if (frame === 4) artwork.setDirector({ current: -.25, autonomy: .7 });
        if (frame === 7) artwork.cueDirector({ type: 'release' });
        artwork.advance(.05);
      }
    }
    assert.equal(digest(global), digest(module));
    assert.deepEqual(snapshot(global.getDirector()), snapshot(module.getDirector()));
    assert.deepEqual(snapshot(global.ink), snapshot(module.ink));
    assert.equal(global.getStats().inkGlyphs, module.getStats().inkGlyphs);
    for (const artwork of [global, module]) artwork.showDirectorStill('depart');
    assert.equal(digest(global), digest(module));
    assert.deepEqual(snapshot(global.getDirector()), snapshot(module.getDirector()));
    global.destroy(); module.destroy();
    assert.equal(globalHost.pending + moduleHost.pending, 0);
    assert.equal(globalHost.document.listenerCount + moduleHost.document.listenerCount, 0);
  }
});

test('director pause, still, restart, hidden and reduced motion retain shared scheduler ownership', () => {
  const host = fakeBrowser({ reducedMotion: true }), first = host.canvas(640, 460), second = host.canvas(640, 460);
  const a = createMarineDirector(first, { scene: scenes[0] }, { ...options, autoStart: true });
  const b = createMarineDirector(second, { scene: scenes[1] }, { ...options, autoStart: true });
  assert(a.paused && b.paused); assert.equal(host.pending, 0);
  a.showDirectorStill('explore'); const tableau = digest(a), time = a.getDirector().time;
  host.frame(10000); a.render(); assert.equal(digest(a), tableau); assert.equal(a.getDirector().time, time);
  a.setPaused(false); b.setPaused(false); assert.equal(host.pending, 1);
  host.frame(); host.frame(50); assert(a.getDirector().time > time);
  const hidden = a.getDirector().time; host.hide(true); assert.equal(host.pending, 0);
  host.frame(300000); assert.equal(a.getDirector().time, hidden);
  host.hide(false); assert.equal(host.pending, 1); host.frame(); assert.equal(a.getDirector().time, hidden);
  host.setReduced(true); assert(a.paused && b.paused); assert.equal(host.pending, 0);
  host.setReduced(false); assert(a.paused && b.paused); assert.equal(host.pending, 0);
  a.restart(); assert(a.paused); assert.equal(a.getDirector().chapter, 'arrive'); assert.equal(a.getDirector().time, 0);
  a.setDirector(null); assert.equal(a.getDirector().enabled, false); assert.equal(a.getDirector().config, null);
  a.setDirector({ scene: scenes[2] }); assert(a.paused); assert.equal(host.pending, 0);
  a.destroy(); a.destroy(); b.destroy();
  assert.equal(host.pending, 0);
  assert.equal(host.document.listenerCount + host.view.listenerCount + host.motion.listenerCount + first.listenerCount + second.listenerCount, 0);
  assert.equal(host.resizes.size + host.intersections.size, 0);
});

test('director respects coarse/portrait/wide grid budgets and deterministic paused resizing', () => {
  for (const [width, height] of [[320, 240], [300, 800], [1600, 300]]) {
    const host = fakeBrowser(), canvas = host.canvas(width, height);
    const a = createMarineDirector(canvas, { scene: 'reef-rendezvous', current: -1, spread: 1.5, intimacy: 1.5 },
      { ...options, count: 6, speciesByAnimal: [...cast, ...cast], size: 1.1, density: 1.5, maxCells: 4096 });
    a.showDirectorStill('explore'); assertFiniteFrame(a);
    const clock = a.getDirector().time, state = a.fish[1].speciesState;
    canvas.rect.width += 17; a.resize(); assert.equal(a.getDirector().time, clock); assert(a.paused);
    assert.equal(a.fish[1].speciesState, state); assert.equal(host.pending, 0); assertFiniteFrame(a);
    a.destroy();
  }
});

test.after(() => console.log('MARINE_DIRECTOR_RECEIPT ' + JSON.stringify(receipt)));
