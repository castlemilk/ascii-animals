import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as Original from '../lib/public/butterfly.js';
import { createScheduler } from '../lib/core/scheduler.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const variation = 'species/butterfly/variations/sunpatch';
const temporary = await mkdtemp(path.join(tmpdir(), 'ascii-butterfly-sunpatch-'));
after(() => rm(temporary, { recursive: true, force: true }));

// The private source is outside the package compiler's inputs. Compile it with
// the same strictness into disposable output, preserving its relative imports.
// No package exports, canonical build output or repository configuration change.
let privateRuntime, privateRenderer;
try {
  execFileSync(process.execPath, [
    path.join(root, 'node_modules/typescript/bin/tsc'),
    '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext',
    '--strict', '--exactOptionalPropertyTypes', '--noUncheckedIndexedAccess',
    '--lib', 'ES2022,DOM', '--noEmitOnError',
    '--rootDir', root, '--outDir', temporary,
    path.join(root, variation, 'index.ts'), path.join(root, variation, 'render.ts'),
  ], { cwd: root, encoding: 'utf8' });
  await writeFile(path.join(temporary, 'package.json'), '{"type":"module"}\n');
  await mkdir(path.join(temporary, 'src/core'), { recursive: true });
  await copyFile(path.join(root, 'src/core/scheduler.js'), path.join(temporary, 'src/core/scheduler.js'));
  privateRuntime = await import(pathToFileURL(path.join(temporary, variation, 'index.js')));
  privateRenderer = await import(pathToFileURL(path.join(temporary, variation, 'render.js')));
} catch (error) {
  await rm(temporary, { recursive: true, force: true });
  if (error.stdout) error.message += `\n${error.stdout}`;
  throw error;
}
const {
  createSunpatchButterflyModel: createButterflyModel,
  createSunpatchButterflyArtwork: createButterflyArtwork,
} = privateRuntime;
const { sampleButterflyCharacterPose } = privateRenderer;

// Logical geometry and lifecycle evidence. Real browser captures remain a
// separate acceptance gate for facial readability, timing and touch behavior.
function pigmentCenter(frame) {
  let x = 0, y = 0, count = 0;
  frame.cells.forEach((cell, index) => {
    if (cell.glyph === ' ' || cell.ink !== 1) return;
    x += index % frame.columns;
    y += Math.floor(index / frame.columns);
    count++;
  });
  assert(count > 12, 'The focal butterfly must retain a visible pigment shape.');
  return { x: x / count, y: y / count };
}

function runCue(kind, x, y, ticks) {
  const model = createButterflyModel({ seed: 17 });
  model.guide(x, y);
  model.cue(kind);
  model.advanceTicks(ticks);
  return model;
}

test('curious vertical guidance moves the specimen while perch keeps its root planted', () => {
  const curious = createButterflyModel({ behavior: 'curious' });
  curious.advanceTicks(137);
  curious.guide(0, -1);
  const up = curious.frame();
  const upperPose = sampleButterflyCharacterPose(curious.getOptions(), curious.getState(), null);
  curious.guide(0, 1);
  const down = curious.frame();
  const lowerPose = sampleButterflyCharacterPose(curious.getOptions(), curious.getState(), null);
  assert.notEqual(up.text, down.text, 'Vertical guide input must change visible curious behavior.');
  assert(lowerPose.y > upperPose.y + .1, 'Down and up invitations must move in the requested directions.');
  assert.equal(lowerPose.x, upperPose.x, 'Vertical guidance must not move the specimen sideways.');

  const perched = createButterflyModel({ behavior: 'perch', sway: .4 });
  const root = sampleButterflyCharacterPose(perched.getOptions(), perched.getState(), null);
  for (const ticks of [17, 91, 240]) {
    perched.advanceTicks(ticks);
    const pose = sampleButterflyCharacterPose(perched.getOptions(), perched.getState(), null);
    assert.equal(pose.x, root.x, 'A perched root must not inherit idle side-to-side drift.');
    assert.equal(pose.y, root.y, 'A perched root must not inherit hover bobbing.');
  }
});

test('specimen flower choice changes the landing side and later hover cannot drag it', () => {
  const left = runCue('gather', -.64, .66, 160);
  const right = runCue('gather', .64, .66, 160);
  const a = pigmentCenter(left.frame()), b = pigmentCenter(right.frame());
  assert(a.x < 60 && b.x > 60, 'Each flower invitation must land on the selected side.');
  assert(b.x - a.x > 20, 'Left and right invitations must have visibly different outcomes.');

  const anchored = runCue('gather', -.64, .66, 70);
  anchored.guide(.9, -.8);
  anchored.cue('gather');
  anchored.advanceTicks(90);
  assert(Math.abs(pigmentCenter(anchored.frame()).x - a.x) < 1,
    'Pointer motion and repeat input cannot retarget an active landing.');
});

test('specimen startled lift responds to the side of the disturbance', () => {
  const leftInput = pigmentCenter(runCue('breeze', -.8, 0, 75).frame());
  const rightInput = pigmentCenter(runCue('breeze', .8, 0, 75).frame());
  assert(leftInput.x > rightInput.x + 10, 'A left disturbance must lift right; a right disturbance must lift left.');
  assert(leftInput.y < 25 && rightInput.y < 25, 'Both responses must visibly gain height.');
});

test('character cues expire at their bounded lifetime and repeated cues cannot extend it', () => {
  for (const [kind, duration] of [['gather', 300], ['breeze', 300], ['rest', 420]]) {
    const model = createButterflyModel();
    const baseline = createButterflyModel();
    model.guide(-.64, .66);
    baseline.guide(-.64, .66);
    model.cue(kind);
    model.advanceTicks(duration - 1);
    model.cue(kind);
    model.advanceTicks(1);
    baseline.advanceTicks(duration);
    assert.deepEqual(model.frame(), baseline.frame(), `${kind} must complete without an input queue.`);
  }
});

test('character cue replay remains equal across tick partitions and invalid input is atomic', () => {
  const replay = partition => {
    const model = createButterflyModel({ seed: 29 });
    model.guide(.8, -.2);
    model.cue('breeze');
    for (const ticks of partition) model.advanceTicks(ticks);
    const before = model.frame();
    assert.throws(() => model.cue('unknown'), /Invalid butterfly cue/);
    assert.deepEqual(model.frame(), before);
    return model;
  };
  const whole = replay([129]), split = replay([1, 17, 31, 80]);
  assert.deepEqual(split.getState(), whole.getState());
  assert.deepEqual(split.frame(), whole.frame());
  const before = split.frame();
  split.frame(); split.frame();
  assert.deepEqual(split.frame(), before, 'Sampling cannot age a reaction.');
});

test('a new cue and explicit release keep the current character position before easing away', () => {
  for (const side of [-1, 1]) {
    const model = runCue('gather', side * .64, .66, 160);
    const landed = pigmentCenter(model.frame());
    model.guide(side * .8, 0);
    model.cue('breeze');
    const startled = pigmentCenter(model.frame());
    assert(Math.hypot(landed.x - startled.x, landed.y - startled.y) < 2,
      'An interrupted landing must anticipate from its actual position, not teleport to idle.');
    model.advanceTicks(70);
    const escaped = pigmentCenter(model.frame());
    model.release();
    const released = pigmentCenter(model.frame());
    assert(Math.hypot(escaped.x - released.x, escaped.y - released.y) < 2,
      'Release must start its recovery at the visible pose.');
    model.advanceTicks(89);
    model.release();
    model.advanceTicks(1);
    const baseline = createButterflyModel({ seed: 17 });
    baseline.advanceTicks(320);
    assert.deepEqual(model.frame(), baseline.frame(), 'Repeated release cannot prolong the 90-tick recovery.');
  }
});

function withAttributes(canvas) {
  const attributes = new Map([['aria-label', 'Existing gallery label'], ['role', 'img']]);
  canvas.getAttribute = name => attributes.get(name) ?? null;
  canvas.setAttribute = (name, value) => attributes.set(name, String(value));
  canvas.removeAttribute = name => attributes.delete(name);
  return canvas;
}

function key(canvas, value, options = {}) {
  let prevented = false;
  canvas.emit('keydown', { key: value, repeat: false, altKey: false, ctrlKey: false, metaKey: false,
    preventDefault() { prevented = true; }, ...options });
  return prevented;
}

test('specimen keyboard offers both moments without claiming Space, Tab or classic controls', () => {
  const host = fakeBrowser({ reducedMotion: true });
  const canvas = withAttributes(host.canvas());
  const art = createButterflyArtwork(canvas);
  host.intersect(canvas, true);
  assert.equal(key(canvas, 'ArrowLeft'), true);
  assert.equal(key(canvas, 'Enter'), true);
  const left = art.getFrame();
  assert.equal(art.getGarden().cue, 'gather');
  assert.equal(key(canvas, 'ArrowRight'), true);
  assert.equal(key(canvas, 'ArrowRight'), true);
  assert.equal(key(canvas, 'Enter'), true);
  assert.notEqual(art.getFrame().text, left.text, 'A deliberate still invitation can choose the other flower.');
  assert.equal(key(canvas, 'B'), true);
  assert.equal(art.getGarden().cue, 'breeze');
  assert.equal(key(canvas, 'Escape'), true);
  assert.equal(art.getGarden().cue, 'none');
  assert.equal(key(canvas, ' '), false, 'The gallery keeps its playback shortcut.');
  assert.equal(key(canvas, 'Tab'), false, 'Tab must leave the canvas.');
  assert.equal(key(canvas, 'Enter', { ctrlKey: true }), false);
  assert.equal(host.pending, 0, 'Keyboard inputs must never override reduced motion.');
  assert.equal(art.getStatus().tick, 0);
  assert.equal(canvas.getAttribute('aria-label'), 'Existing gallery label');
  assert.equal(canvas.getAttribute('role'), 'img');
  assert.match(canvas.getAttribute('aria-description'), /Enter.*B sends a breeze/);
  art.update({ director: { scene: 'nectar' } });
  assert.equal(key(canvas, 'Enter'), false, 'The classic director owns its existing keys.');
  assert.equal(canvas.getAttribute('aria-description'), null);
  art.dispose();
  assert.equal(canvas.listenerCount, 0);
});

test('complete specimen touch keeps the cue; cancellation, offscreen state and disposal release work', () => {
  const host = fakeBrowser();
  const canvas = host.canvas(672, 500); // exactly the declared 120:50 grid aspect
  const art = createButterflyArtwork(canvas);
  host.intersect(canvas, true);
  const touch = { clientX: 121, clientY: 415, pointerType: 'touch', pointerId: 1 };
  canvas.emit('pointerdown', touch);
  assert.equal(art.getGarden().cue, 'gather');
  canvas.emit('pointerup', touch);
  canvas.emit('lostpointercapture', touch);
  canvas.emit('pointerleave', touch);
  assert.equal(art.getGarden().cue, 'gather', 'A completed tap must keep its captured invitation.');
  assert.equal(art.getGarden().pointer.active, false, 'Touch hover must not remain stuck.');
  host.frame(); host.frame();
  const tick = art.getStatus().tick;
  host.intersect(canvas, false);
  assert.equal(host.pending, 0);
  for (let n = 0; n < 3; n++) host.frame(1000);
  assert.equal(art.getStatus().tick, tick, 'Offscreen time must not advance reactions.');
  host.intersect(canvas, true);
  host.frame(60000);
  assert.equal(art.getStatus().tick, tick, 'Returning cannot catch up hidden wall time.');
  canvas.emit('pointerdown', { ...touch, clientX: 540, clientY: 220 });
  assert.equal(art.getGarden().cue, 'breeze', 'The open-air tap selects a startled lift.');
  canvas.emit('pointercancel', touch);
  assert.equal(art.getGarden().cue, 'none');
  art.dispose();
  assert.equal(host.pending, 0);
  assert.equal(canvas.listenerCount, 0);
  assert.equal(host.intersections.size, 0);
});

test('paused character posters remain static and restart preserves pause', () => {
  const host = fakeBrowser();
  const canvas = host.canvas();
  const art = createButterflyArtwork(canvas, { paused: true });
  host.intersect(canvas, true);
  art.guide(-.64, .66);
  art.cue('gather');
  const gather = art.getFrame();
  art.cue('breeze');
  const breeze = art.getFrame();
  assert.notEqual(gather.text, breeze.text);
  for (let n = 0; n < 3; n++) host.frame(1000);
  assert.deepEqual(art.getFrame(), breeze);
  assert.equal(art.getStatus().tick, 0);
  assert.equal(host.pending, 0);
  art.restart();
  assert.equal(art.getOptions().paused, true);
  assert.equal(art.getStatus().tick, 0);
  assert.equal(art.getGarden().cue, 'none');
  art.dispose();
});


function frameHash(frame) {
  // Include every glyph, tone and semantic ink; property insertion order is not
  // part of a logical frame's identity.
  const logical = [frame.columns, frame.rows, frame.phase, frame.text,
    frame.cells.map(({ glyph, tone, ink = 0 }) => [glyph, tone, ink])];
  return createHash('sha256').update(JSON.stringify(logical)).digest('hex');
}

// Independently derived from the verified 2026-11-21 Sunpatch review archive,
// not from this private implementation. Archived source SHA256:
// controller 9d588f9b9d4068e2e620fd9e127435bdf4868bf476bcbcdc8c1b119b319fbf56
// renderer   0f877e869686b371a7e0132d0872abc6b80a48ee7381977a69f2fcb3556b4829
// These freeze authored logical output, not browser pixels or font rasterizing.
const archivedFrames = [
  ["idle",{},[],"d8741e0ab56d2cfde032aab5deb43fd1eb294037c071819936cfe4e9676fe3d4"],
  ["gather-left-anticipation",{"seed":17},[["guide",-0.64,0.66],["cue","gather"],["advanceTicks",12]],"0afc7ec8602e3237d49a41d999ff4166bbef62c220906da4f4f7c998d183e727"],
  ["gather-left-settle",{"seed":17},[["guide",-0.64,0.66],["cue","gather"],["advanceTicks",160]],"c4ee768e083c8bbe95c7cdc4c55ffaa21bea54496eea40a7e8218c18e422ec90"],
  ["gather-right-settle",{"seed":17},[["guide",0.64,0.66],["cue","gather"],["advanceTicks",160]],"5e0efee0705d30f17ab6cce7736a4c8e2ca9226e97bdb899f6bde6e4d565bbc3"],
  ["breeze-left-response",{"seed":17},[["guide",-0.8,0],["cue","breeze"],["advanceTicks",75]],"17ce7b2544db57d5fbe002b83dc2bc59f6ed22f4abaa86d51b5a0d8b52aa6431"],
  ["breeze-right-response",{"seed":17},[["guide",0.8,0],["cue","breeze"],["advanceTicks",75]],"fbe1f0dacb9b9412189a90ce0539a58ae891a078c5d5788daa050952f7e8a364"],
  ["interrupted-recovery",{"seed":17},[["guide",-0.64,0.66],["cue","gather"],["advanceTicks",160],["guide",0.8,0],["cue","breeze"],["advanceTicks",70],["release"],["advanceTicks",45]],"13a90ac36560e0363e367417ec9cd5c137f6172267bc79b1d71fb20cca314140"],
  ["phone-landing",{"columns":80,"rows":32,"seed":17,"scale":1.3},[["guide",0.64,0.66],["cue","gather"],["advanceTicks",160]],"54f09b6630680b23f627ac926b9a156a16c07ea86dae101b6250e14cd97ae046"],
  ["nectar-garden",{"seed":31,"director":{"scene":"nectar","count":4,"roles":["forager","scout","basker","wanderer"]}},[["advanceTicks",169],["guide",-0.5,0.4],["cue","gather"],["advanceTicks",130]],"bd8a9ed118716e13f14ff83f09bfa7c7313ad0bdbf64a4ce8c6c0e504ef3bef9"],
  ["paused-breeze",{"paused":true},[["guide",0.8,0],["cue","breeze",true]],"2e47945990d84da203ae771b936e5bc0dca297aa93e0a3175feb732f2b0cc584"],
  ["curious-up",{"behavior":"curious"},[["advanceTicks",137],["guide",0,-1]],"a996bc628a731bcb287e21c056ca77d311df65497f4636e4726f6434f269a4aa"],
  ["perch",{"behavior":"perch","sway":0.4},[["advanceTicks",137]],"d4818ca92c6644ae604b57614c6cb6328240e6c64e207ab6b6b82623063e6874"],
];

test('private Sunpatch keeps the exact archived logical frames across authored outcomes', () => {
  for (const [name, options, events, expected] of archivedFrames) {
    const model = createButterflyModel(options);
    for (const [method, ...args] of events) model[method](...args);
    assert.equal(frameHash(model.frame()), expected, name + ' must preserve the saved Sunpatch output.');
  }
});

test('Sunpatch remains an explicit private import and preserves Original exports, defaults and frames', async () => {
  assert.deepEqual(Object.keys(Original).sort(), [
    'BUTTERFLY_DEFAULTS', 'createButterflyArtwork', 'createButterflyModel', 'normalizeButterflyOptions',
  ]);
  assert.deepEqual(Object.keys(privateRuntime).sort(), [
    'createSunpatchButterflyArtwork', 'createSunpatchButterflyModel',
  ]);
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  assert.deepEqual(manifest.exports['./butterfly'], {
    types: './lib/public/butterfly.d.ts', import: './lib/public/butterfly.js', default: './lib/public/butterfly.js',
  });
  assert(!JSON.stringify(manifest.exports).toLowerCase().includes('sunpatch'),
    'The private variation must not acquire a package export.');
  assert.throws(() => Original.createButterflyModel({ variation: 'sunpatch' }), /Unknown butterfly option/);

  // These Original hashes were independently compiled from main 3b5ffcce7bea56e1402fc16d0edc2c14c3cd5779.
  const idleHash = '39b43d0ecf51acc2eba0e852d343d56cda7d480323cd2a2507cdc91ac829411c';
  const greetingHash = '658d090603b20c17dabb2009b95ee74d8c8d5a7dff7780729e4b853b070e95a5';
  const original = Original.createButterflyModel();
  const defaultOptions = structuredClone(Original.BUTTERFLY_DEFAULTS);
  const originalScenes = structuredClone(original.getScenes());
  assert.equal(frameHash(original.frame()), idleHash);
  const greeting = Original.createButterflyModel({ seed: 17 });
  greeting.guide(-.64, .66); greeting.greet(); greeting.advanceTicks(90);
  assert.equal(frameHash(greeting.frame()), greetingHash);

  const sunpatch = createButterflyModel();
  assert.deepEqual(sunpatch.getOptions(), original.getOptions(), 'Variation selection must not change the options contract.');
  assert.notEqual(frameHash(sunpatch.frame()), idleHash, 'Sunpatch must select the saved different artwork.');
  assert.equal(sunpatch.getScenes()[0].description,
    'Sunpatch: paired cream markings, curious eyes and two flower invitations.');
  assert.equal(original.getScenes()[0].description,
    'A close wing study: branching veins, amber cells and pale marginal spots.');
  assert(Object.isFrozen(sunpatch.getScenes()));
  assert(sunpatch.getScenes().every(scene => Object.isFrozen(scene) && Object.isFrozen(scene.acts)));

  sunpatch.guide(-.64, .66); sunpatch.cue('gather'); sunpatch.advanceTicks(160);
  sunpatch.configure({ palette: 'rose', director: { scene: 'nectar', count: 4 } });
  sunpatch.cue('breeze'); sunpatch.advanceTicks(75); sunpatch.reset();
  assert.equal(frameHash(original.frame()), idleHash, 'Opting in elsewhere cannot modify a live Original model.');
  assert.equal(frameHash(greeting.frame()), greetingHash);
  assert.equal(frameHash(Original.createButterflyModel().frame()), idleHash);
  assert.deepEqual(Original.BUTTERFLY_DEFAULTS, defaultOptions);
  assert.deepEqual(original.getScenes(), originalScenes);
});

function assertReleased(host, canvases) {
  assert.equal(host.pending, 0, 'No animation callback may remain after teardown.');
  for (const canvas of canvases) assert.equal(canvas.listenerCount, 0);
  assert.equal(host.motion.listenerCount, 0);
  assert.equal(host.document.listenerCount, 0);
  assert.equal(host.view.listenerCount, 0);
  assert.equal(host.resizes.size, 0);
  assert.equal(host.intersections.size, 0);
}

test('same-canvas Original to Sunpatch to Original replacement has one controller and restores host accessibility', t => {
  const host = fakeBrowser(), canvas = withAttributes(host.canvas());
  canvas.setAttribute('aria-description', 'Host-provided description');
  const controllers = [];
  t.after(() => { for (const art of controllers) art.dispose(); });
  const mount = factory => {
    const art = factory(canvas);
    controllers.push(art);
    assert.equal(host.resizes.size, 1);
    assert.equal(host.intersections.size, 1);
    assert.equal(host.document.listenerCount, 1);
    assert.equal(host.motion.listenerCount, 1);
    assert.equal(host.pending, 0, 'A replacement waits for its own viewport observation.');
    return art;
  };

  const first = mount(Original.createButterflyArtwork);
  const originalFrame = first.getFrame(), originalListeners = canvas.listenerCount;
  host.intersect(canvas, true);
  assert.equal(host.pending, 1);
  host.frame(); host.frame();
  assert(first.getStatus().tick > 0);
  first.dispose();
  assertReleased(host, [canvas]);
  assert.equal(canvas.getAttribute('aria-description'), 'Host-provided description');

  const sunpatch = mount(createButterflyArtwork);
  assert.equal(sunpatch.getStatus().tick, 0, 'The new choice starts with its own deterministic state.');
  assert.match(canvas.getAttribute('aria-description'), /Enter.*B sends a breeze/);
  host.intersect(canvas, true);
  assert.equal(host.pending, 1);
  assert.equal(key(canvas, 'ArrowLeft'), true);
  assert.equal(key(canvas, 'Enter'), true);
  host.frame(); host.frame();
  assert(sunpatch.getStatus().tick > 0);
  assert.equal(sunpatch.getGarden().cue, 'gather');
  const sunpatchTick = sunpatch.getStatus().tick;
  sunpatch.dispose();
  assertReleased(host, [canvas]);
  assert.equal(canvas.getAttribute('aria-description'), 'Host-provided description');
  assert.equal(canvas.getAttribute('aria-label'), 'Existing gallery label');
  assert.equal(canvas.getAttribute('role'), 'img');

  const last = mount(Original.createButterflyArtwork);
  assert.equal(canvas.listenerCount, originalListeners, 'Sunpatch listeners must not accumulate across replacement.');
  assert.deepEqual(last.getFrame(), originalFrame, 'Returning to Original must restore its original initial frame.');
  assert.equal(key(canvas, 'Enter'), false, 'The retired variant cannot retain its keyboard behavior.');
  assert.equal(last.getGarden().cue, 'none');
  host.intersect(canvas, true);
  assert.equal(host.pending, 1);
  host.frame(60000);
  assert.equal(last.getStatus().tick, 0, 'A replacement cannot inherit the previous clock.');
  host.frame();
  assert(last.getStatus().tick > 0);
  assert.equal(sunpatch.getStatus().tick, sunpatchTick, 'Retired models must receive no subsequent ticks.');
  last.dispose();
  assertReleased(host, [canvas]);
});

test('mixed Original and Sunpatch instances share an explicit host clock and dispose only their own resources', t => {
  const host = fakeBrowser(), originalCanvas = host.canvas(), sunpatchCanvas = withAttributes(host.canvas());
  const scheduler = createScheduler({
    requestFrame: callback => host.view.requestAnimationFrame(callback),
    cancelFrame: handle => host.view.cancelAnimationFrame(handle),
  });
  const original = Original.createButterflyArtwork(originalCanvas, { frameSource: scheduler });
  const sunpatch = createButterflyArtwork(sunpatchCanvas, { frameSource: scheduler });
  t.after(() => { original.dispose(); sunpatch.dispose(); scheduler.dispose(); });
  host.intersect(originalCanvas, true); host.intersect(sunpatchCanvas, true);
  assert.equal(scheduler.size, 2);
  assert.equal(host.pending, 1, 'The explicitly shared host clock owns only one RAF.');
  host.frame(); host.frame();
  const originalFrame = original.getFrame();
  sunpatch.guide(-.64, .66); sunpatch.cue('gather');
  assert.deepEqual(original.getFrame(), originalFrame, 'A Sunpatch invitation cannot modify its Original sibling.');

  host.intersect(sunpatchCanvas, false);
  const hiddenTick = sunpatch.getStatus().tick, originalTick = original.getStatus().tick;
  assert.equal(scheduler.size, 1);
  host.frame();
  assert.equal(sunpatch.getStatus().tick, hiddenTick);
  assert(original.getStatus().tick > originalTick, 'The visible sibling must keep running.');
  host.intersect(originalCanvas, false);
  assert.equal(scheduler.size, 0);
  assert.equal(host.pending, 0, 'Two offscreen instances must perform no clock work.');
  host.frame(60000);
  host.intersect(sunpatchCanvas, true); host.intersect(originalCanvas, true);
  host.frame(60000);
  assert.equal(sunpatch.getStatus().tick, hiddenTick, 'Re-entry must not catch up offscreen wall time.');

  host.setReduced(true);
  assert.equal(scheduler.size, 0);
  sunpatch.play(); sunpatch.cue('breeze'); original.play(); original.pulse();
  assert.equal(host.pending, 0, 'Neither choice may override system reduced motion.');
  assert.equal(scheduler.size, 0);
  host.setReduced(false);
  assert.equal(scheduler.size, 2);
  sunpatch.dispose();
  assert.equal(scheduler.size, 1);
  assert.equal(host.pending, 1);
  assert.equal(sunpatchCanvas.listenerCount, 0);
  const survivingTick = original.getStatus().tick;
  host.frame(); host.frame();
  assert(original.getStatus().tick > survivingTick, 'Disposing Sunpatch must leave Original active.');
  original.dispose();
  assert.equal(scheduler.size, 0);
  assertReleased(host, [originalCanvas, sunpatchCanvas]);

  let calls = 0;
  const unsubscribe = scheduler.subscribe(() => calls++);
  host.frame();
  assert.equal(calls, 1, 'Neither artwork owns or disposes the borrowed scheduler.');
  unsubscribe();
  assert.equal(host.pending, 0);
});
