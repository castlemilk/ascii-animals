// Optional deterministic native Canvas evidence. This is NOT a browser test.
// Use an already-installed @napi-rs/canvas module; no dependency is installed.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { createMarineMovementArtwork } from 'ascii-animals-review/movement/marine';
import { fakeBrowser } from '../../test/helpers/fake-browser.mjs';
const modulePath = process.env.ASCII_CANVAS_MODULE;
if (!modulePath) throw new Error('Set ASCII_CANVAS_MODULE to an existing @napi-rs/canvas/index.js.');
const { createCanvas, loadImage } = await import(pathToFileURL(modulePath).href);
const destination = process.argv[2] ?? 'artifacts/movement-native';
await mkdir(destination, { recursive: true });
const width = 900, height = 600;
function nativeHost() {
  const host = fakeBrowser();
  host.document.createElement = () => {
    const canvas = createCanvas(300, 150), listeners = new Map();
    canvas.ownerDocument = host.document;
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height });
    canvas.addEventListener = (type, fn) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); };
    canvas.removeEventListener = (type, fn) => listeners.get(type)?.delete(fn);
    return canvas;
  };
  return host;
}
const cases = [
  ['horizontal', 'Current crossing', { path: 'horizontal' }],
  ['horizontal-reverse', 'Reverse crossing', { path: 'horizontal', direction: 'reverse' }],
  ['vertical', 'Rising current', { path: 'vertical', direction: 'reverse' }],
  ['diagonal', 'Diagonal passage', { path: 'diagonal', diagonalSlope: 'up' }],
  ['free', 'Seeded wandering', { path: 'free' }],
  ['natural', 'Natural scene · journey disabled', { enabled: false }]
];
const selection = process.env.ASCII_CAPTURE_CASE;
if (selection === undefined) {
  // Native font/Canvas caches are process-local. Isolate each raster pass so
  // six proof frames do not retain all intermediate atlas allocations at once.
  for (let i = 0; i < cases.length; i++) execFileSync(process.execPath,
    [fileURLToPath(import.meta.url), destination], { env: { ...process.env, ASCII_CAPTURE_CASE: String(i) }, stdio: 'inherit' });
  const sheet = createCanvas(1800, 2010), context = sheet.getContext('2d');
  context.fillStyle = '#0b1512'; context.fillRect(0, 0, sheet.width, sheet.height);
  const manifest = { kind: 'native Canvas 2D, not browser', seed: 17, width, height, states: [] };
  for (let i = 0; i < cases.length; i++) {
    const [name, title] = cases[i], x = (i % 2) * width, y = Math.floor(i / 2) * 670;
    context.drawImage(await loadImage(`${destination}/${name}.png`), x, y + 70);
    context.fillStyle = '#cfe0c6'; context.font = '24px sans-serif';
    context.fillText(`${String(i + 1).padStart(2, '0')}  ${title}`, x + 30, y + 44);
    manifest.states.push(JSON.parse(await readFile(`${destination}/${name}.json`, 'utf8')));
  }
  await writeFile(`${destination}/contact-sheet.png`, sheet.toBuffer('image/png'));
  await writeFile(`${destination}/capture-manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ destination, states: cases.length, kind: manifest.kind }));
} else {
  const [name, title, patch] = cases[Number(selection)];
  const host = nativeHost(), canvas = host.document.createElement('canvas');
  const a = createMarineMovementArtwork(canvas, { enabled: true, seed: 17, lanes: 3, staggerSeconds: 1.3,
    lingerSeconds: 2, timing: { mode: 'duration', seconds: 16 }, ...patch },
  { count: 3, species: 'manta', speciesByAnimal: ['manta', 'cuttlefish', 'octopus'], size: .5, sizeVariation: .1,
    scene: 'reactive', formation: 'independent', seed: 17, autoStart: false, paused: true, glow: true, depthStrength: .7 });
  a.showMovementStill(.5);
  await writeFile(`${destination}/${name}.png`, canvas.toBuffer('image/png'));
  await writeFile(`${destination}/${name}.json`, JSON.stringify({ file: `${name}.png`, title,
    movement: a.getMovementOptions(), simulationTick: a.getMovementState().tick,
    displayedTick: a.getMovementDisplay().tick, stats: a.getStats() }, null, 2) + '\n');
  a.dispose();
}
