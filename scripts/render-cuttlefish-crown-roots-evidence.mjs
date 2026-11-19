// Native Canvas evidence for V5 crown and arm-root refinement, compared with the
// exact delivered V4 tree. Actual source renderer + simulated DOM; not browser
// screenshots. No geometry source is rewritten by this script.
//
// From a complete applied repository (the default AFTER source is this repo):
// SKIA_CANVAS_MODULE=/absolute/path/to/skia-canvas \
// ANATOMY_FONT=/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf \
// node scripts/render-cuttlefish-crown-roots-evidence.mjs \
//   --base=/path/to/applied-v4 --out=/path/to/new-evidence \
//   --expect-source-sha=<after-cuttlefish-sha256>
//
// BEFORE may be a clean V4 checkout OR a worktree with the V4 patch staged on
// another HEAD: its index tree must equal the approved V4 tree, and its working
// files must match that index. The private local V4 commit is only a reference
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
// Every BEFORE case is checked against its delivered V4 native PNG hash;
// identical backend/font and saved source settings are required for replay.
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
for (const key of ['base','out']) if (!args[key]) throw new Error(`Pass --${key}=<path>; baseline must be the exact delivered V4 tree.`);
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
  revision: 'V5 crown and arm-root refinement',
  stage: args['final-commit'] ? 'final committed snapshot' : args['expect-source-tree'] ? 'applied snapshot pinned by index tree' : args['expect-source-sha'] ? 'source snapshot pinned by SHA256; Git state recorded separately' : 'source snapshot; actual hash recorded',
  baselineDescription: 'Exact delivered V4 progressive head growth; comparison is V4 versus V5, not older V3 or main.',
  baselineCommit: '99cb8c503d70f8a407d6f2b3aff3c6b45af8f9bd',
  baselineTree: '30372b6c308c0734d9ea3adf73639fee396c6bd7',
  baselineCuttlefishSha256: 'e92beee50ae36c590191929370668d9e82e24f16f2e5716111e1678a883df83d',
  baselineMantaSha256: '239fe85eb0396b36e97be4b041fabfe77f0509d6827714ec79c472b7ece9f4ca',
};
// Exact saved native V4 frames, from capture manifest SHA256
// 751b03c13e9885dd4dc313e85cd0b546a3829305bd00156e8fe3c4cc9002a9a7.
// These hashes make every BEFORE case independently checkable without the
// original private checkout or a workspace-specific evidence folder.
const baselineNativePngSha256 = Object.freeze({
  "desktop-broadside-ascii": "8c67274958fe5c5c28599dc459f2a555c2fe39c5c76ec2047450930c46262898",
  "desktop-three-quarter-ascii": "0f3c135c281ac998cefeb343d82465677d0c647f8800e6532683d219af1fe496",
  "desktop-head-on-ascii": "dead8da3d8ab517a3dd6b1df6b8a0353734375fbc866160b0bb106e944e39f0f",
  "desktop-dorsal-ascii": "99d074e00881640cf24f56336840e422f41bbb0cda89ab92cb01f91b159da139",
  "scene-reactive-ascii": "394d1e1b7d60ad5a120dc6a3242be1f1d67479c62da2c5f0d57cbabe04911f8c",
  "mobile-390-ascii": "f16423e79fb145ae167b6b5c2bc063e472b81d1abfb370c6a3e20dc7d06fa27b",
  "desktop-broadside-ascii-t6p8": "d49d09f55cc85f51ef5e5b110622ec7fc57950c99f0ae50c7aebb4fc7362ec9e",
  "desktop-three-quarter-ascii-t6p8": "48c59626ab215ba76897fb04ed0b7159f356364d082c05f0c59b8989fee8d95c",
  "desktop-head-on-ascii-t6p8": "96e78a5576f3fee2ea953a3ffb557308ed826866614a90d1446089ce3f6abc5a",
  "desktop-dorsal-ascii-t6p8": "2a6233d94a1cc3d0e9370353970ad4a6393f67397f6b6e8a7fa875e79c173537",
  "scene-reactive-ascii-t6p8": "2f41ac0f7092d7d951c4480b260dc9ef9b20e4486690623f8146944e0f7cbdab",
  "mobile-390-ascii-t6p8": "df33c8a53ec3b5b7c75f4a7f3f563634b86d2f0498d6e4b5abc76025008ac7ba",
  "scene-encounter-ascii": "f5263c55361d1c36db8e9550cbf0b8e3d072af1359f68f9d0809630b6f010110",
  "default-school-ascii": "60a3328e80de759ae5f9b516912435ee822a7a2752978ed692144efad23fdec9",
  "manta-reactive-ascii": "410b51fcca6526017b1db8145ba018d9d0c664368084b064946aa607d7e4432c",
  "manta-encounter-ascii": "9ed2080f457364ab2d080c08ed355e0f9daf20a95735375f6db2272c5b192bf2",
  "diagnostic-resolving-ascii": "e9ee810588af63cdeb49218952a50b946240173ebed27f1d0f269e28f674fd69",
  "desktop-broadside-points": "49545bb9dd0eef3e7cca4212c487555c7a3ada77937d09f840e20b537d2b8d5b",
  "desktop-three-quarter-points": "33b9859d3565e6716f31b47f3ea403a47a87a0d3277a7175e66912f32d6a6841",
  "desktop-head-on-points": "9ef1335a50f91620be1dbbaa10fde3beaf66bb2019fc7e2a72252914e6c191f1",
  "desktop-dorsal-points": "97d2c0ba35139c6955121a7d24931f38173b133ada12d003686f74c35eee5ef3",
  "scene-reactive-points": "3ab3264c1fd2ae47f2aeb97ca357c159721f7b0fca673876a03b7d059c322914",
  "mobile-390-points": "2b06d5de9b29956acf3b4b45c3c964ff59efc824dee5a82145bca3b178070bd9",
  "desktop-broadside-points-t6p8": "2424642aeb96ca552b4eed533a3dd634b5e067a80ee852c329b61989918cf3a7",
  "desktop-three-quarter-points-t6p8": "a6b76ba8e9efaceb49e421166818f2ae91cd7bff1b564dafa8c18a1714d51a4a",
  "desktop-head-on-points-t6p8": "fc49ee2eefc5516e19e004f158afdbb6b9368f1fd096e0246ee427424addbc16",
  "desktop-dorsal-points-t6p8": "faf3d13e093d4732507af645fb097f06366bd636b06439ac28c327ff0e71ea08",
  "scene-reactive-points-t6p8": "ece5883da4d8f8a31cbf8615c287b44906ca025ea2838b1c7f22399221d90200",
  "mobile-390-points-t6p8": "cdb618e7cbef05df26997fe0b33599f92e86ff66642383352093f8b88f0dbbf7",
  "scene-encounter-points": "723c62bf5db0628d13eb62dc68d2bd9a9fbf2a490d36f27bf652fbd7371e70d9",
  "default-school-points": "073c7c350e4d0fd9455f8895f9a599a7c6831f9f9682bb352d5c3e71c8362c13",
  "manta-reactive-points": "13c145368976bebc243afd2ad1a675417cf71fc2e82ee55a12ff3650d4bb8e1a",
  "manta-encounter-points": "24150ce346fb51fbababadc18b2d7a3b8aa30b3bc5356a2ddd028d516113130f",
  "diagnostic-resolving-points": "cf84718b66bbe29dc57421224b71629454802a47ed95b525232705ebebfe215a",
  "v4-canonical-replay": "abbbe793dc4de712a153323cbb4129dd9ce344d4df8179884f5e65fa88262ce3"
});
assert.equal(baselineGit.indexTree,identity.baselineTree,'BEFORE index must match the exact delivered V4 tree. A matching private HEAD commit is not required.');
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
  'The BEFORE source must be delivered V4 99cb8c5, not V3 or main.');
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
    'This output directory belongs to a different V5 candidate. Choose a new output directory.');
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
scenarios.push({ id:'v4-canonical-replay', title:'Delivered V4 head-growth render replay · separate provenance check',
  time:2.4, size:1.2, glow:false, density:1.5, mode:'ascii', group:'provenance',
  expectedBeforeSha256:'abbbe793dc4de712a153323cbb4129dd9ce344d4df8179884f5e65fa88262ce3' });
const selectedCases=args.case?args.case.split(',').filter(Boolean):null;
if (selectedCases) for (const id of selectedCases) assert(scenarios.some(scenario=>scenario.id===id),`Unknown scenario: ${id}`);

const records = [], outputs = [], captures = new Map(), mantaComparisons = [], replay = [], baselineReplays = [];
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
  label(ctx,'BEFORE · V4 head growth · 99cb8c5',18,56,13,'#9cb7bd');
  label(ctx,'AFTER · V5 crown and arm roots',width+18,56,13,'#9cb7bd');
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
  assert(baselineNativePngSha256[scenario.id], `Missing delivered V4 frame identity: ${scenario.id}`);
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
    if (version === 'before') {
      const observed=sha256(png),expected=baselineNativePngSha256[scenario.id];
      assert.equal(observed,expected,`${scenario.id}: BEFORE must reproduce the delivered V4 native PNG exactly.`);
      baselineReplays.push({scenario:scenario.id,expected,observed,exactMatch:true});
    }
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
    label(ctx,`Same demo pixels · ${view} crown and roots · t=${sample.time}s / 3× nearest-neighbour`,18,28,16);
    label(ctx,'BEFORE · V4 head growth · 99cb8c5',18,57,13,'#9cb7bd');
    label(ctx,'AFTER · V5 crown and arm roots',displayW+18,57,13,'#9cb7bd');
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
    const filename=`diagnostic-crown-roots-${view}${sample.suffix}-pixel-crop.png`;
    await save(filename,sheet);
    records.push({kind:'crop',file:filename,sources,animationSample:sample.id,time:sample.time,
      crop,enlargement:enlarge,interpolation:'nearest-neighbour; exact source pixels; labels outside image'});
  }
} else {
  for (const id of selectedCases) await contactSheet(`${id}-comparison.png`,'V4 progressive head growth / V5 crown and arm-root refinement',[captures.get(id)]);
}

for (const [relative,hashes] of Object.entries(sourceHashes)) {
  assert.equal(await fileHash(path.join(base,relative)),hashes.before,`BEFORE source changed during capture: ${relative}`);
  assert.equal(await fileHash(path.join(root,relative)),hashes.after,`AFTER source changed during capture: ${relative}`);
}
assert.equal(await fileHash(fileURLToPath(import.meta.url)),scriptSha256,'Evidence script changed during capture.');
assert.deepEqual(gitState(base),baselineGit,'The immutable V4 baseline worktree changed during capture.');
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
  mantaComparisons,priorRenderReplay:replay,baselineNativeReplays:baselineReplays,records,outputs};
await writeFile(path.join(out,args.case?`capture-settings-${selectedCases.length===1?selectedCases[0]:'selected'}.json`:'capture-settings.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output:out,scenarios:captures.size,renders:records.filter(r=>r.version).length,
  baselineNativeReplays:baselineReplays.length,mantaPairs:mantaComparisons.length,mantaByteIdentical:mantaComparisons.length?mantaComparisons.every(r=>r.byteIdentical):null,priorReplay:replay,browser:false}));
