#!/usr/bin/env node
/** Exact-tick, native Skia Canvas review evidence for the fox.
 * This is NOT a browser capture, input test, or device-performance benchmark.
 * Compile the chosen source first. --source may point at an isolated base tree.
 * No dependency downloads and no changes to the chosen source are performed.
 *
 * node species/fox/scripts/capture-dusk-review.mjs \
 *   --source=/absolute/repository --out=/absolute/evidence --label=after
 */
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';

const argument = (key, fallback) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const repository = resolve(argument('source', fileURLToPath(new URL('../../..', import.meta.url))));
const output = resolve(argument('out', join(repository, 'species/fox/evidence/dusk')));
const label = argument('label', 'after');
if (!/^[a-z0-9-]+$/.test(label)) throw Error('--label accepts lowercase letters, digits and hyphens');
const species = join(repository, 'species/fox');
const require = createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/' : import.meta.url);
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const { createFoxDirector } = await import(pathToFileURL(join(species, 'lib/director.js')));
const { buildFoxSceneGrid, paintFoxSceneGrid } = await import(pathToFileURL(join(species, 'lib/director-render.js')));
const sha = value => createHash('sha256').update(value).digest('hex');
const fontPath = process.env.FOX_EVIDENCE_FONT ?? execFileSync('fc-match', ['-f', '%{file}', 'Liberation Mono'], { encoding: 'utf8' }).trim();
if (!GlobalFonts.registerFromPath(fontPath, 'ui-monospace')) throw Error('Could not register the installed evidence font');
const sourceFiles = (await readdir(join(species, 'src'))).filter(name => name.endsWith('.ts')).sort();
const compiledFiles = (await readdir(join(species, 'lib'))).filter(name => name.endsWith('.js')).sort();
async function hashes() {
  const entries = [];
  for (const folder of ['src', 'lib']) {
    for (const name of folder === 'src' ? sourceFiles : compiledFiles) {
      entries.push([`species/fox/${folder}/${name}`, sha(await readFile(join(species, folder, name)))]);
    }
  }
  return Object.fromEntries(entries);
}
const sourceHashes = await hashes();
const baseCommit = 'b8f222dab868821f27bf2a64a98434f3483fc8e6';
const surfaces = {
  desktop: { width: 960, height: 640, cols: 160, rows: 64 },
  phone: { width: 390, height: 446, cols: 112, rows: 64 },
};
const configuration = { seed: 17, scene: 'dusk-hunt', count: 2, showLabels: false };
const cueTick = 60;
const scenarios = [
  { name: 'hunt', cue: 'rustle', ages: [20, 75, 185, 220, 248, 275, 360], endTick: 540 },
  { name: 'curiosity', cue: 'play', ages: [16, 50, 100, 145, 180, 300], endTick: 540 },
];
const captures = [];
const motion = [];
await mkdir(output, { recursive: true });
const rawFrames = join(output, '.frames');
await mkdir(rawFrames, { recursive: true });
function render(frame, surfaceName, monochrome = false) {
  const surface = surfaces[surfaceName];
  const grid = buildFoxSceneGrid(frame, { cols: surface.cols, rows: surface.rows, monochrome });
  const canvas = createCanvas(surface.width, surface.height);
  paintFoxSceneGrid(canvas.getContext('2d'), grid, surface.width, surface.height, { monochrome });
  return { canvas, grid };
}
function actorRecord(actor) {
  return {
    id: actor.id, role: actor.role, action: actor.action, intent: actor.intent,
    modelTick: actor.state.tick, phase: actor.state.behavior.kind,
    behavior: actor.state.behavior, rootX: actor.state.rootX,
    feet: actor.state.feet, expression: actor.expression, x: actor.x, y: actor.y,
  };
}
async function capture(name, frame, surfaceName, monochrome = false) {
  const { canvas, grid } = render(frame, surfaceName, monochrome);
  const filename = `native-${label}-${name}-${surfaceName}.png`;
  const bytes = canvas.toBuffer('image/png');
  await writeFile(join(output, filename), bytes);
  await writeFile(join(output, filename.replace('.png', '.txt')), grid.text + '\n');
  captures.push({
    filename, sha256: sha(bytes), evidence: 'native-canvas', surface: surfaceName,
    ...surfaces[surfaceName], tick: frame.state.tick, tableau: frame.tableau,
    cueAge: frame.state.tick >= cueTick ? frame.state.tick - cueTick : null,
    count: frame.options.count, scene: frame.options.scene, seed: frame.state.seed,
    monochrome, occupied: grid.occupied, cellsSha256: sha(grid.text),
    ownersSha256: sha(grid.owners), materialsSha256: sha(grid.materials),
    actors: frame.state.actors.map(actorRecord),
  });
  return canvas;
}
function contactSheet(tiles, title, columns = 3) {
  const tileWidth = 480, tileHeight = 362, header = 74;
  const canvas = createCanvas(columns * tileWidth, header + Math.ceil(tiles.length / columns) * tileHeight);
  const context = canvas.getContext('2d');
  context.fillStyle = '#10191c'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#f6e5bb'; context.font = '20px ui-monospace'; context.fillText(title, 20, 29);
  context.fillStyle = '#9ba99f'; context.font = '11px ui-monospace';
  context.fillText('ACTUAL NATIVE CANVAS / seed 17 / identical ordered ticks / no browser or device-performance claim', 20, 52);
  tiles.forEach(({ canvas: tile, caption }, index) => {
    const x = index % columns * tileWidth, y = header + Math.floor(index / columns) * tileHeight;
    context.drawImage(tile, x, y, 480, 320);
    context.fillStyle = '#d8ba85'; context.font = '11px ui-monospace'; context.fillText(caption, x + 13, y + 342);
  });
  return canvas;
}
const poster = createFoxDirector(configuration);
for (const surface of Object.keys(surfaces)) {
  await capture('initial', poster.getFrame(), surface);
  await capture('listen', poster.getFrame('listen'), surface);
}
poster.dispose();
const detail = createFoxDirector({ ...configuration, count: 1 });
await capture('detail', detail.getFrame('listen'), 'desktop');
await capture('silhouette', detail.getFrame('listen'), 'desktop', true);
detail.dispose();

for (const scenario of scenarios) {
  const director = createFoxDirector(configuration);
  const events = [{ type: 'cue', cue: scenario.cue, tick: cueTick, seq: 0, id: 0, x: -.04, y: .69 }];
  const selected = new Set(scenario.ages.map(age => age + cueTick));
  const tiles = [];
  const frameDirectory = join(rawFrames, scenario.name);
  await mkdir(frameDirectory, { recursive: true });
  let frameCount = 0;
  for (let tick = 0; tick <= scenario.endTick; tick++) {
    if (tick) director.step(tick, events.filter(event => event.tick === tick));
    if (!selected.has(tick) && tick % 5 !== 0) continue;
    const frame = director.getFrame();
    if (selected.has(tick)) {
      const name = `${scenario.name}-age-${String(tick - cueTick).padStart(3, '0')}`;
      const desktop = await capture(name, frame, 'desktop');
      await capture(name, frame, 'phone');
      const actor = frame.state.actors[0];
      tiles.push({ canvas: desktop, caption: `t${tick} / +${tick - cueTick} / ${actor.action} / ${actor.state.behavior.kind}` });
    }
    if (tick % 5 === 0) {
      const { canvas: raw } = render(frame, 'desktop');
      const canvas = createCanvas(960, 688), context = canvas.getContext('2d');
      context.drawImage(raw, 0, 0);
      context.fillStyle = '#10191c'; context.fillRect(0, 640, 960, 48);
      context.fillStyle = '#f6e5bb'; context.font = '12px ui-monospace'; context.textBaseline = 'middle';
      context.fillText(`${label.toUpperCase()} / ${scenario.name.toUpperCase()} / tick ${tick} / ${frame.state.actors[0].action} / ${frame.state.actors[0].state.behavior.kind}`, 18, 657);
      context.fillStyle = '#9ba99f'; context.font = '10px ui-monospace';
      context.fillText('NATIVE CANVAS / 60 simulation ticks per second / rendered every 5 ticks / 12 fps playback; not measured device FPS', 18, 677);
      await writeFile(join(frameDirectory, `${String(frameCount).padStart(4, '0')}.png`), canvas.toBuffer('image/png'));
      frameCount++;
    }
  }
  const finalStateHash = sha(JSON.stringify(director.getState()));
  const finalCellsHash = sha(buildFoxSceneGrid(director.getFrame()).text);
  director.dispose();
  await writeFile(join(output, `native-${label}-${scenario.name}-contact.png`), contactSheet(tiles, `${label.toUpperCase()} / FOX ${scenario.name.toUpperCase()} / exact-tick sequence`).toBuffer('image/png'));
  const prefix = `native-${label}-${scenario.name}`;
  const palette = join(frameDirectory, 'palette.png');
  const gif = join(output, `${prefix}.gif`), mp4 = join(output, `${prefix}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '12', '-i', join(frameDirectory, '%04d.png'), '-vf', 'palettegen=max_colors=96:stats_mode=diff', '-frames:v', '1', palette], { stdio: 'pipe' });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '12', '-i', join(frameDirectory, '%04d.png'), '-i', palette, '-lavfi', 'paletteuse=dither=none', '-loop', '0', gif], { stdio: 'pipe' });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '12', '-i', join(frameDirectory, '%04d.png'), '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: 'pipe' });
  motion.push({ scenario: scenario.name, events, endTick: scenario.endTick, frameCount, nominalFps: 12,
    simulationTicksPerFrame: 5, excerptRestarts: true, finalStateHash, finalCellsHash,
    files: [gif, mp4].map(path => path.slice(output.length + 1)),
    bytes: { gif: (await stat(gif)).size, mp4: (await stat(mp4)).size } });
}

const comparison = argument('compare', '');
const comparisons = [];
if (comparison) {
  for (const surface of Object.keys(surfaces)) {
    const size = surfaces[surface];
    for (const pose of ['listen', 'hunt-age-075']) {
      const beforeName = `native-before-${pose}-${surface}.png`;
      const afterName = `native-${label}-${pose}-${surface}.png`;
      const before = await loadImage(await readFile(join(resolve(comparison), beforeName)));
      const after = await loadImage(await readFile(join(output, afterName)));
      const canvas = createCanvas(size.width * 2, size.height + 68), context = canvas.getContext('2d');
      context.fillStyle = '#10191c'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#f6e5bb'; context.font = `${surface === 'phone' ? 12 : 18}px ui-monospace`;
      context.fillText('BEFORE / current main', 15, 23); context.fillText('AFTER / fox dusk candidate', size.width + 15, 23);
      context.fillStyle = '#9ba99f'; context.font = `${surface === 'phone' ? 9 : 12}px ui-monospace`;
      context.fillText(`NATIVE CANVAS / matched seed, event log, tick and grid / ${pose} / ${size.width}x${size.height}`, 15, 48);
      context.drawImage(before, 0, 68); context.drawImage(after, size.width, 68);
      const name = `matched-${pose}-${surface}.png`;
      await writeFile(join(output, name), canvas.toBuffer('image/png'));
      comparisons.push({ filename: name, before: beforeName, after: afterName, surface, pose, evidence: 'native-canvas' });
    }
  }
}
if (JSON.stringify(await hashes()) !== JSON.stringify(sourceHashes)) throw Error('Source/compiled files changed during capture; discard and rerun after compilation is stable');
const manifest = {
  schemaVersion: 1, label, evidenceKind: 'native-canvas',
  claim: 'Exact compiled fox source rendered by native Skia Canvas, not browser screenshots or browser input acceptance.',
  baseCommit, configuration, surfaces, sourceHashes,
  runtime: { node: process.version, canvas: `@napi-rs/canvas ${require('@napi-rs/canvas/package.json').version}`,
    ffmpeg: execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' }).split('\n')[0] },
  font: { path: fontPath, sha256: sha(await readFile(fontPath)), alias: 'ui-monospace', bundled: false },
  captures, motion, comparisons,
  limitations: ['Native Canvas only.', 'Normal-speed files encode fixed-tick playback; their cadence is not measured rendering throughput.', 'No physical-device touch, screen-reader, or device-performance claim.', 'System fonts/Skia rasterization may differ from browser pixels.'],
};
await writeFile(join(output, `native-${label}-manifest.json`), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ output, label, evidence: 'native-canvas', screenshots: captures.length, motion, comparisons: comparisons.length }, null, 2));
