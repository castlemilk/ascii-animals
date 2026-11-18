/** Actual native Canvas frames of compiled geometry/painter; this is not browser evidence. */
import { mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createGecko } from '../compiled/gecko.js';
import { renderGeckoGrid, drawGeckoGrid } from '../compiled/preview.js';

const root=fileURLToPath(new URL('..',import.meta.url));
const output=resolve(root,'evidence'),frameDir=join(output,'frames');
const nativeModule=process.env.GECKO_CANVAS_MODULE || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? pathToFileURL(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas/index.js')).href : '@napi-rs/canvas');
const {createCanvas,GlobalFonts}=await import(nativeModule);
await mkdir(frameDir,{recursive:true});
const log=JSON.parse(await readFile(join(output,'events.json'),'utf8'));
const model=createGecko({seed:log.seed,heading:log.initialHeading});
const targets=new Map([[0,'idle'],[72,'approach'],[197,'curl'],[226,'retreat'],[302,'recovery'],[410,'cooldown'],[600,'settled']]);
const captures=[];
const temporary=await mkdtemp(join(tmpdir(),'gecko-native-'));
const film=!process.argv.includes('--no-gif');
const width=720,height=550;
const draw=(state,view={})=>{
  const canvas=createCanvas(width,height),ctx=canvas.getContext('2d'),grid=renderGeckoGrid(state,view);
  drawGeckoGrid(ctx,grid,width,height);
  return {canvas,grid};
};
try {
  for(let tick=0;tick<=600;tick++) {
    if(tick)model.step(log.events.filter(e=>e.tick===tick));
    const state=model.getSnapshot();
    if(targets.has(tick)||film&&tick%3===0) {
      const {canvas,grid}=draw(state);
      if(targets.has(tick)) {
        const name=targets.get(tick);
        await writeFile(join(frameDir,`${name}.png`),canvas.toBuffer('image/png'));
        await writeFile(join(frameDir,`${name}.txt`),grid.text+'\n');
        captures.push({name,tick,state,canvas,cells:grid.occupied,samples:grid.samples});
      }
      if(film&&tick%3===0)await writeFile(join(temporary,`frame-${String(tick/3).padStart(4,'0')}.png`),canvas.toBuffer('image/png'));
    }
  }
  const tileW=560,tileH=470,sheet=createCanvas(tileW*3,tileH*2),ctx=sheet.getContext('2d');
  ctx.fillStyle='#101c19';ctx.fillRect(0,0,sheet.width,sheet.height);
  captures.slice(0,6).forEach((item,i)=>{
    const x=i%3*tileW,y=Math.floor(i/3)*tileH;
    ctx.drawImage(item.canvas,x,y+40,tileW,tileW*550/720);
    ctx.fillStyle='#eee5ce';ctx.font='17px sans-serif';ctx.fillText(`${String(i+1).padStart(2,'0')}  ${item.name} / tick ${item.tick}`,x+20,y+26);
  });
  await writeFile(join(output,'contact-sheet.png'),sheet.toBuffer('image/png'));
  const small=createCanvas(1120,940),sc=small.getContext('2d');sc.fillStyle='#101c19';sc.fillRect(0,0,small.width,small.height);
  const headings=[-.24,Math.PI,Math.PI/2,-Math.PI/2];
  for(let i=0;i<headings.length;i++) {
    const state=createGecko({seed:37,heading:headings[i]}).getSnapshot();
    const {canvas,grid}=draw(state,{cols:112,rows:50,neutral:true});
    const x=i%2*560,y=Math.floor(i/2)*470;
    sc.drawImage(canvas,x,y+40,560,560*550/720);sc.fillStyle='#eee5ce';sc.font='17px sans-serif';
    sc.fillText(`112 x 50 / neutral / heading ${headings[i].toFixed(2)}`,x+18,y+26);
    await writeFile(join(frameDir,`neutral-${i}.txt`),grid.text+'\n');
  }
  await writeFile(join(output,'small-grid-contact-sheet.png'),small.toBuffer('image/png'));
  let gifResult='not requested';
  if(film) {
    const gif=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate','20','-i',join(temporary,'frame-%04d.png'),
      '-filter_complex','[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3',
      '-loop','0',join(output,'gecko-native.gif')],{encoding:'utf8',timeout:60000});
    if(gif.status!==0)throw new Error(`GIF conversion failed: ${gif.error?.message??gif.stderr}`);
    gifResult='201 actual native Canvas frames, explicit 0..600 ticks at 20fps. Replay has a deliberate reset cut.';
  }
  const sourceHashes={};
  for(const name of ['types','gecko','geometry','preview','proposed-adapter']) {
    sourceHashes[`src/${name}.ts`]=createHash('sha256').update(await readFile(join(root,'src',`${name}.ts`))).digest('hex');
  }
  const meta={evidenceKind:'native Canvas (@napi-rs/canvas), not browser or deployed',runtime:process.version,
    width,height,defaultGrid:[176,78],minimumGrid:[112,50],fontAvailable:GlobalFonts.has('Liberation Mono'),
    seed:log.seed,eventLog:'events.json',frames:captures.map(({canvas,...item})=>item),gif:gifResult,sourceHashes};
  await writeFile(join(output,'native-capture.json'),JSON.stringify(meta,null,2)+'\n');
  console.log(JSON.stringify({evidenceKind:meta.evidenceKind,frames:captures.map(x=>({name:x.name,tick:x.tick,phase:x.state.behavior.kind,cells:x.cells,samples:x.samples})),gif:gifResult},null,2));
} finally {await rm(temporary,{recursive:true,force:true});model.dispose();}
