#!/usr/bin/env node
// Repeatable NATIVE CANVAS evidence. No browser DOM, layout or device claim.
// Requires an externally installed @napi-rs/canvas; no package changes are needed.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { nativeHost } from './native-host.mjs';
import { createMantaReef } from '../reef-artwork.mjs';
import { CuttlefishArtwork } from '../../../lib/animals/cuttlefish.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--(baseline|out|motion)=(.+)$/.exec(arg);
  if (!match) throw new Error(`Unknown argument: ${arg}`);
  return [match[1], match[2]];
}));
if (!args.baseline) throw new Error('Supply --baseline=/path/to/built/b8f222d-checkout');
const out = resolve(args.out || join(root, 'artifacts/manta-native'));
const baseline = resolve(args.baseline);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const source = await readFile(join(root, 'src/animals/manta.js'));
if (!source.equals(await readFile(join(root, 'lib/animals/manta.js')))) throw new Error('Build is stale: source/lib manta bytes differ.');
const { CuttlefishArtwork: BeforeArtwork } = await import(pathToFileURL(join(baseline, 'lib/animals/cuttlefish.js')));
await mkdir(out, { recursive: true });
const require = createRequire(import.meta.url);
const meta = {
  evidence: 'Native @napi-rs/canvas rasterization with mocked browser bookkeeping. NOT real browser screenshots.',
  node: process.version, canvasVersion: require('@napi-rs/canvas/package.json').version,
  baseline: 'b8f222dab868821f27bf2a64a98434f3483fc8e6', sourceSha256: hash(source),
  protocol: '240 fixed 1/60 s ticks for matched geometry; same options, dimensions, camera contract and no input. Intermediate presentation draws suppressed, simulation untouched. Final frame uses exact built renderer.',
  nativeShim: 'Caches integer glyph atlas crops to avoid native backend full-atlas snapshots per glyph. Direct/cached phone comparison: 1 of 873600 RGBA channels differed by 1/255. Geometry/cells unchanged.',
  captures: [], motion: []
};
function digest(art) {
  const h = createHash('sha256');
  for (const field of ['depth','tones','kinds','glyphs','owners']) {
    const a = art[field]; h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
  }
  return h.digest('hex');
}
async function save(name, canvas, art, extra = {}) {
  art.render();
  const bytes = await canvas.encode('png'); await writeFile(join(out, name), bytes);
  meta.captures.push({ file:name, width:art.width, height:art.height, pngSha256:hash(bytes),
    cellsSha256:digest(art), glyphs:art.glyphCount, samples:art.sampleCount, ...extra });
}
function tickWithoutDraws(art, ticks) {
  const render = art.render; art.render = () => {};
  try { for (let n = 0; n < ticks; n++) art.advance(1 / 60); }
  finally { art.render = render; }
}
const matched = { species:'manta', count:1, scene:'reactive', behaviors:['hover'],
  size:1.14, sizeVariation:0, density:1.3, ripple:1.05, depthStrength:1,
  motion:1.2, speed:1, followPointer:true, glow:false, seed:17,
  autoStart:false, paused:false, reducedMotion:'ignore', maxDpr:1 };
for (const [label, width, height] of [['desktop',1100,620],['phone',390,470]]) {
  for (const [variant, Constructor] of [['before',BeforeArtwork],['after',CuttlefishArtwork]]) {
    const {canvas, rasterStats, fonts} = nativeHost(width,height);
    const art = new Constructor(canvas,matched);
    tickWithoutDraws(art,240);
    await save(`${label}-geometry-${variant}-native.png`,canvas,art,{kind:'matched geometry',variant,ticks:240,options:matched,rasterStats:{...rasterStats}});
    if (!meta.fontFamilies) meta.fontFamilies = (Array.isArray(fonts) ? fonts : JSON.parse(Buffer.from(fonts).toString())).map(x => x.family);
    art.destroy();
  }
  const {canvas} = nativeHost(width,height);
  const art = createMantaReef(canvas,{}, {autoStart:false,reducedMotion:'ignore',maxDpr:1});
  for (const still of ['glide','anticipation','bank','recover']) {
    art.showReefStill(still);
    await save(`${label}-reef-${still}-native.png`,canvas,art,{kind:'authored representative still',state:art.getReef()});
  }
  art.bank(-1);
  await save(`${label}-reef-bank-left-native.png`,canvas,art,{kind:'authored opposite bank still',state:art.getReef()});
  art.destroy();
}
// Frames preserve real timing. A movie can be encoded at the declared fps;
// do not speed up the slow recovery. The ordered bank input occurs at t=2 s.
if (args.motion !== 'false') {
  for (const [name, seconds, fps, bankAt] of [['current',32,10,null],['bank',13,15,2]]) {
    const frameDir = join(out,`frames-${name}`); await mkdir(frameDir,{recursive:true});
    const {canvas} = nativeHost(720,480);
    const art = createMantaReef(canvas,{}, {autoStart:false,reducedMotion:'ignore',maxDpr:1});
    const states = [];
    for (let frame = 0; frame <= seconds*fps; frame++) {
      if (bankAt !== null && frame === bankAt*fps) art.bank(1);
      art.render();
      await writeFile(join(frameDir,`${String(frame).padStart(4,'0')}.png`),await canvas.encode('png'));
      states.push({frame,time:frame/fps,...art.getReef()});
      if (frame < seconds*fps) tickWithoutDraws(art,60/fps);
    }
    meta.motion.push({name,width:720,height:480,seconds,fps,frames:states.length,
      input:bankAt === null ? [] : [{time:bankAt,action:'bank',side:1}],states});
    art.destroy();
  }
}
await writeFile(join(out,'capture-manifest.json'),JSON.stringify(meta,null,2)+'\n');
console.log(JSON.stringify({out,captures:meta.captures.length,movies:meta.motion.length,sourceSha256:meta.sourceSha256},null,2));
