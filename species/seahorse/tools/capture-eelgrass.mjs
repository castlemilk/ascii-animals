/** Exact adapter pixels in native Skia Canvas. This is NOT a browser screenshot.
 * Usage: node .../capture-eelgrass.mjs OUTPUT [PATH_TO_BUILT_SEAHORSE_MODULE] [--motion]
 * Uses an installed @napi-rs/canvas; adds no runtime dependency to the package.
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';
const require = createRequire(import.meta.url);
const canvasModule = process.env.SEAHORSE_CANVAS_MODULE || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/@napi-rs/canvas` : '@napi-rs/canvas');
const { createCanvas, GlobalFonts } = require(canvasModule);
const fontFile = process.env.SEAHORSE_FONT_FILE || '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf';
GlobalFonts.registerFromPath(fontFile, 'monospace');
const output = path.resolve(process.argv[2] || 'artifacts/seahorse-eelgrass');
const moduleFile = path.resolve(process.argv[3] || 'lib/public/seahorse.js');
const { createSeahorseArtwork } = await import(pathToFileURL(moduleFile));
await mkdir(output, { recursive: true });
function host(width, height, options) {
  const harness = fakeBrowser(), surface = harness.canvas(width, height), canvas = createCanvas(width, height);
  surface.getContext = () => canvas.getContext('2d');
  for (const key of ['width', 'height']) Object.defineProperty(surface, key, { get: () => canvas[key], set: n => { canvas[key] = n; } });
  let callback;
  const frameSource = { subscribe: cb => { callback = cb; return () => { callback = undefined; }; } };
  const art = createSeahorseArtwork(surface, { ...options, frameSource });
  harness.intersect(surface, true);
  let time = 0;
  function step(ticks) { if (callback) { callback(time); for (let i = 0; i < ticks;) { const n = Math.min(6, ticks - i); callback?.(time += n * 1000 / 60); i += n; } } }
  return { art, canvas, surface, harness, step };
}
const scenarios = [
  { name: 'desktop', width: 1280, height: 900, columns: 160, rows: 76, count: 1 },
  { name: 'phone', width: 390, height: 530, columns: 100, rows: 76, count: 1 },
  { name: 'ensemble', width: 1280, height: 900, columns: 160, rows: 76, count: 3 },
];
const records = [];
const motion = process.argv.includes('--motion');
if (!motion) for (const scenario of scenarios) {
  const { name, width, height, columns, rows, count } = scenario;
  const base = { scene: 'kelp-garden', choreography: 'hold', columns, rows, count, current: .6, seed: 7, labels: false, individuals: [{ role: 'sentinel' }, { role: 'explorer' }, { role: 'dreamer' }] };
  for (const [state, cue, tick, target] of [
    ['rest', null, 0, null], ['brace-prepare', 'startle', 18, null], ['brace', 'startle', 80, null], ['brace-recover', 'startle', 202, null],
    ['release-prepare', 'release', 18, null], ['uncoil', 'release', 48, null], ['drift', 'release', 100, null], ['reanchor', 'release', 210, null],
    ['notice', 'inspect', 18, [-.65, -.25]], ['approach', 'inspect', 85, [-.65, -.25]], ['settle', 'inspect', 180, [-.65, -.25]],
  ]) {
    const h = host(width, height, base);
    if (target) h.art.guide(...target);
    if (cue) h.art.direct({ type: cue });
    h.step(tick);
    const file = `${name}-${state}.png`;
    await writeFile(path.join(output, file), h.canvas.toBuffer('image/png'));
    const director = h.art.getDirectorState(), frame = h.art.getFrame();
    records.push({ name, file, state, cue, tick: h.art.getStatus().tick, viewport: { width, height }, options: h.art.getOptions(), director, frameSha256: createHash('sha256').update(frame.text).digest('hex') });
    h.art.dispose();
  }
}
if (motion) {
  const options = { scene: 'kelp-garden', choreography: 'hold', columns: 100, rows: 76,
    count: 1, current: .6, seed: 7, labels: false, individuals: [{ role: 'sentinel' }] };
  const events = [{ tick: 30, type: 'startle' }, { tick: 300, type: 'release' },
    { tick: 570, type: 'inspect', guide: [-.65, -.25] }];
  for (const viewport of [{ name: 'motion', width: 780, height: 660 }, { name: 'phone-motion', width: 390, height: 530 }]) {
    const h = host(viewport.width, viewport.height, options);
    const directory = path.join(output, viewport.name);
    await mkdir(directory, { recursive: true });
    for (let tick = 0; tick <= 780; tick += 5) {
      const event = events.find(event => event.tick === tick);
      if (event?.guide) h.art.guide(...event.guide);
      if (event) h.art.direct({ type: event.type });
      const file = `${viewport.name}/${String(tick / 5).padStart(4, '0')}.png`;
      await writeFile(path.join(output, file), h.canvas.toBuffer('image/png'));
      records.push({ file, tick: h.art.getStatus().tick, expectedTick: tick, event,
        viewport, options: h.art.getOptions(), director: h.art.getDirectorState() });
      if (tick < 780) h.step(5);
    }
    h.art.dispose();
  }
}
await writeFile(path.join(output, 'capture-manifest.json'), JSON.stringify({
  representation: 'Exact built createSeahorseArtwork Canvas2D drawing in native @napi-rs/canvas / Skia; fake DOM and deterministic frameSource. NOT browser screenshots or real-device validation.',
  moduleFile, moduleSha256: createHash('sha256').update(await readFile(moduleFile)).digest('hex'),
  fontFile, fontSha256: createHash('sha256').update(await readFile(fontFile)).digest('hex'),
  node: process.version, motion, sampledFps: motion ? 12 : null, records,
}, null, 2) + '\n');
console.log(JSON.stringify({ output, captures: records.length, renderer: 'native Canvas, not browser' }));
