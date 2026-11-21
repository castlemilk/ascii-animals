#!/usr/bin/env node
/**
 * Explicit fallback evidence: real native Skia Canvas, NOT a browser.
 * Run: node --expose-gc species/octopus/trickster/tests/render-native.mjs --preview
 * Full: node --expose-gc species/octopus/trickster/tests/render-native.mjs --motion
 * @napi-rs/canvas is an external review dependency, never a package dependency.
 * Current-main sources and candidate sources are frozen before importing.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { fakeBrowser } from '../../../../test/helpers/fake-browser.mjs';

const here = dirname(fileURLToPath(import.meta.url)), repo = resolve(here, '../../../..'), task = resolve(repo, '..');
const args = new Set(process.argv.slice(2));
const option = name => process.argv.find(value => value.startsWith(name + '='))?.slice(name.length + 1);
const out = resolve(option('--out') || join(task, 'octopus-delivery/evidence'));
const BASE = 'f63b20e2045b1070b10bde2efc4eb3a8536e606b';
const preview = args.has('--preview'), motion = args.has('--motion');
const require = createRequire(import.meta.url);
let canvasModule;
for (const value of ['@napi-rs/canvas', join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules', '@napi-rs/canvas'), join(task, 'native-deps/node_modules/@napi-rs/canvas')]) {
  try { canvasModule = require.resolve(value); break; } catch {}
}
if (!canvasModule) throw new Error('Install @napi-rs/canvas in isolated native-deps; do not modify repository dependencies.');
if (typeof globalThis.gc !== 'function') throw new Error('Run node with --expose-gc for bounded native snapshot memory.');
const { createCanvas, loadImage } = require(canvasModule);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sizes = [{ name: 'desktop', width: 960, height: 600 }, { name: 'phone', width: 390, height: 500 }];
const allPoints = [
  { tick: 60, name: 'idle' }, { tick: 115, name: 'anticipation' }, { tick: 150, name: 'reach' },
  { tick: 210, name: 'contact' }, { tick: 296, name: 'recoil' }, { tick: 377, name: 'gather' },
  { tick: 414, name: 'hide' }, { tick: 474, name: 'peek' }, { tick: 570, name: 'settle' }, { tick: 650, name: 'restored' },
];
const points = preview ? allPoints.filter(point => ['idle', 'hide', 'peek'].includes(point.name)) : allPoints;
const eventLog = [{ tick: 90, type: 'invite', x: .70, y: .33 }, { tick: 280, type: 'release' }, { tick: 360, type: 'pulse', x: -.5, y: 0 }];
const surfaces = preview ? ['study'] : ['study', 'gallery'];
await mkdir(out, { recursive: true });
const snapshotRoot = join(task, 'native-capture-source', String(Date.now()));
const manifest = { schemaVersion: 1, generatedAt: new Date().toISOString(), baselineCommit: BASE,
  evidenceKind: 'Native Skia Canvas renders of exact source; baseline has a mocked browser host. NOT browser screenshots.',
  notEvidenceFor: ['Browser rendering', 'CSS or responsive layout', 'Trusted keyboard/touch delivery', 'Device FPS', 'Browser heap behavior'],
  runtime: { node: process.version, platform: process.platform, arch: process.arch, nativeCanvas: require(join(dirname(canvasModule), 'package.json')).version, dpr: 1 },
  fontPolicy: 'Animal renderer font stacks are unmodified and resolve to installed Liberation Mono in native Canvas. Evidence captions use explicit Liberation Mono because native generic monospace resolves proportionally. No font is bundled or downloaded.',
  replay: { tickRate: 60, speed: 1, eventLog, note: 'Events apply after the listed tick capture, before advancing to the next tick. Candidate positions map to identical CSS-pixel baseline pointer positions.' },
  capturePolicy: 'Main baseline geometry/rasterization execute every tick; native pixel writes are suppressed on unretained ticks. Main-canvas drawImage checkpoints preserve RGBA pixels and state every 128 atlas draws to bound native snapshot memory. Candidate uses its exact fillText renderer.',
  sources: {}, hostParity: {}, frames: [], sheets: [], editable: [], motion: [], timing: {}, warnings: [],
};

async function snapshot(relative, variant) {
  const bytes = variant === 'baseline' ? execFileSync('git', ['show', `${BASE}:${relative}`], { cwd: repo }) : await readFile(join(repo, relative));
  const target = join(snapshotRoot, variant, relative); await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes); manifest.sources[`${variant}/${relative}`] = sha(bytes); return target;
}
for (const variant of ['baseline', 'candidate']) {
  await mkdir(join(snapshotRoot, variant), { recursive: true });
  await writeFile(join(snapshotRoot, variant, 'package.json'), '{"type":"module"}\n');
}
for (const relative of ['src/core/scheduler.js', 'src/animals/cuttlefish.js', 'src/animals/manta.js', 'src/animals/octopus.js']) await snapshot(relative, 'baseline');
for (const relative of ['species/octopus/trickster/core.mjs', 'species/octopus/trickster/render.mjs']) await snapshot(relative, 'candidate');
manifest.sources['capture-script'] = sha(await readFile(fileURLToPath(import.meta.url)));
manifest.sources['fake-browser-host'] = sha(await readFile(join(repo, 'test/helpers/fake-browser.mjs')));
const { CuttlefishArtwork } = await import(pathToFileURL(join(snapshotRoot, 'baseline/src/animals/cuttlefish.js')));
const core = await import(pathToFileURL(join(snapshotRoot, 'candidate/species/octopus/trickster/core.mjs')));
const render = await import(pathToFileURL(join(snapshotRoot, 'candidate/species/octopus/trickster/render.mjs')));

function baselineOptions(surface) {
  const common = { species: 'octopus', count: 1, scene: 'reactive', seed: surface === 'study' ? 17 : 7,
    followPointer: true, speed: 1, autoStart: false, paused: false, reducedMotion: 'ignore', observeVisibility: true };
  return surface === 'study' ? { ...common, speciesByAnimal: [], formation: 'independent', behaviors: ['hover'],
    size: 1.3, sizeVariation: 0, density: 1.45, palette: 'ember', glow: false } : { ...common, size: 1 };
}
const pixelMethods = new Set(['fillText', 'strokeText', 'fill', 'stroke', 'clearRect', 'fillRect', 'strokeRect', 'putImageData', 'reset']);
function baselineFixture(size, surface, checkpoints = true) {
  const host = fakeBrowser({ dpr: 1 }), backings = new WeakMap();
  function canvas(width = 1, height = 1, main = false) {
    const target = host.canvas(width, height), native = createCanvas(Math.max(1, width), Math.max(1, height));
    const entry = { native, paint: true, main, saves: 0, imageDraws: 0, checkpoints: 0 };
    backings.set(target, entry);
    Object.defineProperties(target, {
      width: { configurable: true, get: () => native.width, set: value => { native.width = Math.max(1, value); entry.saves = entry.imageDraws = 0; } },
      height: { configurable: true, get: () => native.height, set: value => { native.height = Math.max(1, value); entry.saves = entry.imageDraws = 0; } },
    });
    const context = native.getContext('2d'), methods = new Map();
    function checkpoint() {
      if (!checkpoints || !main || entry.saves || entry.imageDraws < 128) return;
      const image = context.getImageData(0, 0, native.width, native.height), transform = context.getTransform();
      const keys = ['fillStyle', 'strokeStyle', 'globalAlpha', 'globalCompositeOperation', 'imageSmoothingEnabled', 'imageSmoothingQuality', 'filter', 'font', 'textAlign', 'textBaseline', 'lineWidth', 'lineCap', 'lineJoin', 'miterLimit', 'lineDashOffset', 'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY'];
      const styles = keys.map(key => [key, context[key]]), dash = context.getLineDash();
      native.width = native.width; context.putImageData(image, 0, 0);
      for (const [key, value] of styles) if (value !== undefined) context[key] = value;
      context.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f); context.setLineDash(dash);
      entry.imageDraws = 0; entry.checkpoints++; globalThis.gc();
    }
    const proxy = new Proxy(context, {
      get(object, key) {
        if (methods.has(key)) return methods.get(key);
        if (key === 'drawImage') {
          const fn = (source, ...values) => { if (!entry.paint) return; const result = object.drawImage(backings.get(source)?.native || source, ...values); entry.imageDraws++; checkpoint(); return result; };
          methods.set(key, fn); return fn;
        }
        const value = object[key]; if (typeof value !== 'function') return value;
        const fn = (...values) => {
          if (pixelMethods.has(key) && !entry.paint) return;
          const result = value.apply(object, values);
          if (key === 'save') entry.saves++; else if (key === 'restore') { entry.saves = Math.max(0, entry.saves - 1); checkpoint(); }
          return result;
        }; methods.set(key, fn); return fn;
      },
      set(object, key, value) { object[key] = value; return true; },
    });
    target.getContext = type => type === '2d' ? proxy : null; return target;
  }
  host.document.createElement = name => { if (name !== 'canvas') throw new Error(`Unexpected element ${name}`); return canvas(); };
  const target = canvas(size.width, size.height, true), artwork = new CuttlefishArtwork(target, baselineOptions(surface));
  const backing = backings.get(target); backing.paint = false;
  function input(event) {
    if (event.type === 'release') { target.emit('pointerleave'); return; }
    const unit = Math.min(size.width * .44, size.height * .48);
    target.emit('pointermove', { pointerType: 'mouse', clientX: size.width * .5 + event.x * unit, clientY: size.height * .49 + event.y * unit });
    if (event.type === 'pulse') artwork.pulse();
  }
  return { native: backing.native, artwork, input,
    step() { backing.paint = false; artwork.advance(1 / 60); },
    present() {
      const before = logicalDigest(artwork); backing.paint = true; artwork.render(); backing.paint = false;
      backing.native.getContext('2d').getImageData(0, 0, 1, 1); globalThis.gc();
      if (logicalDigest(artwork) !== before) throw new Error('Baseline redraw advanced logical state.');
    },
    stats() { return { ...artwork.getStats(), diagnostics: JSON.parse(JSON.stringify(artwork.fish[0].speciesState.diagnostics)),
      exactOptions: JSON.parse(JSON.stringify(artwork.options)), nativeCheckpoints: backing.checkpoints, pendingScheduledFrames: host.pending }; },
    dispose() { artwork.destroy(); artwork.destroy(); if (host.pending || host.resizes.size || host.intersections.size || target.listenerCount) throw new Error('Baseline disposal leaked.'); backing.native.width = backing.native.height = 1; globalThis.gc(); },
  };
}
function logicalDigest(artwork) {
  const hash = createHash('sha256');
  for (const array of [artwork.depth, artwork.tones, artwork.glyphs, artwork.kinds, artwork.owners, artwork.visibility]) hash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
  return hash.digest('hex');
}
function candidateFixture(size, surface) {
  const state = core.createOctopusState(surface === 'study' ? 17 : 7), native = createCanvas(size.width, size.height);
  let events = [], stats;
  return { native, state,
    input(event) { events.push({ ...event, type: event.type === 'pulse' ? 'startle' : event.type }); },
    step() { core.stepOctopus(state, events); events = []; },
    present() {
      const before = JSON.stringify(state); stats = render.renderOctopus(native, state, { width: size.width, height: size.height, dpr: 1 });
      if (JSON.stringify(state) !== before) throw new Error('Candidate rendering mutated core state.');
    },
    stats() {
      const { grid, hitTest, ...numeric } = stats;
      return { ...numeric, pose: core.sampleOctopus(state), gridSha256: sha(Buffer.concat([Buffer.from(grid.chars), Buffer.from(grid.colors), Buffer.from(grid.owners)])) };
    },
    dispose() { native.width = native.height = 1; },
  };
}

async function parity() {
  const size = { width: 320, height: 240 }, outputs = [];
  for (const enabled of [false, true]) {
    const f = baselineFixture(size, 'study', enabled); f.present();
    outputs.push({ rgba: Buffer.from(f.native.getContext('2d').getImageData(0, 0, size.width, size.height).data), logical: logicalDigest(f.artwork), checkpoints: f.stats().nativeCheckpoints }); f.dispose();
  }
  let differingChannels = 0, maximumDelta = 0;
  for (let i = 0; i < outputs[0].rgba.length; i++) { const delta = Math.abs(outputs[0].rgba[i] - outputs[1].rgba[i]); if (delta) differingChannels++; maximumDelta = Math.max(maximumDelta, delta); }
  manifest.hostParity = { viewport: size, exact: differingChannels === 0 && outputs[0].logical === outputs[1].logical,
    differingChannels, maximumDelta, directRgbaHash: sha(outputs[0].rgba), checkpointRgbaHash: sha(outputs[1].rgba), checkpointCount: outputs[1].checkpoints };
  if (!manifest.hostParity.exact || !outputs[1].checkpoints) throw new Error('Native checkpoint host differs from direct native pixels.');
}
async function capture(variant, size, surface) {
  const fixture = variant === 'baseline' ? baselineFixture(size, surface) : candidateFixture(size, surface);
  try {
    for (let tick = 0; tick <= points.at(-1).tick; tick++) {
      const point = points.find(value => value.tick === tick);
      if (point) {
        fixture.present(); const filename = `native-${size.name}-${surface}-${variant}-${point.name}.png`, bytes = fixture.native.toBuffer('image/png');
        await writeFile(join(out, filename), bytes);
        manifest.frames.push({ filename, evidence: 'Native Canvas; NOT browser', variant, surface, tick, elapsedSeconds: tick / 60,
          label: point.name, width: size.width, height: size.height, seed: surface === 'study' ? 17 : 7, pngSha256: sha(bytes), stats: fixture.stats() });
        if (variant === 'candidate' && surface === 'study' && ['idle', 'contact', 'peek'].includes(point.name)) {
          await editableGrid(fixture.state, size, point);
        }
      }
      for (const event of eventLog) if (event.tick === tick) fixture.input(event);
      if (tick !== points.at(-1).tick) fixture.step();
      if (tick % 30 === 0) { globalThis.gc(); await new Promise(accept => setImmediate(accept)); }
    }
  } finally { fixture.dispose(); }
  console.log(JSON.stringify({ captured: variant, surface, size: size.name, states: points.length }));
}
async function editableGrid(state, size, point) {
  const directory = join(task, 'octopus-delivery/concepts'); await mkdir(directory, { recursive: true });
  const grid = render.rasterizeOctopus(state, size), palette = Object.values(render.PALETTE);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
  const texts = [];
  for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++) {
    const index = row * grid.cols + col; if (grid.chars[index] === 32) continue;
    texts.push(`<text x="${((col + .5) * grid.cellW).toFixed(3)}" y="${((row + .5) * grid.cellH).toFixed(3)}" fill="${palette[grid.colors[index]]}">${escape(String.fromCharCode(grid.chars[index]))}</text>`);
  }
  const title = `Pocket Trickster ${point.name}; seed 17, tick ${point.tick}; editable ASCII cell-map export`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}"><title>${escape(title)}</title><desc>Original deterministic cell output. Editable proposal, not a browser screenshot; font rasterization may differ.</desc><rect width="100%" height="100%" fill="${render.PALETTE.water}"/><g font-family="&apos;SFMono-Regular&apos;,Consolas,&apos;Liberation Mono&apos;,monospace" font-size="${Math.min(grid.cellH * .95, grid.cellW * 1.62).toFixed(3)}" font-weight="600" text-anchor="middle" dominant-baseline="central">${texts.join('')}</g></svg>\n`;
  const name = `octopus-${size.name}-${point.name}`;
  await writeFile(join(directory, name + '.svg'), svg);
  await writeFile(join(directory, name + '.txt'), render.gridToText(grid) + '\n');
  manifest.editable.push({ svg: `concepts/${name}.svg`, text: `concepts/${name}.txt`, title, cols: grid.cols, rows: grid.rows,
    cellCount: grid.chars.length, glyphCount: grid.glyphCount, note: 'Actual cell data; editable export, not native/browser pixel evidence.' });
}
async function sheet(filename, frames, columns, thumbWidth, thumbHeight, title) {
  const header = 80, caption = 36, rows = Math.ceil(frames.length / columns);
  const canvas = createCanvas(columns * thumbWidth, header + rows * (thumbHeight + caption)), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#09191f'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff0ce'; ctx.font = '600 20px "Liberation Mono"'; ctx.fillText(title, 18, 30);
  ctx.fillStyle = '#9eafb1'; ctx.font = '12px "Liberation Mono"'; ctx.fillText('NATIVE CANVAS + SIMULATED HOST · NOT BROWSER SCREENSHOTS', 18, 54);
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i], x = i % columns * thumbWidth, y = header + Math.floor(i / columns) * (thumbHeight + caption);
    const image = await loadImage(join(out, f.filename)); ctx.drawImage(image, x, y, thumbWidth, thumbHeight);
    ctx.fillStyle = '#14262d'; ctx.fillRect(x, y + thumbHeight, thumbWidth, caption);
    ctx.fillStyle = '#fff0ce'; ctx.font = '12px "Liberation Mono"';
    const actualStage = f.variant === 'baseline' ? f.stats.diagnostics?.sequence || f.stats.reactionStage || f.label
      : f.stats.pose?.stage || f.label;
    const label = `${f.variant === 'baseline' ? 'MAIN' : 'PROPOSAL'} · ${actualStage} · tick ${f.tick}`;
    if (ctx.measureText(label).width > thumbWidth - 24) ctx.font = '10px "Liberation Mono"';
    ctx.fillText(label, x + 12, y + thumbHeight + 23);
  }
  await writeFile(join(out, filename), canvas.toBuffer('image/png'));
  manifest.sheets.push({ filename, evidence: 'Native Canvas composite; original component PNGs supplied', title, frames: frames.map(f => f.filename), width: canvas.width, height: canvas.height });
}
async function makeSheets() {
  for (const surface of surfaces) for (const size of sizes) {
    for (const name of preview ? ['idle', 'peek'] : ['idle', 'contact', 'peek']) {
      const frames = ['baseline', 'candidate'].map(variant => manifest.frames.find(f => f.variant === variant && f.surface === surface && f.width === size.width && f.label === name));
      await sheet(`native-${size.name}-${surface}-before-after-${name}.png`, frames, 2, size.width, size.height, `Octopus · main / Pocket Trickster · ${surface}`);
    }
    const frames = manifest.frames.filter(f => f.variant === 'candidate' && f.surface === surface && f.width === size.width);
    await sheet(`native-${size.name}-${surface}-candidate-sequence.png`, frames, preview ? 3 : 5,
      size.name === 'desktop' ? 320 : 260, size.name === 'desktop' ? 200 : 334, 'Pocket Trickster · native motion keys');
  }
}
async function captureMovie(size) {
  const dir = join(out, `native-motion-frames-${size.name}`); await mkdir(dir, { recursive: true });
  const fixture = candidateFixture(size, 'study'), labelled = createCanvas(size.width, size.height + 50), ctx = labelled.getContext('2d');
  let index = 0; const retained = [];
  for (let tick = 0; tick <= 720; tick++) {
    if (tick % 2 === 0) {
      fixture.present(); ctx.fillStyle = '#09191f'; ctx.fillRect(0, 0, labelled.width, labelled.height); ctx.drawImage(fixture.native, 0, 50);
      ctx.fillStyle = '#fff0ce'; ctx.font = `${size.width < 600 ? 11 : 14}px "Liberation Mono"`;
      ctx.fillText('POCKET TRICKSTER · NATIVE CANVAS', 14, 21);
      ctx.fillStyle = '#9eafb1'; ctx.font = `${size.width < 600 ? 9 : 11}px "Liberation Mono"`;
      const pose = core.sampleOctopus(fixture.state);
      ctx.fillText(`Not browser · normal speed · ${(tick / 60).toFixed(2)}s · ${pose.stage}`, 14, 39);
      const bytes = labelled.toBuffer('image/png'), filename = String(index++).padStart(4, '0') + '.png';
      await writeFile(join(dir, filename), bytes); retained.push({ filename, tick, stage: pose.stage, pngSha256: sha(bytes) });
    }
    for (const event of eventLog) if (event.tick === tick) fixture.input(event);
    if (tick < 720) fixture.step();
    if (tick % 60 === 0) { globalThis.gc(); await new Promise(accept => setImmediate(accept)); }
  }
  fixture.dispose();
  const mp4 = `octopus-${size.name}-native-normal-speed.mp4`, gif = `octopus-${size.name}-native-normal-speed.gif`;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '30', '-i', join(dir, '%04d.png'), '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(out, mp4)]);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '30', '-i', join(dir, '%04d.png'), '-filter_complex', `[0:v]fps=15,scale=${Math.min(size.width, 720)}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, '-loop', '0', join(out, gif)]);
  const metadata = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,width,height,r_frame_rate,nb_frames', '-of', 'json', join(out, mp4)], { encoding: 'utf8' }));
  manifest.motion.push({ mp4, gif, evidence: 'Native Canvas frames; NOT browser or live wall-clock capture', speed: 1, simulationHz: 60, mp4Fps: 30, gifFps: 15, retained, metadata });
  console.log(JSON.stringify({ motion: mp4, frameCount: index }));
}
function timing() {
  const size = sizes[0], fixture = candidateFixture(size, 'study'), canvasTimes = [], gridTimes = [];
  for (let tick = 0; tick < 720; tick++) {
    for (const event of eventLog) if (event.tick === tick) fixture.input(event);
    fixture.step();
    if (tick % 2) continue;
    let start = performance.now(); render.rasterizeOctopus(fixture.state, size); const gridMs = performance.now() - start;
    start = performance.now(); fixture.present(); const canvasMs = performance.now() - start;
    if (tick >= 60) { gridTimes.push(gridMs); canvasTimes.push(canvasMs); }
  }
  const summarize = times => {
    times.sort((a, b) => a - b);
    return { measuredFrames: times.length, p50Ms: times[Math.floor(times.length * .5)],
      p95Ms: times[Math.floor(times.length * .95)], maximumMs: times.at(-1), below16MsReference: times[Math.floor(times.length * .95)] <= 16 };
  };
  fixture.dispose();
  manifest.timing = { evidence: 'Node pure-cell CPU work and native Canvas CPU work; neither is a browser or physical-device benchmark',
    width: size.width, height: size.height, warmupFrames: 30, sampledEveryTicks: 2, eventLog,
    declaredReferenceP95Ms: 16, pureCellRaster: summarize(gridTimes), nativeCanvasRasterAndDraw: summarize(canvasTimes),
    note: 'Native canvas sample includes a JSON state-purity guard. Whole sequence covers idle, reach, contact, recoil, hide, peek, settle.' };
}

try {
  if (args.has('--baseline-refresh')) {
    const saved = JSON.parse(await readFile(join(out, preview ? 'native-preview-manifest.json' : 'native-manifest.json'), 'utf8'));
    Object.assign(manifest, saved, { frames: saved.frames.filter(frame => frame.variant !== 'baseline'), sheets: [] });
    manifest.sources['baseline-refresh-script'] = sha(await readFile(fileURLToPath(import.meta.url)));
    for (const surface of surfaces) for (const size of sizes) await capture('baseline', size, surface);
    await makeSheets();
  } else if (args.has('--sheets-only')) {
    const saved = JSON.parse(await readFile(join(out, preview ? 'native-preview-manifest.json' : 'native-manifest.json'), 'utf8'));
    Object.assign(manifest, saved, { sheets: [] });
    manifest.sources['sheet-script'] = sha(await readFile(fileURLToPath(import.meta.url)));
    await makeSheets();
  } else {
    await parity();
    for (const surface of surfaces) for (const size of sizes) for (const variant of ['baseline', 'candidate']) await capture(variant, size, surface);
    await makeSheets();
    if (!preview) timing();
    if (motion && !preview) for (const size of sizes) await captureMovie(size);
  }
  manifest.completed = true;
} catch (error) { manifest.completed = false; manifest.error = error.stack || String(error); process.exitCode = 1; }
finally {
  const name = preview ? 'native-preview-manifest.json' : 'native-manifest.json';
  await writeFile(join(out, name), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ completed: manifest.completed, output: out, frames: manifest.frames.length, sheets: manifest.sheets.length,
    motion: manifest.motion.length, timing: manifest.timing, error: manifest.error?.split('\n')[0] }, null, 2));
}
