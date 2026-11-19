// Matched native-Canvas evidence from the actual renderer, not a browser test.
// Optional review dependency: skia-canvas or @napi-rs/canvas (not added to the library).
// SKIA_CANVAS_MODULE / CANVAS_MODULE may name an already-installed module path.
// node scripts/render-anatomy-evidence.mjs --base=../ascii-animals-base --out=../anatomy-review/evidence
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fakeBrowser } from '../test/helpers/fake-browser.mjs';

let createCanvas, encodePNG, backend;
if (process.env.SKIA_CANVAS_MODULE) {
  const { Canvas, FontLibrary } = createRequire(import.meta.url)(process.env.SKIA_CANVAS_MODULE);
  createCanvas = (w,h) => new Canvas(w,h);
  encodePNG = canvas => canvas.toBuffer('png');
  backend = 'skia-canvas';
  if (process.env.ANATOMY_FONT) FontLibrary.use('Liberation Mono', [process.env.ANATOMY_FONT]);
} else {
  const api = await import(process.env.CANVAS_MODULE || '@napi-rs/canvas');
  createCanvas = api.createCanvas;
  encodePNG = canvas => canvas.toBuffer('image/png');
  backend = '@napi-rs/canvas';
  if (process.env.ANATOMY_FONT) api.GlobalFonts.registerFromPath(process.env.ANATOMY_FONT, 'Liberation Mono');
}
// Prefer the renderer's existing open system-font fallback when present. Font
// files are never copied or bundled; pixel evidence is backend/font specific.
const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
if (!args.base) throw new Error('Pass --base=<clean checkout of the exact recorded base>.');
const root = fileURLToPath(new URL('..', import.meta.url));
const base = path.resolve(args.base), out = path.resolve(args.out || 'artifacts/anatomy');
await mkdir(out, { recursive: true });
const Before = (await import(pathToFileURL(path.join(base, 'src/animals/cuttlefish.js')).href)).CuttlefishArtwork;
const After = (await import(pathToFileURL(path.join(root, 'src/animals/cuttlefish.js')).href)).CuttlefishArtwork;

function nativeHost(width, height) {
  const h = fakeBrowser();
  h.document.createElement = () => createCanvas(1, 1);
  const canvas = createCanvas(width, height);
  const target = h.canvas(width, height);
  Object.assign(canvas, { ownerDocument: h.document,
    getBoundingClientRect: () => target.getBoundingClientRect(),
    addEventListener: (...args) => target.addEventListener(...args),
    removeEventListener: (...args) => target.removeEventListener(...args),
    dispatchEvent: () => true });
  return { canvas, h };
}

function pose(a, s) {
  const original = a._camera.bind(a);
  a._camera = t => {
    original(t);
    if (!s.rotation) return;
    [a.r00,a.r01,a.r02,a.r10,a.r11,a.r12,a.r20,a.r21,a.r22] = s.rotation;
    [a.worldX,a.worldY,a.worldZ] = s.position || [0,0,0];
    a.objectScale = s.objectScale || 1; a.scale = s.scale || 150;
    a.perspectiveStrength = s.perspective || 0;
    a.geometryStep = 1; a.encounterGrip = 0; a.encounterFront = 0;
    a.subjectVisibility = 1;
    for (const [prefix, vector] of [['l',[-.38,-.48,.790]],['h',[-.204,-.258,.944]]]) {
      a[`${prefix}x`] = a.r00*vector[0]+a.r10*vector[1]+a.r20*vector[2];
      a[`${prefix}y`] = a.r01*vector[0]+a.r11*vector[1]+a.r21*vector[2];
      a[`${prefix}z`] = a.r02*vector[0]+a.r12*vector[1]+a.r22*vector[2];
    }
    a.vx=a.r20; a.vy=a.r21; a.vz=a.r22;
  };
}

const side = [1,0,0, 0,0,-1, 0,1,0];
const otherSide = [-1,0,0, 0,0,-1, 0,-1,0];
const dorsal = [1,0,0, 0,1,0, 0,0,1];
const scenarios = [
  { id:'manta-demo', label:'Manta · existing reactive demo pose', species:'manta', time:3.2, size:1.2 },
  { id:'manta-points', label:'Manta · identical pose in points mode', species:'manta', time:3.2, size:1.2, mode:'points' },
  { id:'cuttlefish-demo', label:'Cuttlefish · existing reactive demo pose', species:'cuttlefish', time:2.4, size:1.2 },
  { id:'cuttlefish-encounter', label:'Cuttlefish · existing frontal encounter at 11.5 seconds', species:'cuttlefish', time:11.5, scene:'encounter', size:1 },
  { id:'cuttlefish-side', label:'Cuttlefish · diagnostic lateral view', species:'cuttlefish', time:2.4, rotation:side, scale:160 },
  { id:'cuttlefish-other-side', label:'Cuttlefish · diagnostic opposite lateral view', species:'cuttlefish', time:2.4, rotation:otherSide, scale:160 },
  { id:'cuttlefish-dorsal', label:'Cuttlefish · diagnostic dorsal view', species:'cuttlefish', time:2.4, rotation:dorsal, scale:160 },
  { id:'cuttlefish-eye', label:'Cuttlefish · lateral eye at resolving scale (diagnostic close-up)', species:'cuttlefish', time:2.4, rotation:side, scale:700, position:[-.48,.085,0] },
  { id:'cuttlefish-eye-points', label:'Cuttlefish · same lateral eye / points mode', species:'cuttlefish', time:2.4, rotation:side, scale:700, position:[-.48,.085,0], mode:'points' },
  { id:'cuttlefish-detail', label:'Cuttlefish · lateral eye / 3× pixel enlargement', species:'cuttlefish', time:2.4, rotation:side, scale:260, position:[-.48,.085,0], crop:[370,160,260,260], enlarge:3 },
  { id:'cuttlefish-small', label:'Cuttlefish · 390 × 320 mobile-size canvas', species:'cuttlefish', time:2.4, size:.7, width:390, height:320 },
];
const records = [];
for (const s of scenarios.filter(s => !args.case || s.id === args.case)) {
  const width = s.width || 1000, height = s.height || 650;
  const options = { species:s.species, scene:s.scene || 'reactive', count:1, size:s.size || 1,
    sizeVariation:0, seed:7, density:1.5, glow:false, mode:s.mode || 'ascii',
    autoStart:false, paused:true, reducedMotion:'ignore' };
  const canvases = [];
  for (const [name, Artwork] of [['before',Before],['after',After]]) {
    const { canvas } = nativeHost(width,height);
    const a = new Artwork(canvas,options);
    a.time=s.time; a.elapsed=s.time;
    for (const fish of a.fish) fish.sceneTime=s.time;
    pose(a,s); a.render();
    const png = await encodePNG(canvas);
    await writeFile(path.join(out,`${s.id}-${name}.png`),png);
    records.push({ scenario:s.id, version:name, options, time:s.time,
      view:s.rotation ? 'diagnostic camera override; actual geometry and renderer' : 'existing scene camera',
      rotation:s.rotation, position:s.position, scale:s.scale, crop:s.crop, enlarge:s.enlarge,
      width,height, grid:[a.cols,a.rows], cell:[a.cellW,a.cellH], geometryStep:a.geometryStep,
      samples:a.sampleCount, sha256:createHash('sha256').update(png).digest('hex') });
    canvases.push(canvas);
    a.destroy();
  }
  const displayW = s.crop ? s.crop[2] * s.enlarge : width;
  const displayH = s.crop ? s.crop[3] * s.enlarge : height;
  const pair=createCanvas(displayW*2,displayH+76), ctx=pair.getContext('2d');
  ctx.fillStyle='#10181c';ctx.fillRect(0,0,pair.width,pair.height);
  ctx.fillStyle='#d5e7e9';ctx.font='19px sans-serif';ctx.fillText(s.label,24,27);
  ctx.font='13px monospace';ctx.fillStyle='#9cb7bd';
  ctx.fillText('BEFORE · b8f222d',24,58);ctx.fillText('AFTER · local anatomy patch',displayW+24,58);
  ctx.imageSmoothingEnabled = false;
  for (let i=0;i<2;i++) {
    if (s.crop) ctx.drawImage(canvases[i],...s.crop,i*displayW,76,displayW,displayH);
    else ctx.drawImage(canvases[i],i*displayW,76);
  }
  await writeFile(path.join(out,`${s.id}-comparison.png`),await encodePNG(pair));
}
await writeFile(path.join(out,args.case ? `capture-settings-${args.case}.json` : 'capture-settings.json'),JSON.stringify({
  backend:`${backend}; actual source renderer; simulated DOM/lifecycle; not a browser screenshot`,
  node:process.version,base,source:root,records },null,2)+'\n');
console.log(JSON.stringify({ output:out, scenarios:records.length/2, renders:records.length, browser:false }));
