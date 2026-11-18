// Reproducible native Canvas evidence, NOT browser screenshots or browser QA.
// Run after npm run build. Requires @napi-rs/canvas (or BUTTERFLY_CANVAS_MODULE).
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { createButterflyArtwork } from '../../../lib/public/butterfly.js';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';
const require=createRequire(import.meta.url);
const {createCanvas,GlobalFonts}=require(process.env.BUTTERFLY_CANVAS_MODULE||'@napi-rs/canvas');
const out=resolve(process.argv[2]||'species/butterfly/evidence/director');
await mkdir(out,{recursive:true});
const roles=['forager','scout','basker','wanderer'];
function surface(width,height,options){
 const host=fakeBrowser(),element=host.canvas(width,height),native=createCanvas(width,height);
 element.getContext=()=>native.getContext('2d');
 for(const key of ['width','height'])Object.defineProperty(element,key,{get:()=>native[key],set:v=>{native[key]=v;}});
 const art=createButterflyArtwork(element,options);host.intersect(element,true);
 return {host,element,native,art};
}
const frames=[];
for(const scene of ['morning','nectar','breeze','roost']){
 const {art,native}=surface(960,810,{columns:144,rows:68,paused:true,director:{scene,count:4,roles,showLabels:true}});
 for(let act=0;act<4;act++){
  const file=`${scene}-act-${act+1}.png`;
  await writeFile(resolve(out,file),native.toBuffer('image/png'));
  frames.push({file,kind:'native Canvas render',scene,act:art.getGarden().act,actLabel:art.getGarden().actLabel,tick:art.getStatus().tick,garden:art.getGarden()});
  art.nextAct();
 }
 art.dispose();
}
for(const [name,columns,rows,count,width,height,scale] of [
 ['mobile-six',104,86,6,350,517,1],['minimum-six',80,32,6,896,640,.6],['specimen',120,50,1,960,714,1]
]){
 const {art,native}=surface(width,height,{columns,rows,scale,paused:true,director:{scene:name==='specimen'?'specimen':'morning',count,showLabels:true}});
 await writeFile(resolve(out,`${name}.png`),native.toBuffer('image/png'));
 frames.push({file:`${name}.png`,kind:'native Canvas render',columns,rows,count,scale});art.dispose();
}
// One complete 18s scene at authored time, sampled at 8 frames/s. These are
// synthetic scheduler ticks fed to the real adapter, not measured browser FPS.
const motion=surface(768,648,{columns:144,rows:68,director:{scene:'nectar',count:4,roles,sceneSeconds:18,showLabels:true}});
await mkdir(resolve(out,'motion'),{recursive:true});
motion.host.frame();
for(let index=0;index<144;index++){
 // 125ms sampled as 5 × 25ms callbacks, below the controller catch-up cap.
 for(let j=0;j<5;j++)motion.host.frame(25);
 await writeFile(resolve(out,'motion',`${String(index).padStart(3,'0')}.png`),motion.native.toBuffer('image/png'));
}
const final=motion.art.getGarden();motion.art.dispose();
await writeFile(resolve(out,'native-render-manifest.json'),JSON.stringify({
 kind:'native Canvas pixel evidence; lifecycle host is simulated',canvas:'@napi-rs/canvas',
 fontPolicy:'Uses installed system monospace fallback; no font binary distributed',
 limitations:['Not a browser screenshot','No DOM/CSS/touch/mobile device or performance certification','Animation sampled at 8 fps from deterministic synthetic scheduler timestamps'],
 frames,motion:{frames:144,sampleIntervalMs:125,sceneSeconds:18,finalAct:final.act,finalCycle:final.cycle}
},null,2)+'\n');
console.log(JSON.stringify({out,stillFrames:frames.length,motionFrames:144,finalCycle:final.cycle,fonts:GlobalFonts.families.length}));
