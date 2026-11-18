#!/usr/bin/env node
/** Native actual Fox director output. No browser, device FPS or accessibility claim. */
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, copyFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { createFoxDirector, FOX_DIRECTOR_DEFAULTS } from '../lib/director.js';
import { buildFoxSceneGrid, paintFoxSceneGrid } from '../lib/director-render.js';

const base = fileURLToPath(new URL('../', import.meta.url));
const root = resolve(base, '../..');
const destination = process.argv.find(arg => arg.startsWith('--out='))?.slice(6) ?? 'evidence/director';
const output = resolve(base, destination);
const frames = join(base, '.test-output', 'director-native-frames');
await mkdir(output, { recursive: true }); await mkdir(frames, { recursive: true });
let requireCanvas = createRequire(import.meta.url);
let canvasPackage;
try { canvasPackage = requireCanvas('@napi-rs/canvas'); }
catch {
  if (!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) throw Error('Use an already installed @napi-rs/canvas. This script never downloads a dependency.');
  requireCanvas = createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/');
  canvasPackage = requireCanvas('@napi-rs/canvas');
}
const { createCanvas, GlobalFonts, loadImage } = canvasPackage;
const canvasVersion = requireCanvas('@napi-rs/canvas/package.json').version;
const fontPath = process.env.FOX_EVIDENCE_FONT ?? execFileSync('fc-match', ['-f', '%{file}', 'Liberation Mono'], { encoding: 'utf8' }).trim();
if (!GlobalFonts.registerFromPath(fontPath, 'ui-monospace')) throw Error('Installed evidence font could not be registered');
const sha = value => createHash('sha256').update(value).digest('hex');
const modules = ['director.js', 'director-render.js', 'director-types.js', 'model.js', 'geometry.js', 'config.js', 'preview.js'];
async function moduleHashes() { return Object.fromEntries(await Promise.all(modules.map(async file => [file, sha(await readFile(join(base, 'lib', file)))]))); }
const sourceHashes = await moduleHashes();
const provenance = {
  evidenceKind: 'Actual native Skia Canvas output from compiled Fox director/model/scene painter; not browser/deployed evidence',
  node: process.version, canvas: `@napi-rs/canvas ${canvasVersion}`,
  ffmpeg: execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' }).split('\n')[0],
  baseCommit: execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: root, encoding: 'utf8' }).trim(),
  checkoutHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  uncommittedSource: Boolean(execFileSync('git', ['status', '--porcelain', '--', 'species/fox'], { cwd: root, encoding: 'utf8' }).trim()),
  sourceHashes, font: { path: fontPath, sha256: sha(await readFile(fontPath)), bundled: false, registeredAlias: 'ui-monospace' },
  surfaces: { desktop: { width: 800, height: 640, cols: 160, rows: 64 }, portrait: { width: 390, height: 446, cols: 112, rows: 64 } },
  note: 'Native screenshots include a separate metadata footer. Nominal GIF cadence is not measured throughput. Normal-speed playback, device testing and browser accessibility require separate evidence.',
};
const events = [
  { tick: 30, seq: 0, type: 'guide', x: .65, y: .2 },
  { tick: 60, seq: 1, type: 'cue', cue: 'rustle', id: 0, x: -.05, y: .65 },
  { tick: 330, seq: 2, type: 'guide', x: -.45, y: .55 },
  { tick: 455, seq: 3, type: 'cue', cue: 'play', id: 1, x: .1, y: .5 },
  { tick: 700, seq: 4, type: 'cue', cue: 'rest', id: 2 },
  { tick: 760, seq: 5, type: 'leave' },
  { tick: 820, seq: 6, type: 'cue', cue: 'pounce', id: 0, x: .3, y: .7 },
];
const config = { ...FOX_DIRECTOR_DEFAULTS, scene: 'dusk-hunt', count: 3, seed: 17 };
const replay = { schemaVersion: 1, directorVersion: 1, seed: 17, tickRate: 60, options: config, endTick: 960, events };
await writeFile(join(output, 'replay.json'), JSON.stringify(replay, null, 2) + '\n');
const states = [];
function render(frame, { portrait = false, monochrome = false, label = '' } = {}) {
  const surface = portrait ? provenance.surfaces.portrait : provenance.surfaces.desktop;
  const grid = buildFoxSceneGrid(frame, { cols: surface.cols, rows: surface.rows, monochrome });
  const canvas = createCanvas(surface.width, surface.height + 44), context = canvas.getContext('2d');
  paintFoxSceneGrid(context, grid, surface.width, surface.height, { monochrome });
  context.fillStyle = '#10191c'; context.fillRect(0, surface.height, surface.width, 44);
  context.font = `${portrait ? 9 : 12}px ui-monospace`; context.textAlign = 'left'; context.textBaseline = 'middle'; context.fillStyle = '#f6e5bb';
  context.fillText(label, portrait ? 10 : 18, surface.height + 14);
  context.fillStyle = '#9fb29d'; context.font = `${portrait ? 8 : 10}px ui-monospace`;
  context.fillText(`NATIVE CANVAS / ${surface.cols}x${surface.rows} / seed ${frame.state.seed} / tick ${frame.state.tick}`, portrait ? 10 : 18, surface.height + 32);
  return { canvas, grid };
}
async function saveFrame(name, frame, settings = {}) {
  const { canvas, grid } = render(frame, { ...settings, label: name.replaceAll('-', ' ').toUpperCase() });
  await writeFile(join(output, `${name}.png`), canvas.toBuffer('image/png'));
  await writeFile(join(output, `${name}.txt`), grid.text + '\n');
  states.push({ name, scene: frame.state.scene, tick: frame.state.tick, beat: frame.state.beat, tableau: frame.tableau,
    actors: frame.state.actors.map(actor => ({ id: actor.id, name: actor.name, role: actor.role, action: actor.action, phase: actor.state.behavior.kind, expression: actor.expression })),
    cols: grid.cols, rows: grid.rows, occupied: grid.occupied, cellHash: sha(grid.text), ownerHash: sha(grid.owners) });
  return canvas;
}
const director = createFoxDirector(config);
const sampled = new Map([[0, 'replay-arrival'], [95, 'replay-listening'], [230, 'replay-sniffing'], [306, 'replay-airborne'], [328, 'replay-landing'], [610, 'replay-answering-hop'], [900, 'replay-recovery']]);
const replaySheets = [];
let gifFrames = 0;
for (let tick = 0; tick <= replay.endTick; tick++) {
  if (tick) director.step(tick, events.filter(event => event.tick === tick));
  const frame = director.getFrame();
  if (sampled.has(tick)) {
    const canvas = await saveFrame(sampled.get(tick), frame);
    if (tick > 0) replaySheets.push(canvas);
  }
  if (tick % 5 === 0) {
    const { canvas } = render(frame, { label: `DUSK HUNT / ${frame.state.beat.toUpperCase()} / ACTUAL SEEDED REPLAY` });
    await writeFile(join(frames, `${String(gifFrames).padStart(4, '0')}.png`), canvas.toBuffer('image/png')); gifFrames++;
  }
}
const finalStateHash = sha(JSON.stringify(director.getState()));
const finalCellHash = sha(buildFoxSceneGrid(director.getFrame()).text);
director.dispose();
const sceneSheets = [];
for (const [scene, tick] of [['dusk-hunt', 870], ['moon-play', 500], ['den-watch', 1260]]) {
  const model = createFoxDirector({ seed: 17, scene, count: 3 });
  for (let step = 1; step <= tick; step++) model.step(step);
  sceneSheets.push(await saveFrame(`native-${scene}`, model.getFrame()));
  if (scene === 'dusk-hunt') {
    await saveFrame('native-portrait-112x64', model.getFrame(), { portrait: true });
    await saveFrame('native-neutral-desktop', model.getFrame(), { monochrome: true });
  }
  model.dispose();
}
const tableaux = createFoxDirector({ seed: 17, scene: 'den-watch', count: 3 });
for (const name of ['listen', 'pounce', 'rest']) sceneSheets.push(await saveFrame(`native-tableau-${name}`, tableaux.getFrame(name)));
tableaux.dispose();
function contact(canvases, title) {
  const width = 1200, tileWidth = 600, tileHeight = 513, header = 72;
  const sheet = createCanvas(width, Math.ceil(canvases.length / 2) * tileHeight + header), context = sheet.getContext('2d');
  context.fillStyle = '#10191c'; context.fillRect(0, 0, sheet.width, sheet.height);
  context.fillStyle = '#f6e5bb'; context.font = '21px ui-monospace'; context.fillText(title, 22, 31);
  context.fillStyle = '#9fb29d'; context.font = '12px ui-monospace'; context.fillText('Actual native model/cell output. Browser behavior, motion playback and device timing are separate gates.', 22, 54);
  canvases.forEach((canvas, index) => context.drawImage(canvas, index % 2 * tileWidth, header + Math.floor(index / 2) * tileHeight, tileWidth, tileHeight));
  return sheet;
}
await writeFile(join(output, 'native-scenes-contact.png'), contact(sceneSheets, 'FOX / three scenes + deliberate still tableaux').toBuffer('image/png'));
await writeFile(join(output, 'native-replay-contact.png'), contact(replaySheets, 'FOX / ordered attention, reaction and recovery').toBuffer('image/png'));
try {
  const before = await loadImage(await readFile(join(output, 'before', 'native-dusk-hunt.png')));
  const after = await loadImage(await readFile(join(output, 'native-dusk-hunt.png')));
  const comparison = createCanvas(1200, 581), context = comparison.getContext('2d');
  context.fillStyle = '#10191c'; context.fillRect(0, 0, comparison.width, comparison.height);
  context.fillStyle = '#f6e5bb'; context.font = '18px ui-monospace';
  context.fillText('BEFORE / first native composition', 18, 28);
  context.fillText('AFTER / revised native grounding', 618, 28);
  context.fillStyle = '#9fb29d'; context.font = '11px ui-monospace';
  context.fillText('Actual PNGs from identical scene / seed 17 / tick 870. No browser or performance claim.', 18, 51);
  context.drawImage(before, 0, 68, 600, 513); context.drawImage(after, 600, 68, 600, 513);
  await writeFile(join(output, 'native-grounding-before-after.png'), comparison.toBuffer('image/png'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const palette = join(frames, 'palette.png'), gif = join(output, 'native-director-replay.gif');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '12', '-i', join(frames, '%04d.png'), '-vf', 'palettegen=max_colors=96:stats_mode=diff', '-frames:v', '1', palette], { stdio: 'pipe' });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '12', '-i', join(frames, '%04d.png'), '-i', palette, '-lavfi', 'paletteuse=dither=none', '-loop', '0', gif], { stdio: 'pipe' });
if (JSON.stringify(await moduleHashes()) !== JSON.stringify(sourceHashes)) throw Error('Compiled modules changed during capture; rerun once the build is stable');
const manifest = { ...provenance, replay, gif: { frames: gifFrames, nominalFps: 12, bytes: (await stat(gif)).size, excerptRestarts: true }, states, finalStateHash, finalCellHash };
await writeFile(join(output, 'native-render.json'), JSON.stringify(manifest, null, 2) + '\n');
if (process.argv.includes('--record-before')) {
  const before = join(output, 'before');
  await mkdir(before); // Fail instead of replacing the original critique evidence.
  const files = ['native-dusk-hunt.png', 'native-portrait-112x64.png'];
  for (const file of files) {
    await copyFile(join(output, file), join(before, file));
  }
  await writeFile(join(before, 'manifest.json'), JSON.stringify({
    evidenceKind: provenance.evidenceKind, baseCommit: provenance.baseCommit,
    checkoutHead: provenance.checkoutHead, uncommittedSource: provenance.uncommittedSource,
    node: provenance.node, canvas: provenance.canvas, sourceHashes, font: provenance.font,
    files: await Promise.all(files.map(async file => ({ file, sha256: sha(await readFile(join(before, file))),
      state: states.find(state => `${state.name}.png` === file) }))),
  }, null, 2) + '\n');
}
console.log(JSON.stringify({ output, gifFrames, gifBytes: manifest.gif.bytes, frames: states.length, finalStateHash, finalCellHash, evidence: provenance.evidenceKind }, null, 2));
