/**
 * Native Canvas evidence from the actual browser-controller draw path.
 * This is NOT browser, DOM layout, touch-device or performance evidence.
 *
 * Build first, then:
 *   node species/turtle/scripts/render-evidence.mjs /absolute/output [--gif]
 *
 * Uses an already available @napi-rs/canvas installation (or the managed runtime
 * dependency directory). It does not install dependencies or launch a browser.
 * The pinned baseline is reconstructed byte-for-byte with git show outside the
 * repository. All poses are produced through the actual public controller API.
 */
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const args = process.argv.slice(2);
const output = path.resolve(args.find(arg => !arg.startsWith('--')) || path.join(root, '..', 'turtle-delivery', 'evidence'));
const baseline = 'c06114404900884814bef879a02f1a49a3e7d590';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const require = createRequire(import.meta.url);
let canvasModule;
try { canvasModule = require.resolve('@napi-rs/canvas'); }
catch (error) {
  const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if (!runtime) throw new Error('An already installed @napi-rs/canvas is required; no installation was attempted.', { cause: error });
  canvasModule = require.resolve(path.join(runtime, '@napi-rs/canvas'));
}
const { createCanvas, loadImage } = require(canvasModule);
const nativeVersion = require(path.join(path.dirname(canvasModule), 'package.json')).version;
const sourceText = await readFile(path.join(root, 'src/public/turtle.ts'), 'utf8');
const compiledMap = JSON.parse(await readFile(path.join(root, 'lib/public/turtle.js.map'), 'utf8'));
if (!compiledMap.sourcesContent?.includes(sourceText)) throw new Error('Compiled turtle does not match current TypeScript. Build before rendering evidence.');
const { createTurtleArtwork } = await import(pathToFileURL(path.join(root, 'lib/public/turtle.js')).href);
await mkdir(output, { recursive: true });

const baselineRoot = path.join(output, '.baseline');
await mkdir(path.join(baselineRoot, 'public'), { recursive: true });
await mkdir(path.join(baselineRoot, 'core'), { recursive: true });
await writeFile(path.join(baselineRoot, 'package.json'), '{"type":"module"}\n');
const baselineSource = execFileSync('git', ['show', `${baseline}:dist/turtle/runtime/public/turtle.js`], { cwd: root });
const baselineScheduler = execFileSync('git', ['show', `${baseline}:dist/turtle/runtime/core/scheduler.js`], { cwd: root });
await writeFile(path.join(baselineRoot, 'public/turtle.js'), baselineSource);
await writeFile(path.join(baselineRoot, 'core/scheduler.js'), baselineScheduler);
const { createTurtleArtwork: createBaseline } = await import(pathToFileURL(path.join(baselineRoot, 'public/turtle.js')).href);

const manifest = {
  evidenceKind: 'Actual TurtleArtwork Canvas2D calls executed by native Skia Canvas with a mocked browser host',
  notEvidenceFor: ['Browser rendering', 'CSS / responsive layout', 'Real keyboard or touch delivery', 'Browser accessibility', 'Device performance or heap behavior'],
  baselineCommit: baseline,
  workingTreeHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceSha256: {
    'src/public/turtle.ts': sha256(sourceText),
    'lib/public/turtle.js': sha256(await readFile(path.join(root, 'lib/public/turtle.js'))),
    'baseline/dist/turtle/runtime/public/turtle.js': sha256(baselineSource),
    'test/helpers/fake-browser.mjs': sha256(await readFile(path.join(root, 'test/helpers/fake-browser.mjs')))
  },
  runtime: { node: process.version, nativeCanvas: nativeVersion, platform: process.platform, arch: process.arch, dpr: 1 },
  font: 'Unmodified controller font stack; native host system font fallback. No bundled or downloaded fonts.',
  timing: '60 simulation ticks per second through shared scheduler harness; capture grouping never changes tick order. No wall-time performance claims.',
  generatedAt: new Date().toISOString(),
  frames: [],
  animations: []
};

/** Fake only the host resources. Every fillRect/fillText is the real controller. */
function mount(factory, options, width = 1008, height = 720, reducedMotion = false) {
  const host = fakeBrowser({ reducedMotion, dpr: 1 });
  const canvas = host.canvas(width, height), native = createCanvas(width, height);
  Object.defineProperties(canvas, {
    width: { get: () => native.width, set: value => { native.width = value; }, configurable: true },
    height: { get: () => native.height, set: value => { native.height = value; }, configurable: true }
  });
  canvas.getContext = kind => kind === '2d' ? native.getContext('2d') : null;
  const art = factory(canvas, options);
  host.intersect(canvas, true);
  // First callback initializes the controller's timestamp without advancing.
  host.frame(0);
  return {
    art, host, canvas, native,
    advance(ticks) {
      if (!Number.isInteger(ticks) || ticks < 0) throw new RangeError('Evidence ticks must be a nonnegative integer');
      // Public stage()/direct() clear the previous frame time; establish it.
      host.frame(0);
      while (ticks > 0) {
        const batch = Math.min(5, ticks);
        host.frame(batch * 1000 / 60); ticks -= batch;
      }
    },
    dispose() {
      art.dispose();
      if (host.pending !== 0 || canvas.listenerCount !== 0 || host.resizes.size !== 0 || host.intersections.size !== 0) {
        throw new Error('Evidence controller did not release its mocked host resources');
      }
    }
  };
}

const defaults = { scene: 'reef-passage', count: 3, columns: 160, rows: 64, showLabels: true, palette: 'brass' };
async function save(name, title, fixture, method) {
  const png = fixture.native.toBuffer('image/png');
  const file = `${name}.png`;
  await writeFile(path.join(output, file), png);
  const logical = fixture.art.getFrame();
  const record = {
    file, title, method, viewport: [fixture.native.width, fixture.native.height],
    options: fixture.art.getOptions(), status: fixture.art.getStatus(),
    director: fixture.art.getDirectorState?.() ?? null,
    pngSha256: sha256(png), logicalTextSha256: sha256(logical.text),
    occupiedCells: logical.cells.filter(cell => cell.glyph !== ' ').length,
    visibleOwners: [...new Set(logical.cells.map(cell => cell.ownerId).filter(id => typeof id === 'number'))].sort(),
    pendingSchedulerFrames: fixture.host.pending
  };
  manifest.frames.push(record);
  return record;
}

const old = mount(createBaseline, { columns: 120, rows: 50 });
old.advance(120);
await save('00-base-solo', 'BASE / centered single study', old, 'Pinned main controller, default settings, 120 ticks');
old.dispose();
const compatible = mount(createTurtleArtwork, { columns: 120, rows: 50 });
compatible.advance(120);
await save('01-new-solo', 'NEW / preserved solo study', compatible, 'New controller, unchanged legacy options, 120 ticks');
compatible.dispose();

for (const [index, act] of ['arrival', 'linger', 'departure'].entries()) {
  const fixture = mount(createTurtleArtwork, defaults);
  if (act === 'arrival') fixture.advance(300);
  else fixture.art.stage(act);
  await save(`0${index + 2}-reef-${act}`, `NEW / reef ${act}`, fixture, act === 'arrival'
    ? 'Actual arrival after 300 simulation ticks from construction (5 seconds)'
    : `Public stage('${act}') tableau; no hand-positioned animals`);
  fixture.dispose();
}

const meadow = mount(createTurtleArtwork, defaults);
meadow.art.direct('seagrass-stop'); meadow.art.update({ palette: 'lagoon' }); meadow.art.stage('linger'); meadow.advance(90);
await save('05-seagrass-stop', 'NEW / seagrass inspection', meadow, "direct('seagrass-stop'); stage('linger'); advance 90 ticks");
meadow.dispose();
const blue = mount(createTurtleArtwork, defaults);
blue.art.direct('blue-drift'); blue.art.update({ count: 1, palette: 'lagoon' }); blue.art.stage('linger'); blue.advance(150);
await save('06-blue-solitary', 'NEW / solitary blue drift', blue, "direct('blue-drift'); count 1; stage('linger'); advance 150 ticks");
blue.dispose();

const response = mount(createTurtleArtwork, defaults);
response.art.stage('linger'); response.art.select(1);
const selected = response.art.getDirectorState().members.find(member => member.id === 1);
response.art.inspect(selected.x - .25, selected.y + .16, 1);
response.advance(72);
await save('07-selected-inspect', 'NEW / Moss inspects the guide', response, 'Selected individual 1; inspect near its pose; response age 72 ticks');
response.advance(53);
await save('08-selected-bank', 'NEW / inspection becomes a bank', response, 'Same event log; response age 125 ticks');
response.advance(85);
await save('09-selected-recovery', 'NEW / rejoining the reef route', response, 'Same event log; response age 210 ticks');
response.advance(130);
await save('10-selected-return', 'NEW / route recovered', response, 'Same event log; response age 340 ticks');
response.dispose();

const mobile = mount(createTurtleArtwork, { ...defaults, columns: 100, rows: 40 }, 390, 280);
mobile.art.stage('linger');
await save('11-mobile-grid', 'NEW / 390px native rendering', mobile, '100×40 logical grid at 390×280; not a mobile browser screenshot');
mobile.dispose();
const maximum = mount(createTurtleArtwork, { ...defaults, count: 5, columns: 180, rows: 90 }, 1400, 1000);
maximum.art.stage('linger');
await save('12-five-travellers', 'NEW / bounded five travellers', maximum, 'Maximum count and 180×90 grid; 1400×1000 viewport');
maximum.dispose();
const still = mount(createTurtleArtwork, defaults, 1008, 720, true);
still.art.select(1); still.art.pulse(); still.advance(120);
await save('13-reduced-motion', 'NEW / deliberate still inspection', still, 'System reduced motion; deliberate pulse; attempted 120 ticks remain tick 0');
still.dispose();

async function contactSheet(filename, frames, columns, thumbWidth, thumbHeight) {
  const margin = 20, caption = 58, rows = Math.ceil(frames.length / columns), header = 78;
  const canvas = createCanvas(margin + columns * (thumbWidth + margin), header + margin + rows * (thumbHeight + caption + margin));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#071116'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ebc88c'; ctx.font = '21px monospace';
  ctx.fillText('SEA TURTLE / ACTUAL CONTROLLER RENDERING', margin, 31);
  ctx.fillStyle = '#9ab4bc'; ctx.font = '13px monospace';
  ctx.fillText('Native Canvas + mocked host. Not browser screenshots or a CSS layout test.', margin, 56);
  for (const [index, frame] of frames.entries()) {
    const x = margin + (index % columns) * (thumbWidth + margin);
    const y = header + margin + Math.floor(index / columns) * (thumbHeight + caption + margin);
    ctx.fillStyle = '#0e2028'; ctx.fillRect(x, y, thumbWidth, thumbHeight + caption);
    const img = await loadImage(path.join(output, frame.file));
    const scale = Math.min(thumbWidth / img.width, thumbHeight / img.height);
    ctx.drawImage(img, x + (thumbWidth - img.width * scale) / 2, y + (thumbHeight - img.height * scale) / 2, img.width * scale, img.height * scale);
    ctx.fillStyle = '#ebc88c'; ctx.font = '15px monospace'; ctx.fillText(frame.title, x + 12, y + thumbHeight + 25);
    ctx.fillStyle = '#9ab4bc'; ctx.font = '11px monospace';
    ctx.fillText(`${frame.options.columns}x${frame.options.rows} cells / tick ${frame.status.tick} / ${frame.director?.phase ?? frame.status.phase}`, x + 12, y + thumbHeight + 45);
  }
  const bytes = canvas.toBuffer('image/png'); await writeFile(path.join(output, filename), bytes);
  return { file: filename, sha256: sha256(bytes), frames: frames.map(frame => frame.file) };
}
manifest.sheets = [
  await contactSheet('before-after.png', [manifest.frames[0], manifest.frames[3]], 2, 680, 486),
  await contactSheet('contact-sheet.png', manifest.frames, 3, 450, 322)
];

if (args.includes('--gif')) {
  const framesDir = path.join(output, '.gif-frames'); await mkdir(framesDir, { recursive: true });
  const fixture = mount(createTurtleArtwork, { ...defaults, columns: 140, rows: 56 }, 784, 560);
  fixture.advance(240);
  const eventLog = [{ frame: 0, action: 'Capture starts after 240 arrival ticks from construction' }];
  for (let i = 0; i < 144; i++) {
    if (i === 60) {
      const member = fixture.art.getDirectorState().members[1];
      fixture.art.select(1); fixture.art.inspect(member.x - .25, member.y + .16, 1);
      eventLog.push({ frame: i, action: 'inspect', id: 1, x: member.x - .25, y: member.y + .16 });
    }
    await writeFile(path.join(framesDir, `${String(i).padStart(4, '0')}.png`), fixture.native.toBuffer('image/png'));
    fixture.advance(5);
  }
  fixture.dispose();
  const filename = 'reef-pass-and-inspection.gif';
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '12', '-i', path.join(framesDir, '%04d.png'), '-filter_complex', '[0:v]split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', '-loop', '-1', path.join(output, filename)], { maxBuffer: 2 * 1024 * 1024 });
  const bytes = await readFile(path.join(output, filename));
  manifest.animations.push({ file: filename, sha256: sha256(bytes), durationSeconds: 12, frames: 144, fps: 12, simulationTicksPerFrame: 5, speed: 1, events: eventLog, note: 'Normal-speed public controller capture. One play, no loop-seam claim.' });
  await rm(framesDir, { recursive: true, force: true });
}

await writeFile(path.join(output, 'render-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(output, 'README.md'), `# Sea turtle rendering evidence\n\nThese PNGs and the optional GIF are produced by the actual TurtleArtwork controller drawing to native Canvas2D through a mocked host. They are not browser screenshots. Native system font selection may differ from a browser.\n\nThe baseline is pinned to ${baseline}. Source hashes, exact options, scene poses, tick positions, event log, and native Canvas version are in render-manifest.json. Images are generated; no visual pass/fail verdict is embedded.\n\nReproduce after building:\n\n\`\`\`sh\nnode species/turtle/scripts/render-evidence.mjs /absolute/output --gif\n\`\`\`\n\nAn already installed @napi-rs/canvas is required. The GIF additionally uses an installed ffmpeg. The script does not install dependencies or launch a browser.\n`);
console.log(JSON.stringify({ output, frames: manifest.frames.length, sheets: manifest.sheets.map(sheet => sheet.file), animations: manifest.animations.map(item => item.file), sourceSha256: manifest.sourceSha256 }, null, 2));
