// Matched source evidence on a native Canvas2D backend. This is NOT a browser.
// Usage: node species/crab/tests/capture-review.mjs BASELINE_ROOT OUTPUT_DIR
// Optional: --stills-only, --baseline-only. Requires @napi-rs/canvas and ffmpeg.
// The supplied baseline must contain the exact pinned source, its compiled
// lib/public/crab.js, and baseline-manifest.json. No production assets are edited.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
if (!process.argv[2]) throw new Error('Pass the separately compiled pinned BASELINE_ROOT');
const baselineRoot = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3] ?? path.join(root, 'artifacts/crab-uplift'));
const stillsOnly = process.argv.includes('--stills-only');
const baselineOnly = process.argv.includes('--baseline-only');
const require = createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'package.json') : import.meta.url);
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const font = process.env.CRAB_EVIDENCE_FONT ?? '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf';
if (!GlobalFonts.registerFromPath(font, 'ui-monospace')) throw new Error('Evidence font registration failed');
const sha = data => createHash('sha256').update(data).digest('hex');
const baselineManifest = JSON.parse(await readFile(path.join(baselineRoot, 'baseline-manifest.json'), 'utf8'));
const expectedBase = 'b8f222dab868821f27bf2a64a98434f3483fc8e6';
if (baselineManifest.commit !== expectedBase) throw new Error(`Expected baseline ${expectedBase}`);
const beforeSource = await readFile(path.join(baselineRoot, 'src/public/crab.ts'));
if (sha(beforeSource) !== baselineManifest.files['src/public/crab.ts']) throw new Error('Baseline source hash mismatch');
const factories = {
  before: (await import(pathToFileURL(path.join(baselineRoot, 'lib/public/crab.js')))).createCrabArtwork,
  after: (await import(pathToFileURL(path.join(root, 'lib/public/crab.js')))).createCrabArtwork,
};
const sides = baselineOnly ? ['before'] : ['before', 'after'];
await mkdir(output, { recursive: true });
const manifest = {
  kind: 'native-canvas-with-mocked-window',
  baseCommit: expectedBase,
  node: process.version,
  typescript: JSON.parse(await readFile(path.join(root, 'node_modules/typescript/package.json'), 'utf8')).version,
  canvasBackend: { package: '@napi-rs/canvas', version: require('@napi-rs/canvas/package.json').version },
  font: { path: font, sha256: sha(await readFile(font)), registeredAlias: 'ui-monospace' },
  source: {
    before: { path: 'src/public/crab.ts', sha256: sha(beforeSource), compiledSHA256: sha(await readFile(path.join(baselineRoot, 'lib/public/crab.js'))) },
    after: { path: 'src/public/crab.ts', sha256: sha(await readFile(path.join(root, 'src/public/crab.ts'))), compiledSHA256: sha(await readFile(path.join(root, 'lib/public/crab.js'))) },
    harnessSHA256: sha(await readFile(fileURLToPath(import.meta.url))),
    fakeBrowserSHA256: sha(await readFile(path.join(root, 'test/helpers/fake-browser.mjs'))),
  },
  notVerified: ['real browser DOM and CSS', 'real pointer/touch/keyboard delivery', 'screen readers', 'device performance', 'Safari or mobile browser rasterization'],
  chromiumAttempt: {
    result: 'blocked before page creation', executable: '/usr/bin/chromium', driver: 'Playwright',
    error: 'process_singleton_posix.cc:297: socket() failed: Operation not permitted; SIGABRT',
    workaround: 'none',
  },
  guarantees: 'Same source runtime, seed, options, ordered events and integer ticks; raster output is specific to this native backend and font.',
  timeline: {
    tickRate: 60, lastTick: 1080, sampledEveryTicks: 6,
    events: [
      { tick: 0, method: 'setBeat', arguments: ['forage'] },
      { tick: 60, method: 'guide', arguments: [0.3, 0.20] },
      { tick: 60, method: 'cue', arguments: ['forage', 0] },
      { tick: 60, method: 'clearGuide', arguments: [] },
      { tick: 360, method: 'cue', arguments: ['signal', 0] },
      { tick: 720, method: 'cue', arguments: ['shelter', 0] },
    ],
  },
  fixtures: [], sequences: [],
};
const sizes = [
  { name: 'desktop', width: 980, height: 700, columns: 140, rows: 56 },
  { name: 'phone', width: 390, height: 280, columns: 80, rows: 32 },
];
const common = { seed: 7, scene: 'tide', count: 1, director: 'manual', tide: .2, current: .25, labels: false, speed: 1, scale: 1, paused: false };
const moments = new Map([
  [0, ['rest', 'Low tide / resting shell']],
  [78, ['scuttle-anticipation', 'Sand lure / anticipation']],
  [102, ['scuttle', 'Sideways scuttle / planted stance']],
  [180, ['forage', 'Sand lure / working claw']],
  [300, ['scuttle-recovery', 'Sand lure / recovery']],
  [378, ['display-anticipation', 'Claw display / anticipation']],
  [480, ['display', 'Claw display / held response']],
  [600, ['display-recovery', 'Claw display / recovery']],
  [780, ['retreat', 'Shelter / lateral retreat']],
  [840, ['shelter', 'Shelter / concealed']],
  [900, ['peek', 'Shelter / checking outside']],
  [960, ['return', 'Shelter / re-emergence']],
  [1080, ['recovered', 'Shelter / recovered']],
]);

function mount(factory, options, width, height) {
  const raster = createCanvas(width, height), lifecycle = fakeBrowser(), canvas = lifecycle.canvas(width, height);
  Object.defineProperties(canvas, {
    width: { get: () => raster.width, set: n => { raster.width = n; } },
    height: { get: () => raster.height, set: n => { raster.height = n; } },
  });
  canvas.getContext = () => raster.getContext('2d');
  const art = factory(canvas, options);
  lifecycle.intersect(canvas, true);
  lifecycle.frame(0); // Establish the adapter's timestamp, without advancing.
  return {
    raster, art, lifecycle,
    advance(ticks) {
      const before = art.getStatus().tick;
      while (ticks > 0) { const n = Math.min(6, ticks); lifecycle.frame(n * 1000 / 60); ticks -= n; }
      if (art.getStatus().tick < before) throw new Error('Clock moved backwards');
    },
  };
}

async function record(side, size, key, title, mounted) {
  const { raster, art } = mounted;
  const name = `${side}-${size.name}-${key}`;
  const png = raster.toBuffer('image/png');
  await writeFile(path.join(output, `${name}.png`), png);
  await writeFile(path.join(output, `${name}.txt`), art.getFrame().text + '\n');
  const frame = art.getFrame();
  manifest.fixtures.push({
    name, title, kind: manifest.kind, dimensions: { width: raster.width, height: raster.height },
    options: art.getOptions(), status: art.getStatus(), scene: art.getScene(),
    logicalSHA256: sha(frame.text), cellsSHA256: sha(JSON.stringify(frame.cells)), pngSHA256: sha(png),
  });
}

function eventAt(tick, art) {
  if (tick === 0) art.setBeat('forage');
  if (tick === 60) { art.guide(.3, .20); art.cue('forage', 0); art.clearGuide(); }
  if (tick === 360) art.cue('signal', 0);
  if (tick === 720) art.cue('shelter', 0);
}

function comparisonCanvas(width, height, title) {
  const image = createCanvas(width * 2 + 32, height + 94), ctx = image.getContext('2d');
  ctx.fillStyle = '#071115'; ctx.fillRect(0, 0, image.width, image.height);
  ctx.fillStyle = '#e3d6b9'; ctx.font = '18px ui-monospace'; ctx.fillText(title, 12, 25);
  ctx.fillStyle = '#99b3af'; ctx.font = '11px ui-monospace';
  ctx.fillText('Native Canvas2D · same seed / options / integer ticks · not browser screenshots', 12, 47);
  ctx.fillStyle = '#bcafa0'; ctx.font = '12px ui-monospace'; ctx.fillText('BEFORE · b8f222da', 12, 73);
  ctx.fillStyle = '#dcdbb7'; ctx.fillText('AFTER · crab source candidate', width + 20, 73);
  return { image, ctx, before: { x: 8, y: 88 }, after: { x: width + 24, y: 88 } };
}

for (const size of sizes) {
  const mounted = Object.fromEntries(sides.map(side => [side, mount(factories[side], { ...common, columns: size.columns, rows: size.rows }, size.width, size.height)]));
  for (let tick = 0; tick <= 1080; tick += 6) {
    for (const side of sides) {
      const m = mounted[side];
      if (tick) m.advance(6);
      if (m.art.getStatus().tick !== tick) throw new Error(`Bad clock at ${side}/${size.name}: ${m.art.getStatus().tick} != ${tick}`);
      eventAt(tick, m.art);
      if (moments.has(tick)) await record(side, size, ...moments.get(tick), m);
    }
  }
  for (const m of Object.values(mounted)) m.art.dispose();
  for (const side of sides) {
    // Existing default study and multi-resident limits receive their own controls,
    // not falsely presented as matched single-resident comparison settings.
    let m = mount(factories[side], { seed: 7, columns: size.columns, rows: size.rows, scene: 'study', paused: false }, size.width, size.height);
    m.advance(60); await record(side, size, 'study', 'Default study / tick 60', m); m.art.dispose();
    m = mount(factories[side], { ...common, scene: 'forage', count: 3, columns: size.columns, rows: size.rows }, size.width, size.height);
    m.advance(120); await record(side, size, 'ensemble-three', 'Three residents / tick 120', m); m.art.dispose();
    m = mount(factories[side], { ...common, scene: 'signals', count: 5, columns: size.columns, rows: size.rows, scale: .6, facing: 'right', paused: true }, size.width, size.height);
    m.art.setBeat('challenge'); await record(side, size, 'ensemble-five-minimum', 'Five residents / scale .6 / mirrored poster', m); m.art.dispose();
  }
  console.log(JSON.stringify({ completed: size.name, sides, moments: moments.size }));
}

if (!baselineOnly) {
  // Whole-sized individual views remain alongside these compact comparison sheets.
  for (const size of sizes) {
    for (const key of ['rest', 'display', 'shelter', 'study']) {
      const sheet = comparisonCanvas(size.width, size.height, `CRAB / ${key.toUpperCase()} / ${size.name.toUpperCase()}`);
      for (const side of sides) sheet.ctx.drawImage(await loadImage(path.join(output, `${side}-${size.name}-${key}.png`)), sheet[side].x, sheet[side].y);
      await writeFile(path.join(output, `native-matched-${size.name}-${key}.png`), sheet.image.toBuffer('image/png'));
    }
  }
  const sheetKeys = ['scuttle-anticipation', 'scuttle', 'forage', 'display-anticipation', 'display', 'display-recovery', 'retreat', 'shelter', 'peek', 'return', 'recovered', 'study'];
  const tileW = 390, tileH = 280, captionH = 44, top = 72, columns = 3, rows = Math.ceil(sheetKeys.length / columns);
  const sheet = createCanvas(columns * tileW, top + rows * (tileH + captionH)), ctx = sheet.getContext('2d');
  ctx.fillStyle = '#071115'; ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.fillStyle = '#e3d6b9'; ctx.font = '22px ui-monospace'; ctx.fillText('CRAB / THREE DIRECTED SEQUENCES', 16, 29);
  ctx.fillStyle = '#99b3af'; ctx.font = '12px ui-monospace'; ctx.fillText('After · 390×280 native canvas, 80×32 cells · browser/device acceptance remains separate', 16, 52);
  for (let i = 0; i < sheetKeys.length; i++) {
    const key = sheetKeys[i], x = (i % columns) * tileW, y = top + Math.floor(i / columns) * (tileH + captionH);
    ctx.drawImage(await loadImage(path.join(output, `after-phone-${key}.png`)), x, y + captionH);
    const f = manifest.fixtures.find(f => f.name === `after-phone-${key}`);
    ctx.fillStyle = '#cfccb9'; ctx.font = '11px ui-monospace'; ctx.fillText(f.title, x + 10, y + 18);
    ctx.fillStyle = '#8ea8a5'; ctx.font = '10px ui-monospace'; ctx.fillText(`tick ${f.status.tick} · ${f.scene.actors[0].behavior.kind}`, x + 10, y + 34);
  }
  await writeFile(path.join(output, 'native-sequence-contact-sheet.png'), sheet.toBuffer('image/png'));
}

if (!stillsOnly && !baselineOnly) {
  const width = 700, height = 500, motionDir = path.join(output, 'motion');
  await mkdir(motionDir, { recursive: true });
  const mounted = Object.fromEntries(sides.map(side => [side, mount(factories[side], { ...common, columns: 140, rows: 56 }, width, height)]));
  for (let tick = 0; tick <= 1080; tick += 6) {
    for (const side of sides) { const m = mounted[side]; if (tick) m.advance(6); eventAt(tick, m.art); }
    const section = tick < 60 ? 'LOW TIDE' : tick < 360 ? 'PLANTED SCUTTLE' : tick < 720 ? 'CLAW DISPLAY' : 'RETREAT / RE-EMERGE';
    const panel = comparisonCanvas(width, height, `${section} / ${(tick / 60).toFixed(1)} seconds / tick ${tick}`);
    for (const side of sides) panel.ctx.drawImage(mounted[side].raster, panel[side].x, panel[side].y);
    await writeFile(path.join(motionDir, `${String(tick / 6).padStart(3, '0')}.png`), panel.image.toBuffer('image/png'));
  }
  for (const m of Object.values(mounted)) m.art.dispose();
  const mp4 = path.join(output, 'native-crab-matched-motion.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '10', '-i', path.join(motionDir, '%03d.png'), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  const gif = path.join(output, 'native-crab-matched-motion.gif');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '10', '-i', path.join(motionDir, '%03d.png'), '-filter_complex', 'scale=1000:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3', '-loop', '0', gif], { stdio: 'inherit' });
  manifest.sequences.push({ name: 'native-crab-matched-motion', kind: manifest.kind, sampleRateHz: 10, renderedFrames: 181, simulatedSeconds: 18, dimensions: { width: 1432, height: 594 }, mp4SHA256: sha(await readFile(mp4)), gifSHA256: sha(await readFile(gif)), performanceClaim: 'Sampling rate only; not measured runtime FPS.' });
}
await writeFile(path.join(output, 'native-review-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ output, kind: manifest.kind, fixtures: manifest.fixtures.length, sequences: manifest.sequences.length, base: expectedBase }));
