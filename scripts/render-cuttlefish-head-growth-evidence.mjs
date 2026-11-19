// Native Canvas evidence for V4 progressive head widening, compared with the
// exact delivered V3 tree. Actual source renderer + simulated DOM; not browser
// screenshots. No geometry source is rewritten by this script.
//
// From a complete applied repository (the default AFTER source is this repo):
// SKIA_CANVAS_MODULE=/absolute/path/to/skia-canvas \
// ANATOMY_FONT=/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf \
// node scripts/render-cuttlefish-head-growth-evidence.mjs \
//   --base=/path/to/applied-v3 --out=/path/to/new-evidence \
//   --expect-source-sha=<after-cuttlefish-sha256>
//
// BEFORE may be a clean V3 checkout OR a worktree with the V3 patch staged on
// another HEAD: its index tree must equal the approved V3 tree, and its working
// files must match that index. The private local V3 commit is only a reference
// label, never a required Git object or required observed HEAD.
//
// --source=<repo> overrides the default AFTER repository.
// --case=<id>[,<id>] captures a small set, e.g.
//   --case=desktop-broadside-ascii,desktop-dorsal-points
// Omit --case for the complete suite. A full run requires a fresh output folder.
// --expect-source-tree=<tree> optionally pins a staged AFTER snapshot by index
// tree; --final-commit=<sha> optionally pins a clean commit for local review.
// Neither option requires the historical private commit for patch replay.
// --check-only=true validates inputs and prints their identities without loading
// Skia, constructing a renderer, writing an output directory or capturing pixels.
// --crop=x,y,width,height sets shared native-pixel diagnostic crop bounds.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const split = arg.indexOf('=');
  if (!arg.startsWith('--') || split < 3) throw new Error('Use --name=value arguments.');
  return [arg.slice(2, split), arg.slice(split + 1)];
}));
for (const key of ['base','out']) if (!args[key]) throw new Error(`Pass --${key}=<path>; baseline must be the exact delivered V3 tree.`);
const checkOnly=args['check-only']==='true';

const root = args.source ? path.resolve(args.source) : fileURLToPath(new URL('..',import.meta.url));
const base = path.resolve(args.base), out = path.resolve(args.out);
const git = (cwd,...parts) => execFileSync('git',parts,{cwd,encoding:'utf8'}).trim();
const gitState = cwd => ({head:git(cwd,'rev-parse','HEAD'),headTree:git(cwd,'rev-parse','HEAD^{tree}'),
  indexTree:git(cwd,'write-tree'),workingTreeStatus:git(cwd,'status','--porcelain'),
  unstagedPaths:git(cwd,'diff','--name-only').split('\n').filter(Boolean),
  untrackedPaths:git(cwd,'ls-files','--others','--exclude-standard').split('\n').filter(Boolean)});
function assertWorkingFilesMatchIndex(state,label) {
  assert.equal(state.unstagedPaths.length,0,`${label}: working files must match the staged index; stage the exact patch first.`);
  assert.equal(state.untrackedPaths.length,0,`${label}: unexpected untracked files make the snapshot ambiguous.`);
}
const baselineGit = gitState(base), sourceGitAtStart = gitState(root);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fileHash = async filename => sha256(await readFile(filename));
const identity = {
  repository: 'https://github.com/castlemilk/ascii-animals',
  revision: 'V4 progressive head widening',
  stage: args['final-commit'] ? 'final committed snapshot' : args['expect-source-tree'] ? 'applied snapshot pinned by index tree' : 'candidate; actual source hash recorded',
  baselineDescription: 'Exact delivered V3 rounded crown and roots; comparison is V3 versus V4, not older V2 or main.',
  baselineCommit: '8931bcc568cb5272f3a7b5eab0532c6c95c92858',
  baselineTree: 'ef45da059fb583c86e3561eaeb5b3bf810fc244f',
  baselineCuttlefishSha256: 'cd1dc0d1cb60310afdaa86f2743be336fa97078a464f74511d6bf7af2d0d0f10',
  baselineMantaSha256: '239fe85eb0396b36e97be4b041fabfe77f0509d6827714ec79c472b7ece9f4ca',
};
assert.equal(baselineGit.indexTree,identity.baselineTree,'BEFORE index must match the exact delivered V3 tree. A matching private HEAD commit is not required.');
assertWorkingFilesMatchIndex(baselineGit,'BEFORE');
identity.baselineVerification='Exact staged index tree + source hashes; observed HEAD is recorded independently.';
if(args['expect-source-tree']) {
  assert.equal(sourceGitAtStart.indexTree,args['expect-source-tree'],'AFTER index differs from the requested tree.');
  assertWorkingFilesMatchIndex(sourceGitAtStart,'AFTER');
}
if (args['final-commit']) {
  assert.equal(sourceGitAtStart.head,args['final-commit']);
  assert.equal(sourceGitAtStart.workingTreeStatus,'','Final AFTER snapshot must be clean.');
}
assert.equal(await fileHash(path.join(base, 'src/animals/cuttlefish.js')), identity.baselineCuttlefishSha256,
  'The BEFORE source must be delivered V3 8931bcc, not V2 or main.');
assert.equal(await fileHash(path.join(base, 'src/animals/manta.js')), identity.baselineMantaSha256,
  'The BEFORE source must preserve the delivered manta anatomy.');
const sourceHashes={};
for (const relative of ['src/animals/cuttlefish.js','src/animals/manta.js','src/animals/octopus.js','src/core/scheduler.js','test/helpers/fake-browser.mjs']) {
  sourceHashes[relative]={before:await fileHash(path.join(base,relative)),after:await fileHash(path.join(root,relative))};
}
const scriptSha256=await fileHash(fileURLToPath(import.meta.url));
if (args['expect-source-sha']) assert.equal(sourceHashes['src/animals/cuttlefish.js'].after,args['expect-source-sha'],'AFTER candidate source differs from requested SHA256.');
identity.afterCommitPinned=args['final-commit']||null;
identity.afterIndexTreePinned=args['expect-source-tree']||null;
identity.afterSourceSha256=sourceHashes['src/animals/cuttlefish.js'].after;
identity.afterDiffersFromBaseline=identity.afterSourceSha256!==identity.baselineCuttlefishSha256;

if(checkOnly) {
  console.log(JSON.stringify({checkOnly:true,rendererConstructed:false,outputWritten:false,identity,
    base,source:root,requestedOutput:out,baselineGit,sourceGitAtStart,sourceHashes,scriptSha256},null,2));
  process.exit(0);
}
if (!process.env.SKIA_CANVAS_MODULE) throw new Error('Set SKIA_CANVAS_MODULE to an installed skia-canvas module.');
if (!process.env.ANATOMY_FONT) throw new Error('Set ANATOMY_FONT to the existing Liberation Mono system font.');
const { fakeBrowser } = await import(pathToFileURL(path.join(root,'test/helpers/fake-browser.mjs')).href);
assert.equal(await fileHash(process.env.ANATOMY_FONT),'5883330d94debd992952cd8f0571b225f478c2d797d3f36c7521b0a5c9bde0f2','Use the exact Liberation Mono font from the delivered evidence.');
const { Canvas, FontLibrary, loadImage } = createRequire(import.meta.url)(process.env.SKIA_CANVAS_MODULE);
FontLibrary.use('Liberation Mono', [process.env.ANATOMY_FONT]);
const createCanvas = (width, height) => new Canvas(width, height);
const encodePNG = canvas => canvas.toBuffer('png');
const Before = (await import(pathToFileURL(path.join(base, 'src/animals/cuttlefish.js')).href)).CuttlefishArtwork;
const After = (await import(pathToFileURL(path.join(root, 'src/animals/cuttlefish.js')).href)).CuttlefishArtwork;
await mkdir(out, { recursive: true });
const existingFiles=await readdir(out);
if (!args.case) assert.equal(existingFiles.length,0,'A full capture requires a fresh output directory.');
for (const name of existingFiles.filter(name=>/^capture-settings.*\.json$/.test(name))) {
  const previous=JSON.parse(await readFile(path.join(out,name),'utf8'));
  assert.equal(previous.sourceHashes['src/animals/cuttlefish.js'].after,identity.afterSourceSha256,
    'This output directory belongs to a different V4 candidate. Choose a new output directory.');
}


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
  { id:'head-on', title:'Frontal / head-on', direction:[1,0,0] },
  { id:'dorsal', title:'Dorsal', direction:[0,0,1] },
];
const animationSamples = [
  { id:'t2p4', time:2.4, suffix:'' },
  { id:'t6p8', time:6.8, suffix:'-t6p8' },
];
const scenarios = [];
for (const mode of ['ascii','points']) {
  for (const sample of animationSamples) {
    for (const view of orientations) scenarios.push({ ...view,
      id:`desktop-${view.id}-${mode}${sample.suffix}`, mode, group:'orientations',
      time:sample.time, animationSample:sample.id,
      title:`${view.title} · ${mode} · t=${sample.time}s · native demo scalar / 1:1 pixels` });
    scenarios.push(
      { id:`scene-reactive-${mode}${sample.suffix}`,
        title:`Reactive scene · ${mode} · t=${sample.time}s · original camera`,
        mode, time:sample.time, animationSample:sample.id, group:'scenes' },
      { id:`mobile-390-${mode}${sample.suffix}`,
        title:`390px page / 349 × 440 canvas · ${mode} · t=${sample.time}s · reactive`,
        mode, time:sample.time, animationSample:sample.id, width:349, height:440, size:1, group:'mobile' },
    );
  }
  scenarios.push(
    { id:`scene-encounter-${mode}`, title:`Close encounter · ${mode} · original camera / arms may obscure the eyes`,
      mode, time:11.5, scene:'encounter', size:1, group:'scenes' },
    { id:`default-school-${mode}`, title:`Default demo school · ${mode} · four animals / original swim-by camera`,
      mode, time:8, demoDefault:true, group:'default-school' },
    { id:`manta-reactive-${mode}`, title:`Manta reactive · ${mode} · unchanged-source invariant`,
      species:'manta', mode, time:3.2, group:'manta' },
    { id:`manta-encounter-${mode}`, title:`Manta encounter · ${mode} · unchanged-source invariant`,
      species:'manta', mode, time:8, scene:'encounter', group:'manta' },
    { id:`diagnostic-resolving-${mode}`, title:`Resolving diagnostic · ${mode} · scale 400 / object size 1 (not demo size)`,
      direction:[0,1,.18], mode, time:2.4, scale:400, objectScale:1,
      position:[-.48,.085,-.6], glow:false, density:1.5, group:'resolving' },
  );
}
scenarios.push({ id:'v3-canonical-replay', title:'Delivered V3 rounded-crown render replay · separate provenance check',
  time:2.4, size:1.2, glow:false, density:1.5, mode:'ascii', group:'provenance',
  expectedBeforeSha256:'5007d91c3ea917ea70dd4a3853e0fa3b4db535d9c9c41c1488d836130a632786' });
const selectedCases=args.case?args.case.split(',').filter(Boolean):null;
if (selectedCases) for (const id of selectedCases) assert(scenarios.some(scenario=>scenario.id===id),`Unknown scenario: ${id}`);

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
  label(ctx,'BEFORE · V3 crown and roots · 8931bcc',18,56,13,'#9cb7bd');
  label(ctx,'AFTER · V4 progressive head widening',width+18,56,13,'#9cb7bd');
  ctx.imageSmoothingEnabled=false;
  let top=76;
  for (const { scenario, canvases } of selected) {
    label(ctx,scenario.title,18,top+22,13);
    for (let i=0;i<2;i++) ctx.drawImage(canvases[i],i*width,top+38);
    top+=(scenario.height||650)+38;
  }
  await save(filename,sheet);
}

for (const scenario of scenarios.filter(s => !selectedCases || selectedCases.includes(s.id))) {
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
      options,time:scenario.time,animationSample:scenario.animationSample??null,width,height,cssPixelsAtDpr1:true,
      view:scenario.direction ? 'controlled orientation; actual renderer; native demo scalar unless resolving diagnostic' : 'unchanged production scene camera',
      camera:single?.camera??null,lightLocal:single?.lightLocal??null,halfwayLocal:single?.halfwayLocal??null,
      grid:[art.cols,art.rows],cell:[art.cellW,art.cellH],geometryStep:single?.geometryStep??null,
      samples:renderedFish.reduce((sum,fish)=>sum+fish.samples,0),sha256:sha256(png),
      renderedFish });
    // Composite the already-saved native pixels. Drawing a live Skia Canvas
    // can replay its recorded antialias/glow commands with tiny pixel changes.
    // Decoding the PNG first makes 1:1 sheets and nearest-neighbour crops exact.
    canvases.push(await loadImage(png));pngs.push(png);art.destroy();
  }
  const pair=records.filter(record=>record.scenario===scenario.id&&record.version);
  assert.equal(pair.length,2);
  for (const key of ['options','time','animationSample','width','height','view','camera','lightLocal','halfwayLocal','grid','cell','geometryStep'])
    assert.deepEqual(pair[0][key],pair[1][key],`${scenario.id}: BEFORE/AFTER mismatch in ${key}`);
  assert.equal(pair[0].renderedFish.length,pair[1].renderedFish.length);
  for (let i=0;i<pair[0].renderedFish.length;i++) {
    const {samples:beforeSamples,...beforeFish}=pair[0].renderedFish[i];
    const {samples:afterSamples,...afterFish}=pair[1].renderedFish[i];
    assert.deepEqual(beforeFish,afterFish,`${scenario.id}: per-fish state mismatch`);
  }
  captures.set(scenario.id,{scenario,canvases});
  console.log(JSON.stringify({event:'captured',scenario:scenario.id,sourceSha256:identity.afterSourceSha256}));
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
    for (const sample of animationSamples) {
      for (const view of ['broadside','three-quarter','dorsal']) {
        await contactSheet(`review-${view}-${mode}${sample.suffix}-comparison.png`,
          `Cuttlefish · ${view} / ${mode} · t=${sample.time}s · native 1000 × 650`,
          [captures.get(`desktop-${view}-${mode}${sample.suffix}`)]);
      }
      await contactSheet(`desktop-${mode}${sample.suffix}-contact-sheet.png`,
        `Cuttlefish · ${mode} · t=${sample.time}s · four views / 1000 × 650 each, unscaled`,
        orientations.map(view=>captures.get(`desktop-${view.id}-${mode}${sample.suffix}`)));
    }
    await contactSheet(`scene-${mode}-contact-sheet.png`,
      `Cuttlefish · ${mode} · existing scene cameras / 1000 × 650, unscaled`,
      [...animationSamples.map(sample=>captures.get(`scene-reactive-${mode}${sample.suffix}`)),
        captures.get(`scene-encounter-${mode}`)]);
    await contactSheet(`default-school-${mode}-comparison.png`,
      `Cuttlefish · default demo school / ${mode} · 1000 × 650, unscaled`,
      [captures.get(`default-school-${mode}`)]);
    await contactSheet(`mobile-${mode}-contact-sheet.png`,
      `Cuttlefish · ${mode} · mobile · two phases · 1:1`,
      animationSamples.map(sample=>captures.get(`mobile-390-${mode}${sample.suffix}`)));
    await contactSheet(`diagnostic-resolving-${mode}-comparison.png`,
      `Cuttlefish · ${mode} · resolving diagnostic only / scale 400`,[captures.get(`diagnostic-resolving-${mode}`)]);
  }
  // These crops are taken from the exact desktop-scale frames above, with no
  // rerender, interpolation or selective edits. Only nearest-neighbour pixel
  // enlargement and external labels are applied.
  // The default includes the short crown-to-arm transition and adjacent eye.
  // A reviewer can choose different matched bounds after inspecting the raw
  // frames; those exact bounds are always recorded in the output manifest.
  const crop=args.crop?args.crop.split(',').map(Number):[420,150,310,340];
  assert(crop.length===4&&crop.every(Number.isInteger)&&crop[0]>=0&&crop[1]>=0
    &&crop[2]>0&&crop[3]>0&&crop[0]+crop[2]<=1000&&crop[1]+crop[3]<=650,
    'The crop must be four integers inside the native 1000 × 650 desktop frame.');
  const enlarge=3,displayW=crop[2]*enlarge,displayH=crop[3]*enlarge;
  for (const sample of animationSamples) for (const view of ['broadside','dorsal']) {
    const sheet=createCanvas(displayW*2,100+(displayH+38)*2),ctx=sheet.getContext('2d');
    ctx.fillStyle='#10181c';ctx.fillRect(0,0,sheet.width,sheet.height);
    label(ctx,`Same demo pixels · ${view} head growth · t=${sample.time}s / 3× nearest-neighbour`,18,28,16);
    label(ctx,'BEFORE · V3 crown and roots · 8931bcc',18,57,13,'#9cb7bd');
    label(ctx,'AFTER · V4 progressive head widening',displayW+18,57,13,'#9cb7bd');
    label(ctx,`Source crop [${crop.join(', ')}] from native 1000 × 650 frames. No new zoom.`,18,82,12,'#9cb7bd');
    ctx.imageSmoothingEnabled=false;
    const sources=[];
    for (const [row,mode] of ['ascii','points'].entries()) {
      const source=`desktop-${view}-${mode}${sample.suffix}`;
      sources.push(source);
      const {canvases}=captures.get(source),top=100+row*(displayH+38);
      label(ctx,mode.toUpperCase(),18,top+25,14);
      for(let i=0;i<2;i++)ctx.drawImage(canvases[i],...crop,i*displayW,top+38,displayW,displayH);
    }
    const filename=`diagnostic-head-growth-${view}${sample.suffix}-pixel-crop.png`;
    await save(filename,sheet);
    records.push({kind:'crop',file:filename,sources,animationSample:sample.id,time:sample.time,
      crop,enlargement:enlarge,interpolation:'nearest-neighbour; exact source pixels; labels outside image'});
  }
} else {
  for (const id of selectedCases) await contactSheet(`${id}-comparison.png`,'V3 crown and roots / V4 progressive head widening',[captures.get(id)]);
}

for (const [relative,hashes] of Object.entries(sourceHashes)) {
  assert.equal(await fileHash(path.join(base,relative)),hashes.before,`BEFORE source changed during capture: ${relative}`);
  assert.equal(await fileHash(path.join(root,relative)),hashes.after,`AFTER source changed during capture: ${relative}`);
}
assert.equal(await fileHash(fileURLToPath(import.meta.url)),scriptSha256,'Evidence script changed during capture.');
assert.deepEqual(gitState(base),baselineGit,'The immutable V3 baseline worktree changed during capture.');
const sourceGitAtEnd=gitState(root);
if(args['final-commit'] || args['expect-source-tree']) assert.deepEqual(sourceGitAtEnd,sourceGitAtStart,'Pinned AFTER git state changed during capture.');
const report={schema:2,backend:'skia-canvas; actual source renderer; simulated DOM/lifecycle; not browser screenshots',
  node:process.version,generatedAt:new Date().toISOString(),base,source:root,identity,sourceHashes,baselineGit,sourceGitAtStart,sourceGitAtEnd,
  scriptSha256,font:{path:process.env.ANATOMY_FONT,sha256:await fileHash(process.env.ANATOMY_FONT)},
  framing:{ desktop:'1000 × 650 native canvas pixels, no scaling in contact sheets; density 1.1 and glow true match demo defaults.',
    composition:'Contact sheets and crops decode the saved native PNGs before drawing, so no live Canvas command recording is replayed. Native frames are copied 1:1; diagnostic crops use nearest-neighbour bitmap enlargement.',
    defaultSchool:'Exact dist/app.js default options, plus capture-only paused/autoStart/reducedMotion overrides; time 8 seconds. Points frame changes only the presentation mode. Constructor seed defaults to 0.',
    orientation:'Controlled broadside, three-quarter, frontal/head-on and dorsal camera rotations at 2.4s and 6.8s. Camera, light and projection are identical between animation samples. Scalar = min(1000/7.4,650/4.6) = 135.135; size 1.2; perspective .2.',
    mobile:'390px viewport: main 5% side padding and studio borders yield 349px canvas width; CSS max-width:390px selects 440px scene height. This is CSS-derived sizing, not measured browser layout.',
    animationSamples:'Controlled orientations plus native reactive and mobile frames at 2.4s and 6.8s retain the actual procedural motion. Each BEFORE/AFTER pair uses the same timestamp, seed, options and camera.',
    resolving:'Explicit diagnostic-only scale 400 and objectScale 1; never presented as normal demo size.',
    cameraMetadata:'Per-fish camera/state snapshots are captured inside _rasterize before render() restores fish[0]. Nominal option size and actual camera objectScale are recorded separately. Top-level camera is supplied only for single-fish snapshots.' },
  browserAndCIGaps:['No real browser screenshots or live input/device acceptance from this script; prior browser launch was blocked and no permissions/sandbox retries are attempted.','Native glyph pixels are backend/font-specific.','No CI execution or deployment is implied.'],
  mantaComparisons,priorRenderReplay:replay,records,outputs};
await writeFile(path.join(out,args.case?`capture-settings-${selectedCases.length===1?selectedCases[0]:'selected'}.json`:'capture-settings.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output:out,scenarios:captures.size,renders:records.filter(r=>r.version).length,
  mantaPairs:mantaComparisons.length,mantaByteIdentical:mantaComparisons.length?mantaComparisons.every(r=>r.byteIdentical):null,priorReplay:replay,browser:false}));
