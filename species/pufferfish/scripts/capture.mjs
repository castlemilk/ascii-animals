#!/usr/bin/env node
/** Exact procedural capture, not browser or target-device acceptance.
 * Build the TypeScript sources first, then run with @napi-rs/canvas installed.
 * Python/Pillow assembles the already-rendered PNGs; no art is generated here.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createPufferfish, stepPufferfish, PUFFERFISH_REPLAY } from '../build/model.js';
import { createPufferfishPainter, LEGACY_RENDERER_SHA256 } from '../build/legacy-painter.js';

const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const speciesRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(speciesRoot, '../..');
const output = join(speciesRoot, 'evidence');
const frameDirectory = await mkdtemp(join(tmpdir(), 'pufferfish-native-frames-'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourcePaths = ['src/types.ts', 'src/model.ts', 'src/geometry.ts', 'src/legacy-painter.ts', 'scripts/capture.mjs'];
const sourceHashes = {};
for (const path of sourcePaths) sourceHashes[path] = hash(await readFile(join(speciesRoot, path)));
const legacySource = await readFile(join(repoRoot, 'dist/artwork.js'), 'utf8');
assert.equal(hash(legacySource), LEGACY_RENDERER_SHA256, 'Pinned legacy renderer must match');
const scope = { window: {} };
vm.runInNewContext(legacySource, scope, { filename: 'dist/artwork.js' });
const Legacy = scope.window.CuttlefishArtwork;
assert.equal(typeof Legacy, 'function');
await mkdir(output, { recursive: true });

const artifacts = [];
const timings = { modelStepMs: [], nativeDrawMs: [] };
const transitions = [];
const checkpoints = new Map([
  [0, { name: 'neutral', label: 'Neutral / small round body' }],
  [80, { name: 'approach', label: 'Approach / sustained nearby visitor' }],
  [122, { name: 'belly', label: 'Belly inflation / first stage' }],
  [190, { name: 'inflated', label: 'Full inflation / buoyant hold' }],
  [295, { name: 'recovery', label: 'Recovery / smooth deflation' }],
  [420, { name: 'cooldown', label: 'Cooldown / space before rearming' }],
]);
const states = new Map();
const frames = [];
const canvas = createCanvas(900, 506);
const painter = createPufferfishPainter(canvas, Legacy, { quality: 'standard', view: 'right' }, () => createCanvas(1, 1));
painter.resize(900, 506, 1);
let state = createPufferfish({ seed: 23 });
let sequenceSignature = `${state.phase.kind}/`;
transitions.push({ tick: 0, phase: state.phase });
const orderedEvents = PUFFERFISH_REPLAY.map(event => ({ ...event }));

async function renderFrame(current, targetCanvas, targetPainter, path, settings = {}) {
  const before = performance.now();
  const result = targetPainter.draw(current, settings.staticPose ?? false);
  timings.nativeDrawMs.push(performance.now() - before);
  const png = targetCanvas.toBuffer('image/png');
  await writeFile(path, png);
  const pixels = targetCanvas.getContext('2d').getImageData(0, 0, targetCanvas.width, targetCanvas.height).data;
  const entry = {
    file: relative(output, path), tick: current.tick, phase: current.phase,
    inflation: current.inflation, stateSha256: hash(JSON.stringify(current)),
    logicalCellSha256: hash(result.text), rasterRgbaSha256: hash(pixels), pngSha256: hash(png),
    cols: result.cols, rows: result.rows, samples: result.samples, glyphs: result.glyphs,
    width: targetCanvas.width, height: targetCanvas.height, options: targetPainter.getConfig(),
    staticPose: settings.staticPose ?? false,
  };
  assert(result.samples <= 16_000);
  assert(result.cols <= 160 && result.rows <= 90);
  assert(/^[\x20-\x7e\n]*$/.test(result.text), 'Logical cells contain only printable ASCII');
  return { entry, result };
}

try {
  for (let tick = 0; tick <= 1110; tick++) {
    if (tick > 0) {
      const before = performance.now();
      state = stepPufferfish(state, { tick, events: orderedEvents.filter(event => event.tick === tick) }).state;
      timings.modelStepMs.push(performance.now() - before);
      const signature = `${state.phase.kind}/${state.phase.stage ?? ''}`;
      if (signature !== sequenceSignature) {
        transitions.push({ tick, phase: state.phase });
        sequenceSignature = signature;
      }
    }
    const checkpoint = checkpoints.get(tick);
    if (checkpoint) {
      states.set(checkpoint.name, state);
      const path = join(output, `native-${checkpoint.name}.png`);
      const { entry, result } = await renderFrame(state, canvas, painter, path);
      artifacts.push({ ...entry, label: checkpoint.label });
      await writeFile(join(output, `cells-${checkpoint.name}.txt`), `${result.text}\n`);
    }
    if (tick % 4 === 0 && tick < 1110) {
      const file = `${String(frames.length).padStart(4, '0')}.png`;
      const { entry } = await renderFrame(state, canvas, painter, join(frameDirectory, file));
      frames.push({ file, tick, stateSha256: entry.stateSha256, logicalCellSha256: entry.logicalCellSha256,
        rasterRgbaSha256: entry.rasterRgbaSha256, samples: entry.samples, glyphs: entry.glyphs });
    }
  }
  assert.equal(state.tick, 1110);
  assert.equal(state.phase.kind, 'idle');
  assert.equal(state.reactions, 2);
  const finalCapture = await renderFrame(state, canvas, painter, join(output, 'native-final.png'));
  artifacts.push({ ...finalCapture.entry, label: 'Final tick / two complete encounters' });
  const finalState = state;

  // Minimum declared size at true native scale: 72 by 40 logical cells.
  const smallCanvas = createCanvas(360, 270);
  const small = createPufferfishPainter(smallCanvas, Legacy, { quality: 'small' }, () => createCanvas(1, 1));
  small.resize(360, 270, 1);
  try {
    for (const view of ['front', 'left', 'right']) {
      small.configure({ view });
      for (const name of ['neutral', 'inflated']) {
        const { entry } = await renderFrame(states.get(name), smallCanvas, small,
          join(output, `small-${view}-${name}.png`), { staticPose: true });
        assert.equal(entry.cols, 72);
        assert.equal(entry.rows, 40);
        artifacts.push({ ...entry, label: `${view} / ${name} / 72 x 40 cells` });
      }
    }
  } finally { small.dispose(); }

  // Neutral monochrome material review, no glow. Eye/pupil contrast remains.
  painter.configure({ monochrome: true });
  for (const view of ['front', 'left', 'right']) {
    painter.configure({ view });
    const { entry } = await renderFrame(states.get('neutral'), canvas, painter,
      join(output, `mono-${view}-neutral.png`), { staticPose: true });
    artifacts.push({ ...entry, label: `${view} / neutral monochrome material` });
  }

  const assemblyInput = {
    output, frameDirectory,
    frames: frames.map((frame, index) => ({ file: frame.file,
      durationMs: Math.round((frames[index + 1]?.tick ?? 1110) / 60 * 100) * 10 - Math.round(frame.tick / 60 * 100) * 10 })),
    contact: artifacts.filter(item => item.file.startsWith('native-') && item.file !== 'native-final.png'),
    small: artifacts.filter(item => item.file.startsWith('small-')),
    mono: artifacts.filter(item => item.file.startsWith('mono-')),
  };
  assert.equal(assemblyInput.frames.reduce((sum, item) => sum + item.durationMs, 0), 18_500);
  const assemblyPath = join(frameDirectory, 'assembly.json');
  await writeFile(assemblyPath, JSON.stringify(assemblyInput));
  const python = String.raw`
import json, pathlib, sys
from PIL import Image, ImageDraw, ImageFont
data=json.loads(pathlib.Path(sys.argv[1]).read_text())
out=pathlib.Path(data['output'])
try:
    title=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',22)
    label=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
except OSError:
    title=label=ImageFont.load_default()
def sheet(items,name,columns,cellw,cellh,heading,subheading,native=False):
    rows=(len(items)+columns-1)//columns
    result=Image.new('RGB',(columns*cellw,96+rows*cellh),(9,15,18))
    draw=ImageDraw.Draw(result)
    draw.text((22,18),heading,font=title,fill=(244,236,208))
    draw.text((22,52),subheading,font=label,fill=(156,183,183))
    for i,item in enumerate(items):
        x=(i%columns)*cellw; y=96+(i//columns)*cellh
        image=Image.open(out/item['file']).convert('RGB')
        if not native: image.thumbnail((cellw-16,cellh-59),Image.Resampling.LANCZOS)
        result.paste(image,(x+(cellw-image.width)//2,y+4))
        draw.text((x+16,y+cellh-49),item['label'],font=label,fill=(231,235,219))
        draw.text((x+16,y+cellh-27),f"tick {item['tick']} / inflation {item['inflation']:.3f} / {item['samples']} samples",font=label,fill=(139,166,168))
    result.save(out/name)
sheet(data['contact'],'native-contact-sheet.png',3,480,321,'Pufferfish / staged inflation and recovery','Native Canvas (Skia), reused original glyph renderer. Seed 23. Not browser evidence.')
sheet(data['small'],'minimum-grid-contact-sheet.png',3,400,329,'Pufferfish / minimum grid review','360 x 270 native pixels / 72 x 40 cells. Static poses. No browser or device claim.',True)
sheet(data['mono'],'monochrome-contact-sheet.png',3,480,321,'Pufferfish / neutral monochrome views','Actual rendered glyphs, no glow. Eye/pupil contrast retained; this is not a flat mask.')
# One shared palette and retained frames permit GIF delta rectangles. PNGs
# remain the authoritative full-resolution evidence; the GIF is a preview.
palette_source=Image.new('RGB',(960,270))
palette_source.paste(Image.open(out/'native-neutral.png').convert('RGB').resize((480,270),Image.Resampling.LANCZOS),(0,0))
palette_source.paste(Image.open(out/'native-inflated.png').convert('RGB').resize((480,270),Image.Resampling.LANCZOS),(480,0))
palette=palette_source.quantize(colors=64,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE)
gif_frames=[]
for item in data['frames']:
    im=Image.open(pathlib.Path(data['frameDirectory'])/item['file']).convert('RGB')
    im=im.resize((480,270),Image.Resampling.LANCZOS)
    gif_frames.append(im.quantize(palette=palette,dither=Image.Dither.NONE))
gif_frames[0].save(out/'pufferfish-native.gif',save_all=True,append_images=gif_frames[1:],
    duration=[item['durationMs'] for item in data['frames']],loop=0,optimize=True,disposal=1)
saved=Image.open(out/'pufferfish-native.gif')
duration=0
for index in range(saved.n_frames):
    saved.seek(index)
    duration+=saved.info.get('duration',0)
assert duration==18500, f'Encoded GIF duration changed: {duration}'
print(json.dumps({'sampledGifFrames':len(gif_frames),'encodedGifFrames':saved.n_frames,'durationMs':duration}))
`;
  const result = spawnSync('python3', ['-c', python, assemblyPath], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Pillow assembly failed: ${result.stderr}`);
  process.stdout.write(result.stdout);
  const assemblyReport = JSON.parse(result.stdout);
  for (const file of ['native-contact-sheet.png', 'minimum-grid-contact-sheet.png', 'monochrome-contact-sheet.png', 'pufferfish-native.gif']) {
    const bytes = await readFile(join(output, file));
    artifacts.push({ file, sha256: hash(bytes), bytes: bytes.length, assemblyOnly: true });
  }
  const summarize = entries => {
    const sorted = entries.toSorted((a, b) => a - b);
    const percentile = q => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)];
    return { count: sorted.length, min: sorted[0], median: percentile(0.50), p95: percentile(0.95), p99: percentile(0.99), max: sorted.at(-1) };
  };
  const metadata = {
    evidenceVersion: 1,
    evidenceKind: 'native Canvas / Skia raster output; NOT browser, deployed, or target-device evidence',
    capturedAtUtc: new Date().toISOString(),
    runtime: { node: process.version, canvas: require('@napi-rs/canvas/package.json').version, platform: process.platform, arch: process.arch,
      requestedFontStack: 'SFMono-Regular, Consolas, Liberation Mono, monospace',
      availableMonospaceFamilies: GlobalFonts.families.filter(item => /Mono|Consolas/.test(item.family)).map(item => item.family),
      exactFallbackSelection: 'Not instrumented; installed-family inventory does not prove the selected font.' },
    source: { mainBase: '0e446c47b491b751d484e40db753ec725652b515', legacySha256: hash(legacySource), speciesSha256: sourceHashes,
      bridge: 'Original makeAtlas, _put, _rasterize and render called in place. Legacy constructor not invoked. No browser APIs stubbed for raster capture.' },
    replay: { seed: 23, tickRate: 60, lastTick: 1110, simulationSeconds: 18.5, events: orderedEvents,
      finalState, finalStateSha256: hash(JSON.stringify(finalState)), transitions },
    gif: { file: 'pufferfish-native.gif', sampledFrames: frames.length, encodedFrames: assemblyReport.encodedGifFrames,
      intervalTicks: 4, intendedFps: 15, durationMs: assemblyReport.durationMs,
      width: 480, height: 270, quantization: 'One shared 64-color palette, no dithering, delta frames; PNG originals are authoritative',
      timing: 'Centisecond delays rounded cumulatively; final interval is 2 ticks. Tick 1110 is in native-final.png.' },
    artifacts, frames,
    timing: { note: 'Raw one-run native CPU/Skia timings including JS model and reused renderer; no warmup or browser/device acceptance. Draw timing pools replay/checkpoint/default/minimum/monochrome scenarios and excludes PNG encoding and GIF assembly.',
      modelStepMs: summarize(timings.modelStepMs), nativeDrawMs: summarize(timings.nativeDrawMs), raw: timings },
    unrun: ['Real browser rendering and input', 'Keyboard and touch execution', 'Browser accessibility tree and assistive technology',
      'Browser memory/RAF cleanup', 'Browser/device performance budget', 'Deployed integration', 'Cross-font/platform raster equivalence'],
  };
  await writeFile(join(output, 'native-capture.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  await writeFile(join(output, 'replay-seed23.json'), `${JSON.stringify({ version: 'pufferfish-v1', seed: 23, tickRate: 60, untilTick: 1110, events: orderedEvents }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ output, artifactCount: artifacts.length, frames: frames.length, finalPhase: finalState.phase.kind, timing: { nativeDrawMs: summarize(timings.nativeDrawMs) } }, null, 2)}\n`);
} finally {
  painter.dispose();
  await rm(frameDirectory, { recursive: true, force: true });
}
