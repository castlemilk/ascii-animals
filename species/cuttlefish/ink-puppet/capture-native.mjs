#!/usr/bin/env node
/**
 * Exact-source native evidence, never browser screenshots.
 *
 * CODEX_PRIMARY_RUNTIME_NODE_MODULES=/path/to/node_modules \
 * node species/cuttlefish/ink-puppet/capture-native.mjs --out /outside/repo/evidence
 *
 * Requires @napi-rs/canvas, ffmpeg, and installed Liberation Mono fonts.
 * The canonical-host/immutable-atlas pattern follows the repository's
 * scripts/capture-cuttlefish-study.mjs, without its historical source-hash gate.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';
import { CuttlefishArtwork } from '../../../src/animals/cuttlefish.js';
import { createPuppetState, cuePuppet, stepPuppet, samplePuppet,
  getPuppetState, PUPPET_MODEL_VERSION } from './model.mjs';
import { rasterizePuppet, drawPuppetGrid, gridToText, PUPPET_PALETTE, PUPPET_GLYPHS } from './render.mjs';

const args = process.argv.slice(2);
function argument(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${name} requires a value.`);
  return args[index + 1];
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const out = resolve(argument('--out', join(root, '..', 'cuttlefish-review/evidence/native')));
if (out === root || out.startsWith(`${root}/`)) throw new Error('Evidence must be written outside the repository.');
if (args.includes('--stills-only') && args.includes('--movies-only')) throw new Error('Choose one capture restriction.');
await mkdir(out, { recursive: true });
const require = createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, '__ink_puppet_capture__.cjs') : import.meta.url);
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const canvasVersion = require('@napi-rs/canvas/package.json').version;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const paths = ['src/animals/cuttlefish.js', 'src/core/scheduler.js', 'test/helpers/fake-browser.mjs',
  'species/cuttlefish/ink-puppet/model.mjs', 'species/cuttlefish/ink-puppet/render.mjs',
  'species/cuttlefish/ink-puppet/capture-native.mjs'];
const sourceHashes = Object.fromEntries(await Promise.all(paths.map(async path => [path, sha(await readFile(join(root, path)))])));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const fontPaths = ['/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf'];
const fonts = [];
for (const path of fontPaths) {
  if (!existsSync(path)) throw new Error(`Required installed font unavailable: ${path}`);
  GlobalFonts.registerFromPath(path, 'Liberation Mono');
  GlobalFonts.registerFromPath(path, 'monospace');
  fonts.push({ path, sha256: sha(await readFile(path)) });
}
const viewports = [{ name: 'desktop', width: 1100, height: 640 }, { name: 'phone', width: 390, height: 560 }];
const galleryOptions = Object.freeze({ seed: 7, species: 'cuttlefish', scene: 'reactive', count: 1,
  size: 1, followPointer: true, paused: true, autoStart: false, reducedMotion: 'system' });
const puppetOptions = Object.freeze({ seed: 7, size: 1, habitat: true });
const eventLog = Object.freeze([
  { tick: 0, seq: 1, input: { type: 'investigate', x: .3, y: -.1 } },
  { tick: 400, seq: 2, input: { type: 'retreat', x: .25, y: -.1 } }
]);
const manifest = {
  schemaVersion: 1, evidenceType: 'native-canvas-with-simulated-DOM; not browser screenshots',
  repository: 'https://github.com/castlemilk/ascii-animals', baseCommit: commit,
  modelVersion: PUPPET_MODEL_VERSION, sourceHashes,
  runtime: { node: process.version, platform: process.platform, arch: process.arch,
    canvas: `@napi-rs/canvas ${canvasVersion}`, fonts,
    ffmpeg: execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' }).split('\n')[0] },
  before: { description: 'Actual canonical gallery renderer; movement wrapper is disabled in the gallery.',
    requestedOptions: galleryOptions, pointer: 'inactive; no recorded live pointer input' },
  after: { description: 'Actual isolated Ink Puppet pure model and ASCII cell renderer.', options: puppetOptions,
    glyphs: PUPPET_GLYPHS, palette: PUPPET_PALETTE },
  comparison: 'Equal viewport, DPR1, seed7, selected size1 and elapsed tick0. Different authored poses; no pose-alignment override.',
  movie: { simulationHz: 60, presentationFps: 24, totalTicks: 780, durationSeconds: 13, frames: 312,
    eventLog, tickSampling: 'floor(frame * 60 / 24); zero or one simulation-tick quantisation at presentation',
    speed: '1x simulation time, not a browser performance recording', headerPixels: 48 },
  captures: [], outputs: [], limitations: [
    'Native Skia pixels differ from browser/system-font pixels.',
    'The canonical original retains its existing glyph atlas, glow and atmospheric raster treatments.',
    'Ink Puppet scene is only a flat field and printable ASCII glyphs; labels are evidence metadata.',
    'No pointer/touch DOM dispatch, browser media recording, GPU timing or physical-phone performance is implied.'
  ]
};

function nativeHost(width, height) {
  const host = fakeBrowser({ dpr: 1 }), immutable = new WeakMap();
  let mounting = true;
  const makeCanvas = (w = 300, h = 150) => {
    const target = host.canvas(w, h), canvas = createCanvas(300, 150);
    const getContext = canvas.getContext.bind(canvas), contexts = new Map();
    canvas.getContext = type => {
      if (!contexts.has(type)) {
        const context = getContext(type);
        contexts.set(type, new Proxy(context, {
          get(native, key) {
            if (key === 'drawImage') return (source, ...coordinates) => {
              if (mounting) return;
              native.drawImage(immutable.get(source) || source, ...coordinates);
            };
            const value = Reflect.get(native, key, native);
            return typeof value === 'function' ? value.bind(native) : value;
          },
          set(native, key, value) { return Reflect.set(native, key, value, native); }
        }));
      }
      return contexts.get(type);
    };
    Object.assign(canvas, { ownerDocument: host.document,
      getBoundingClientRect: target.getBoundingClientRect.bind(target),
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      dispatchEvent: target.dispatchEvent.bind(target) });
    Object.defineProperty(canvas, 'listenerCount', { get: () => target.listenerCount });
    return canvas;
  };
  host.document.createElement = name => {
    if (name !== 'canvas') throw new Error(`Unsupported native-host element: ${name}`);
    return makeCanvas();
  };
  return { host, canvas: makeCanvas(width, height), async finish(art) {
    const verification = [];
    for (const name of ['atlas', 'inkAtlas']) {
      const source = art[name], image = await loadImage(source.toBuffer('image/png'));
      const copy = createCanvas(source.width, source.height), c = copy.getContext('2d'); c.drawImage(image, 0, 0);
      const direct = Buffer.from(source.getContext('2d').getImageData(0, 0, source.width, source.height).data);
      const decoded = Buffer.from(c.getImageData(0, 0, source.width, source.height).data);
      assert.ok(direct.equals(decoded), `${name} immutable PNG cache changed RGBA`);
      // Verify representative scaled/cropped sprite draws as well as full RGBA.
      const left = createCanvas(160, 80), right = createCanvas(160, 80);
      const sprite = name === 'atlas' ? art.sprite : art.inkSprite;
      const drawSize = name === 'atlas' ? art.spriteDrawSize : art.inkDrawSize;
      for (let i = 0; i < 5; i++) {
        const coordinates = [i * sprite % source.width, i * 17 * sprite % source.height, sprite, sprite,
          20 + i * art.cellW - drawSize / 2, (i + .5) * art.cellH - drawSize / 2, drawSize, drawSize];
        left.getContext('2d').drawImage(source, ...coordinates);
        right.getContext('2d').drawImage(image, ...coordinates);
      }
      const originalCrop = Buffer.from(left.getContext('2d').getImageData(0, 0, 160, 80).data);
      const cachedCrop = Buffer.from(right.getContext('2d').getImageData(0, 0, 160, 80).data);
      assert.ok(originalCrop.equals(cachedCrop), `${name} immutable cache changed cropped draws`);
      immutable.set(source, image);
      verification.push({ name, width: source.width, height: source.height,
        rgbaSHA256: sha(direct), croppedRGBA: sha(originalCrop), exact: true });
    }
    mounting = false; art.render();
    return verification;
  } };
}

function canonicalBounds(art) {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity, cells = 0, edges = 0;
  for (let i = 0; i < art.owners.length; i++) if (art.owners[i] >= 0 && art.visibility[i] > .005) {
    const x = i % art.cols, y = Math.floor(i / art.cols);
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); cells++;
    if (x === 0 || y === 0 || x === art.cols - 1 || y === art.rows - 1) edges++;
  }
  return { cells, edges, bounds: cells ? { left: left * art.cellW, right: (right + 1) * art.cellW,
    top: top * art.cellH, bottom: (bottom + 1) * art.cellH } : null };
}
function gridMetrics(grid) {
  let edges = 0, inkCells = 0;
  for (let i = 0; i < grid.owners.length; i++) {
    if (grid.owners[i] === 8) inkCells++;
    if (grid.owners[i] < 1 || grid.owners[i] > 6) continue;
    const x = i % grid.cols, y = Math.floor(i / grid.cols);
    if (x === 0 || y === 0 || x === grid.cols - 1 || y === grid.rows - 1) edges++;
  }
  return { bounds: grid.bounds, cells: grid.glyphs.length, animalCells: grid.animalCells,
    glyphCount: grid.glyphCount, edgeCells: edges, inkCells };
}
function puppetFrame(viewport, state) {
  const pose = samplePuppet(state), grid = rasterizePuppet(pose, { ...viewport, ...puppetOptions });
  const canvas = createCanvas(viewport.width, viewport.height); drawPuppetGrid(canvas.getContext('2d'), grid);
  return { canvas, grid, pose };
}
async function save(bytes, filename, extra = {}) {
  await writeFile(join(out, filename), bytes);
  const result = { file: filename, bytes: bytes.length, sha256: sha(bytes), ...extra };
  manifest.outputs.push(result); return result;
}
const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function svgGlyphs(grid, x = 0, y = 0, scale = 1) {
  let content = `<g transform="translate(${x} ${y}) scale(${scale})"><rect width="${grid.width}" height="${grid.height}" fill="${PUPPET_PALETTE[0]}"/>`;
  content += `<g font-family="Liberation Mono,monospace" font-weight="600" font-size="${grid.cellH * .98}" text-anchor="middle" dominant-baseline="central">`;
  for (let i = 0; i < grid.glyphs.length; i++) if (grid.glyphs[i]) {
    content += `<text x="${((i % grid.cols + .5) * grid.cellW).toFixed(3)}" y="${((Math.floor(i / grid.cols) + .5) * grid.cellH).toFixed(3)}" fill="${PUPPET_PALETTE[grid.colors[i]]}">${xml(String.fromCharCode(grid.glyphs[i]))}</text>`;
  }
  return `${content}</g></g>`;
}
function svg(grid, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${grid.width}" height="${grid.height}" viewBox="0 0 ${grid.width} ${grid.height}"><title>${xml(title)}</title><desc>Editable printable-ASCII text glyphs from exact source; native Canvas reference, not browser evidence. Fonts are not embedded.</desc>${svgGlyphs(grid)}</svg>`;
}
function sheetHeader(ctx, width, title, note) {
  ctx.fillStyle = '#08151a'; ctx.fillRect(0, 0, width, 10000);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = 'bold 21px "Liberation Mono"'; ctx.fillStyle = '#f5dfaa'; ctx.fillText(title, 20, 31);
  ctx.font = '13px "Liberation Mono"'; ctx.fillStyle = '#97c9b3'; ctx.fillText(note, 20, 57);
}

if (!args.includes('--movies-only')) {
  for (const viewport of viewports) {
    const native = nativeHost(viewport.width, viewport.height);
    const before = new CuttlefishArtwork(native.canvas, galleryOptions);
    const atlas = await native.finish(before);
    const after = puppetFrame(viewport, createPuppetState(7));
    await save(native.canvas.toBuffer('image/png'), `${viewport.name}-before.png`, { width: viewport.width, height: viewport.height });
    await save(after.canvas.toBuffer('image/png'), `${viewport.name}-after.png`, { width: viewport.width, height: viewport.height });
    await save(Buffer.from(svg(after.grid, `Ink Puppet / ${viewport.name} / seed 7 / tick 0`)), `${viewport.name}-after.svg`);
    await save(Buffer.from(gridToText(after.grid)), `${viewport.name}-after.txt`);
    const width = viewport.width * 2 + 60, height = viewport.height + 120;
    const contact = createCanvas(width, height), ctx = contact.getContext('2d');
    sheetHeader(ctx, width, `Cuttlefish / ${viewport.name} / native Canvas comparison`,
      `Seed 7 / DPR 1 / time 0 / selected scale 1 / different authored poses`);
    ctx.font = 'bold 14px "Liberation Mono"'; ctx.fillStyle = '#e9e9d5';
    ctx.fillText(`BEFORE / canonical main ${commit.slice(0, 7)}`, 20, 87);
    ctx.fillText('AFTER / isolated Ink Puppet prototype', viewport.width + 40, 87);
    ctx.drawImage(native.canvas, 20, 100); ctx.drawImage(after.canvas, viewport.width + 40, 100);
    await save(contact.toBuffer('image/png'), `matched-${viewport.name}.png`, { width, height });
    manifest.captures.push({ kind: 'matched-still', viewport, tick: 0, beforeOptions: before.options,
      beforeMetrics: canonicalBounds(before), afterMetrics: gridMetrics(after.grid), atlasVerification: atlas });
    before.destroy();
    assert.equal(native.host.pending, 0);
    assert.equal(native.canvas.listenerCount + native.host.document.listenerCount + native.host.view.listenerCount + native.host.motion.listenerCount, 0);
    assert.equal(native.host.resizes.size + native.host.intersections.size, 0);
    console.log(`Saved ${viewport.name} before/after + editable SVG/text.`);
  }
  const entries = [
    { name: 'NOTICE', action: 'investigate', seconds: .5, target: { x: .3, y: -.1 } },
    { name: 'REACH', action: 'investigate', seconds: 2.25, target: { x: .3, y: -.1 } },
    { name: 'SOFT JET', action: 'retreat', seconds: 1.75, target: { x: .25, y: -.1 } },
    { name: 'SETTLE', action: 'retreat', seconds: 5.1, target: { x: .25, y: -.1 } }
  ];
  const sheetWidth = 1160, sheetHeight = 850, contact = createCanvas(sheetWidth, sheetHeight), c = contact.getContext('2d');
  sheetHeader(c, sheetWidth, 'Ink Puppet / staged motion keys', 'Native Canvas / seed 7 / each action starts at tick 0 / desktop frames shown at 50%');
  let vector = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWidth}" height="${sheetHeight}" viewBox="0 0 ${sheetWidth} ${sheetHeight}"><title>Editable Ink Puppet motion keys</title><rect width="100%" height="100%" fill="#08151a"/><text x="20" y="31" fill="#f5dfaa" font-size="21" font-family="Liberation Mono,monospace">Ink Puppet / native Canvas motion keys</text>`;
  for (const [index, entry] of entries.entries()) {
    const state = createPuppetState(7); cuePuppet(state, { type: entry.action, ...entry.target }); stepPuppet(state, Math.round(entry.seconds * 60));
    const rendered = puppetFrame(viewports[0], state), x = 20 + index % 2 * 570, y = 102 + Math.floor(index / 2) * 370;
    const label = `${entry.name} / ${rendered.pose.phase} / ${entry.seconds.toFixed(2)}s`;
    c.font = 'bold 15px "Liberation Mono"'; c.fillStyle = '#f5dfaa'; c.fillText(label, x, y - 14);
    c.drawImage(rendered.canvas, x, y, 550, 320);
    vector += `<text x="${x}" y="${y - 14}" fill="#f5dfaa" font-size="15" font-family="Liberation Mono,monospace">${xml(label)}</text>${svgGlyphs(rendered.grid, x, y, .5)}`;
    manifest.captures.push({ kind: 'motion-key', ...entry, tick: state.tick, phase: rendered.pose.phase, metrics: gridMetrics(rendered.grid) });
  }
  vector += '</svg>';
  await save(contact.toBuffer('image/png'), 'motion-keys.png', { width: sheetWidth, height: sheetHeight });
  await save(Buffer.from(vector), 'motion-keys.svg');
  console.log('Saved motion keys and editable glyph contact sheet.');
}

if (!args.includes('--stills-only')) {
  for (const viewport of viewports) {
    const filename = `normal-speed-${viewport.name}.mp4`, destination = join(out, filename);
    const encoder = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-vcodec', 'png',
      '-framerate', '24', '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', destination], { stdio: ['pipe', 'ignore', 'pipe'] });
    let errors = ''; encoder.stderr.on('data', data => { if (errors.length < 20000) errors += data; });
    const complete = once(encoder, 'close');
    encoder.stdin.on('error', () => {});
    const state = createPuppetState(7), scene = createCanvas(viewport.width, viewport.height), sceneCtx = scene.getContext('2d');
    const film = createCanvas(viewport.width, viewport.height + 48), ctx = film.getContext('2d');
    let eventIndex = 0, maximumEdgeCells = 0, maximumInkCells = 0, minimumAnimalCells = Infinity;
    let maximumCellAllocation = 0, maximumGlyphs = 0;
    const timings = [];
    for (let frame = 0; frame < 312; frame++) {
      const tick = Math.floor(frame * 60 / 24);
      while (eventLog[eventIndex]?.tick <= tick) {
        const event = eventLog[eventIndex++]; stepPuppet(state, event.tick - state.tick);
        assert.equal(cuePuppet(state, event.input), true, `Replay rejected event ${event.seq}`);
      }
      stepPuppet(state, tick - state.tick);
      const started = performance.now(), pose = samplePuppet(state);
      const grid = rasterizePuppet(pose, { ...viewport, ...puppetOptions });
      drawPuppetGrid(sceneCtx, grid); timings.push(performance.now() - started);
      const metrics = gridMetrics(grid);
      maximumEdgeCells = Math.max(maximumEdgeCells, metrics.edgeCells);
      maximumInkCells = Math.max(maximumInkCells, metrics.inkCells);
      minimumAnimalCells = Math.min(minimumAnimalCells, metrics.animalCells);
      maximumCellAllocation = Math.max(maximumCellAllocation, metrics.cells); maximumGlyphs = Math.max(maximumGlyphs, metrics.glyphCount);
      ctx.fillStyle = '#08151a'; ctx.fillRect(0, 0, film.width, 48);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = 'bold 12px "Liberation Mono"'; ctx.fillStyle = '#f5dfaa';
      ctx.fillText('NATIVE CANVAS REPLAY / 1x', 12, 18);
      ctx.textAlign = 'right'; ctx.fillText(`${(tick / 60).toFixed(2)}s`, film.width - 12, 18);
      ctx.textAlign = 'left'; ctx.font = '12px "Liberation Mono"'; ctx.fillStyle = '#97c9b3';
      ctx.fillText(`${pose.action || 'idle'} / ${pose.phase}`, 12, 37);
      ctx.drawImage(scene, 0, 48);
      if (!encoder.stdin.write(film.toBuffer('image/png'))) await once(encoder.stdin, 'drain');
      if (frame % 78 === 0) console.log(`${viewport.name}: frame ${frame}/312, tick ${tick}, ${pose.phase}.`);
    }
    stepPuppet(state, 780 - state.tick);
    encoder.stdin.end(); const [code] = await complete;
    if (code !== 0) throw new Error(`ffmpeg failed (${code}): ${errors}`);
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
      'stream=width,height,r_frame_rate,nb_frames,duration', '-of', 'json', destination], { encoding: 'utf8' }));
    const stream = probe.streams[0];
    assert.equal(stream.r_frame_rate, '24/1'); assert.equal(Number(stream.nb_frames), 312); assert.equal(Number(stream.duration), 13);
    assert.equal(maximumEdgeCells, 0, 'Native replay reached the viewing boundary');
    const movieBytes = await readFile(destination), sorted = timings.slice(20).sort((a, b) => a - b);
    manifest.outputs.push({ file: filename, bytes: (await stat(destination)).size, sha256: sha(movieBytes),
      width: stream.width, height: stream.height, durationSeconds: 13, fps: 24, frames: 312 });
    manifest.captures.push({ kind: 'native-replay', viewport, eventLog, finalState: getPuppetState(state),
      maximumEdgeCells, maximumInkCells, minimumAnimalCells, maximumCellAllocation, maximumGlyphs,
      nativeRenderWorkMs: { warmupFramesExcluded: 20, p50: sorted[Math.floor(sorted.length * .5)],
        p95: sorted[Math.floor(sorted.length * .95)], p99: sorted[Math.floor(sorted.length * .99)],
        interpretation: 'Host-native raster+Canvas wall work only. Encoding excluded; not browser frame rate.' } });
    console.log(`Saved ${filename}: 312 frames, 24 fps, 13s, ${maximumEdgeCells} animal edge cells.`);
  }
}

for (const [path, expected] of Object.entries(sourceHashes)) assert.equal(sha(await readFile(join(root, path))), expected,
  `Source changed during capture: ${path}; rerun against one source snapshot.`);
await writeFile(join(out, 'native-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ output: out, sourceHashes, outputs: manifest.outputs.map(item => item.file) }, null, 2));
