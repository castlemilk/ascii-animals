/**
 * Exact-source octopus evidence: real CuttlefishArtwork Canvas2D draw calls on
 * native Skia Canvas, with a mocked browser host. NOT browser screenshots.
 *
 * node --expose-gc species/octopus/scripts/render-evidence.mjs /absolute/output --baseline-only
 * node --expose-gc species/octopus/scripts/render-evidence.mjs /absolute/output --after-only --motion
 * node --expose-gc species/octopus/scripts/render-evidence.mjs /absolute/output --motion
 *
 * No dependencies are downloaded. @napi-rs/canvas must already be installed;
 * --motion additionally requires ffmpeg. Baseline files come from git show at
 * the pinned commit. Candidate source is snapshotted before importing, so a
 * concurrently edited worktree cannot silently change an in-progress capture.
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
const output = path.resolve(args.find(arg => !arg.startsWith('--')) || path.join(root, '..', 'octopus-evidence'));
const baselineCommit = 'b8f222dab868821f27bf2a64a98434f3483fc8e6';
const sourceFiles = ['src/core/scheduler.js', 'src/animals/cuttlefish.js', 'src/animals/manta.js', 'src/animals/octopus.js'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const require = createRequire(import.meta.url);
let canvasPath;
try { canvasPath = require.resolve('@napi-rs/canvas'); }
catch (error) {
  const dependencies = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if (!dependencies) throw new Error('An already installed @napi-rs/canvas is required; nothing was installed.', { cause: error });
  canvasPath = require.resolve(path.join(dependencies, '@napi-rs/canvas'));
}
const { createCanvas, loadImage } = require(canvasPath);
const nativeVersion = require(path.join(path.dirname(canvasPath), 'package.json')).version;
if (typeof globalThis.gc !== 'function') throw new Error('Run with node --expose-gc; native per-frame cache collection bounds capture memory.');
const viewports = [{ id: 'desktop', width: 1200, height: 800 }, { id: 'phone', width: 390, height: 640 }];
const options = Object.freeze({
  species: 'octopus', count: 1, scene: 'reactive', behaviors: ['hover'], formation: 'independent',
  palette: 'ember', size: 1.3, sizeVariation: 0, density: 1.45, motion: 1.2, ripple: 1.3,
  speed: 1, glow: false, followPointer: true, seed: 17, autoStart: false, reducedMotion: 'ignore'
});
const eventLog = Object.freeze([
  { tick: 120, action: 'pointermove', x: .18, y: .22, note: 'One normalized pointer invitation, delivered through the existing canvas listener.' },
  { tick: 420, action: 'pointerleave', note: 'Existing pointerleave listener; no direct geometry mutation.' },
  { tick: 480, action: 'pulse', note: 'Existing public pulse() API; response/ink evolve through fixed 1/60-second advance() calls.' }
]);
const states = Object.freeze([
  { tick: 120, id: 'idle', title: 'Idle / 2.00 s' },
  { tick: 135, id: 'notice', title: 'Notice / invitation +0.25 s' },
  { tick: 180, id: 'unfold', title: 'Unfold / invitation +1.00 s' },
  { tick: 270, id: 'examine', title: 'Examine / invitation +2.50 s' },
  { tick: 420, id: 'peel', title: 'Peel / invitation +5.00 s' },
  { tick: 480, id: 'release', title: 'Release / pointer left +1.00 s' },
  { tick: 492, id: 'startle', title: 'Gather / startle +0.20 s' },
  { tick: 519, id: 'ink', title: 'Ink / startle +0.65 s' },
  { tick: 570, id: 'jet', title: 'Jet / startle +1.50 s' },
  { tick: 768, id: 'return', title: 'Return / startle +4.80 s' },
  { tick: 936, id: 'replant', title: 'Replant / startle +7.60 s' },
  { tick: 1032, id: 'settled', title: 'Settled / startle +9.20 s' }
]);
const captureStates = args.includes('--idle-only') ? [states[0]] : states;

await mkdir(output, { recursive: true });
const manifestFile = path.join(output, 'capture-manifest.json');
let prior;
try { prior = JSON.parse(await readFile(manifestFile, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (prior && (prior.baselineCommit !== baselineCommit || JSON.stringify(prior.options) !== JSON.stringify(options))) {
  throw new Error('Output directory contains evidence with a different baseline/options; choose another directory.');
}
const manifest = prior || {
  schemaVersion: 1,
  evidenceKind: 'Native Skia Canvas execution of actual source CuttlefishArtwork Canvas2D calls with a mocked browser host.',
  notEvidenceFor: ['Real browser rasterization', 'CSS or page layout', 'Actual keyboard or touch delivery', 'Browser accessibility', 'Hardware or device performance', 'Browser heap behavior'],
  baselineCommit,
  runtime: { node: process.version, nativeCanvas: nativeVersion, platform: process.platform, arch: process.arch, dpr: 1 },
  font: 'Unmodified renderer font stack: SFMono-Regular, Consolas, Liberation Mono, monospace. Native host fallback; no downloaded or bundled font.',
  options, viewports, eventLog,
  timing: { tickRate: 60, stepSeconds: 1 / 60, speed: 1, geometryAndRasterizationEveryTick: true, nativePaintOnlyRetainedFrames: true, note: 'Inputs are delivered at the listed tick after that tick\'s capture. Every advance uses the same fixed dt. Main Canvas pixel-write calls are suppressed on unretained ticks, while geometry/rasterization and source control flow still run. No wall-time FPS claim.' },
  variants: {}, nativeHostParity: {}, sheets: [], animations: []
};
manifest.nativeHostParity ||= {};
// Update capture-host metadata when a baseline-only run is followed by a later
// after-only run. Each variant retains the script hash that produced its frames.
manifest.nativeCapturePolicy = 'Native drawImage(Canvas) retains a full-source snapshot for every glyph. Every 128 main-canvas image draws, outside a saved context, the host preserves the opaque native RGBA pixels and drawing state, resets native backing storage, and restores those pixels/state. Atlas content and source/destination drawing arguments remain untouched. Strict small-frame parity checks compare this host with direct native drawing. Exact source geometry/rasterization run every simulation tick; native main-canvas pixel writes occur only for retained frames. Earlier unbounded and atlas-cache experiments were rejected; all final files use this checkpoint adapter. This is not browser heap or performance evidence.';
manifest.timing = { tickRate: 60, stepSeconds: 1 / 60, speed: 1, geometryAndRasterizationEveryTick: true, nativePaintOnlyRetainedFrames: true, sameTimeRedrawBeforeCapture: true, note: 'Inputs are delivered at the listed tick after that tick\'s capture. Every advance uses the same fixed dt. Interim main Canvas pixel-write calls are suppressed while geometry/rasterization and source control flow run. No wall-time FPS claim.' };
manifest.command = [process.execPath, ...process.execArgv, ...process.argv.slice(1)];

/** Every canvas, including atlases and glow buffers, has real native pixels. */
function mount(Artwork, width, height, checkpointEnabled = true) {
  const host = fakeBrowser({ reducedMotion: false, dpr: 1 });
  const backing = new WeakMap();
  function nativeCanvas(w = 1, h = 1, isMain = false) {
    const canvas = host.canvas(w, h), native = createCanvas(Math.max(1, w), Math.max(1, h));
    const entry = { native, paint: true, isMain, saveDepth: 0, drawCalls: 0, checkpoints: 0 };
    backing.set(canvas, entry);
    let backingWidth = Math.max(1, w), backingHeight = Math.max(1, h);
    Object.defineProperties(canvas, {
      width: { configurable: true, get: () => backingWidth, set: value => { backingWidth = value; native.width = Math.max(1, value); entry.drawCalls = 0; entry.saveDepth = 0; } },
      height: { configurable: true, get: () => backingHeight, set: value => { backingHeight = value; native.height = Math.max(1, value); entry.drawCalls = 0; entry.saveDepth = 0; } }
    });
    const context = native.getContext('2d'), methods = new Map();
    const writesPixels = new Set(['fillText', 'strokeText', 'fill', 'stroke', 'clearRect', 'fillRect', 'strokeRect', 'putImageData', 'reset']);
    function checkpoint() {
      if (!checkpointEnabled || !entry.isMain || entry.saveDepth || entry.drawCalls < 128) return;
      const pixels = context.getImageData(0, 0, native.width, native.height), transform = context.getTransform();
      const keys = ['fillStyle', 'strokeStyle', 'globalAlpha', 'globalCompositeOperation', 'imageSmoothingEnabled', 'imageSmoothingQuality', 'filter', 'font', 'textAlign', 'textBaseline', 'lineWidth', 'lineCap', 'lineJoin', 'miterLimit', 'lineDashOffset', 'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY'];
      const state = keys.map(key => [key, context[key]]), dash = context.getLineDash();
      native.width = native.width;
      context.putImageData(pixels, 0, 0);
      for (const [key, value] of state) if (value !== undefined) context[key] = value;
      context.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
      context.setLineDash(dash);
      entry.drawCalls = 0; entry.checkpoints++; globalThis.gc();
    }
    const proxy = new Proxy(context, {
      get(target, key) {
        if (methods.has(key)) return methods.get(key);
        if (key === 'drawImage') {
          const drawImage = (source, ...values) => {
            if (!entry.paint) return;
            const original = backing.get(source);
            const result = target.drawImage(original?.native || source, ...values);
            entry.drawCalls++; checkpoint(); return result;
          };
          methods.set(key, drawImage); return drawImage;
        }
        const value = target[key];
        if (typeof value !== 'function') return value;
        const method = (...values) => {
          if (writesPixels.has(key) && !entry.paint) return;
          const result = value.apply(target, values);
          if (key === 'save') entry.saveDepth++;
          else if (key === 'restore') { entry.saveDepth = Math.max(0, entry.saveDepth - 1); checkpoint(); }
          return result;
        };
        methods.set(key, method); return method;
      },
      set(target, key, value) { target[key] = value; return true; }
    });
    canvas.getContext = kind => kind === '2d' ? proxy : null;
    return canvas;
  }
  host.document.createElement = tag => {
    if (tag !== 'canvas') throw new Error(`Unexpected host element: ${tag}`);
    return nativeCanvas();
  };
  const canvas = nativeCanvas(width, height, true);
  if (args.includes('--trace')) console.log(JSON.stringify({ captureTrace: 'before-construction', width, height, memory: process.memoryUsage() }));
  const art = new Artwork(canvas, { ...options, behaviors: [...options.behaviors] });
  if (args.includes('--trace')) console.log(JSON.stringify({ captureTrace: 'after-construction', width, height, memory: process.memoryUsage() }));
  let tick = 0;
  return {
    host, canvas, art, native: backing.get(canvas).native, get tick() { return tick; }, get nativeCheckpoints() { return backing.get(canvas).checkpoints; },
    async present() {
      backing.get(canvas).paint = true;
      // Allow native wrapper finalizers to settle before a retained frame.
      // Rendering again at the same time must leave species state unchanged.
      await new Promise(resolve => setImmediate(resolve));
      const before = logicalDigest(art);
      art.render();
      if (logicalDigest(art) !== before) throw new Error('A same-time capture redraw changed the logical scene.');
      backing.get(canvas).native.getContext('2d').getImageData(0, 0, 1, 1);
      backing.get(canvas).paint = false;
      globalThis.gc();
    },
    step(paint = false) {
      backing.get(canvas).paint = paint;
      art.advance(1 / 60); tick++;
      // N-API native image wrappers are not a browser display list. Flush and
      // collect each frame so their lifetime cannot inflate capture memory.
      if (paint) backing.get(canvas).native.getContext('2d').getImageData(0, 0, 1, 1);
      globalThis.gc();
      if (args.includes('--trace') && tick % 120 === 0) console.log(JSON.stringify({ captureTrace: 'tick', tick, memory: process.memoryUsage() }));
    },
    invite(x, y) { canvas.emit('pointermove', { pointerType: 'mouse', clientX: (x + .5) * width, clientY: (y + .5) * height }); },
    leave() { canvas.emit('pointerleave'); },
    dispose() {
      art.destroy(); art.destroy();
      if (host.pending || canvas.listenerCount || host.resizes.size || host.intersections.size || host.document.listenerCount || host.view.listenerCount || host.motion.listenerCount) {
        throw new Error('Capture controller did not release its mocked host resources.');
      }
    }
  };
}

async function snapshotSource(variant) {
  const destination = path.join(output, variant === 'before' ? '.baseline-source' : '.candidate-source');
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, 'package.json'), '{"type":"module"}\n');
  const hashes = {};
  for (const file of sourceFiles) {
    const bytes = variant === 'before'
      ? execFileSync('git', ['show', `${baselineCommit}:${file}`], { cwd: root })
      : await readFile(path.join(root, file));
    const target = path.join(destination, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes); hashes[file] = sha256(bytes);
  }
  hashes['test/helpers/fake-browser.mjs'] = sha256(await readFile(path.join(root, 'test/helpers/fake-browser.mjs')));
  hashes['species/octopus/scripts/render-evidence.mjs'] = sha256(await readFile(fileURLToPath(import.meta.url)));
  const { CuttlefishArtwork } = await import(pathToFileURL(path.join(destination, 'src/animals/cuttlefish.js')).href);
  return { Artwork: CuttlefishArtwork, hashes };
}

function logicalDigest(art) {
  const digest = createHash('sha256');
  for (const data of [art.depth, art.tones, art.glyphs, art.kinds, art.owners, art.visibility]) {
    digest.update(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
  }
  return digest.digest('hex');
}

async function saveFrame(variant, viewport, state, fixture) {
  await fixture.present();
  const filename = `${variant}-${viewport.id}-${state.id}.png`;
  const bytes = fixture.native.toBuffer('image/png');
  const foreground = foregroundPixels(fixture);
  if (fixture.art.glyphCount > 20 && foreground.eligibleCells > 10 && foreground.visibleCells < 3) {
    throw new Error(`Native output omitted visible animal glyphs: ${filename} (${JSON.stringify(foreground)})`);
  }
  await writeFile(path.join(output, filename), bytes);
  const fish = fixture.art.fish[0];
  return {
    filename, title: state.title, state: state.id, tick: fixture.tick,
    viewport: [viewport.width, viewport.height],
    pngSha256: sha256(bytes), logicalSha256: logicalDigest(fixture.art),
    stats: fixture.art.getStats(),
    pose: { position: [fish.worldX, fish.worldY, fish.worldZ], rotation: [fish.r00, fish.r01, fish.r02, fish.r10, fish.r11, fish.r12, fish.r20, fish.r21, fish.r22] },
    diagnostics: JSON.parse(JSON.stringify(fish.speciesState?.diagnostics || {})),
    geometrySamples: fixture.art.sampleCount,
    sampleSha256: sha256(Buffer.from(fixture.art.samples.buffer, 0, fixture.art.sampleCount * 6 * 4)),
    armSha256: sha256(Buffer.concat((fish.speciesState?.arms || []).map(arm => Buffer.from(arm.buffer, arm.byteOffset, arm.byteLength)))),
    pendingSchedulerFrames: fixture.host.pending,
    nativeBackingCheckpoints: fixture.nativeCheckpoints,
    foreground
  };
}

function foregroundPixels(fixture) {
  const art = fixture.art, pixels = fixture.native.getContext('2d').getImageData(0, 0, fixture.native.width, fixture.native.height).data;
  let eligibleCells = 0, visibleCells = 0;
  for (let cell = 0; cell < art.owners.length; cell++) {
    if (art.owners[cell] < 0 || art.visibility[cell] < .2 || art.tones[cell] < 9) continue;
    const color = art.colorBytes[art.kinds[cell] * 24 + art.tones[cell]];
    if (!color || Math.max(...color) < 100) continue;
    eligibleCells++;
    const x = (cell % art.cols + .5) * art.cellW, y = (Math.floor(cell / art.cols) + .5) * art.cellH;
    let found = false;
    for (let py = Math.max(0, Math.floor(y - art.cellH * .55)); py < Math.min(fixture.native.height, y + art.cellH * .55) && !found; py++) {
      for (let px = Math.max(0, Math.floor(x - art.cellW * .55)); px < Math.min(fixture.native.width, x + art.cellW * .55); px++) {
        const index = (py * fixture.native.width + px) * 4;
        if (Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) >= 75) { found = true; break; }
      }
    }
    if (found) visibleCells++;
  }
  return { eligibleCells, visibleCells, note: 'Owned, medium-bright glyph cells with visible native foreground pixels; guards against missing animal pixels, not an anatomy judgment.' };
}

function dispatch(fixture, event) {
  if (event.action === 'pointermove') fixture.invite(event.x, event.y);
  else if (event.action === 'pointerleave') fixture.leave();
  else if (event.action === 'pulse') fixture.art.pulse();
  else throw new Error(`Unsupported evidence action: ${event.action}`);
}

async function captureVariant(variant) {
  const { Artwork, hashes } = await snapshotSource(variant);
  if (manifest.nativeHostParity[variant]?.octopusSourceSha256 !== hashes['src/animals/octopus.js'] || args.includes('--verify-native-host')) {
    const size = [320, 240];
    const direct = mount(Artwork, ...size, false); await direct.present();
    const directLogical = logicalDigest(direct.art);
    const directPixels = Buffer.from(direct.native.getContext('2d').getImageData(0, 0, ...size).data);
    direct.dispose(); direct.native.width = direct.native.height = 1; globalThis.gc();
    const cached = mount(Artwork, ...size, true); await cached.present();
    const boundedLogical = logicalDigest(cached.art), checkpoints = cached.nativeCheckpoints;
    const cachedPixels = Buffer.from(cached.native.getContext('2d').getImageData(0, 0, ...size).data);
    cached.dispose(); cached.native.width = cached.native.height = 1; globalThis.gc();
    let differingChannels = 0, maximumChannelDelta = 0;
    for (let i = 0; i < directPixels.length; i++) {
      const delta = Math.abs(directPixels[i] - cachedPixels[i]);
      if (delta) differingChannels++;
      maximumChannelDelta = Math.max(maximumChannelDelta, delta);
    }
    manifest.nativeHostParity[variant] = { octopusSourceSha256: hashes['src/animals/octopus.js'], viewport: size, tick: 0, directLogical, boundedLogical, directRgbaSha256: sha256(directPixels), boundedRgbaSha256: sha256(cachedPixels), checkpoints, differingChannels, maximumChannelDelta, exact: differingChannels === 0 };
    console.log(JSON.stringify({ nativeHostParity: manifest.nativeHostParity[variant] }));
    if (differingChannels || directLogical !== boundedLogical || checkpoints === 0) throw new Error('Native backing checkpoint differs from direct native drawing; capture rejected.');
  }
  const record = {
    generatedAt: new Date().toISOString(),
    worktreeHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    sourceSha256: hashes, frames: []
  };
  manifest.variants[variant] = record;
  for (const viewport of viewports) {
    const fixture = mount(Artwork, viewport.width, viewport.height);
    try {
      for (let tick = 0; tick <= captureStates.at(-1).tick; tick++) {
        const state = captureStates.find(item => item.tick === tick);
        if (state) record.frames.push(await saveFrame(variant, viewport, state, fixture));
        for (const event of eventLog.filter(item => item.tick === tick)) dispatch(fixture, event);
        if (tick !== captureStates.at(-1).tick) fixture.step();
      }
    } finally { fixture.dispose(); }
    await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
    console.log(JSON.stringify({ variant, viewport: viewport.id, captures: captureStates.length, sourceSha256: hashes['src/animals/octopus.js'] }));
  }
  return Artwork;
}

async function contactSheet(filename, title, frames, columns, thumbWidth, thumbHeight) {
  const margin = 24, header = 84, caption = 58, rows = Math.ceil(frames.length / columns);
  const canvas = createCanvas(margin + columns * (thumbWidth + margin), header + margin + rows * (thumbHeight + caption + margin));
  const context = canvas.getContext('2d');
  context.fillStyle = '#0a1012'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#e7d8b5'; context.font = '600 23px monospace'; context.fillText(title, margin, 34);
  context.fillStyle = '#9ca6a7'; context.font = '13px monospace';
  context.fillText('Exact-source native Canvas + mocked host. Not browser screenshots or a responsive-layout test.', margin, 61);
  for (const [index, frame] of frames.entries()) {
    const x = margin + index % columns * (thumbWidth + margin), y = header + margin + Math.floor(index / columns) * (thumbHeight + caption + margin);
    context.fillStyle = '#101a1c'; context.fillRect(x, y, thumbWidth, thumbHeight + caption);
    const image = await loadImage(path.join(output, frame.filename));
    const scale = Math.min(thumbWidth / image.width, thumbHeight / image.height);
    context.drawImage(image, x + (thumbWidth - image.width * scale) / 2, y + (thumbHeight - image.height * scale) / 2, image.width * scale, image.height * scale);
    context.fillStyle = '#e7d8b5'; context.font = '14px monospace'; context.fillText(frame.label || frame.title, x + 12, y + thumbHeight + 24);
    context.fillStyle = '#9ca6a7'; context.font = '11px monospace';
    context.fillText(`${frame.viewport.join(' x ')} / tick ${frame.tick} / ${frame.stats.glyphs} animal cells`, x + 12, y + thumbHeight + 44);
  }
  const bytes = canvas.toBuffer('image/png'); await writeFile(path.join(output, filename), bytes);
  return { filename, pngSha256: sha256(bytes), frames: frames.map(frame => frame.filename), dimensions: [canvas.width, canvas.height] };
}

async function captureMotion(Artwork) {
  const viewport = { id: 'motion', width: 960, height: 640 };
  const temp = path.join(output, '.motion-frames'); await mkdir(temp, { recursive: true });
  const fixture = mount(Artwork, viewport.width, viewport.height);
  const retained = [];
  try {
    // The exact source samples/rasterizes every 60 Hz tick. Paint/retain every
    // fifth output frame at native resolution for a normal-speed 12 fps clip.
    for (let tick = 0; tick <= 1030; tick++) {
      if (tick >= 60 && tick % 5 === 0) {
        await fixture.present();
        const filename = `${String(retained.length).padStart(4, '0')}.png`;
        const bytes = fixture.native.toBuffer('image/png');
        await writeFile(path.join(temp, filename), bytes);
        retained.push({ index: retained.length, tick, pngSha256: sha256(bytes), phase: fixture.art.getStats().phase, reactionStage: fixture.art.getStats().reactionStage });
      }
      for (const event of eventLog.filter(item => item.tick === tick)) dispatch(fixture, event);
      if (tick !== 1030) fixture.step();
    }
  } finally { fixture.dispose(); }
  const clip = 'octopus-examine-jet-native.mp4';
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '12', '-i', path.join(temp, '%04d.png'), '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(output, clip)], { maxBuffer: 4 * 1024 * 1024 });
  const gif = 'octopus-examine-jet-native.gif';
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '12', '-i', path.join(temp, '%04d.png'), '-filter_complex', '[0:v]scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', '-loop', '-1', path.join(output, gif)], { maxBuffer: 4 * 1024 * 1024 });
  const files = [];
  for (const filename of [clip, gif]) files.push({ filename, sha256: sha256(await readFile(path.join(output, filename))) });
  await rm(temp, { recursive: true, force: true });
  manifest.animations = [{
    files, viewport: [viewport.width, viewport.height], frames: retained.length, fps: 12, durationSeconds: retained.length / 12,
    simulationTickRate: 60, sourceSha256: manifest.variants.after.sourceSha256,
    eventLog, captures: retained,
    note: 'Normal-speed native Canvas replay. Exact source geometry/rasterization run every tick; native paint/retention is every fifth tick. MP4 is 960x640; GIF is a 720px derivative and plays once. Not a real browser or a seamless-loop certification.'
  }];
  console.log(JSON.stringify({ motion: files.map(file => file.filename), frames: retained.length, fps: 12 }));
}

let candidateArtwork;
if (!args.includes('--after-only')) await captureVariant('before');
if (!args.includes('--baseline-only')) candidateArtwork = await captureVariant('after');
manifest.sheets = [];
if (manifest.variants.before && manifest.variants.after) {
  for (const viewport of viewports) {
    const frames = ['before', 'after'].map(variant => {
      const frame = manifest.variants[variant].frames.find(item => item.state === 'idle' && item.viewport[0] === viewport.width);
      return { ...frame, label: `${variant.toUpperCase()} / identical seed, options, tick` };
    });
    manifest.sheets.push(await contactSheet(`before-after-${viewport.id}.png`, `OCTOPUS / MATCHED ${viewport.id.toUpperCase()} CANVAS`, frames, 2, viewport.id === 'desktop' ? 900 : 390, viewport.id === 'desktop' ? 600 : 640));
  }
}
for (const variant of Object.keys(manifest.variants)) {
  const frames = manifest.variants[variant].frames.filter(frame => frame.viewport[0] === viewports[0].width);
  manifest.sheets.push(await contactSheet(`${variant}-motion-contact-sheet.png`, `OCTOPUS / ${variant.toUpperCase()} RESPONSE STATES`, frames, 3, 400, 267));
}
if (args.includes('--motion') && candidateArtwork) await captureMotion(candidateArtwork);
await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(output, 'README.md'), `# Octopus exact-source rendering evidence\n\nThese images and optional motion files are generated from the actual canonical marine renderer and octopus module using native Skia Canvas. The browser event/lifecycle host is mocked. They are **not browser screenshots**, CSS/layout proof, real keyboard/touch delivery, browser accessibility evidence, or device performance measurements.\n\nBaseline: \`${baselineCommit}\`. The candidate source is snapshotted before importing. See \`capture-manifest.json\` for source hashes, all options, viewport sizes, event log, simulation ticks, geometry/cell hashes and output checksums. All comparisons use seed 17, speed 1, a 1/60-second step and identical options.\n\nThe "phone" images are 390×640 native Canvas captures, not phone-browser screenshots. Before/after sheets use the same idle frame after 120 ticks (2 seconds). The 12 response frames cover notice, unfolding, examination, peeling, release, gathering, ink, departure, return and settled state.\n\nReproduce from the repository with an already installed \`@napi-rs/canvas\` (and \`ffmpeg\` for motion):\n\n\`\`\`sh\nnode --expose-gc species/octopus/scripts/render-evidence.mjs /absolute/output --motion\n\`\`\`\n\nThe native host preserves opaque RGBA pixels and drawing state, resets native backing storage every 128 image draws, then restores those exact pixels/state. This releases native full-atlas snapshots without altering atlas content or draw arguments. The manifest records strict 320×240 raw-pixel and logical-cell parity against direct native rendering, plus visible-foreground checks on every saved frame. Earlier unbounded captures and atlas-cache experiments were rejected and regenerated. The script does not install software or start a browser. Motion is 60 Hz simulation with a retained frame every fifth tick, played at 12 fps. No FPS or memory-performance claim is made. The source samples/rasterizes every simulation tick; the native adapter suppresses interim main-canvas pixel writes and paints retained frames, with a same-time redraw whose logical hash must remain identical. Atlas content, glyph geometry, input mapping and draw arguments come from the captured source. The host events/resources are simulated, and the pixel-preserving native checkpoints are capture-only.\n`);
console.log(JSON.stringify({ output, baselineCommit, variants: Object.keys(manifest.variants), sheets: manifest.sheets.map(sheet => sheet.filename), animations: manifest.animations.flatMap(item => item.files.map(file => file.filename)) }, null, 2));
