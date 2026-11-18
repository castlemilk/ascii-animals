import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createFrog, stepFrog, FROG_DEFAULTS } from '../generated/frog.mjs';
import { nativePreview, createCanvas, captureFont } from './native-host.mjs';
const out = resolve(process.argv[2] || new URL('../evidence', import.meta.url).pathname);
await mkdir(out, { recursive:true }); await mkdir(`${out}/frames`, {recursive:true});
const events = [
  { tick:1, seq:0, type:'target', x:.65, y:.05 }, { tick:12, seq:1, type:'leap' },
  { tick:16, seq:2, type:'leap' }, { tick:24, seq:3, type:'leave' },
  { tick:150, seq:4, type:'target', x:-.6, y:.5 }, { tick:162, seq:5, type:'leap' },
];
const replay = { schemaVersion:1,speciesVersion:1,tickRate:60,seed:23,config:FROG_DEFAULTS,events };
await writeFile(`${out}/replay.json`,JSON.stringify(replay,null,2)+'\n');
const { canvas, preview } = nativePreview();
const ctx = canvas.getContext('2d');
const ticks = [0,10,24,36,47,72,88,109];
const states = new Map();
let state = createFrog(), frames = [];
for (let tick=0;tick<=300;tick++) {
  if(tick) state=stepFrog(state,tick,events.filter(e=>e.tick===tick)).state;
  if(ticks.includes(tick)) states.set(tick,state);
  if(tick%3===0) {
    const r=preview.draw(state);
    ctx.fillStyle='#adc498';ctx.font='12px monospace';ctx.textAlign='left';
    ctx.fillText(`FROG  /  ${state.behavior.kind.toUpperCase()}  /  TICK ${tick}`,24,30);
    ctx.fillStyle='#78927f';ctx.font='10px monospace';ctx.fillText('NATIVE CANVAS CAPTURE · ORIGINAL GEOMETRY · EXISTING GLYPH ATLAS',24,520);
    const filename=`frames/${String(frames.length).padStart(4,'0')}.png`;
    await writeFile(`${out}/${filename}`,canvas.toBuffer('image/png'));frames.push({tick,file:filename,phase:state.behavior.kind,samples:r.samples,glyphs:r.glyphs});
  }
}
preview.draw(createFrog(),{motion:false});
await writeFile(`${out}/frog-poster.png`,canvas.toBuffer('image/png'));
await writeFile(`${out}/frog-specimen.txt`,preview.toText()+'\n');
const sheet = createCanvas(1440,1256), c=sheet.getContext('2d');
c.fillStyle='#101a14';c.fillRect(0,0,1440,1256);c.fillStyle='#d7e9bd';c.font='24px monospace';c.fillText('FROG / DETERMINISTIC LEAP',24,38);
c.fillStyle='#8ea184';c.font='13px monospace';c.fillText('Native Canvas pixels; real legacy glyph atlas. Seed 23. Explicit ticks. Browser acceptance pending.',24,65);
let index=0;
for(const [tick,s] of states){preview.draw(s);const col=index%4,row=Math.floor(index/4);c.drawImage(canvas,col*360,100+row*315,360,270);c.fillStyle='#b8ce9a';c.font='14px monospace';c.fillText(`${s.behavior.kind} / tick ${tick}`,col*360+16,100+row*315+291);index++;}
const views = ['front','left','right','profile'];
for(let i=0;i<views.length;i++){const v=views[i];const small=nativePreview(320,240,{cols:72,rows:40,view:v,silhouette:true});const r=small.preview.draw(createFrog(),{motion:false});c.drawImage(small.canvas,i*360+20,785,320,240);c.fillStyle='#b8ce9a';c.font='14px monospace';c.fillText(`${v} / ${r.cols}×${r.rows} single tone`,i*360+16,1060);await writeFile(`${out}/silhouette-${v}.png`,small.canvas.toBuffer('image/png'));small.preview.dispose();}
c.fillStyle='#8ea184';c.font='14px monospace';c.fillText('States: idle → interest → crouch → flight → landing → recovery → cooldown → ready',24,1130);
c.fillText('Ground ring / landing reticle are non-glyph preview UI. No raster frog silhouette is drawn.',24,1160);
c.fillText('Motion timings are authored, not biological measurements. Profile is a diagnostic view.',24,1190);
await writeFile(`${out}/frog-contact-sheet.png`,sheet.toBuffer('image/png'));
await writeFile(`${out}/native-capture.json`,JSON.stringify({evidence:'native Canvas, not browser',node:process.version,seed:23,viewport:[720,540],dpr:1,frames,contactTicks:ticks,captureFont,fontStrategy:'existing atlas system font fallback; no binary bundled',pending:['browser input','screen-reader','real mobile','browser p95/p99','heap profiling']},null,2)+'\n');
preview.dispose();console.log(JSON.stringify({output:out,frames:frames.length,samplesPerFrame:frames[0].samples,evidence:'native Canvas'},null,2));
