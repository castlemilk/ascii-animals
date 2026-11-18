/** Reproducible native Canvas evidence, never a claim of browser or FPS testing.
 * DRAGONFLY_CANVAS_MODULE may name an already-installed @napi-rs/canvas module.
 * node species/dragonfly/scripts/capture-director.mjs [output-directory]
 * ffmpeg is used only to encode the actual captured frames into the GIF.
 */
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createDragonflyDirector } from '../lib/director.js';
import { rasterizeDragonflyPond, paintDragonflyPond, layoutDragonflyPondLabels } from '../lib/pond-preview.js';
import { gridToText, DRAGONFLY_FONT } from '../lib/preview.js';

const { createCanvas } = await import(process.env.DRAGONFLY_CANVAS_MODULE || '@napi-rs/canvas');
const species = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(process.argv[2] || resolve(species, 'evidence/director'));
await mkdir(output, { recursive: true });
const framesDir = resolve(output, '.native-frames');
await mkdir(framesDir, { recursive: true });
const sourceFiles = ['director.ts', 'browser.ts', 'preview.ts', 'pond-preview.ts', 'demo.ts'];
const sourceSha256 = {};
for (const file of sourceFiles) sourceSha256[file] = createHash('sha256').update(await readFile(resolve(species, 'src', file))).digest('hex');
const manifest = {
  evidence: 'actual native Canvas using the committed species geometry, projection, glyph compositor and painter',
  browser: false, performanceAcceptance: false, seed: 17, tickHz: 60, animationFps: 12,
  font: DRAGONFLY_FONT, fontFileBundled: false, platformPixelIdentityPromised: false,
  sourceSha256, eventSequence: [], frames: [], animation: {},
};
const fixture = new Map([
  [90, [{ type: 'select', id: 1 }]],
  [91, [{ type: 'pointer', x: .6, y: -.35 }]],
  [140, [{ type: 'cue', cue: 'dart' }]],
  [420, [{ type: 'leave' }]],
  [480, [{ type: 'cue', cue: 'perch' }]],
  [720, [{ type: 'cue', cue: 'return' }]],
]);
let sequence = 0;
for (const [tick, events] of fixture) {
  const stamped = events.map(event => ({ ...event, tick, seq: sequence++ }));
  fixture.set(tick, stamped); manifest.eventSequence.push(...stamped);
}
function advance(director, end, events = new Map()) {
  for (let tick = director.getState().tick + 1; tick <= end; tick++) director.step(tick, events.get(tick) || []);
}
function render(director, config = {}) {
  const { width = 900, height = 600, cols = 120, rows = 64, view = 'dorsal', neutral = false } = config;
  const canvas = createCanvas(width, height), context = canvas.getContext('2d');
  const members = director.sample();
  const grid = rasterizeDragonflyPond(members, { cols, rows, view, neutral });
  paintDragonflyPond(context, grid, { width, height, dpr: 1, neutral, labels: true });
  const cellH = Math.min(height / rows, width / (cols * .68));
  context.font = Math.max(8, Math.min(11, cellH * .95)) + 'px ' + DRAGONFLY_FONT;
  const labels = layoutDragonflyPondLabels(grid, width, height, text => context.measureText(text).width);
  const state = director.getState();
  return { canvas, grid, metadata: { width, height, cols, rows, view, neutral, tick: state.tick,
    scene: state.scene, arc: state.arc, selected: state.selected, memberCount: members.length,
    options: director.getOptions(), samples: members.reduce((n, member) => n + member.geometry.samples.length, 0),
    animalCells: grid.animalCells, clippedSamples: grid.clippedSamples, labelsPlaced: labels.length,
    perches: grid.perches, members: state.members } };
}
const posters = [];
async function poster(name, title, director, config = {}) {
  const rendered = render(director, config);
  await writeFile(resolve(output, name + '.png'), rendered.canvas.toBuffer('image/png'));
  await writeFile(resolve(output, name + '.txt'), gridToText(rendered.grid) + '\n');
  manifest.frames.push({ file: name + '.png', title, ...rendered.metadata });
  posters.push({ title, ...rendered });
}

const patrol = createDragonflyDirector(); advance(patrol, 360);
await poster('patrol', 'Pond patrol / separate territories / tick 360', patrol);
const attention = createDragonflyDirector({ scene: 'attention' });
advance(attention, 360, new Map([[30, [{ type: 'pointer', tick: 30, seq: 0, x: .16, y: -.5 }]]]));
await poster('attention', 'Hovering attention / selected visitor follows / tick 360', attention);
const relay = createDragonflyDirector({ scene: 'relay', count: 4, route: 'figure-eight' }); advance(relay, 360);
await poster('relay', 'Reed relay / four staggered motives / tick 360', relay, { view: 'oblique' });
const perched = createDragonflyDirector(); advance(perched, 700, fixture);
await poster('perch', 'Deliberate reed landing / held until released / tick 700', perched);
await poster('small-grid', 'Small grid / 360 x 286 / 72 x 44 cells', patrol, { width: 360, height: 286, cols: 72, rows: 44 });
const still = createDragonflyDirector({ count: 4 }, { motion: 'static' }); still.setStaticPose(0);
await poster('still', 'Four still visitors / minimum 72 x 44 grid / tick 0', still,
  { neutral: true, width: 360, height: 286, cols: 72, rows: 44 });

const sheet = createCanvas(1800, 940), sheetContext = sheet.getContext('2d');
sheetContext.fillStyle = '#112220'; sheetContext.fillRect(0, 0, 1800, 940);
sheetContext.font = '17px sans-serif'; sheetContext.fillStyle = '#d6e6d8';
sheetContext.fillText('DRAGONFLY / POND DIRECTOR — actual native Canvas frames, seed 17', 24, 31);
for (let i = 0; i < posters.length; i++) {
  const { canvas, title } = posters[i], x = (i % 3) * 600, y = 50 + Math.floor(i / 3) * 445;
  sheetContext.fillStyle = '#0b1717'; sheetContext.fillRect(x + 8, y, 584, 432);
  const scale = Math.min(570 / canvas.width, 388 / canvas.height);
  const w = canvas.width * scale, h = canvas.height * scale;
  sheetContext.drawImage(canvas, x + (600 - w) / 2, y + 8 + (388 - h) / 2, w, h);
  sheetContext.fillStyle = '#c6d8ca'; sheetContext.font = '13px sans-serif';
  sheetContext.fillText(title, x + 20, y + 417);
}
await writeFile(resolve(output, 'contact-sheet.png'), sheet.toBuffer('image/png'));

const manual = createDragonflyDirector();
const movieCheckpoints = new Set([0, 90, 140, 165, 190, 235, 325, 420, 480, 580, 640, 700, 720, 820, 960]);
let index = 0, movieClipped = 0;
const phaseFrames = [];
const motionPanels = [];
const motionPanelTicks = new Set([140, 175, 210, 285, 700, 820]);
for (let tick = 0; tick <= 960; tick++) {
  if (tick) manual.step(tick, fixture.get(tick) || []);
  if (tick % 5) continue;
  const frame = render(manual, { width: 840, height: 530, cols: 112, rows: 56 });
  movieClipped += frame.grid.clippedSamples;
  const current = manual.getState(), chosen = current.members[current.selected];
  const frameCanvas = createCanvas(840, 570), ctx = frameCanvas.getContext('2d');
  ctx.fillStyle = '#0b1717'; ctx.fillRect(0, 0, 840, 570); ctx.drawImage(frame.canvas, 0, 0);
  ctx.fillStyle = '#c8d8cb'; ctx.font = '13px sans-serif';
  ctx.fillText('POND PATROL  |  tick ' + String(tick).padStart(3, '0') + '  |  ' + chosen.label + ': ' + chosen.phase.kind, 24, 548);
  ctx.fillStyle = '#8ca897'; ctx.font = '11px sans-serif';
  ctx.fillText('seed 17 / 60 Hz fixed ticks / actual native Canvas / captured at 12 fps', 24, 565);
  await writeFile(resolve(framesDir, 'frame-' + String(index++).padStart(4, '0') + '.png'), frameCanvas.toBuffer('image/png'));
  if (motionPanelTicks.has(tick)) motionPanels.push(frameCanvas);
  if (movieCheckpoints.has(tick)) phaseFrames.push({ tick, selected: current.selected, phase: chosen.phase,
    position: chosen.position, velocity: chosen.velocity, arc: current.arc });
}
const ffmpeg = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '12',
  '-i', resolve(framesDir, 'frame-%04d.png'), '-filter_complex',
  '[0:v]split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=none', '-loop', '0',
  resolve(output, 'pond-director.gif')], { encoding: 'utf8' });
if (ffmpeg.status !== 0) throw new Error('GIF encoding failed: ' + (ffmpeg.stderr || ffmpeg.error));
const motionSheet = createCanvas(1800, 862), motionContext = motionSheet.getContext('2d');
motionContext.fillStyle = '#112220'; motionContext.fillRect(0, 0, 1800, 862);
motionContext.fillStyle = '#d6e6d8'; motionContext.font = '17px sans-serif';
motionContext.fillText('DRAGONFLY / DELIBERATE SEQUENCE — launch, dart, stabilize, return, perch, release', 24, 30);
for (let i = 0; i < motionPanels.length; i++)
  motionContext.drawImage(motionPanels[i], (i % 3) * 600 + 8, 46 + Math.floor(i / 3) * 406, 584, 396);
await writeFile(resolve(output, 'motion-contact-sheet.png'), motionSheet.toBuffer('image/png'));
manifest.animation = { file: 'pond-director.gif', frames: index, fps: 12, tickStart: 0, tickEnd: 960,
  clippedSamplesAcrossFrames: movieClipped, checkpoints: phaseFrames };
await writeFile(resolve(output, 'capture-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await rm(framesDir, { recursive: true, force: true });
for (const director of [patrol, attention, relay, perched, still, manual]) director.dispose();
console.log(JSON.stringify({ output, posters: posters.length, gifFrames: index, clippedSamplesAcrossAnimation: movieClipped,
  postersClipped: manifest.frames.map(frame => ({ file: frame.file, clipped: frame.clippedSamples, labels: frame.labelsPlaced })) }, null, 2));
