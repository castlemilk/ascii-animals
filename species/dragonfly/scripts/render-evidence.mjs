/** Actual glyph rendering through an optional native Canvas implementation.
 * This is neither a browser screenshot nor a browser performance result.
 */
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createDragonfly } from '../lib/index.js';
import { rasterizeDragonfly, gridToText, paintDragonfly } from '../lib/preview.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] || resolve(root, 'evidence'));
const require = createRequire(import.meta.url);
let native;
try { native = require(process.env.DRAGONFLY_CANVAS || '@napi-rs/canvas'); }
catch { console.error('An existing @napi-rs/canvas is required for native evidence. Set DRAGONFLY_CANVAS to its module directory.'); process.exit(1); }
const { createCanvas } = native;
await mkdir(out,{recursive:true});
await mkdir(resolve(out,'animation-frames'),{recursive:true});
const record=JSON.parse(await readFile(resolve(root,'fixtures/replay.json'),'utf8'));
const model=createDragonfly(record.options);
const scenes=[];
function draw(model,cols=120,rows=64,neutral=false,view='oblique',width=840,height=580){
  const grid=rasterizeDragonfly(model.sample(),{cols,rows,view,neutral});
  const canvas=createCanvas(width,height);
  paintDragonfly(canvas.getContext('2d'),grid,{width,height,dpr:1,neutral});
  return {canvas,grid};
}
function label(canvas,title){
  const ctx=canvas.getContext('2d');
  ctx.font='14px monospace';ctx.fillStyle='#b2c6b9';ctx.textAlign='left';ctx.textBaseline='top';
  ctx.fillText(title,18,14);ctx.fillStyle='#82998b';ctx.font='11px monospace';
  ctx.fillText('ACTUAL NATIVE CANVAS  /  SEED 17  /  NOT A BROWSER CAPTURE',18,canvas.height-28);
}
const wanted=new Map([[0,'Idle'],[90,'Pointer approach'],[108,'Dart'],[130,'Stabilized hover'],[190,'Cooldown'],[320,'Return to tracking']]);
let cursor=0,frame=0;
for(let tick=0;tick<=record.ticks;tick++){
  if(tick>0){const events=[];while(cursor<record.events.length&&record.events[cursor].tick===tick)events.push(record.events[cursor++]);model.step(tick,events);}
  if(wanted.has(tick)){
    const {canvas,grid}=draw(model);label(canvas,`${wanted.get(tick)} / tick ${tick}`);
    const name=`frame-${String(tick).padStart(3,'0')}.png`;
    await writeFile(resolve(out,name),canvas.toBuffer('image/png'));
    scenes.push({canvas,name,tick,phase:model.getState().behavior.kind,occupied:grid.occupied,clippedSamples:grid.clippedSamples,
      stateHash:createHash('sha256').update(JSON.stringify(model.getState())).digest('hex')});
  }
  if(tick%4===0){const {canvas}=draw(model,120,64,false,'oblique',720,500);label(canvas,`DRAGONFLY / tick ${String(tick).padStart(3,'0')} / ${model.getState().behavior.kind}`);
    await writeFile(resolve(out,'animation-frames',`frame-${String(frame++).padStart(3,'0')}.png`),canvas.toBuffer('image/png'));}
}
const sheet=createCanvas(1260,580),sheetCtx=sheet.getContext('2d');
sheetCtx.fillStyle='#0b1717';sheetCtx.fillRect(0,0,1260,580);
scenes.forEach((scene,i)=>sheetCtx.drawImage(scene.canvas,(i%3)*420,Math.floor(i/3)*290,420,290));
await writeFile(resolve(out,'contact-sheet.png'),sheet.toBuffer('image/png'));
const poster=createDragonfly({seed:17,motion:'static'});
const small=draw(poster,72,44,true,'dorsal',360,286);
await writeFile(resolve(out,'small-neutral.png'),small.canvas.toBuffer('image/png'));
await writeFile(resolve(out,'small-neutral.txt'),gridToText(small.grid)+'\n');
const neutralSheet=createCanvas(1080,572),neutralCtx=neutralSheet.getContext('2d');neutralCtx.fillStyle='#0b1717';neutralCtx.fillRect(0,0,1080,572);
for(const [i,tick] of [0,7,14,21,28,35].entries()){
  const m=createDragonfly({seed:17});for(let t=1;t<=tick;t++)m.step(t);
  const {canvas}=draw(m,72,44,true,i<3?'dorsal':'oblique',360,286);
  neutralCtx.drawImage(canvas,(i%3)*360,Math.floor(i/3)*286);
}
await writeFile(resolve(out,'small-grid-wing-phases.png'),neutralSheet.toBuffer('image/png'));
const metadata={evidenceKind:'native Canvas glyph rendering; not browser/deployed evidence',runtime:process.version,
  canvasModule:'@napi-rs/canvas',view:'oblique',cols:120,rows:64,seed:17,sampleCount:poster.sample().samples.length,
  replay:'fixtures/replay.json',renderedFrames:frame,gifFramesPerSecond:15,smallGrid:{cols:72,rows:44,width:360,height:286},
  shots:scenes.map(({canvas,...scene})=>scene)};
await writeFile(resolve(out,'render-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify(metadata,null,2));
