// Native Canvas review of the actual procedural source. This is not a browser
// screenshot or a redraw. No image-generation model is used for these frames.
//
// SKIA_CANVAS_MODULE=/absolute/path/to/skia-canvas \
// ANATOMY_FONT=/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf \
// node scripts/render-cuttlefish-head-evidence.mjs \
//   --base=../ascii-animals-eye-recess-base --out=../review-head/evidence
//
// --base MUST contain the delivered recessed-eye revision ed12581. Comparing
// this head revision against the older anatomy/main-only version is invalid.
// --case=<scenario-id> can render a single pair while reviewing a change.
// --crop=x,y,width,height chooses one shared desktop crop for the head/shoulder
// diagnostic. It never changes the render or selects different bounds per side.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fakeBrowser } from '../test/helpers/fake-browser.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const split = arg.indexOf('=');
  return [arg.slice(2, split), arg.slice(split + 1)];
}));
if (!args.base) throw new Error('Pass --base=<checkout of the delivered recessed-eye revision ed12581>.');
if (!process.env.SKIA_CANVAS_MODULE) throw new Error('Set SKIA_CANVAS_MODULE to an installed skia-canvas module.');
if (!process.env.ANATOMY_FONT) throw new Error('Set ANATOMY_FONT to the existing Liberation Mono system font.');

const root = fileURLToPath(new URL('..', import.meta.url));
const base = path.resolve(args.base), out = path.resolve(args.out || 'artifacts/cuttlefish-head');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fileHash = async filename => sha256(await readFile(filename));
const identity = {
  repository: 'https://github.com/castlemilk/ascii-animals',
  revision: 'Cuttlefish head volume and transition to the arm crown',
  baselineDescription: 'Just-delivered recessed-eye revision; not the earlier anatomy patch or older main.',
  baselineCommit: 'ed125811d41cb90b811c79ab7613ce06327bd4d1',
  baselineTree: 'b46dfb36336ecfec5a1be949e47db91950a00d24',
  baselineCuttlefishSha256: 'e8c289f7e1e63212571820c78520d553672c9ffb14f033477a1055a435a7c663',
  baselineMantaSha256: '239fe85eb0396b36e97be4b041fabfe77f0509d6827714ec79c472b7ece9f4ca',
};
assert.equal(await fileHash(path.join(base, 'src/animals/cuttlefish.js')), identity.baselineCuttlefishSha256,
  'The BEFORE source must be the delivered recessed-eye revision ed12581, not earlier anatomy or main.');
assert.equal(await fileHash(path.join(base, 'src/animals/manta.js')), identity.baselineMantaSha256,
  'The BEFORE source must preserve the delivered manta anatomy.');
const sourceHashes={};
for (const relative of ['src/animals/cuttlefish.js','src/animals/manta.js','src/animals/octopus.js','src/core/scheduler.js','test/helpers/fake-browser.mjs']) {
  sourceHashes[relative]={before:await fileHash(path.join(base,relative)),after:await fileHash(path.join(root,relative))};
}
const scriptSha256=await fileHash(fileURLToPath(import.meta.url));

const { Canvas, FontLibrary } = createRequire(import.meta.url)(process.env.SKIA_CANVAS_MODULE);
FontLibrary.use('Liberation Mono', [process.env.ANATOMY_FONT]);
const createCanvas = (width, height) => new Canvas(width, height);
const encodePNG = canvas => canvas.toBuffer('png');
const Before = (await import(pathToFileURL(path.join(base, 'src/animals/cuttlefish.js')).href)).CuttlefishArtwork;
const After = (await import(pathToFileURL(path.join(root, 'src/animals/cuttlefish.js')).href)).CuttlefishArtwork;
await mkdir(out, { recursive: true });

function nativeHost(width, height) {
  const browser = fakeBrowser();
  browser.document.createElement = () => createCanvas(1, 1);
  const canvas = createCanvas(width, height), target = browser.canvas(width, height);
  Object.assign(canvas, { ownerDocument: browser.document,
    getBoundingClientRect: () => target.getBoundingClientRect(),
    addEventListener: (...eventArgs) => target.addEventListener(...eventArgs),
    removeEventListener: (...eventArgs) => target.removeEventListener(...eventArgs),
    dispatchEvent: () => true });
  return canvas;
}

const normalize = values => {
  const length = Math.hypot(...values);
  return values.map(value => value / length);
};
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
function viewMatrix(direction) {
  const view = normalize(direction);
  if (Math.abs(view[2]) > .99) return [1,0,0, 0,1,0, 0,0,1];
  const right = normalize(cross(view, [0,0,1]));
  return [...right, ...cross(view, right), ...view];
}

function installPose(art, scenario) {
  if (!scenario.direction) return;
  const originalCamera = art._camera.bind(art), rotation = viewMatrix(scenario.direction);
  art._camera = time => {
    originalCamera(time);
    [art.r00,art.r01,art.r02,art.r10,art.r11,art.r12,art.r20,art.r21,art.r22] = rotation;
    [art.worldX,art.worldY,art.worldZ] = scenario.position || [-.45,0,-.6];
    // Native single-animal demo scalar; only the explicitly labelled resolving
    // diagnostic increases it. Sampling LOD follows the renderer's thresholds.
    art.scale = scenario.scale || Math.min(art.width/7.4, art.height/4.6);
    art.objectScale = scenario.objectScale || scenario.size || 1.2;
    art.perspectiveStrength = .2;
    const projectedRadius = art.objectScale * art.scale / Math.max(.24, 1-art.worldZ*art.perspectiveStrength);
    art.geometryStep = projectedRadius > 105 ? 1 : projectedRadius > 46 ? 2 : 3;
    art.encounterGrip = 0; art.encounterFront = 0;
    art.subjectVisibility = 1;
    for (const [prefix, vector] of [['l',[-.38,-.48,.790]], ['h',[-.204,-.258,.944]]]) {
      art[`${prefix}x`] = art.r00*vector[0]+art.r10*vector[1]+art.r20*vector[2];
      art[`${prefix}y`] = art.r01*vector[0]+art.r11*vector[1]+art.r21*vector[2];
      art[`${prefix}z`] = art.r02*vector[0]+art.r12*vector[1]+art.r22*vector[2];
    }
    art.vx=art.r20; art.vy=art.r21; art.vz=art.r22;
  };
}

function captureRasterizedFish(art) {
  // render() reactivates fish[0] after drawing, restoring its nominal size.
  // Capture the actual draw camera inside _rasterize, while all per-fish
  // transforms (including diagnostic overrides) are still in effect.
  const snapshots=[],original=art._rasterize;
  art._rasterize=function(...parameters) {
    snapshots.push({
      id:this.activeFish.id,species:this.activeFish.species,nominalSize:this.activeFish.size,
      camera:{rotation:[this.r00,this.r01,this.r02,this.r10,this.r11,this.r12,this.r20,this.r21,this.r22],
        position:[this.worldX,this.worldY,this.worldZ],scale:this.scale,objectScale:this.objectScale,
        perspectiveStrength:this.perspectiveStrength},
      lightLocal:[this.lx,this.ly,this.lz],halfwayLocal:[this.hx,this.hy,this.hz],
      grid:[this.cols,this.rows],cell:[this.cellW,this.cellH],geometryStep:this.geometryStep,
      samples:this.sampleCount,
      state:{sceneTime:this.sceneTime,encounterGrip:this.encounterGrip,encounterFront:this.encounterFront,
        startleTension:this.startleTension,escapeAmount:this.escapeAmount,subjectVisibility:this.subjectVisibility,
        phase:this.phase},
    });
    return original.apply(this,parameters);
  };
  return snapshots;
}

const orientations = [
  { id:'broadside', title:'Broadside', direction:[0,1,0] },
  { id:'three-quarter', title:'Three-quarter', direction:[.60,1,.25] },
  { id:'head-on', title:'Head-on', direction:[1,0,0] },
  { id:'dorsal', title:'Dorsal', direction:[0,0,1] },
];
const scenarios = [];
for (const mode of ['ascii','points']) {
  for (const view of orientations) scenarios.push({ ...view,
    id:`desktop-${view.id}-${mode}`, mode, group:'orientations', time:2.4,
    title:`${view.title} · ${mode} · native demo scalar / 1:1 canvas pixels` });
  scenarios.push(
    { id:`scene-reactive-${mode}`, title:`Reactive scene · ${mode} · original camera`, mode, time:2.4, group:'scenes' },
    { id:`scene-encounter-${mode}`, title:`Close encounter · ${mode} · original camera / arms may obscure the eyes`,
      mode, time:11.5, scene:'encounter', size:1, group:'scenes' },
    { id:`default-school-${mode}`, title:`Default demo school · ${mode} · four animals / original swim-by camera`,
      mode, time:8, demoDefault:true, group:'default-school' },
    { id:`mobile-390-${mode}`, title:`390px page / 349 × 440 canvas · ${mode} · original reactive camera`,
      mode, time:2.4, width:349, height:440, size:1, group:'mobile' },
    { id:`mobile-prior-size-${mode}`, title:`Prior compact canvas / 390 × 320 · ${mode} · original reactive camera`,
      mode, time:2.4, width:390, height:320, size:.7, group:'compact' },
    { id:`manta-reactive-${mode}`, title:`Manta reactive · ${mode} · unchanged-source invariant`,
      species:'manta', mode, time:3.2, group:'manta' },
    { id:`manta-encounter-${mode}`, title:`Manta encounter · ${mode} · unchanged-source invariant`,
      species:'manta', mode, time:8, scene:'encounter', group:'manta' },
    { id:`diagnostic-resolving-${mode}`, title:`Resolving diagnostic · ${mode} · scale 400 / object size 1 (not demo size)`,
      direction:[0,1,.18], mode, time:2.4, scale:400, objectScale:1,
      position:[-.48,.085,-.6], glow:false, density:1.5, group:'resolving' },
  );
}
scenarios.push({ id:'recess-canonical-replay', title:'Delivered recessed-eye render replay · separate provenance check',
  time:2.4, size:1.2, glow:false, density:1.5, mode:'ascii', group:'provenance',
  expectedBeforeSha256:'4db281f1a36898359a24c807b1129235df618532a26d13412a29a764477b0ec4' });
if (args.case && !scenarios.some(scenario => scenario.id === args.case)) throw new Error(`Unknown scenario: ${args.case}`);

const records = [], outputs = [], captures = new Map(), mantaComparisons = [], replay = [];
async function save(filename, canvas) {
  const png = await encodePNG(canvas);
  await writeFile(path.join(out, filename), png);
  outputs.push({ file:filename, width:canvas.width, height:canvas.height, sha256:sha256(png), bytes:png.length });
  return png;
}
function label(ctx, text, x, y, size=16, color='#cbdce0') {
  ctx.fillStyle=color; ctx.font=`${size}px Liberation Mono`; ctx.fillText(text,x,y);
}
async function contactSheet(filename, title, selected) {
  const width = Math.max(...selected.map(row => row.scenario.width || 1000));
  const heights = selected.map(row => (row.scenario.height || 650)+38);
  const sheet=createCanvas(width*2, 76+heights.reduce((a,b)=>a+b,0)),ctx=sheet.getContext('2d');
  ctx.fillStyle='#10181c';ctx.fillRect(0,0,sheet.width,sheet.height);
  label(ctx,title,18,28,19);
  label(ctx,'BEFORE · recessed eyes ed12581',18,56,13,'#9cb7bd');
  label(ctx,'AFTER · head volume revision',width+18,56,13,'#9cb7bd');
  ctx.imageSmoothingEnabled=false;
  let top=76;
  for (const { scenario, canvases } of selected) {
    label(ctx,scenario.title,18,top+22,13);
    for (let i=0;i<2;i++) ctx.drawImage(canvases[i],i*width,top+38);
    top+=(scenario.height||650)+38;
  }
  await save(filename,sheet);
}

for (const scenario of scenarios.filter(s => !args.case || s.id === args.case)) {
  const width=scenario.width||1000,height=scenario.height||650;
  const options=scenario.demoDefault ? {
    scene:'swimby',palette:'lagoon',speed:1.05,ripple:1.3,density:1.1,motion:1.2,depthStrength:1.2,
    mode:scenario.mode,followPointer:false,glow:true,count:4,formation:'independent',size:.7,
    sizeVariation:.45,spacing:1,reverse:false,showLabels:false,behaviors:['auto','auto','auto','auto'],
    seed:0,autoStart:false,paused:true,reducedMotion:'ignore',
  } : { species:scenario.species||'cuttlefish',scene:scenario.scene||'reactive',count:1,
    size:scenario.size||1.2,sizeVariation:0,seed:7,density:scenario.density||1.1,
    glow:scenario.glow??true,palette:'lagoon',mode:scenario.mode,autoStart:false,paused:true,reducedMotion:'ignore' };
  const canvases=[],pngs=[];
  for (const [version,Artwork] of [['before',Before],['after',After]]) {
    const canvas=nativeHost(width,height),art=new Artwork(canvas,options);
    art.time=scenario.time;art.elapsed=scenario.time;
    for (const fish of art.fish) fish.sceneTime=scenario.time;
    const renderedFish=captureRasterizedFish(art);
    installPose(art,scenario);art.render();
    assert(renderedFish.length>0,`${scenario.id}: no fish reached rasterization`);
    const single=renderedFish.length===1?renderedFish[0]:null;
    const png=await save(`${scenario.id}-${version}.png`,canvas);
    records.push({ scenario:scenario.id,version,file:`${scenario.id}-${version}.png`,
      options,time:scenario.time,width,height,cssPixelsAtDpr1:true,
      view:scenario.direction ? 'controlled orientation; actual renderer; native demo scalar unless resolving diagnostic' : 'unchanged production scene camera',
      camera:single?.camera??null,lightLocal:single?.lightLocal??null,halfwayLocal:single?.halfwayLocal??null,
      grid:[art.cols,art.rows],cell:[art.cellW,art.cellH],geometryStep:single?.geometryStep??null,
      samples:renderedFish.reduce((sum,fish)=>sum+fish.samples,0),sha256:sha256(png),
      renderedFish });
    canvases.push(canvas);pngs.push(png);art.destroy();
  }
  captures.set(scenario.id,{scenario,canvases});
  if (scenario.species==='manta') {
    const identical=pngs[0].equals(pngs[1]);
    mantaComparisons.push({scenario:scenario.id,byteIdentical:identical,beforeSha256:sha256(pngs[0]),afterSha256:sha256(pngs[1])});
    assert(identical,`${scenario.id}: manta pixels changed`);
  }
  if (scenario.expectedBeforeSha256) {
    const observed=sha256(pngs[0]);
    replay.push({scenario:scenario.id,expected:scenario.expectedBeforeSha256,observed,exactMatch:observed===scenario.expectedBeforeSha256});
    assert.equal(observed,scenario.expectedBeforeSha256,'The known prior render must reproduce exactly with this backend/font.');
  }
}

if (!args.case) {
  for (const mode of ['ascii','points']) {
    for (const view of ['broadside','three-quarter']) {
      await contactSheet(`review-${view}-${mode}-comparison.png`,
        `Cuttlefish · ${view} / ${mode} · native 1000 × 650 comparison`,
        [captures.get(`desktop-${view}-${mode}`)]);
    }
    await contactSheet(`desktop-${mode}-contact-sheet.png`,
      `Cuttlefish · ${mode} · four matched views / each canvas 1000 × 650, unscaled`,
      orientations.map(view=>captures.get(`desktop-${view.id}-${mode}`)));
    await contactSheet(`scene-${mode}-contact-sheet.png`,
      `Cuttlefish · ${mode} · existing scene cameras / 1000 × 650, unscaled`,
      ['reactive','encounter'].map(scene=>captures.get(`scene-${scene}-${mode}`)));
    await contactSheet(`default-school-${mode}-comparison.png`,
      `Cuttlefish · default demo school / ${mode} · 1000 × 650, unscaled`,
      [captures.get(`default-school-${mode}`)]);
    await contactSheet(`mobile-${mode}-contact-sheet.png`,
      `Cuttlefish · ${mode} · mobile and compact canvases, unscaled`,
      [captures.get(`mobile-390-${mode}`),captures.get(`mobile-prior-size-${mode}`)]);
    await contactSheet(`diagnostic-resolving-${mode}-comparison.png`,
      `Cuttlefish · ${mode} · resolving diagnostic only / scale 400`,[captures.get(`diagnostic-resolving-${mode}`)]);
  }
  // These crops are taken from the exact desktop-scale frames above, with no
  // rerender, interpolation or selective edits. Only nearest-neighbour pixel
  // enlargement and external labels are applied.
  // The default includes the anterior mantle, shoulder, head and arm roots.
  // A reviewer can choose different matched bounds after inspecting the raw
  // frames; those exact bounds are always recorded in the output manifest.
  const crop=args.crop?args.crop.split(',').map(Number):[300,200,380,240];
  assert(crop.length===4&&crop.every(Number.isInteger)&&crop[0]>=0&&crop[1]>=0
    &&crop[2]>0&&crop[3]>0&&crop[0]+crop[2]<=1000&&crop[1]+crop[3]<=650,
    'The crop must be four integers inside the native 1000 × 650 desktop frame.');
  const enlarge=3,displayW=crop[2]*enlarge,displayH=crop[3]*enlarge;
  const sheet=createCanvas(displayW*2,100+(displayH+38)*2),ctx=sheet.getContext('2d');
  ctx.fillStyle='#10181c';ctx.fillRect(0,0,sheet.width,sheet.height);
  label(ctx,'Same demo pixels · head and shoulder / 3× nearest-neighbour enlargement',18,28,16);
  label(ctx,'BEFORE · recessed eyes ed12581',18,57,13,'#9cb7bd');
  label(ctx,'AFTER · head volume revision',displayW+18,57,13,'#9cb7bd');
  label(ctx,`Source crop [${crop.join(', ')}] from the 1000 × 650 broadside frame. No new zoom.`,18,82,12,'#9cb7bd');
  ctx.imageSmoothingEnabled=false;
  for (const [row,mode] of ['ascii','points'].entries()) {
    const {canvases}=captures.get(`desktop-broadside-${mode}`),top=100+row*(displayH+38);
    label(ctx,mode.toUpperCase(),18,top+25,14);
    for(let i=0;i<2;i++)ctx.drawImage(canvases[i],...crop,i*displayW,top+38,displayW,displayH);
  }
  await save('diagnostic-demo-pixel-crop.png',sheet);
  records.push({kind:'crop',file:'diagnostic-demo-pixel-crop.png',sources:['desktop-broadside-ascii','desktop-broadside-points'],
    crop,enlargement:enlarge,interpolation:'nearest-neighbour; exact source pixels; labels outside image'});
} else {
  await contactSheet(`${args.case}-comparison.png`,'Matched recessed-eye baseline / head-volume revision',[captures.get(args.case)]);
}

for (const [relative,hashes] of Object.entries(sourceHashes)) {
  assert.equal(await fileHash(path.join(base,relative)),hashes.before,`BEFORE source changed during capture: ${relative}`);
  assert.equal(await fileHash(path.join(root,relative)),hashes.after,`AFTER source changed during capture: ${relative}`);
}
assert.equal(await fileHash(fileURLToPath(import.meta.url)),scriptSha256,'Evidence script changed during capture.');
const report={schema:1,backend:'skia-canvas; actual source renderer; simulated DOM/lifecycle; not browser screenshots',
  node:process.version,generatedAt:new Date().toISOString(),base,source:root,identity,sourceHashes,
  scriptSha256,font:{path:process.env.ANATOMY_FONT,sha256:await fileHash(process.env.ANATOMY_FONT)},
  framing:{ desktop:'1000 × 650 native canvas pixels, no scaling in contact sheets; density 1.1 and glow true match demo defaults.',
    defaultSchool:'Exact dist/app.js default options, plus capture-only paused/autoStart/reducedMotion overrides; time 8 seconds. Points frame changes only the presentation mode. Constructor seed defaults to 0.',
    orientation:'Controlled broadside, three-quarter, head-on and dorsal camera rotations. The original animation time and renderer are retained. Scalar = min(1000/7.4,650/4.6) = 135.135; size 1.2; perspective .2.',
    mobile:'390px viewport: main 5% side padding and studio borders yield 349px canvas width; CSS max-width:390px selects 440px scene height. This is CSS-derived sizing, not measured browser layout.',
    priorContinuity:'390 × 320 compact canvas at size .7, retained from prior evidence; not claimed to be current page CSS height.',
    resolving:'Explicit diagnostic-only scale 400 and objectScale 1; never presented as normal demo size.',
    cameraMetadata:'Per-fish camera/state snapshots are captured inside _rasterize before render() restores fish[0]. Nominal option size and actual camera objectScale are recorded separately. Top-level camera is supplied only for single-fish snapshots.' },
  browserAndCIGaps:['No real browser screenshots or live input/device acceptance from this script.','Native glyph pixels are backend/font-specific.','No CI execution or deployment is implied.'],
  mantaComparisons,priorRenderReplay:replay,records,outputs};
await writeFile(path.join(out,args.case?`capture-settings-${args.case}.json`:'capture-settings.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output:out,scenarios:captures.size,renders:records.filter(r=>r.version).length,
  mantaByteIdentical:mantaComparisons.every(r=>r.byteIdentical),priorReplay:replay,browser:false}));
