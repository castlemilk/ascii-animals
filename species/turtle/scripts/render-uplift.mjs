/**
 * Matched turtle evidence: real controller Canvas2D calls on native Skia Canvas.
 * The DOM, scheduler and input delivery are mocked. These are NOT browser or
 * phone screenshots, CSS reflow, accessibility, touch-device or FPS evidence.
 *
 *   npm run build
 *   node species/turtle/scripts/render-uplift.mjs /absolute/output [--motion]
 *
 * --baseline-only captures the pinned baseline before a candidate is built.
 * No dependencies are installed; @napi-rs/canvas and optional ffmpeg must exist.
 */
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const args = process.argv.slice(2);
for (const arg of args.filter(arg => arg.startsWith('--'))) {
  if (!['--motion', '--baseline-only'].includes(arg)) throw new Error(`Unknown option: ${arg}`);
}
if (args.filter(arg => !arg.startsWith('--')).length > 1) throw new Error('Supply one output directory');
const output = path.resolve(args.find(arg => !arg.startsWith('--')) || path.join(root, '..', 'turtle-uplift-evidence'));
const baselineOnly = args.includes('--baseline-only');
const baselineCommit = 'b8f222dab868821f27bf2a64a98434f3483fc8e6';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const require = createRequire(import.meta.url);
let canvasModule;
try { canvasModule = require.resolve('@napi-rs/canvas'); }
catch (error) {
  const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if (!runtime) throw new Error('Existing @napi-rs/canvas is required; nothing was installed.', { cause: error });
  canvasModule = require.resolve(path.join(runtime, '@napi-rs/canvas'));
}
const { createCanvas, loadImage } = require(canvasModule);
const nativeVersion = require(path.join(path.dirname(canvasModule), 'package.json')).version;
await mkdir(output, { recursive: true });

// Baseline bytes are from the exact integration base, never the live site.
const baselineRoot = path.join(output, '.baseline');
await mkdir(path.join(baselineRoot, 'public'), { recursive: true });
await mkdir(path.join(baselineRoot, 'core'), { recursive: true });
await writeFile(path.join(baselineRoot, 'package.json'), '{"type":"module"}\n');
const baselineSource = execFileSync('git', ['show', `${baselineCommit}:src/public/turtle.ts`], { cwd: root });
const baselineRuntime = execFileSync('git', ['show', `${baselineCommit}:dist/turtle/runtime/public/turtle.js`], { cwd: root });
const baselineScheduler = execFileSync('git', ['show', `${baselineCommit}:dist/turtle/runtime/core/scheduler.js`], { cwd: root });
await writeFile(path.join(baselineRoot, 'public/turtle.js'), baselineRuntime);
await writeFile(path.join(baselineRoot, 'core/scheduler.js'), baselineScheduler);
const { createTurtleArtwork: createBaseline } = await import(pathToFileURL(path.join(baselineRoot, 'public/turtle.js')).href);

const sourceHashes = {
  'baseline/src/public/turtle.ts': sha256(baselineSource),
  'baseline/dist/turtle/runtime/public/turtle.js': sha256(baselineRuntime),
  'baseline/dist/turtle/runtime/core/scheduler.js': sha256(baselineScheduler),
  'test/helpers/fake-browser.mjs': sha256(await readFile(path.join(root, 'test/helpers/fake-browser.mjs'))),
  'species/turtle/scripts/render-uplift.mjs': sha256(await readFile(fileURLToPath(import.meta.url)))
};
const factories = [['before', createBaseline]];
if (!baselineOnly) {
  const source = await readFile(path.join(root, 'src/public/turtle.ts'), 'utf8');
  const compiledMap = JSON.parse(await readFile(path.join(root, 'lib/public/turtle.js.map'), 'utf8'));
  if (!compiledMap.sourcesContent?.includes(source)) throw new Error('Compiled turtle differs from current TypeScript. Build before capturing.');
  sourceHashes['src/public/turtle.ts'] = sha256(source);
  sourceHashes['lib/public/turtle.js'] = sha256(await readFile(path.join(root, 'lib/public/turtle.js')));
  sourceHashes['lib/core/scheduler.js'] = sha256(await readFile(path.join(root, 'lib/core/scheduler.js')));
  const { createTurtleArtwork } = await import(pathToFileURL(path.join(root, 'lib/public/turtle.js')).href);
  factories.push(['after', createTurtleArtwork]);
}

const manifest = {
  schemaVersion: 1,
  evidenceKind: 'Actual TurtleArtwork controller draws through native Skia Canvas2D with a mocked browser host',
  notEvidenceFor: ['Browser pixels', 'CSS layout or responsive page reflow', 'Real keyboard/touch dispatch', 'Assistive technology', 'Phone hardware', 'Browser FPS, memory or heap behavior'],
  baselineCommit, baselineOnly,
  workingTreeHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceSha256: sourceHashes,
  runtime: { node: process.version, nativeCanvas: nativeVersion, platform: process.platform, arch: process.arch, dpr: 1 },
  font: 'Unmodified controller system-monospace stack; native host fallback. No font downloads or bundled fonts.',
  determinism: '60 fixed simulation ticks/second. Identical options and ordered cue events are replayed for each before/after pair; pixels are environment specific.',
  generatedAt: new Date().toISOString(),
  frames: [], comparisons: [], sheets: [], animations: []
};

/** All painting is the actual controller. Only DOM/scheduling are test doubles. */
function mount(factory, options, width, height, reducedMotion = false) {
  const host = fakeBrowser({ reducedMotion, dpr: 1 });
  const canvas = host.canvas(width, height), native = createCanvas(width, height);
  Object.defineProperties(canvas, {
    width: { get: () => native.width, set: value => { native.width = value; }, configurable: true },
    height: { get: () => native.height, set: value => { native.height = value; }, configurable: true }
  });
  canvas.getContext = kind => kind === '2d' ? native.getContext('2d') : null;
  const art = factory(canvas, options);
  host.intersect(canvas, true); host.frame(0);
  return {
    art, host, canvas, native,
    advance(ticks) {
      if (!Number.isInteger(ticks) || ticks < 0) throw new RangeError('Capture ticks must be nonnegative integers');
      const before = art.getStatus().tick, blocked = art.getStatus().paused;
      host.frame(0); // stage/direct reset the frame clock; this consumes no tick.
      let remaining = ticks;
      while (remaining > 0) { const n = Math.min(5, remaining); host.frame(n * 1000 / 60); remaining -= n; }
      const expected = blocked ? before : before + ticks;
      if (art.getStatus().tick !== expected) throw new Error(`Capture advanced to ${art.getStatus().tick}, expected ${expected}`);
    },
    dispose() {
      art.dispose();
      if (host.pending || canvas.listenerCount || host.resizes.size || host.intersections.size || host.document.listenerCount || host.motion.listenerCount) throw new Error('Controller leaked mocked host resources');
    }
  };
}

const sizes = [
  { name: 'desktop', width: 1008, height: 720, columns: 160, rows: 64 },
  { name: 'phone', width: 390, height: 280, columns: 100, rows: 40 },
  { name: 'minimum', width: 320, height: 228, columns: 80, rows: 32 }
];
const common = { seed: 7, speed: 1, palette: 'brass', showLabels: false, showRoute: false };
const scenes = [
  { name: 'solo', title: 'Solo study', options: { scene: 'study', count: 1 } },
  { name: 'glide', title: 'Unhurried blue drift', options: { scene: 'blue-drift', count: 1, director: 'hold' } },
  { name: 'reef', title: 'Three travelers', options: { scene: 'reef-passage', count: 3, director: 'hold' } }
];
function optionsFor(size, options) { return { ...common, columns: size.columns, rows: size.rows, ...options }; }

async function save(name, title, variant, fixture, events, extra = {}) {
  const bytes = fixture.native.toBuffer('image/png'), logical = fixture.art.getFrame();
  const file = `${name}.png`, textFile = `${name}.txt`;
  await writeFile(path.join(output, file), bytes);
  await writeFile(path.join(output, textFile), logical.text + '\n');
  const record = {
    file, textFile, title, variant, ...extra,
    viewport: [fixture.native.width, fixture.native.height],
    canvasFont: fixture.native.getContext('2d').font,
    options: fixture.art.getOptions(), status: fixture.art.getStatus(),
    director: fixture.art.getDirectorState(), events,
    pngSha256: sha256(bytes), logicalTextSha256: sha256(logical.text),
    occupiedCells: logical.cells.filter(cell => cell.glyph !== ' ').length,
    animalCells: logical.cells.filter(cell => Number.isInteger(cell.ownerId)).length,
    visibleOwners: [...new Set(logical.cells.map(cell => cell.ownerId).filter(Number.isInteger))].sort(),
    pendingSchedulerFrames: fixture.host.pending
  };
  manifest.frames.push(record); return record;
}

for (const size of sizes) for (const scene of scenes) {
  const files = [];
  for (const [variant, factory] of factories) {
    const fixture = mount(factory, optionsFor(size, scene.options), size.width, size.height);
    fixture.advance(120);
    const record = await save(`${size.name}-${scene.name}-${variant}`, `${scene.title} / ${variant}`, variant, fixture,
      [{ tick: 0, action: 'construct' }, { tick: 120, action: 'capture' }], { comparison: `${size.name}-${scene.name}`, size: size.name });
    files.push(record.file); fixture.dispose();
  }
  manifest.comparisons.push({ name: `${size.name}-${scene.name}`, files, matched: 'Same options, seed 7, tick 120, viewport and grid; baseline differs only by source revision' });
}

const cues = [{ name: 'breath', y: -.9, title: 'Surface breath' }, { name: 'dive', y: .9, title: 'Dive and recover' }];
const cueAges = [{ tick: 0, name: 'cue' }, { tick: 24, name: 'anticipation' }, { tick: 108, name: 'response' }, { tick: 210, name: 'recovery' }, { tick: 340, name: 'returned' }];
for (const size of sizes.slice(0, 2)) for (const cue of cues) {
  for (const [variant, factory] of factories) {
    const fixture = mount(factory, optionsFor(size, scenes[1].options), size.width, size.height);
    fixture.advance(120); fixture.art.inspect(0, cue.y, 0);
    const events = [{ tick: 0, action: 'construct' }, { tick: 120, action: 'inspect', x: 0, y: cue.y, id: 0 }];
    let age = 0;
    for (const state of cueAges) {
      fixture.advance(state.tick - age); age = state.tick;
      await save(`${size.name}-${cue.name}-${state.name}-${variant}`, `${cue.title} / ${state.name} / ${variant}`, variant, fixture, events,
        { comparison: `${size.name}-${cue.name}-${state.name}`, size: size.name, cue: cue.name, cueAgeTicks: state.tick, state: state.name });
    }
    fixture.dispose();
  }
  for (const state of cueAges) manifest.comparisons.push({ name: `${size.name}-${cue.name}-${state.name}`, files: factories.map(([variant]) => `${size.name}-${cue.name}-${state.name}-${variant}.png`), matched: 'Identical normalized inspect cue at tick 120; identical capture tick and viewport' });
}

// A deliberate still action must not schedule motion. Native evidence does not
// substitute for testing the real operating system media query or event routing.
for (const [variant, factory] of factories) {
  const size = sizes[1], fixture = mount(factory, optionsFor(size, scenes[1].options), size.width, size.height, true);
  fixture.art.inspect(0, .9, 0); fixture.advance(120);
  await save(`phone-reduced-motion-${variant}`, `Reduced motion / deliberate dive pose / ${variant}`, variant, fixture,
    [{ tick: 0, action: 'construct with mocked reduced motion' }, { tick: 0, action: 'inspect', x: 0, y: .9, id: 0 }, { tick: 0, action: 'attempt 120 ticks; remain still' }], { size: 'phone' });
  if (fixture.art.getStatus().tick !== 0 || fixture.host.pending !== 0) throw new Error('Reduced-motion capture unexpectedly advanced');
  fixture.dispose();
}

async function sheet(file, title, frames, columns, imageWidth, imageHeight) {
  const margin = 20, header = 88, caption = 64, rows = Math.ceil(frames.length / columns);
  const canvas = createCanvas(margin + columns * (imageWidth + margin), header + margin + rows * (imageHeight + caption + margin));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#071116'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ebc88c'; ctx.font = '20px monospace'; ctx.fillText(title, margin, 30);
  ctx.fillStyle = '#9ab4bc'; ctx.font = '13px monospace';
  ctx.fillText('Actual controller / native Canvas + mocked host / NOT browser screenshots', margin, 56);
  ctx.fillText('Pinned before: b8f222d | Matched seed, options, ticks and viewport', margin, 75);
  for (const [index, frame] of frames.entries()) {
    const x = margin + index % columns * (imageWidth + margin), y = header + margin + Math.floor(index / columns) * (imageHeight + caption + margin);
    ctx.fillStyle = '#0e2028'; ctx.fillRect(x, y, imageWidth, imageHeight + caption);
    const img = await loadImage(path.join(output, frame.file));
    const ratio = Math.min(imageWidth / img.width, imageHeight / img.height);
    ctx.drawImage(img, x + (imageWidth - img.width * ratio) / 2, y + (imageHeight - img.height * ratio) / 2, img.width * ratio, img.height * ratio);
    ctx.fillStyle = '#ebc88c'; ctx.font = '14px monospace'; ctx.fillText(frame.title, x + 10, y + imageHeight + 25);
    ctx.fillStyle = '#9ab4bc'; ctx.font = '12px monospace';
    ctx.fillText(`${frame.options.columns}x${frame.options.rows} cells | tick ${frame.status.tick}${frame.cueAgeTicks !== undefined ? ` | cue +${frame.cueAgeTicks}` : ''}`, x + 10, y + imageHeight + 47);
  }
  const bytes = canvas.toBuffer('image/png'); await writeFile(path.join(output, file), bytes);
  manifest.sheets.push({ file, title, pngSha256: sha256(bytes), frames: frames.map(frame => frame.file) });
}

for (const size of sizes) {
  const records = scenes.flatMap(scene => factories.map(([variant]) => manifest.frames.find(frame => frame.file === `${size.name}-${scene.name}-${variant}.png`)));
  await sheet(`comparison-${size.name}.png`, `SEA TURTLE / MATCHED ${size.name.toUpperCase()} CANVAS`, records, factories.length, size.name === 'desktop' ? 600 : 390, size.name === 'desktop' ? 428 : 280);
}
if (!baselineOnly) for (const cue of cues) {
  const records = cueAges.map(state => manifest.frames.find(frame => frame.file === `desktop-${cue.name}-${state.name}-after.png`));
  await sheet(`sequence-${cue.name}.png`, `SEA TURTLE / ${cue.title.toUpperCase()} / CANDIDATE`, records, 3, 460, 329);
}

if (args.includes('--motion') && !baselineOnly) {
  const animationDir = path.join(output, '.motion-frames'); await mkdir(animationDir, { recursive: true });
  const width = 560, height = 400, header = 62, canvas = createCanvas(width * 2, height + header), ctx = canvas.getContext('2d');
  const fixtures = factories.map(([variant, factory]) => ({ variant, ...mount(factory, { ...common, ...scenes[1].options, columns: 140, rows: 56 }, width, height) }));
  fixtures.forEach(fixture => fixture.art.stage('linger'));
  const eventLog = [
    { frame: 0, tick: 0, action: 'construct then stage linger on BOTH factories', options: fixtures[0].art.getOptions() },
    { frame: 12, presentationSeconds: 1, tick: 60, action: 'inspect', x: 0, y: -.9, id: 0, title: 'Surface breath' },
    { frame: 84, presentationSeconds: 7, tick: 0, action: 'restart then stage linger on BOTH factories', title: 'Explicit cut: fresh identical scene for the second cue' },
    { frame: 96, presentationSeconds: 8, tick: 60, action: 'inspect', x: 0, y: .9, id: 0, title: 'Dive and recover' }
  ];
  for (let frame = 0; frame < 168; frame++) {
    for (const fixture of fixtures) {
      if (frame === 84) { fixture.art.restart(); fixture.art.stage('linger'); }
      if (frame === 12) fixture.art.inspect(0, -.9, 0);
      if (frame === 96) fixture.art.inspect(0, .9, 0);
    }
    ctx.fillStyle = '#071116'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ebc88c'; ctx.font = '16px monospace';
    ctx.fillText('BEFORE / b8f222d', 16, 24); ctx.fillText('AFTER / candidate', width + 16, 24);
    ctx.fillStyle = '#9ab4bc'; ctx.font = '12px monospace';
    const cue = frame < 84 ? 'TAKE 1 / SURFACE BREATH' : 'TAKE 2 / DIVE (RESET AT 7s)';
    const actualTick = fixtures[0].art.getStatus().tick;
    if (fixtures.some(fixture => fixture.art.getStatus().tick !== actualTick)) throw new Error('Motion comparison clocks diverged');
    ctx.fillText(`Native Canvas, mocked host | ${cue} | tick ${actualTick} | 12 fps / 60 ticks/s`, 16, 47);
    for (const [index, fixture] of fixtures.entries()) ctx.drawImage(fixture.native, index * width, header);
    await writeFile(path.join(animationDir, `${String(frame).padStart(4, '0')}.png`), canvas.toBuffer('image/png'));
    if (frame < 167) for (const fixture of fixtures) fixture.advance(5);
  }
  fixtures.forEach(fixture => fixture.dispose());
  const input = path.join(animationDir, '%04d.png');
  // Persist complete still evidence before optional encoders. If an encoder is
  // unavailable or fails, that cannot leave a stale manifest describing old PNGs.
  await writeFile(path.join(output, 'render-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(path.join(animationDir, 'capture.json'), JSON.stringify({ sourceSha256: sourceHashes, width: canvas.width, height: canvas.height, frames: 168, events: eventLog }, null, 2) + '\n');
  // Two passes prevent the palettegen/split branch from buffering the complete
  // animation while paletteuse waits. One decoder/filter/encoder thread bounds
  // transient memory on constrained review hosts without changing capture size.
  const ffmpeg = ['-hide_banner', '-loglevel', 'error', '-y', '-threads', '1', '-filter_threads', '1', '-filter_complex_threads', '1'];
  const palette = path.join(animationDir, 'palette.png');
  const execOptions = { maxBuffer: 2 * 1024 * 1024 };
  execFileSync('ffmpeg', [...ffmpeg, '-framerate', '12', '-i', input, '-vf', 'palettegen=max_colors=96:stats_mode=diff', '-frames:v', '1', '-threads', '1', palette], execOptions);
  execFileSync('ffmpeg', [...ffmpeg, '-framerate', '12', '-i', input, '-threads', '1', '-i', palette, '-filter_complex', '[0:v][1:v]paletteuse=dither=bayer:bayer_scale=4', '-threads', '1', '-loop', '-1', path.join(output, 'matched-motion.gif')], execOptions);
  execFileSync('ffmpeg', [...ffmpeg, '-framerate', '12', '-i', input, '-c:v', 'libx264', '-threads', '1', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', path.join(output, 'matched-motion.mp4')], execOptions);
  for (const file of ['matched-motion.gif', 'matched-motion.mp4']) manifest.animations.push({ file, sha256: sha256(await readFile(path.join(output, file))), durationSeconds: 14, frames: 168, encodedFramesPerSecond: 12, simulationTicksPerFrame: 5, segments: [{ firstFrame: 0, lastFrame: 83, firstTick: 0, lastTick: 415, cue: 'breath', cueTick: 60 }, { firstFrame: 84, lastFrame: 167, firstTick: 0, lastTick: 415, cue: 'dive', cueTick: 60, startsWith: 'Explicit public restart then stage linger on both factories' }], viewport: [canvas.width, canvas.height], panelViewport: [width, height], logicalGrid: [140, 56], encoding: 'Two-pass GIF palette; single-threaded decoding, filtering and encoding; no image scaling', events: eventLog, note: 'Two 7-second normal-speed deterministic takes, with an explicitly captioned public restart at second 7 so each forward-traveling response stays visible. One play. Encoding cadence is not achieved browser FPS. No loop-seam claim.' });
  await rm(animationDir, { recursive: true, force: true });
}

if (!baselineOnly && sha256(await readFile(path.join(root, 'src/public/turtle.ts'))) !== sourceHashes['src/public/turtle.ts']) {
  throw new Error('Turtle source changed during capture. Keep this run as intermediate evidence and rebuild/re-run for final review.');
}
await writeFile(path.join(output, 'render-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(output, 'README.md'), `# Turtle uplift rendering evidence\n\nThese PNGs, text frames, contact sheets and optional GIF/MP4 are produced by the actual TurtleArtwork controller drawing to native Skia Canvas through a mocked DOM and scheduler. **They are not browser or phone screenshots.** The named desktop, phone and minimum sizes describe Canvas dimensions and logical cell grids, not browser viewport acceptance. No FPS, touch-device, CSS or assistive-technology claim is made.\n\nBefore is pinned to ${baselineCommit}. Every comparison uses the same options, seed, normalized events, tick and dimensions. Full source hashes, options, cue logs, pose snapshots and runtime version are in render-manifest.json. Candidate source-map parity is required before capture.\n\nScenes: solo study, solitary blue drift and three-traveler reef at tick 120. The still breath and dive cues are invoked at tick 120 through inspect(0, -0.9, 0) and inspect(0, 0.9, 0), then captured at cue ages 0, 24, 108, 210 and 340. The unchanged baseline receives those exact same calls.\n\nReproduce after building:\n\n\`\`\`sh\nnpm run build\nnode species/turtle/scripts/render-uplift.mjs /absolute/output --motion\n\`\`\`\n\nThe optional 14-second matched animation uses 12 sampled frames per second, five simulation ticks per frame. It comprises two 7-second takes. Breath is cued at local tick 60 in the first take. At second 7, BOTH controllers use public restart() then stage('linger'); the caption and event log mark this explicit reset/cut. Dive is cued at local tick 60 in the second take. Each response retains its actual forward progress; resetting between takes keeps both recoveries in view without hand-positioning the animals. The animation plays once. Encoding rate is not measured runtime performance. It requires ffmpeg; @napi-rs/canvas is optional verification tooling, not a package runtime dependency.\n\n${baselineOnly ? 'This run contains baseline-only captures; it makes no candidate comparison claim.\n' : 'Reduced-motion evidence uses a mocked media query and a deliberate still cue; all instances are checked for release of their mocked host resources.\n'}`);
console.log(JSON.stringify({ output, baselineOnly, frames: manifest.frames.length, comparisons: manifest.comparisons.length, sheets: manifest.sheets.map(sheet => sheet.file), animations: manifest.animations.map(animation => animation.file), sourceSha256: sourceHashes }, null, 2));
