#!/usr/bin/env node
/** Exact built source through the canonical painter in native Skia Canvas.
 * This is deliberately not labelled browser evidence. See review-uplift.mjs
 * for the independent Chromium harness. --root points to a freshly built
 * baseline or candidate; all capture settings are identical between them.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const ownRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const args=Object.fromEntries(process.argv.slice(2).map(arg=>{
  if(arg==='--quick')return ['quick',true];
  const match=/^--(root|out)=(.+)$/.exec(arg);if(!match)throw new Error(`Unknown argument ${arg}`);return [match[1],match[2]];
}));
const root=path.resolve(args.root??ownRoot),output=path.resolve(args.out??path.join(ownRoot,'species/pufferfish/evidence/uplift-native'));
await mkdir(output,{recursive:true});
const require=createRequire(import.meta.url);
let native;
try{native=require('@napi-rs/canvas')}catch{native=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'))}
const {createCanvas,loadImage}=native;
const importBuilt=file=>import(pathToFileURL(path.join(root,'lib',file)).href);
const {CuttlefishArtwork}=await importBuilt('animals/cuttlefish.js');
const {createPufferfishDirector,stepPufferfishDirector,pufferfishDirectorPoster}=await importBuilt('species/pufferfish/director.js');
const {createPufferfish,pufferfishPoster}=await importBuilt('species/pufferfish/model.js');
const {createPufferfishPainter}=await importBuilt('species/pufferfish/legacy-painter.js');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourcePaths=(await readdir(path.join(root,'species/pufferfish/src'))).filter(name=>name.endsWith('.ts')).map(name=>`species/pufferfish/src/${name}`);
sourcePaths.push('src/animals/cuttlefish.js','lib/animals/cuttlefish.js');
for(const name of (await readdir(path.join(root,'lib/species/pufferfish'))).filter(name=>name.endsWith('.js')))sourcePaths.push(`lib/species/pufferfish/${name}`);
const sourceHashes=Object.fromEntries(await Promise.all(sourcePaths.map(async file=>[file,hash(await readFile(path.join(root,file)))])));
assert.equal(sourceHashes['src/animals/cuttlefish.js'],sourceHashes['lib/animals/cuttlefish.js']);
for(const name of(await readdir(path.join(root,'lib/species/pufferfish'))).filter(name=>name.endsWith('.js')))
  assert.equal(hash(await readFile(path.join(root,'species/pufferfish/build',name))),sourceHashes[`lib/species/pufferfish/${name}`],`Compiler/package parity for ${name}`);
const captures=[],animations=[];
async function host(width,height,options={}){
  const canvas=createCanvas(width,height),atlas=createCanvas(1,1);
  const painter=createPufferfishPainter(canvas,CuttlefishArtwork,{quality:'fine',view:'right',...options},()=>atlas);
  painter.resize(width,height,1);
  // Native Canvas snapshots mutable source canvases per blit. A lossless
  // immutable atlas Image avoids retained copies; the canonical writer,
  // camera, cell/depth buffers and rasterizer are used unchanged.
  let atlasImage=await loadImage(atlas.toBuffer('image/png'));
  const ctx=canvas.getContext('2d'),drawImage=ctx.drawImage.bind(ctx);
  ctx.drawImage=(source,...coords)=>drawImage(source===atlas?atlasImage:source,...coords);
  return{canvas,painter,async configure(options){painter.configure(options);atlasImage=await loadImage(atlas.toBuffer('image/png'))}};
}
async function capture(host,state,file,{solo=false,staticPose=false,...meta}={}){
  const frame=solo?host.painter.draw(state,staticPose):host.painter.drawScene(state,staticPose);
  assert(frame.samples<=16000&&frame.cols<=160&&frame.rows<=90);
  assert.match(frame.text,/^[\x20-\x7e\n]+$/);
  const png=host.canvas.toBuffer('image/png');await writeFile(path.join(output,file),png);
  captures.push({file,...meta,solo,staticPose,width:host.canvas.width,height:host.canvas.height,
    tick:state.tick,scene:solo?'solo':state.config.scene,beat:solo?null:state.beat.kind,
    options:host.painter.getConfig(),samples:frame.samples,glyphs:frame.glyphs,cols:frame.cols,rows:frame.rows,
    stateSha256:hash(JSON.stringify(state)),cellsSha256:hash(frame.text),pngSha256:hash(png),
    actors:solo?[{phase:state.phase,inflation:state.inflation}]:state.actors.map(actor=>({id:actor.id,phase:actor.state.phase,
      inflation:actor.state.inflation,x:actor.x,y:actor.y,yaw:actor.yaw,finEffort:actor.finEffort,motive:actor.motive}))});
  return frame;
}
const events=[{tick:121,seq:0,type:'approach'},{tick:271,seq:1,type:'retreat'}];
const inspectionEvents=[{tick:61,seq:0,type:'invite',x:.38,y:-.2}];
for(const [name,width,height]of[['desktop',1200,675],['phone',390,520]]){
  const h=await host(width,height);
  let state=createPufferfishDirector({scene:'current',count:1,roles:['drifter'],labels:false},{seed:23});
  for(const tick of[0,120,138,174,240,288,330,385,440,640]){
    while(state.tick<tick){const next=state.tick+1;state=stepPufferfishDirector(state,{tick:next,events:events.filter(e=>e.tick===next)}).state}
    await capture(h,state,`encounter-${name}-${String(tick).padStart(4,'0')}.png`,{events});
  }
  for(const view of['right','front','left']){
    await h.configure({view});
    const solo=createPufferfish({seed:23});
    await capture(h,solo,`solo-${name}-${view}-calm.png`,{solo:true,staticPose:true});
    await capture(h,pufferfishPoster(solo,true),`solo-${name}-${view}-inflated.png`,{solo:true,staticPose:true});
  }
  await h.configure({view:'right'});
  let drift=createPufferfishDirector({scene:'current',count:2,labels:false},{seed:23});
  for(const tick of[0,240,420,660,900,1199]){
    while(drift.tick<tick)drift=stepPufferfishDirector(drift,{tick:drift.tick+1}).state;
    await capture(h,drift,`drift-${name}-${String(tick).padStart(4,'0')}.png`);
  }
  let inspection=createPufferfishDirector({scene:'reef',count:1,labels:false},{seed:23});
  for(const tick of[0,80,180,300,380,500,600]){
    while(inspection.tick<tick){const next=inspection.tick+1;inspection=stepPufferfishDirector(inspection,{tick:next,events:inspectionEvents.filter(e=>e.tick===next)}).state}
    await capture(h,inspection,`inspection-${name}-${String(tick).padStart(4,'0')}.png`,{events:inspectionEvents});
  }
  if(!args.quick&&name==='desktop'){
    for(const sequence of['encounter','inspection']){
      const motionDir=path.join(output,`${sequence}-motion-frames`);await mkdir(motionDir,{recursive:true});
      let scene=createPufferfishDirector(sequence==='encounter'?{scene:'current',count:1,roles:['drifter'],labels:false}:{scene:'reef',count:1,labels:false},{seed:23});
      const log=sequence==='encounter'?events:inspectionEvents;
      for(let tick=0,index=0;tick<=720;tick+=4,index++){
        while(scene.tick<tick){const next=scene.tick+1;scene=stepPufferfishDirector(scene,{tick:next,events:log.filter(e=>e.tick===next)}).state}
        h.painter.drawScene(scene,false);
        await writeFile(path.join(motionDir,`${String(index).padStart(4,'0')}.png`),h.canvas.toBuffer('image/png'));
      }
      const gif=path.join(output,`${sequence}-native.gif`);
      execFileSync('ffmpeg',['-y','-v','error','-threads','1','-framerate','15','-i',path.join(motionDir,'%04d.png'),'-filter_complex_threads','1','-filter_complex','[0:v]fps=15,scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',gif]);
      const decoded=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=nb_read_frames,width,height,duration','-of','json',gif],{encoding:'utf8'}));
      assert.equal(Number(decoded.streams[0].nb_read_frames),181,'All captured motion frames must decode');
      animations.push({file:path.basename(gif),nativeCanvas:true,ticks:[0,720],tickStep:4,captureFps:15,events:log,
        sha256:hash(await readFile(gif)),decoded:decoded.streams[0],note:'A replay excerpt, not a seamless loop. GIF returns to its initial frame.'});
    }
  }
  h.painter.dispose();
}
for(const quality of['fine','small']){
  const h=await host(360,270,{quality});
  const solo=createPufferfish({seed:23});
  await capture(h,solo,`squat-${quality}-solo-calm.png`,{solo:true,staticPose:true});
  await capture(h,pufferfishPoster(solo,true),`squat-${quality}-solo-inflated.png`,{solo:true,staticPose:true});
  const trio=createPufferfishDirector({scene:'reef',count:3,labels:false},{seed:23});
  await capture(h,trio,`squat-${quality}-trio-calm.png`,{staticPose:true});
  await capture(h,pufferfishDirectorPoster(trio,true),`squat-${quality}-trio-inflated.png`,{staticPose:true});
  h.painter.dispose();
}
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
for(const [file,expected]of Object.entries(sourceHashes))
  assert.equal(hash(await readFile(path.join(root,file))),expected,`${file} changed during the evidence run`);
const manifest={schema:'pufferfish-native-review-v1',sourceCommit,sourceHashes,environment:{node:process.version,
  backend:'@napi-rs/canvas native Skia, canonical glyph painter',browser:false,
  timing:'Explicit 60 Hz simulation; GIF samples every four ticks at 15 fps. Not live frame throughput.',
  atlas:'Lossless immutable native Image used only as drawImage source to avoid native mutable-canvas retention.'},
  harnessSha256:hash(await readFile(fileURLToPath(import.meta.url))),captures,animations};
await writeFile(path.join(output,'native-capture.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output,sourceCommit,captures:captures.length,backend:manifest.environment.backend},null,2));
