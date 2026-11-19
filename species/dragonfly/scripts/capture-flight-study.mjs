/** Matched evidence from the exact species modules. This is native Canvas,
 * not a browser screenshot, browser input test, CSS test, or FPS measurement.
 * Usage: node capture-native.mjs <repository-root> <output-dir> <before|after> [count=3] [scene=patrol]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const canvasModule = process.env.DRAGONFLY_CANVAS_MODULE || require.resolve('@napi-rs/canvas', { paths: [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || process.cwd(), process.cwd()] });
const { createCanvas } = await import(pathToFileURL(canvasModule));
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = resolve(process.argv[2]);
const output = resolve(process.argv[3]);
const label = process.argv[4] ?? 'capture';
const count = Number(process.argv[5] ?? 3), scene = process.argv[6] ?? 'patrol';
if (!Number.isInteger(count) || count < 1 || count > 4 || !['patrol','attention','relay'].includes(scene)) throw new Error('Invalid capture scene or count');
const { createDragonflyDirector } = await import(pathToFileURL(resolve(root, 'species/dragonfly/lib/director.js')));
const { rasterizeDragonflyPond, paintDragonflyPond, layoutDragonflyPondLabels } = await import(pathToFileURL(resolve(root, 'species/dragonfly/lib/pond-preview.js')));
const { gridToText, DRAGONFLY_FONT } = await import(pathToFileURL(resolve(root, 'species/dragonfly/lib/preview.js')));
await mkdir(output, { recursive: true });
const log = [
  { type: 'pointer', tick: 60, seq: 0, x: .30, y: -.30 },
  { type: 'cue', tick: 120, seq: 1, cue: 'dart' },
  { type: 'leave', tick: 400, seq: 2 },
  { type: 'cue', tick: 480, seq: 3, cue: 'perch' },
  { type: 'cue', tick: 780, seq: 4, cue: 'return' },
];
const formats = [
  { name: 'desktop', width: 1174, height: 640, cols: 156, rows: 68, intendedViewport: { width: 1440, height: 1000 } },
  { name: 'phone', width: 356, height: 360, cols: 72, rows: 44, intendedViewport: { width: 390, height: 844 } },
];
const checkpoints = new Map([
  [0, 'initial'], [119, 'hover'], [132, 'anticipation'], [154, 'dart'],
  [177, 'brake'], [215, 'settled'], [330, 'recovery'],
  [520, 'twig-approach'], [620, 'landing'], [755, 'perched'],
  [800, 'relaunch'], [920, 'released'],
]);
const sourceSha256 = {};
for (const name of ['types', 'model', 'geometry', 'director', 'preview', 'pond-preview', 'browser', 'demo']) {
  for (const [folder, ext] of [['src', 'ts'], ['lib', 'js']]) {
    const file = `species/dragonfly/${folder}/${name}.${ext}`;
    try { sourceSha256[file] = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex'); } catch {}
  }
}
const manifest = {
  kind: 'native Canvas source execution; no browser execution', label, root,
  browser: false, nativeCanvas: true, cssLayoutVerified: false,
  realTouchVerified: false, performanceAcceptance: false,
  sourceSha256, seed: 17, tickHz: 60, animationFps: 15,
  font: DRAGONFLY_FONT, noFontBinaryBundled: true,
  options: { scene, count, seed: 17, view: 'oblique' },
  formats, eventLog: log, captures: [], animation: {},
};
const framesDir = resolve(output, '.frames');
await mkdir(framesDir, { recursive: true });
const director = createDragonflyDirector({ scene, count }, { seed: 17 });
const events = new Map(log.map(event => [event.tick, [event]]));
const panels = [];
const frameMeta = [];
let movieIndex = 0;
function render(format, config = {}) {
  const members = director.sample();
  const grid = rasterizeDragonflyPond(members, { cols: format.cols, rows: format.rows, view: 'oblique', neutral: false, ...config });
  const canvas = createCanvas(format.width, format.height), ctx = canvas.getContext('2d');
  paintDragonflyPond(ctx, grid, { width: format.width, height: format.height, dpr: 1, neutral: Boolean(config.neutral), labels: true });
  const status = director.getState();
  return { canvas, grid, status };
}
for (let tick = 0; tick <= 1020; tick++) {
  if (tick) director.step(tick, events.get(tick) ?? []);
  if (checkpoints.has(tick)) {
    for (const format of formats) {
      const { canvas, grid, status } = render(format);
      const file = `${label}-native-${format.name}-${String(tick).padStart(4, '0')}-${checkpoints.get(tick)}`;
      await writeFile(resolve(output, file + '.png'), canvas.toBuffer('image/png'));
      await writeFile(resolve(output, file + '.txt'), gridToText(grid) + '\n');
      manifest.captures.push({ file: file + '.png', format: format.name, tick, stateLabel: checkpoints.get(tick),
        width: format.width, height: format.height, grid: [format.cols, format.rows],
        members: status.members, animalCells: grid.animalCells, clippedSamples: grid.clippedSamples,
        actualPhase: status.members[status.selected].phase.kind, labels: grid.labels, perches: grid.perches });
      if (format.name === 'desktop') panels.push({ tick, name: checkpoints.get(tick), canvas, status });
    }
  }
  if (tick % 4 === 0) {
    const format = { width: 900, height: 560, cols: 120, rows: 59 };
    const { canvas, grid, status } = render(format);
    const movie = createCanvas(900, 598), ctx = movie.getContext('2d');
    ctx.fillStyle = '#091212'; ctx.fillRect(0, 0, 900, 598); ctx.drawImage(canvas, 0, 0);
    ctx.font = '12px sans-serif'; ctx.fillStyle = '#d6e4d8';
    ctx.fillText(`DRAGONFLY / ${label.toUpperCase()} / tick ${tick} / ${status.members[status.selected].phase.kind}`, 18, 577);
    ctx.font = '10px sans-serif'; ctx.fillStyle = '#91a999';
    ctx.fillText('Native Canvas · exact seeded source · 60 Hz ticks · 15 fps capture · not a browser recording', 18, 591);
    await writeFile(resolve(framesDir, `frame-${String(movieIndex++).padStart(4,'0')}.png`), movie.toBuffer('image/png'));
    frameMeta.push({ tick, clipped: grid.clippedSamples, phase: status.members[status.selected].phase.kind });
    // Release native frame buffers promptly; simulation state is independent of
    // Canvas allocation and explicit GC does not change the capture timeline.
    canvas.width = 1; canvas.height = 1; movie.width = 1; movie.height = 1;
    if (movieIndex % 16 === 0) globalThis.gc?.();
  }
}
const sheet = createCanvas(1800, 1600), sheetCtx = sheet.getContext('2d');
sheetCtx.fillStyle = '#091212'; sheetCtx.fillRect(0, 0, 1800, 1600);
sheetCtx.font = '20px sans-serif'; sheetCtx.fillStyle = '#d6e4d8';
sheetCtx.fillText(`DRAGONFLY / ${label.toUpperCase()} / Native Canvas representative states`, 22, 30);
sheetCtx.font = '13px sans-serif'; sheetCtx.fillStyle = '#91a999';
sheetCtx.fillText(`Source geometry and painter · seed 17 · ${count} ${count===1?'visitor':'visitors'} · ${scene} · oblique view · fixed tick/event log · not browser evidence`, 22, 53);
for(let i=0;i<panels.length;i++) {
  const p = panels[i], x = (i%3)*600, y = 78 + Math.floor(i/3)*380;
  sheetCtx.drawImage(p.canvas, x+8, y, 584, 318.36);
  sheetCtx.font='14px sans-serif'; sheetCtx.fillStyle='#d6e4d8';
  sheetCtx.fillText(`${p.tick} / ${p.name} / ${p.status.members[p.status.selected].phase.kind}`, x+18, y+343);
}
await writeFile(resolve(output, `${label}-native-motion-sheet.png`), sheet.toBuffer('image/png'));
const gif = resolve(output, `${label}-native-motion.gif`);
const encoded = spawnSync('ffmpeg', ['-hide_banner','-loglevel','error','-y','-framerate','15','-i',resolve(framesDir,'frame-%04d.png'),
  '-filter_complex','[0:v]split[a][b];[a]palettegen=max_colors=80[p];[b][p]paletteuse=dither=none','-loop','0',gif], {encoding:'utf8'});
if(encoded.status !== 0) throw new Error(`ffmpeg failed: ${encoded.stderr || encoded.error}`);
manifest.animation={ file: `${label}-native-motion.gif`, frames: movieIndex, ticks: [0,1020], clippedAcrossFrames: frameMeta.reduce((n,f)=>n+f.clipped,0), checkpoints: frameMeta };
await writeFile(resolve(output, `${label}-native-manifest.json`), JSON.stringify(manifest,null,2)+'\n');
await rm(framesDir,{recursive:true,force:true});
director.dispose();
console.log(JSON.stringify({output,label,captures:manifest.captures.length,gifFrames:movieIndex,clippedAcrossFrames:manifest.animation.clippedAcrossFrames},null,2));
