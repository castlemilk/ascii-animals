// Actual Canvas2D adapter output on a native raster backend, with a mocked window.
// This is visual evidence for geometry/composition, NOT browser or device QA.
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createCrabArtwork } from '../../../lib/public/crab.js';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const out=path.resolve(process.argv[2]??path.join(root,'artifacts/crab-director'));
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'package.json'):import.meta.url);
const {createCanvas,GlobalFonts,loadImage}=require('@napi-rs/canvas');
const font=process.env.CRAB_EVIDENCE_FONT??'/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf';
if(!GlobalFonts.registerFromPath(font,'ui-monospace'))throw new Error('Evidence font could not be registered');
await mkdir(out,{recursive:true});
const manifest={kind:'native-canvas-with-mocked-window',notVerified:['browser DOM','real pointer/touch delivery','responsive CSS','real-device performance'],
  node:process.version,backend:require('@napi-rs/canvas/package.json').version,font,fontSHA256:createHash('sha256').update(await readFile(font)).digest('hex'),
  sourceSHA256:createHash('sha256').update(await readFile(path.join(root,'src/public/crab.ts'))).digest('hex'),fixtures:[]};

function mount(factory,options,width=980,height=700){
  const raster=createCanvas(width,height),h=fakeBrowser(),canvas=h.canvas(width,height);
  Object.defineProperties(canvas,{width:{get:()=>raster.width,set:value=>raster.width=value},height:{get:()=>raster.height,set:value=>raster.height=value}});
  canvas.getContext=()=>raster.getContext('2d');
  const art=factory(canvas,options);h.intersect(canvas,true);
  return {raster,art,h};
}
const panels=[];
async function save(name,title,mountResult){
  const {raster,art}=mountResult;
  const png=path.join(out,name+'.png');await writeFile(png,raster.toBuffer('image/png'));
  await writeFile(path.join(out,name+'.txt'),art.getFrame().text);
  manifest.fixtures.push({name,title,width:raster.width,height:raster.height,status:art.getStatus(),options:art.getOptions(),scene:art.getScene?.()??null,
    logicalSHA256:createHash('sha256').update(art.getFrame().text).digest('hex')});
  panels.push({png,title});art.dispose();
}
if(process.argv[3]){
  const {createCrabArtwork:legacy}=await import(pathToFileURL(path.resolve(process.argv[3])));
  await save('00-baseline','CURRENT MAIN / the original single-crab study',mount(legacy,{paused:true}));
}
const common={columns:140,rows:56,count:3,labels:true,paused:true,seed:7,tide:.2};
let m=mount(createCrabArtwork,{...common,scene:'forage'});m.art.setBeat('forage');
await save('01-breakfast','LOW TIDE / three residents, three instincts',m);
m=mount(createCrabArtwork,{...common,scene:'signals',formation:'terraces'});m.art.setBeat('signal');
await save('02-council','CLAW COUNCIL / a call, then an answer',m);
m=mount(createCrabArtwork,{...common,scene:'signals',formation:'terraces'});m.art.setBeat('challenge');
await save('03-challenge','CLAW COUNCIL / a proud patch of sand',m);
m=mount(createCrabArtwork,{...common,scene:'tide',tide:.6,current:.65,formation:'shoreline'});m.art.setBeat('shelter');
await save('04-shelter','RETURNING WASH / shelter and patient eyes',m);
m=mount(createCrabArtwork,{...common,scene:'tide',tide:.6,current:-.65,formation:'shoreline'});m.art.setBeat('return');
await save('05-return','RETURNING WASH / staggered steps back out',m);
m=mount(createCrabArtwork,{...common,scene:'forage',count:5,formation:'arc'});m.art.setBeat('forage');
await save('06-five-residents','ENSEMBLE CAP / five legible residents',m);
m=mount(createCrabArtwork,{...common,scene:'signals',count:5,columns:80,rows:32,scale:.6,facing:'right'});m.art.setBeat('challenge');
await save('07-minimum-grid','BOUNDARY / 80 x 32 cells, five residents, size .6',m);

// A normal-time, fixed-tick sequence. Ten sampled frames/s, not a measured FPS.
const sequence=mount(createCrabArtwork,{...common,paused:false,scene:'tide',tide:.6,current:.65,formation:'shoreline'},700,500);
await mkdir(path.join(out,'motion'),{recursive:true});sequence.h.frame(0);
for(let i=0;i<160;i++){
  sequence.h.frame(100); // browser adapter advances exactly six ticks, one render.
  if(i===12)sequence.art.cue('signal',2);
  await writeFile(path.join(out,'motion',String(i).padStart(3,'0')+'.png'),sequence.raster.toBuffer('image/png'));
}
manifest.sequence={scene:'tide',sampledFrames:160,sampledIntervalMilliseconds:100,firstCue:{atFrame:12,action:'signal',id:2},status:sequence.art.getStatus()};
sequence.art.dispose();

const width=1000,height=Math.ceil(panels.length/2)*390+68,sheet=createCanvas(width,height),ctx=sheet.getContext('2d');
ctx.fillStyle='#081416';ctx.fillRect(0,0,width,height);ctx.fillStyle='#dce5dd';ctx.font='24px ui-monospace';ctx.fillText('CRAB / TIDEPOOL THEATRE',20,32);
ctx.fillStyle='#93aea4';ctx.font='12px ui-monospace';ctx.fillText('Actual Canvas2D output · native raster backend · browser acceptance pending',20,54);
for(let i=0;i<panels.length;i++){
  const panel=panels[i],x=(i%2)*500,y=68+Math.floor(i/2)*390;
  ctx.drawImage(await loadImage(panel.png),x+10,y+32,480,343);
  ctx.fillStyle='#d8c6a2';ctx.font='11px ui-monospace';ctx.fillText(panel.title,x+12,y+20);
}
await writeFile(path.join(out,'crab-contact-sheet.png'),sheet.toBuffer('image/png'));
await writeFile(path.join(out,'native-render-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({kind:manifest.kind,output:out,panels:panels.length,sequenceFrames:160}));
