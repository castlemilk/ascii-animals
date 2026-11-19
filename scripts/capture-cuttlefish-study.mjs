#!/usr/bin/env node
/**
 * Exact-source native evidence. This is @napi-rs/canvas (Skia) with the repo's
 * simulated DOM; it is deliberately not described as browser screenshots.
 *
 * node scripts/capture-cuttlefish-study.mjs --repo /absolute/checkout \
 *   --out /absolute/evidence [--size 1.4] [--stills-only | --movies-only]
 *
 * Set CODEX_PRIMARY_RUNTIME_NODE_MODULES if @napi-rs/canvas is runtime-owned.
 * Requires ffmpeg for normal-time 12 fps motion, and Liberation Mono fonts.
 */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const argumentsList = process.argv.slice(2);
function flag(name) { return argumentsList.includes(name); }
function argument(name, fallback) {
  const index = argumentsList.indexOf(name);
  if (index < 0) return fallback;
  if (!argumentsList[index + 1] || argumentsList[index + 1].startsWith('--')) throw new Error(`${name} requires a value`);
  return argumentsList[index + 1];
}
const repo = resolve(argument('--repo', join(dirname(fileURLToPath(import.meta.url)), '..')));
const output = resolve(argument('--out', join(repo, '..', 'study-evidence')));
const size = Number(argument('--size', '1.4'));
if (!Number.isFinite(size) || size < .35 || size > 1.4) throw new RangeError('--size must use the inherited supported range .35–1.4');
if (output === repo || output.startsWith(`${repo}/`)) throw new Error('Evidence output must be outside the repository');
if (flag('--stills-only') && flag('--movies-only')) throw new Error('Choose at most one capture restriction');
await mkdir(output, { recursive: true });

const require = createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, '__cuttlefish_capture__.cjs') : import.meta.url);
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const canvasVersion = require('@napi-rs/canvas/package.json').version;
const { fakeBrowser } = await import(pathToFileURL(join(repo, 'test/helpers/fake-browser.mjs')));
const { CuttlefishArtwork } = await import(pathToFileURL(join(repo, 'src/animals/cuttlefish.js')));
const { createCuttlefishStudy } = await import(pathToFileURL(join(repo, 'src/animals/cuttlefish-study.js')));
const { sampleStudy } = await import(pathToFileURL(join(repo, 'src/animals/cuttlefish-study-director.js')));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceBytes = await readFile(join(repo, 'src/animals/cuttlefish.js'));
const sourceSHA256 = sha(sourceBytes);
const baseline = sourceSHA256 === 'c09382ee6847bdfc269d4b55bf44e24e92d7dd46fe53be7e46b34f6891c6b94f' ? 'public'
  : sourceSHA256 === 'de98d21f593751cdd69e66b2425ff72c064508e9af1d856fb434dd60099d569d' ? 'v71' : null;
if (!baseline) throw new Error(`Unknown canonical renderer: ${sourceSHA256}`);
const fontPaths = ['/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf'];
const fonts = [];
for (const path of fontPaths) {
  if (!existsSync(path)) throw new Error(`Required font is unavailable: ${path}`);
  GlobalFonts.registerFromPath(path, 'Liberation Mono');
  GlobalFonts.registerFromPath(path, 'monospace');
  fonts.push({ path, sha256: sha(await readFile(path)) });
}

function nativeHost(width, height) {
  const host = fakeBrowser({ dpr: 1 });
  const immutableSources = new WeakMap();
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
              // Discarded constructor frames need no image commands. Once the
              // immutable glyph atlases are decoded, rerender the exact source.
              if (mounting) return;
              return native.drawImage(immutableSources.get(source) || source, ...coordinates);
            };
            const value = Reflect.get(native, key, native);
            return typeof value === 'function' ? value.bind(native) : value;
          },
          set(native, key, value) { return Reflect.set(native, key, value, native); }
        }));
      }
      return contexts.get(type);
    };
    canvas.ownerDocument = host.document;
    canvas.getBoundingClientRect = target.getBoundingClientRect.bind(target);
    canvas.addEventListener = target.addEventListener.bind(target);
    canvas.removeEventListener = target.removeEventListener.bind(target);
    canvas.dispatchEvent = target.dispatchEvent.bind(target);
    canvas.emit = target.emit.bind(target);
    Object.defineProperties(canvas, {
      listenerCount: { get: () => target.listenerCount },
      rect: { get: () => target.rect, set: value => { target.rect = value; } }
    });
    return canvas;
  };
  host.document.createElement = name => {
    if (name !== 'canvas') throw new Error(`Native capture only supports canvas elements, received ${name}`);
    return makeCanvas();
  };
  return { host, canvas: makeCanvas(width, height),
    async finishMount(art) {
      const verified = [];
      for (const name of ['atlas', 'inkAtlas']) {
        const source = art[name], image = await loadImage(source.toBuffer('image/png'));
        // Verify full native-size RGBA and representative scaled/cropped draws.
        // A lossless immutable image avoids @napi's per-glyph live-canvas copy.
        const copy = createCanvas(source.width, source.height), ctx = copy.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const original = Buffer.from(source.getContext('2d').getImageData(0, 0, source.width, source.height).data);
        const decoded = Buffer.from(ctx.getImageData(0, 0, source.width, source.height).data);
        if (!original.equals(decoded)) throw new Error(`${name}: PNG snapshot changed native RGBA`);
        const left = createCanvas(160, 80), right = createCanvas(160, 80);
        const sprite = name === 'atlas' ? art.sprite : art.inkSprite;
        const drawSize = name === 'atlas' ? art.spriteDrawSize : art.inkDrawSize;
        for (let index = 0; index < 5; index++) {
          const sx = index * sprite % source.width, sy = index * 17 * sprite % source.height;
          const dx = 20 + index * art.cellW - drawSize / 2, dy = (index + .5) * art.cellH - drawSize / 2;
          left.getContext('2d').drawImage(source, sx, sy, sprite, sprite, dx, dy, drawSize, drawSize);
          right.getContext('2d').drawImage(image, sx, sy, sprite, sprite, dx, dy, drawSize, drawSize);
        }
        const direct = Buffer.from(left.getContext('2d').getImageData(0, 0, 160, 80).data);
        const cached = Buffer.from(right.getContext('2d').getImageData(0, 0, 160, 80).data);
        if (!direct.equals(cached)) {
          const differences = [...direct].map((value, index) => Math.abs(value - cached[index]));
          throw new Error(`${name}: cropped snapshot differs in ${differences.filter(Boolean).length} RGBA values; max ${Math.max(...differences)}`);
        }
        immutableSources.set(source, image);
        verified.push({ source: name, width: source.width, height: source.height,
          sourceRGBA: sha(original), croppedDrawRGBA: sha(direct), exact: true });
      }
      mounting = false;
      art.render();
      return verified;
    }
  };
}

const artworkOptions = Object.freeze({
  species: 'cuttlefish', scene: 'reactive', count: 1, behaviors: ['hover'], formation: 'independent',
  seed: 20261119, autoStart: false, paused: false, size, sizeVariation: 0,
  ripple: .85, density: 1.4, speed: .85, followPointer: false,
  motion: 1.2, depthStrength: 1.2, glow: true, maxCells: 65536, showLabels: false
});
const studyOptions = Object.freeze({ automatic: false, habitat: true, restrainedSkin: true, concealFeedingTentacles: true });
const viewports = [{ name: 'desktop', width: 1100, height: 640 }, { name: 'phone', width: 390, height: 560 }];
const modes = ['ascii', 'points'];
const matched = [
  { name: 'hover', action: 'hover', seconds: 0, point: { x: .22, y: -.06 } },
  { name: 'broadside', action: 'investigate', seconds: 3.2, point: { x: .45, y: -.04 } },
  { name: 'three-quarter', action: 'investigate', seconds: 3.2, point: { x: -.4, y: -.12 } },
  { name: 'turned', action: 'turn', seconds: 2, point: { x: .22, y: -.06 } }
];
const representatives = {
  hover: [0], investigate: [.3, 1.5, 3.2, 5.4, 7],
  turn: [.3, 1.3, 2, 3.5, 5.1], retreat: [.3, .95, 1.55, 2.5, 5.5, 9.7, 10.5]
};
const boundaries = [
  { name: 'investigate-return', action: 'investigate', tick: 414 },
  { name: 'turn-return', action: 'turn', tick: 306 },
  { name: 'retreat-trigger', action: 'retreat', tick: 54 },
  { name: 'retreat-return', action: 'retreat', tick: 630 }
];
const point = Object.freeze({ x: .22, y: -.06 });

async function mount(viewport, mode, before = false) {
  const { host, canvas, finishMount } = nativeHost(viewport.width, viewport.height);
  const art = before ? new CuttlefishArtwork(canvas, { ...artworkOptions, mode })
    : createCuttlefishStudy(canvas, studyOptions, { ...artworkOptions, mode });
  const atlasVerification = await finishMount(art);
  return { host, canvas, art, atlasVerification };
}
function dispose(mounted) {
  mounted.art.destroy();
  const { host, canvas } = mounted;
  if (host.pending || canvas.listenerCount || host.document.listenerCount || host.view.listenerCount
    || host.motion.listenerCount || host.resizes.size || host.intersections.size) {
    throw new Error('Native evidence mount did not dispose its simulated lifecycle registrations');
  }
}
function bodyBounds(art) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity, cells = 0, edgeCells = 0;
  for (let index = 0; index < art.owners.length; index++) {
    if (art.owners[index] < 0 || art.visibility[index] < .1) continue;
    const column = index % art.cols, row = Math.floor(index / art.cols);
    cells++;
    left = Math.min(left, column); top = Math.min(top, row);
    right = Math.max(right, column + 1); bottom = Math.max(bottom, row + 1);
    if (column === 0 || row === 0 || column === art.cols - 1 || row === art.rows - 1) edgeCells++;
  }
  return { cells, edgeCells, pixels: cells ? [left * art.cellW, top * art.cellH,
    right * art.cellW, bottom * art.cellH].map(value => Number(value.toFixed(3))) : null };
}
function pose(art) {
  return art.fish.map(fish => ({ position: [fish.worldX, fish.worldY, fish.worldZ],
    forward: [fish.r00, fish.r10, fish.r20], basis: [fish.r01, fish.r11, fish.r21, fish.r02, fish.r12, fish.r22] }));
}
async function savePNG(canvas, filename) {
  const bytes = canvas.toBuffer('image/png');
  await writeFile(join(output, filename), bytes);
  return { file: filename, bytes: bytes.length, sha256: sha(bytes) };
}
function alignCanonical(before, after) {
  // Explicit evidence-only hook. Original body, eye, arm, shading, projection
  // and rasterization methods are untouched. Only the base's pose branch is
  // selected and sampled from the candidate to isolate the visible treatment.
  before._legacySingle = () => false;
  before._schoolPose = function () {
    const sampled = sampleStudy(after._studyState,
      { id: this.activeFish.id, seed: this.activeFish.seed, count: this.fish.length },
      { width: this.width, height: this.height });
    this.phase = sampled.phase; this.progress = sampled.progress;
    return sampled;
  };
  before.time = after.time; before.elapsed = after.elapsed;
  before.setPaused(after.paused);
  before.pointer = { ...after.pointer };
  before.fish.forEach((fish, index) => { fish.sceneTime = after.fish[index].sceneTime; });
  before.render();
  if (JSON.stringify(pose(before)) !== JSON.stringify(pose(after))) throw new Error('Matched evidence camera/pose mismatch');
  if (JSON.stringify(before.options) !== JSON.stringify(after.options)) throw new Error('Matched normalized options differ');
}
function visualPhase(study, reactionStage) {
  return reactionStage === 'idle' ? study.phase
    : ({ react: 'reaction', spray: 'ink release', escape: 'jet', recover: 'recovery' }[reactionStage] || reactionStage);
}
async function contactSheet(viewport, mode, rows) {
  const margin = 20, columnGap = 20, head = 100, rowHead = 43;
  const canvas = createCanvas(viewport.width * 2 + margin * 2 + columnGap,
    head + rows.length * (viewport.height + rowHead) + 30);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#091013'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#dfede7'; ctx.font = 'bold 21px "Liberation Mono"';
  ctx.fillText(`Cuttlefish / ${baseline === 'v71' ? 'reviewed V7.1' : 'public main'} / ${viewport.name} / ${mode}`, margin, 30);
  ctx.fillStyle = '#a5beb6'; ctx.font = '13px "Liberation Mono"';
  ctx.fillText('NATIVE CANVAS / SIMULATED DOM / DPR 1 / seed 20261119', margin, 54);
  ctx.fillText('Matched pose and time. Original anatomy before; additive study after.', margin, 74);
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index], y = head + index * (viewport.height + rowHead);
    ctx.fillStyle = '#d3dfd8'; ctx.font = '14px "Liberation Mono"';
    ctx.fillText(`${row.name} / ${row.seconds.toFixed(2)} s / BEFORE`, margin, y + 22);
    ctx.fillText(`${row.name} / ${row.seconds.toFixed(2)} s / AFTER`, margin + viewport.width + columnGap, y + 22);
    ctx.drawImage(await loadImage(join(output, row.before.file)), margin, y + rowHead);
    ctx.drawImage(await loadImage(join(output, row.after.file)), margin + viewport.width + columnGap, y + rowHead);
  }
  return savePNG(canvas, `${baseline}-${viewport.name}-${mode}-matched-sheet.png`);
}
async function sequenceSheet(viewport, action, rows) {
  // Phone sheets retain native resolution; desktop panels are scaled solely in
  // this annotated contact sheet. All individually linked source PNGs are 1:1.
  const panelWidth = viewport.name === 'desktop' ? 550 : viewport.width;
  const scale = panelWidth / viewport.width, panelHeight = Math.round(viewport.height * scale);
  const columns = viewport.name === 'desktop' ? 3 : 2, gap = 18, header = 84, labelHeight = 36;
  const canvas = createCanvas(gap + columns * (panelWidth + gap),
    header + Math.ceil(rows.length / columns) * (panelHeight + labelHeight + gap));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#091013'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#dfede7'; ctx.font = 'bold 20px "Liberation Mono"';
  ctx.fillText(`${baseline} / ${action} / ${viewport.name}`, gap, 30);
  ctx.fillStyle = '#a5beb6'; ctx.font = '13px "Liberation Mono"';
  ctx.fillText(`NATIVE CANVAS / SIMULATED DOM / ${scale === 1 ? 'native-size panels' : '50% panels; full-size PNGs included'}`, gap, 54);
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index], x = gap + index % columns * (panelWidth + gap);
    const y = header + Math.floor(index / columns) * (panelHeight + labelHeight + gap);
    ctx.fillStyle = '#d3dfd8'; ctx.font = '13px "Liberation Mono"';
    ctx.fillText(`${row.seconds.toFixed(2)} s / ${row.visualPhase || row.phase}`, x, y + 20);
    ctx.drawImage(await loadImage(join(output, row.file)), x, y + labelHeight, panelWidth, panelHeight);
  }
  return savePNG(canvas, `${baseline}-${viewport.name}-ascii-${action}-states.png`);
}

const manifestPath = join(output, `${baseline}-native-evidence.json`);
const sourceIdentity = {
  baseline, canonicalSourceSHA256: sourceSHA256,
  adapterSHA256: sha(await readFile(join(repo, 'src/animals/cuttlefish-study.js'))),
  directorSHA256: sha(await readFile(join(repo, 'src/animals/cuttlefish-study-director.js')))
};
let previous;
if (flag('--movies-only') && existsSync(manifestPath)) {
  previous = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (JSON.stringify(previous.source) !== JSON.stringify(sourceIdentity)) throw new Error('Existing stills use different source bytes; recapture them first');
}
const manifest = previous || {
  schema: 1, title: 'Cuttlefish study exact-source native visual evidence',
  renderer: { name: '@napi-rs/canvas', version: canvasVersion, implementation: 'native Skia Canvas',
    environment: 'repository fakeBrowser simulated DOM; no actual browser', browserTested: false,
    node: process.version, dpr: 1, fonts,
    atlasCaching: 'Discarded constructor drawImage commands are suppressed. Unchanged glyph/ink canvases are decoded once as immutable PNG Images; full native RGBA and fractional cropped draws are checked byte-identical before the actual source is rerendered. Dynamic glow canvases remain live.' },
  source: sourceIdentity, artworkOptions, studyOptions,
  comparison: {
    baselineBody: 'Exact original canonical body/eyes/arms/shading on the selected base',
    poseNormalization: 'Evidence-only _legacySingle false and _schoolPose override samples the candidate pure pose; identical camera, simulation time, seed and options',
    interpretation: 'Material, fin energy, habitat and feeding-stream visibility comparison; not original shipped choreography',
    privateAnatomy: 'Public and V7.1 comparisons are separate. Public after is not asserted to contain reviewed V7.1 anatomy.'
  },
  matched: [], representatives: [], boundaries: [], contactSheets: [], movies: [],
  limits: ['No browser, CSS, focus or physical-device performance evidence.',
    'Native fonts and rasterization can differ from real browsers.',
    'Cell-edge checks detect obvious clipping but do not prove all silhouette detail or aesthetics.']
};

if (!flag('--movies-only')) {
  for (const viewport of viewports) for (const mode of modes) {
    console.log(`${baseline} ${viewport.name} ${mode}: mounting native canvases`);
    const after = await mount(viewport, mode);
    console.log(`${baseline} ${viewport.name} ${mode}: candidate mounted, RSS ${Math.round(process.memoryUsage().rss / 1048576)} MiB`);
    const before = await mount(viewport, mode, true), rows = [];
    try {
      for (const item of matched) {
        after.art.showStudyStill(item.action, item.seconds, item.point);
        alignCanonical(before.art, after.art);
        const prefix = `${baseline}-${viewport.name}-${mode}-${item.name}`;
        const record = { ...item, viewport, mode,
          before: { ...await savePNG(before.canvas, `${prefix}-before.png`), bounds: bodyBounds(before.art) },
          after: { ...await savePNG(after.canvas, `${prefix}-after.png`), bounds: bodyBounds(after.art) },
          matchedPose: pose(after.art), engineTime: after.art.time,
          normalizedArtworkOptions: structuredClone(after.art.options), study: after.art.getStudy(),
          atlasVerification: { before: before.atlasVerification, after: after.atlasVerification } };
        rows.push(record); manifest.matched.push(record);
      }
      manifest.contactSheets.push(await contactSheet(viewport, mode, rows));
      for (const [action, times] of Object.entries(representatives)) {
        const sequenceRows = [];
        for (const seconds of times) {
          after.art.showStudyStill(action, seconds, point);
          const filename = `${baseline}-${viewport.name}-${mode}-${action}-${seconds.toFixed(2).replace('.', 'p')}.png`;
          const state = after.art.getStudy(), stats = after.art.getStats();
          const record = { action, seconds, viewport, mode, ...await savePNG(after.canvas, filename),
            phase: state.phase, visualPhase: visualPhase(state, stats.reactionStage),
            engineReaction: stats.reactionStage, inkParticles: after.art.ink.length,
            bounds: bodyBounds(after.art), study: state, engineTime: after.art.time };
          sequenceRows.push(record); manifest.representatives.push(record);
        }
        if (mode === 'ascii' && action !== 'hover') manifest.contactSheets.push(await sequenceSheet(viewport, action, sequenceRows));
      }
      if (mode === 'ascii') for (const boundary of boundaries) {
        const boundaryRows = [];
        for (const offset of [-1, 0, 1]) {
          const tick = boundary.tick + offset, seconds = tick / 60;
          after.art.showStudyStill(boundary.action, seconds, point);
          const state = after.art.getStudy(), reactionStage = after.art.getStats().reactionStage;
          const file = `${baseline}-${viewport.name}-ascii-${boundary.name}-tick${tick}.png`;
          const record = { boundary: boundary.name, action: boundary.action, tick, seconds, viewport, mode,
            ...await savePNG(after.canvas, file), phase: state.phase, visualPhase: visualPhase(state, reactionStage),
            engineReaction: reactionStage, inkParticles: after.art.ink.length, bounds: bodyBounds(after.art) };
          boundaryRows.push(record); manifest.boundaries.push(record);
        }
        manifest.contactSheets.push(await sequenceSheet(viewport, `${boundary.name}-boundary`, boundaryRows));
      }
      console.log(`${baseline} ${viewport.name} ${mode}: matched frames and representative states captured`);
    } finally { dispose(before); dispose(after); }
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }
}

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 5e6 });
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${result.stderr || result.error || result.status}`);
}
if (!flag('--stills-only')) {
  const fps = 12;
  for (const viewport of viewports) for (const [action, duration] of [['investigate', 7.5], ['turn', 5.5], ['retreat', 11]]) {
    const prefix = `${baseline}-${viewport.name}-ascii-${action}-native`;
    const framesDirectory = join(output, `${prefix}-frames`);
    await mkdir(framesDirectory, { recursive: true });
    const mounted = await mount(viewport, 'ascii'), frames = [], frameHash = createHash('sha256');
    try {
      if (!mounted.art.cueStudy({ type: action, ...point })) throw new Error(`Could not start ${action}`);
      mounted.art.render();
      for (let frame = 0; frame < duration * fps; frame++) {
        if (frame) mounted.art.advance(5 / 60);
        const bytes = mounted.canvas.toBuffer('image/png');
        frameHash.update(bytes);
        await writeFile(join(framesDirectory, `${String(frame).padStart(4, '0')}.png`), bytes);
        const state = mounted.art.getStudy(), reactionStage = mounted.art.getStats().reactionStage;
        frames.push({ frame, seconds: frame / fps, studyTick: state.tick,
          phase: state.phase, visualPhase: visualPhase(state, reactionStage), engineReaction: reactionStage,
          inkParticles: mounted.art.ink.length, bounds: bodyBounds(mounted.art) });
        if (frame > 0 && frame % 30 === 0) console.log(`${baseline} ${viewport.name} ${action}: native frame ${frame}/${duration * fps}, RSS ${Math.round(process.memoryUsage().rss / 1048576)} MiB`);
      }
    } finally { dispose(mounted); }
    const videoName = `${prefix}.mp4`;
    ffmpeg(['-framerate', String(fps), '-i', join(framesDirectory, '%04d.png'), '-an',
      '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(output, videoName)]);
    const record = { action, viewport, fps, simulationHz: 60, duration, frames: frames.length,
      frameStreamSHA256: frameHash.digest('hex'), video: { file: videoName, sha256: sha(await readFile(join(output, videoName))) },
      clippedFrames: frames.filter(frame => frame.bounds.edgeCells > 0).length,
      emptyFrames: frames.filter(frame => frame.bounds.cells === 0).length,
      phases: [...new Set(frames.map(frame => frame.phase))],
      reactionStages: [...new Set(frames.map(frame => frame.engineReaction))] };
    if (viewport.name === 'phone') {
      const gifName = `${prefix}.gif`;
      ffmpeg(['-framerate', String(fps), '-i', join(framesDirectory, '%04d.png'), '-filter_complex',
        '[0:v]split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3',
        '-loop', '0', join(output, gifName)]);
      record.gif = { file: gifName, sha256: sha(await readFile(join(output, gifName))) };
    }
    const logName = `${prefix}-frames.json`;
    await writeFile(join(output, logName), JSON.stringify(frames, null, 2));
    record.frameLog = logName;
    manifest.movies.push(record);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    await rm(framesDirectory, { recursive: true });
    console.log(`${baseline} ${viewport.name} ${action}: ${record.frames} frames / ${duration}s / ${record.clippedFrames} edge frames`);
  }
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ manifest: manifestPath, matchedPairs: manifest.matched.length,
  representativeFrames: manifest.representatives.length, boundaryFrames: manifest.boundaries.length, movies: manifest.movies.length,
  source: sourceIdentity, browserTested: false }));
