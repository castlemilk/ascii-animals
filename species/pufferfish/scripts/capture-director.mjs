#!/usr/bin/env node
/** Actual canonical native-Canvas evidence; never browser/deployment evidence.
 * Build the package first. --quick captures checkpoints without GIF frames.
 * --tag=before preserves a bounded critique baseline; default tag is final.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { CuttlefishArtwork } from '../../../lib/animals/cuttlefish.js';
import { createPufferfishDirector, stepPufferfishDirector, pufferfishDirectorPoster } from '../../../lib/species/pufferfish/director.js';
import { createPufferfishPainter } from '../../../lib/species/pufferfish/legacy-painter.js';

const require = createRequire(import.meta.url);
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const args = process.argv.slice(2);
assert(args.every(arg => arg === '--quick' || /^--tag=(before|final)$/.test(arg)), 'Usage: capture-director.mjs [--quick] [--tag=before|final]');
const quick = args.includes('--quick'), tag = args.find(arg => arg.startsWith('--tag='))?.slice(6) ?? 'final';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = join(root, 'species/pufferfish/evidence/director', tag);
const scratch = await mkdtemp(join(tmpdir(), 'pufferfish-director-frames-'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(output, { recursive: true });
const sourcePaths = ['src/animals/cuttlefish.js', 'lib/animals/cuttlefish.js',
  'species/pufferfish/src/types.ts', 'species/pufferfish/src/director-types.ts',
  'species/pufferfish/src/director.ts', 'species/pufferfish/src/geometry.ts', 'species/pufferfish/src/model.ts',
  'species/pufferfish/src/legacy-painter.ts', 'species/pufferfish/scripts/capture-director.mjs',
  'lib/species/pufferfish/types.js', 'lib/species/pufferfish/director-types.js',
  'lib/species/pufferfish/director.js', 'lib/species/pufferfish/geometry.js',
  'lib/species/pufferfish/legacy-painter.js', 'lib/species/pufferfish/model.js'];
const sourceHashes = Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, hash(await readFile(join(root, path)))])));
assert.equal(sourceHashes['src/animals/cuttlefish.js'], sourceHashes['lib/animals/cuttlefish.js'], 'Canonical source/build renderer parity');
const captures = [], replays = [], animations = [], nativeTimes = [];
const checkpoints = new Set([1, 240, 420, 660, 900, 1199]);

async function makePainter(width, height, options = {}) {
  const canvas = createCanvas(width, height);
  const atlas = createCanvas(1, 1);
  const painter = createPufferfishPainter(canvas, CuttlefishArtwork,
    { quality: 'fine', view: 'right', ...options }, () => atlas);
  painter.resize(width, height, 1);
  // The installed native Canvas library otherwise snapshots its mutable source
  // canvas for every atlas blit (~2 GB RSS after one frame in the bounded probe).
  // A lossless immutable native Image preserves the exact canonical drawImage
  // coordinates/pixels while reusing one snapshot. First-frame PNG parity is
  // recorded separately in native-atlas-parity.json. No browser mock is used.
  let atlasImage = await loadImage(atlas.toBuffer('image/png'));
  const ctx = canvas.getContext('2d'), drawImage = ctx.drawImage.bind(ctx);
  ctx.drawImage = (source, ...coordinates) => drawImage(source === atlas ? atlasImage : source, ...coordinates);
  return { canvas, painter, refreshAtlas: async () => { atlasImage = await loadImage(atlas.toBuffer('image/png')); } };
}
function inspectOwners(painter, result) {
  const counts = Array.from({ length: result.actorCount }, () => 0), edge = counts.slice();
  const quality = painter.getConfig().quality;
  const cap = { small: 72, standard: 120, fine: 160 }[quality];
  const mix = Math.max(0, Math.min(1, (result.width - 520) / 180));
  const target = quality === 'small' ? 72 : 96 + (cap - 96) * mix;
  const cellW = Math.max(result.width / target, result.height / (90 * 1.35));
  for (let row = 0; row < result.rows; row++) for (let col = 0; col < result.cols; col++) {
    const x = Math.min(1, (col + 0.5) * cellW / result.width * 2 - 1);
    const y = Math.min(1, (row + 0.5) * cellW * 1.35 / result.height * 2 - 1);
    const owner = painter.hitActor(x, y);
    if (owner !== null) {
      counts[owner]++;
      if (row === 0 || row === result.rows - 1 || col === 0 || col === result.cols - 1) edge[owner]++;
    }
  }
  return { visibleCellsByActor: counts, actorCellsOnOuterGridEdge: edge,
    note: 'Counts query actual visible owner cells. Zero edge cells alone is not an arbitrary-pose clipping proof.' };
}
async function capture(scene, host, file, still = false, includeOwners = true) {
  const start = performance.now(), result = host.painter.drawScene(scene, still);
  nativeTimes.push(performance.now() - start);
  assert(result.samples <= 16000 && result.cols <= 160 && result.rows <= 90);
  assert.equal(result.actorCount, scene.actors.length);
  assert(/^[\x20-\x7e\n]*$/.test(result.text));
  const png = host.canvas.toBuffer('image/png');
  await writeFile(file, png);
  return {
    file: relative(output, file), scene: scene.config.scene, tick: scene.tick, beat: scene.beat.kind,
    count: scene.actors.length, selected: scene.selected, staticPose: still,
    actorPhases: scene.actors.map(actor => ({ id: actor.id, role: actor.role, motive: actor.motive,
      phase: actor.state.phase.kind, inflation: actor.state.inflation, x: actor.x, y: actor.y, scale: actor.scale, yaw: actor.yaw })),
    options: host.painter.getConfig(), width: host.canvas.width, height: host.canvas.height,
    cols: result.cols, rows: result.rows, samples: result.samples, glyphs: result.glyphs, sceneScale: result.sceneScale,
    stateSha256: hash(JSON.stringify(scene)), cellsSha256: hash(result.text), pngSha256: hash(png),
    rgbaSha256: hash(host.canvas.getContext('2d').getImageData(0, 0, host.canvas.width, host.canvas.height).data),
    ...(includeOwners ? inspectOwners(host.painter, result) : {}),
  };
}
try {
  for (const name of ['reef', 'current', 'shadow']) {
    const host = await makePainter(900, 675), events = [], frames = [];
    let state = createPufferfishDirector({ scene: name, count: 3 }, { seed: 23 });
    let seq = 0;
    try {
      for (let tick = 0; tick <= 1200; tick++) {
        if (tick) {
          const actor = state.actors[state.selected];
          const input = tick === 121 ? { type: 'select', id: 1 }
            : tick === 122 ? { type: 'invite', x: 0.35, y: -0.2 }
            : tick === 361 ? { type: 'approach' }
            : tick === 461 || tick === 841 ? { type: 'retreat' }
            : tick === 721 ? { type: 'pointer', x: actor.x, y: actor.y, aspect: 4 / 3 } : null;
          const batch = input ? [{ ...input, tick, seq: seq++ }] : [];
          events.push(...batch);
          state = stepPufferfishDirector(state, { tick, events: batch }).state;
        }
        if (checkpoints.has(tick)) {
          captures.push(await capture(state, host, join(output, `${name}-${String(tick).padStart(4, '0')}.png`)));
        }
        if (!quick && name === 'current' && tick < 1200 && tick % 12 === 0) {
          const file = join(scratch, `${name}-${String(tick).padStart(4, '0')}.png`);
          const frame = await capture(state, host, file, false, false);
          frames.push({ file, tick, durationMs: 200, stateSha256: frame.stateSha256, cellsSha256: frame.cellsSha256,
            samples: frame.samples, pngSha256: frame.pngSha256 });
        }
      }
      replays.push({ scene: name, config: state.config, seed: 23, tickRate: 60, events, finalState: state,
        finalStateSha256: hash(JSON.stringify(state)) });
      if (frames.length) animations.push({ scene: name, frames, file: `${name}-native.gif`, durationMs: 20000 });
      for (const dimensions of [[360, 420], [390, 520]]) {
        const mobile = await makePainter(...dimensions);
        try {
          let small = createPufferfishDirector({ scene: name, count: 3, size: 1.1, spacing: 1.2 }, { seed: 23, inflationScale: 1.8 });
          small = pufferfishDirectorPoster(small, true);
          captures.push(await capture(small, mobile, join(output, `${name}-mobile-${dimensions[0]}.png`), true));
        } finally { mobile.painter.dispose(); }
      }
      if (name === 'reef') {
        host.painter.configure({ view: 'front' });
        await host.refreshAtlas();
        captures.push(await capture(state, host, join(output, 'reef-front.png'), true));
        host.painter.configure({ view: 'right' });
        await host.refreshAtlas();
      }
      host.painter.configure({ mode: 'points' });
      await host.refreshAtlas();
      captures.push(await capture(state, host, join(output, `${name}-points.png`), true));
    } finally { host.painter.dispose(); }
  }
  const assembly = { output, captures, animations };
  const assemblyFile = join(scratch, 'assembly.json');
  await writeFile(assemblyFile, JSON.stringify(assembly));
  const python = String.raw`
import json,pathlib,sys
from PIL import Image,ImageDraw,ImageFont
d=json.loads(pathlib.Path(sys.argv[1]).read_text()); out=pathlib.Path(d['output'])
try:
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
 title=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',24)
except OSError: font=title=ImageFont.load_default()
for scene in ['reef','current','shadow']:
 items=[a for a in d['captures'] if a['scene']==scene and a['width']==900 and a['options']['mode']=='ascii' and a['options']['view']=='right']
 sheet=Image.new('RGB',(1350,840),(8,13,15)); draw=ImageDraw.Draw(sheet)
 draw.text((20,16),f'Pufferfish director / {scene}',font=title,fill=(245,235,205))
 draw.text((20,50),'Canonical native Canvas / seed 23 / 3 actors / not browser evidence',font=font,fill=(150,180,176))
 for i,a in enumerate(items):
  im=Image.open(out/a['file']).convert('RGB').resize((450,338),Image.Resampling.LANCZOS)
  x=(i%3)*450; y=85+(i//3)*375; sheet.paste(im,(x,y))
  draw.text((x+15,y+342),f"tick {a['tick']} / {a['beat']} / {a['samples']} samples",font=font,fill=(220,225,210))
 sheet.save(out/f'{scene}-contact-sheet.png')
mobile=[a for a in d['captures'] if a['width']==360]
sheet=Image.new('RGB',(1080,500),(8,13,15)); draw=ImageDraw.Draw(sheet)
draw.text((18,15),'Mobile composition / 360x420 native pixels / maximum size and inflation',font=font,fill=(225,228,210))
for i,a in enumerate(mobile):
 im=Image.open(out/a['file']).convert('RGB'); sheet.paste(im,(i*360,55))
 draw.text((i*360+15,475),a['scene'],font=font,fill=(190,210,205))
sheet.save(out/'mobile-contact-sheet.png')
gifs=[]
for animation in d['animations']:
 frames=[]
 # Shared palette from four actual native frames; no generated art or browser substitution.
 sample=Image.new('RGB',(1200,900))
 for j,index in enumerate([0,30,60,85]):
  im=Image.open(animation['frames'][index]['file']).convert('RGB').resize((600,450),Image.Resampling.LANCZOS)
  sample.paste(im,((j%2)*600,(j//2)*450))
 palette=sample.quantize(colors=80,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE)
 for f in animation['frames']:
  im=Image.open(f['file']).convert('RGB').resize((600,450),Image.Resampling.LANCZOS)
  frames.append(im.quantize(palette=palette,dither=Image.Dither.NONE))
 target=out/animation['file']
 frames[0].save(target,save_all=True,append_images=frames[1:],duration=200,loop=0,optimize=True,disposal=1)
 saved=Image.open(target);duration=0
 for i in range(saved.n_frames):saved.seek(i);duration+=saved.info.get('duration',0)
 assert duration==animation['durationMs'],duration
 gifs.append({'file':animation['file'],'frames':saved.n_frames,'durationMs':duration})
print(json.dumps({'gifs':gifs,'contactSheets':4}))
`;
  const assembled = spawnSync('python3', ['-c', python, assemblyFile], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  assert.equal(assembled.status, 0, assembled.stderr);
  for (const path of sourcePaths) {
    assert.equal(hash(await readFile(join(root, path))), sourceHashes[path], `Source/build changed during capture: ${path}`);
  }
  const sorted = nativeTimes.toSorted((a, b) => a - b);
  const quantile = q => sorted[Math.max(0, Math.ceil(sorted.length * q) - 1)];
  const meta = { evidenceVersion: 1, evidence: 'Actual native Canvas / Skia raster output of the canonical renderer. NOT browser, deployed, phone, or FPS evidence.',
    tag, quick, recordedAt: new Date().toISOString(), baseCommit: 'c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02', sourceHashes,
    runtime: { node: process.version, canvas: require('@napi-rs/canvas/package.json').version, platform: process.platform,
      availableMonospaceFamilies: GlobalFonts.families.filter(entry => /Mono|Consolas/.test(entry.family)).map(entry => entry.family),
      selectedFont: 'Not instrumented; family inventory is not evidence of exact fallback selection.' },
    rendering: 'Imports lib/animals/cuttlefish.js, borrows actual render/makeAtlas/_put/_rasterize in place; no constructor/RAF/browser stubs. Capture-only lossless native atlas Image cache replaces repeated mutable-Canvas snapshots, with byte-identical first-frame PNG parity.',
    captures, replays, animations: animations.map(({ frames, ...rest }) => ({ ...rest, sampledFrames: frames.length, intervalTicks: 12, frames })),
    assembly: JSON.parse(assembled.stdout),
    nativeTiming: { note: 'Single-run CPU/Skia draw times; excludes PNG encoding. No warmup, browser/device/FPS claim.', count: sorted.length,
      p50ms: quantile(.5), p95ms: quantile(.95), p99ms: quantile(.99), maxMs: sorted.at(-1), rawMs: nativeTimes },
    unrun: ['Browser input/accessibility and device performance are separate acceptance.', 'Exact font selection and cross-platform raster parity.', 'Real-device memory/thermal behavior.'] };
  await writeFile(join(output, 'capture.json'), `${JSON.stringify(meta, null, 2)}\n`);
  console.log(JSON.stringify({ output, captures: captures.length, animations: meta.assembly.gifs,
    maxSamples: Math.max(...captures.map(item => item.samples)), p95NativeDrawMs: quantile(.95) }, null, 2));
} finally { await rm(scratch, { recursive: true, force: true }); }
