/**
 * Matched, explicit-tick native Canvas evidence. This is NOT a browser capture.
 * Usage: node --expose-gc species/frog/scripts/render-wetland-review.mjs \
 *   --root=/absolute/repository --variant=before --out=/absolute/evidence
 * Run once against the pinned baseline, once against the candidate. The same
 * seed, input log, dimensions, view, atlas and grid are used in both runs.
 * --summarize=true writes compact provenance from existing captures only.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--([a-z]+)=(.*)$/.exec(arg);
  if (!match) throw new Error(`Expected --name=value, received ${arg}`);
  return [match[1], match[2]];
}));
const root = resolve(args.root || new URL('../../..', import.meta.url).pathname);
const variant = args.variant || 'after';
if (!['before', 'after'].includes(variant)) throw new Error('variant must be before or after');
const out = resolve(args.out || new URL('../review/evidence', import.meta.url).pathname);
if (typeof globalThis.gc !== 'function') throw new Error('Use node --expose-gc; native Canvas caches are explicitly collected');
if (args.summarize === 'true') { await writeCaptureSummaries(await readCaptureMetadata()); process.exit(0); }
if (args.compose === 'true') { await composeReview(); process.exit(0); }
const sourcePaths = ['frog', 'geometry', 'pond', 'legacy-preview', 'choreography', 'controller', 'demo', 'types', 'pond-types', 'index']
  .flatMap(name => [`src/${name}.mts`, `generated/${name}.mjs`, `generated/${name}.d.mts`])
  .concat(['demo/index.html', 'demo/styles.css', 'scripts/native-host.mjs']);

// Each viewport gets a fresh native process, bounding native atlas caches. This
// does not measure browser memory, nor establish a mobile-device performance claim.
if (!args.viewport) {
  await mkdir(out, { recursive: true });
  for (const viewport of ['desktop', 'phone']) execFileSync(process.execPath, [
    '--expose-gc', import.meta.filename, `--root=${root}`, `--variant=${variant}`,
    `--out=${out}`, `--viewport=${viewport}`,
  ], { stdio: 'inherit' });
  process.exit(0);
}
const viewport = args.viewport === 'desktop' ? [1200, 700] : args.viewport === 'phone' ? [390, 520] : null;
if (!viewport) throw new Error('Unknown viewport');
const sources = await sourceHashes();
const { createFrogPond, stepFrogPond } = await import(pathToFileURL(join(root, 'species/frog/generated/pond.mjs')));
const { createFrog } = await import(pathToFileURL(join(root, 'species/frog/generated/frog.mjs')));
const { createCanvas, captureFont } = await import(pathToFileURL(join(root, 'species/frog/scripts/native-host.mjs')));
const { createLegacyFrogPreview } = await import(pathToFileURL(join(root, 'species/frog/generated/legacy-preview.mjs')));
const nativeModule = process.env.FROG_CANVAS_MODULE || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/@napi-rs/canvas` : '@napi-rs/canvas');
const { loadImage } = createRequire(import.meta.url)(nativeModule);
const previewOptions = { cols: 180, rows: 100, labels: true, trajectories: false, view: 'front' };
// Native Skia retains the atlas display list when repeatedly drawing a mutable
// Canvas source. Freeze its already-rendered pixels as an Image for this native
// host only. The production renderer is unchanged. Native PNG/Image sampling
// differs from mutable Canvas sampling; native-atlas-parity.json quantifies it.
// BOTH baseline and candidate use this same disclosed native capture path.
let atlas;
const canvas = createCanvas(...viewport);
canvas.ownerDocument = { defaultView: {}, createElement(name) {
  if (name !== 'canvas') throw new Error('Native review host only supplies Canvas');
  return atlas = createCanvas(1, 1);
} };
const preview = createLegacyFrogPreview(canvas, previewOptions);
preview.resize(...viewport, 1);
const immutableAtlas = await loadImage(atlas.toBuffer('image/png'));
const context = canvas.getContext('2d'), drawImage = context.drawImage.bind(context);
context.drawImage = (source, ...values) => drawImage(source === atlas ? immutableAtlas : source, ...values);
globalThis.gc();
const stem = `${variant}-${args.viewport}`;
const records = [], frameRecords = [];
await mkdir(out, { recursive: true });

function pixels() {
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let foreground = 0, bright = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (Math.max(Math.abs(data[i] - 9), Math.abs(data[i + 1] - 18), Math.abs(data[i + 2] - 15)) > 12) foreground++;
    if (Math.max(data[i], data[i + 1], data[i + 2]) > 100) bright++;
  }
  return { foreground, bright, total: canvas.width * canvas.height };
}
function details(state, frame) {
  return { tick: state.tick, actors: state.actors.map(actor => ({ id: actor.id, motive: actor.motive, behavior: actor.model.behavior.kind })),
    firefly: state.firefly, glyphs: frame.glyphs, actorGlyphs: frame.actorGlyphs,
    samples: frame.samples, environmentSamples: frame.environmentSamples };
}
async function save(name, state, geometryOptions = {}) {
  const frame = preview.drawPond(state, geometryOptions);
  const file = `${stem}-${name}.png`;
  const pixelCounts = pixels();
  if (pixelCounts.foreground < 350 || pixelCounts.bright < 80) throw new Error(`${file}: Canvas pixels are blank or unreadably sparse`);
  await writeFile(join(out, file), canvas.toBuffer('image/png'));
  records.push({ file, ...details(state, frame), pixelCounts, geometryOptions });
  globalThis.gc();
}

const still = createFrogPond({ seed: 23, director: { scene: 'stillwater', count: 3, autonomy: false } });
await save('rest', still, { motion: false });
await save('oblique', still, { motion: false, view: 'left' });
await save('silhouette', still, { motion: false, silhouette: true });
await save('reduced-hunt', still, { motion: false, staticPose: 'rest', pondStill: 'hunt' });
await writeFile(join(out, `${stem}-specimen.txt`), preview.toText() + '\n');
// The default single-animal API remains part of the review; no state patching or
// close-up camera override is used to make its anatomy appear larger.
const singleFrame = preview.draw(createFrog({ seed: 23 }), { motion: false, view: 'left' });
await writeFile(join(out, `${stem}-single.png`), canvas.toBuffer('image/png'));
records.push({ file: `${stem}-single.png`, singleFrog: true, tick: 0, view: 'left', glyphs: singleFrame.glyphs,
  samples: singleFrame.samples, pixelCounts: pixels() });
globalThis.gc();

const segments = [
  { name: 'hop', scene: 'stillwater', count: 3, endTick: 210,
    events: [{ type: 'hop', frogId: 0, padId: 4, tick: 24, seq: 0 }],
    picks: { 35: 'crouch', 59: 'arc', 83: 'splash', 118: 'recovery', 190: 'restored' } },
  { name: 'hunt', scene: 'firefly-supper', count: 3, hunter: 1, endTick: 300,
    events: [{ type: 'hunt', frogId: 1, x: .7, y: -.5, tick: 24, seq: 0 }], picks: {} },
  { name: 'solo-hop', scene: 'stillwater', count: 1, endTick: 210,
    events: [{ type: 'hop', frogId: 0, padId: 4, tick: 24, seq: 0 }],
    picks: { 35: 'crouch', 59: 'arc', 83: 'splash', 118: 'recovery', 190: 'restored' } },
  { name: 'solo-hunt', scene: 'firefly-supper', count: 1, hunter: 0, endTick: 300,
    events: [{ type: 'hunt', frogId: 0, x: .2, y: .55, tick: 24, seq: 0 }], picks: {} },
];
for (const segment of segments) {
  const directory = join(out, 'frames', stem, segment.name);
  await mkdir(directory, { recursive: true });
  let state = createFrogPond({ seed: 23, director: { scene: segment.scene, count: segment.count, autonomy: false } });
  const picked = new Set();
  for (let tick = 0; tick <= segment.endTick; tick++) {
    if (tick) state = stepFrogPond(state, tick, segment.events.filter(event => event.tick === tick)).state;
    if (segment.picks[tick]) await save(`${segment.name}-${segment.picks[tick]}`, state);
    if (segment.hunter !== undefined) {
      const motive = state.actors[segment.hunter].motive;
      let label;
      if (motive.kind === 'track' && motive.age === Math.round(motive.duration * .65)) label = 'stalk';
      if (motive.kind === 'strike' && motive.age === Math.round(motive.duration * .30)) label = 'extend';
      if (motive.kind === 'strike' && motive.age === Math.round(motive.duration * .65)) label = 'return';
      if (motive.kind === 'settle' && motive.age === 30) label = 'settle';
      if (label && !picked.has(label)) { await save(`${segment.name}-${label}`, state); picked.add(label); }
    }
    if (tick % 3) continue;
    const frame = preview.drawPond(state);
    const file = `frames/${stem}/${segment.name}/${String(tick / 3).padStart(4, '0')}.png`;
    await writeFile(join(out, file), canvas.toBuffer('image/png'));
    frameRecords.push({ file, segment: segment.name, ...details(state, frame) });
    globalThis.gc();
  }
  if (segment.hunter !== undefined && picked.size !== 4) throw new Error(`Hunt did not complete all four review phases: ${[...picked].join(', ')}`);
}
preview.dispose();

if (JSON.stringify(sources) !== JSON.stringify(await sourceHashes())) throw new Error('Source changed during capture; rerun against a stable tree');
const metadata = { evidence: 'Actual @napi-rs/canvas raster pixels. NOT a browser/DOM capture or deployed evidence.',
  variant, root, node: process.version, viewport, dpr: 1, seed: 23, modelHz: 60, captureFps: 20,
  previewOptions, font: captureFont, sources, inputSegments: segments.map(({ picks, ...segment }) => segment),
  matchedPolicy: 'Identical seed, inputs, viewports and presentation ticks. Hunt contact-sheet states are also matched by motive progress; their actual ticks are recorded.',
  singleAnimalPolicy: 'Default createFrog state and native renderer camera, no scene/camera enlargement.',
  nativeCachePolicy: 'Fresh process per viewport, immutable Image of the exact native atlas pixels, explicit collection after each PNG; not browser heap evidence.',
  initialCaptureFailure: 'Mutable native atlas capture at1200×700 and720×440 was SIGKILL before its first PNG. An immutable atlas Image host resolves native display-list retention without renderer edits. The native PNG/Image path is not claimed pixel-identical to native Canvas sampling; see native-atlas-parity.json.',
  records, frames: frameRecords,
  pending: ['Real browser regression execution: local Chromium socket denied; cloud localhost unavailable.', 'Physical phone input/performance', 'Browser DOM/accessibility and frame-time/heap checks'] };
await writeFile(join(out, `${stem}-capture.json`), JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify({ variant, viewport, stills: records.length, frames: frameRecords.length,
  maxSamples: Math.max(...frameRecords.map(record => record.samples)),
  minimumActorGlyphs: Math.min(...frameRecords.flatMap(record => record.actorGlyphs.slice(0, record.actors.length))), evidence: 'native Canvas only' }));

async function sourceHashes() {
  const hashes = {};
  for (const path of sourcePaths) {
    try { hashes[`species/frog/${path}`] = createHash('sha256').update(await readFile(join(root, 'species/frog', path))).digest('hex'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; hashes[`species/frog/${path}`] = null; }
  }
  return hashes;
}

async function readCaptureMetadata() {
  const metadata = {};
  for (const variant of ['before', 'after']) for (const viewport of ['desktop', 'phone'])
    metadata[`${variant}-${viewport}`] = JSON.parse(await readFile(join(out, `${variant}-${viewport}-capture.json`), 'utf8'));
  return metadata;
}

/** Keep Git provenance compact; preserve every original capture file intact. */
async function writeCaptureSummaries(metadata) {
  const sortedSources = sources => Object.fromEntries(Object.keys(sources).sort().map(path => [path, sources[path]]));
  const fingerprint = sources => createHash('sha256').update(JSON.stringify(sortedSources(sources))).digest('hex');
  const revisionNames = { before: 'baseline', after: 'candidate' };
  const sourceMaps = {}, fingerprints = {};
  for (const variant of ['before', 'after']) {
    const desktop = metadata[`${variant}-desktop`].sources, phone = metadata[`${variant}-phone`].sources;
    if (fingerprint(desktop) !== fingerprint(phone)) throw new Error(`${variant}: viewport source fingerprints differ`);
    sourceMaps[revisionNames[variant]] = sortedSources(desktop);
    fingerprints[revisionNames[variant]] = fingerprint(desktop);
  }
  const reference = metadata['before-desktop'];
  const settingsOf = capture => ({ node: capture.node, dpr: capture.dpr, seed: capture.seed,
    modelHz: capture.modelHz, captureFps: capture.captureFps,
    previewOptions: capture.previewOptions, font: capture.font });
  const settings = settingsOf(reference);
  const captures = Object.entries(metadata).map(([name, capture]) => {
    if (JSON.stringify(settingsOf(capture)) !== JSON.stringify(settings)) throw new Error(`${name}: capture settings differ`);
    if (JSON.stringify(capture.inputSegments) !== JSON.stringify(reference.inputSegments)) throw new Error(`${name}: input logs differ`);
    return {
      name, revision: revisionNames[capture.variant], viewport: capture.viewport,
      fullCaptureFile: `${name}-capture.json`,
      counts: { selectedStills: capture.records.length, motionFrames: capture.frames.length,
        framesBySegment: Object.fromEntries(capture.inputSegments.map(segment => [segment.name,
          capture.frames.filter(frame => frame.segment === segment.name).length])) },
      metrics: { maxSamples: Math.max(...capture.frames.map(frame => frame.samples)),
        maxEnvironmentSamples: Math.max(...capture.frames.map(frame => frame.environmentSamples)),
        minimumActorGlyphs: Math.min(...capture.frames.flatMap(frame => frame.actorGlyphs.slice(0, frame.actors.length))),
        minimumForegroundPixels: Math.min(...capture.records.map(record => record.pixelCounts.foreground)),
        minimumBrightPixels: Math.min(...capture.records.map(record => record.pixelCounts.bright)) },
      selectedStills: capture.records.map(record => {
        const phase = record.file.slice(name.length + 1, -4);
        const segment = capture.inputSegments.find(segment => phase.startsWith(`${segment.name}-`));
        const actor = record.actors?.find(actor => actor.id === (segment?.hunter ?? 0));
        return { file: record.file, tick: record.tick, phase,
          ...(actor ? { actorId: actor.id, motive: actor.motive.kind, motiveAge: actor.motive.age, bodyBehavior: actor.behavior } : {}),
          ...(record.firefly ? { fireflyPhase: record.firefly.phase } : {}),
          ...(record.geometryOptions ? { geometryOptions: record.geometryOptions } : {}),
          ...(record.singleFrog ? { singleFrog: true, view: record.view } : {}) };
      }),
    };
  });
  await writeFile(join(out, 'source-hashes.json'), JSON.stringify({ schema: 1,
    fingerprintAlgorithm: 'SHA-256 of UTF-8 JSON for the existing capture.sources map, with keys sorted lexically and no whitespace.',
    sourceFingerprintSha256: fingerprints, ...sourceMaps }, null, 2) + '\n');
  await writeFile(join(out, 'capture-summary.json'), JSON.stringify({ schema: 1,
    evidence: reference.evidence, sourceHashes: 'source-hashes.json', settings,
    inputSegments: reference.inputSegments, matchedPolicy: reference.matchedPolicy,
    singleAnimalPolicy: reference.singleAnimalPolicy, nativeCachePolicy: reference.nativeCachePolicy,
    initialCaptureFailure: reference.initialCaptureFailure, pending: reference.pending,
    fullCapturePolicy: 'Original *-capture.json files are preserved intact in the complete review bundle. This summary omits their per-frame objects.',
    crownSelection: 'Composition copies each hop sequence frame at tick93 without rerendering; original tick83 *-hop-splash.png records remain touchdown/impact. See composition.json for source files and crops.',
    captures }, null, 2) + '\n');
  console.log(JSON.stringify({ summaries: 2, sourceFingerprintSha256: fingerprints, captures: captures.length }));
}

/** Arrange unchanged raw captures for review; all scaling is declared here. */
async function composeReview() {
  const nativeModule = process.env.FROG_CANVAS_MODULE || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
    ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/@napi-rs/canvas` : '@napi-rs/canvas');
  const { createCanvas, loadImage, GlobalFonts } = createRequire(import.meta.url)(nativeModule);
  const fontFile = process.env.FROG_FONT_FILE || '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf';
  try { GlobalFonts.registerFromPath(fontFile, 'Liberation Mono'); } catch { /* same native fallback as captures */ }
  const metadata = await readCaptureMetadata();
  await writeCaptureSummaries(metadata);
  // Tick 83 is the captured touchdown/impact. The water crown reads most
  // clearly ten ticks later, so splash panels use that exact existing frame
  // on BOTH sides. Preserve the original captures and their metadata.
  const derivedStills = [];
  for (const variant of ['before', 'after']) for (const viewport of ['desktop', 'phone'])
    for (const segment of ['hop', 'solo-hop']) {
      const source = metadata[`${variant}-${viewport}`].frames.find(frame => frame.segment === segment && frame.tick === 93);
      if (!source) throw new Error(`Missing matched water-crown frame: ${variant}/${viewport}/${segment}/93`);
      const file = `${variant}-${viewport}-${segment}-crown.png`;
      await writeFile(join(out, file), await readFile(join(out, source.file)));
      derivedStills.push({ file, source: source.file, tick: source.tick, operation: 'Byte-for-byte PNG copy; no rerender or image edit' });
    }
  async function sheet(file, title, items, columns, cellWidth, cellHeight) {
    const header = 70, caption = 40, rows = Math.ceil(items.length / columns);
    const canvas = createCanvas(columns * cellWidth, header + rows * (cellHeight + caption));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#09120f'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#d8e5b1'; ctx.font = '20px "Liberation Mono", monospace'; ctx.fillText(title, 20, 28);
    ctx.fillStyle = '#8fa792'; ctx.font = '12px "Liberation Mono", monospace';
    ctx.fillText('NATIVE CANVAS  /  SEED 23  /  SAME INPUT LOG  /  NOT BROWSER CAPTURES', 20, 51);
    for (const [index, item] of items.entries()) {
      const x = (index % columns) * cellWidth, y = header + Math.floor(index / columns) * (cellHeight + caption);
      const image = await loadImage(join(out, item.file));
      if (item.crop) ctx.drawImage(image, item.crop.x, item.crop.y, item.crop.width, item.crop.height, x, y + caption, cellWidth, cellHeight);
      else ctx.drawImage(image, x, y + caption, cellWidth, cellHeight);
      ctx.fillStyle = item.variant === 'after' ? '#d8e5b1' : '#8fa792';
      ctx.font = '14px "Liberation Mono", monospace'; ctx.fillText(item.label, x + 14, y + 25);
      globalThis.gc();
    }
    await writeFile(join(out, file), canvas.toBuffer('image/png')); globalThis.gc();
  }
  function item(variant, viewport, state, label) {
    const selected = /^(solo-)?hop-splash$/.test(state) ? state.replace(/splash$/, 'crown') : state;
    const file = `${variant}-${viewport}-${selected}.png`;
    const record = derivedStills.find(record => record.file === file)
      || metadata[`${variant}-${viewport}`].records.find(record => record.file === file);
    if (!record) throw new Error(`Missing captured state ${file}`);
    return { file, variant, label: `${variant.toUpperCase()} · ${label} · tick ${record.tick}` };
  }
  await sheet('frog-before-after-desktop.png', 'FROG / WETLAND STUDY',
    ['rest', 'oblique'].flatMap(state => ['before', 'after'].map(variant => item(variant, 'desktop', state, state))), 2, 1200, 700);
  await sheet('frog-before-after-phone.png', 'FROG / 390 PX PHONE CANVAS',
    ['before', 'after'].map(variant => item(variant, 'phone', 'rest', 'rest')), 2, 390, 520);
  await sheet('frog-anatomy-comparison.png', 'FROG / SINGLE-ANIMAL OBLIQUE STUDY',
    ['before', 'after'].map(variant => item(variant, 'desktop', 'single', 'single frog / oblique')), 2, 1200, 700);
  const hop = ['crouch', 'arc', 'splash', 'recovery'], hunt = ['stalk', 'extend', 'return', 'settle'];
  const hopCrop = { x: 130, y: 180, width: 800, height: 440 };
  const huntCrop = { x: 430, y: 140, width: 700, height: 440 };
  const phoneCrop = { x: 0, y: 140, width: 390, height: 300 };
  const soloHopCrops = {
    crouch: { x: 80, y: 260, width: 680, height: 380 },
    arc: { x: 200, y: 130, width: 680, height: 380 },
    splash: { x: 300, y: 260, width: 680, height: 380 },
    recovery: { x: 300, y: 260, width: 680, height: 380 },
  };
  const soloHuntCrops = {
    stalk: { x: 80, y: 260, width: 680, height: 380 },
    extend: { x: 300, y: 260, width: 680, height: 380 },
    return: { x: 300, y: 260, width: 680, height: 380 },
    settle: { x: 300, y: 260, width: 680, height: 380 },
  };
  await sheet('frog-hop-contact-sheet.png', 'PLANTED CROUCH / ARC / SPLASH / RECOVERY',
    ['before', 'after'].flatMap(variant => hop.map(state => ({ ...item(variant, 'desktop', `hop-${state}`, state), crop: hopCrop }))), 4, 800, 440);
  await sheet('frog-hunt-contact-sheet.png', 'STALK / TONGUE STRIKE / ATTACHED RETURN / SETTLE',
    ['before', 'after'].flatMap(variant => hunt.map(state => ({ ...item(variant, 'desktop', `hunt-${state}`, state), crop: huntCrop }))), 4, 700, 440);
  await sheet('frog-phone-motion.png', 'FROG / ACTIONS AT ACTUAL 390 PX CANVAS WIDTH',
    [...hop.map(state => ({ ...item('after', 'phone', `hop-${state}`, state), crop: phoneCrop })), ...hunt.map(state => ({ ...item('after', 'phone', `hunt-${state}`, state), crop: phoneCrop }))], 4, 390, 300);
  await sheet('frog-solo-hop-contact-sheet.png', 'ONE FROG / PLANTED CROUCH / ARC / SPLASH / RECOVERY',
    ['before', 'after'].flatMap(variant => hop.map(state => ({ ...item(variant, 'desktop', `solo-hop-${state}`, state), crop: soloHopCrops[state] }))), 4, 680, 380);
  await sheet('frog-solo-hunt-contact-sheet.png', 'ONE FROG / STALK / TONGUE STRIKE / ATTACHED RETURN / SETTLE',
    ['before', 'after'].flatMap(variant => hunt.map(state => ({ ...item(variant, 'desktop', `solo-hunt-${state}`, state), crop: soloHuntCrops[state] }))), 4, 680, 380);
  await sheet('frog-solo-phone-motion.png', 'ONE FROG / ACTIONS AT ACTUAL 390 PX CANVAS WIDTH',
    [...hop.map(state => ({ ...item('after', 'phone', `solo-hop-${state}`, state), crop: phoneCrop })), ...hunt.map(state => ({ ...item('after', 'phone', `solo-hunt-${state}`, state), crop: phoneCrop }))], 4, 390, 300);

  // Each input PNG is a genuine frame at the recorded tick. Both sides of the
  // animation run on the same clock; longer authored hunting phases remain
  // longer instead of being retimed to imply a false matched-frame outcome.
  for (const viewport of ['desktop', 'phone']) for (const segment of ['hop', 'hunt', 'solo-hop', 'solo-hunt']) {
    const width = viewport === 'desktop' ? 600 : 390;
    const label = `NATIVE CANVAS   BEFORE / AFTER   seed 23   60 Hz model / 20 fps capture`;
    const filter = `[0:v]scale=${width}:-1[b];[1:v]scale=${width}:-1[a];[b][a]hstack=inputs=2,pad=iw:ih+36:0:36:color=0x09120f,drawtext=fontfile=${fontFile}:text='${label}':x=12:y=11:fontsize=12:fontcolor=0xd8e5b1,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4[out]`;
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-filter_complex_threads', '1',
      '-framerate', '20', '-i', join(out, `frames/before-${viewport}/${segment}/%04d.png`),
      '-framerate', '20', '-i', join(out, `frames/after-${viewport}/${segment}/%04d.png`),
      '-filter_complex', filter, '-map', '[out]', '-loop', '0', join(out, `frog-${segment}-${viewport}.gif`)], { stdio: 'inherit' });
  }
  await writeFile(join(out, 'composition.json'), JSON.stringify({
    source: 'Raw native Canvas PNGs; no generated illustration or repainting.',
    derivedStills,
    splashSelection: 'Original *-hop-splash.png stills record touchdown/impact at tick83. Contact-sheet splash panels use the exact recorded tick93 frame on both revisions, copied as *-hop-crown.png, when water droplets are lifted. No simulation retiming or rerendering.',
    sheets: ['frog-before-after-desktop.png', 'frog-before-after-phone.png', 'frog-anatomy-comparison.png', 'frog-hop-contact-sheet.png', 'frog-hunt-contact-sheet.png', 'frog-phone-motion.png', 'frog-solo-hop-contact-sheet.png', 'frog-solo-hunt-contact-sheet.png', 'frog-solo-phone-motion.png'],
    scaling: 'Desktop comparison/anatomy and phone panels retain native pixel dimensions. Motion contact sheets use declared fixed matching crops at1:1pixels; only desktop GIF panels are downsampled from1200×700 to600×350. Raw full-resolution PNGs remain included.',
    motionContactSheetCrops: { hop: hopCrop, hunt: huntCrop, phone: phoneCrop, soloHop: soloHopCrops, soloHunt: soloHuntCrops },
    animation: 'GIF20fps from60Hz model sampled every3ticks; both revisions share the same input log and timeline. Loop return is an edit between explicit replays, not a claimed seamless model loop.',
  }, null, 2) + '\n');
  console.log(JSON.stringify({ composed: 9, gifs: 8, evidence: 'native Canvas only', output: out }));
}
