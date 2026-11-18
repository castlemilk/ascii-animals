#!/usr/bin/env node
/** Reproduce native Canvas evidence. This is NOT a browser screenshot/benchmark. */
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {createFox,staticFoxPose,FOX_DEFAULTS} from '../lib/model.js';
import {buildFoxGrid,paintFoxGrid} from '../lib/preview.js';

const localRequire=createRequire(import.meta.url);
let canvasPackage;
try{canvasPackage=localRequire('@napi-rs/canvas');}catch{
  if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw new Error('Use an already available @napi-rs/canvas or set CODEX_PRIMARY_RUNTIME_NODE_MODULES. No automatic downloads.');
  canvasPackage=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/')('@napi-rs/canvas');
}
const {createCanvas,GlobalFonts}=canvasPackage;
const base=fileURLToPath(new URL('../',import.meta.url));
const out=resolve(base,process.argv[2]??'evidence');
const frames=join(base,'.test-output','native-frames');
await mkdir(out,{recursive:true});await mkdir(frames,{recursive:true});
const fontPath=process.env.FOX_EVIDENCE_FONT??execFileSync('fc-match',['-f','%{file}','Liberation Mono'],{encoding:'utf8'}).trim();
if(!GlobalFonts.registerFromPath(fontPath,'ui-monospace'))throw new Error('Could not register installed evidence font');
const fontHash=createHash('sha256').update(await readFile(fontPath)).digest('hex');
const events=[
 {tick:45,seq:0,type:'guide',x:.8,y:.15},
 {tick:150,seq:1,type:'pounce'},
 {tick:160,seq:2,type:'pounce'},
 {tick:340,seq:3,type:'leave'},
 {tick:400,seq:4,type:'guide',x:-.7,y:.2},
 {tick:530,seq:5,type:'pounce'},
];
const replay={schemaVersion:1,speciesVersion:1,seed:17,tickRate:60,options:FOX_DEFAULTS,events};
await writeFile(join(out,'replay.json'),JSON.stringify(replay,null,2)+'\n');
const named=new Map([[0,'idle'],[100,'stalk'],[149,'interest'],[173,'crouch'],[192,'airborne'],[210,'forepaw-landing'],[236,'recover'],[280,'cooldown']]);
const model=createFox({seed:17});
const sheets=[];let gifFrames=0;
const stamp=(canvas,label)=>{const ctx=canvas.getContext('2d');ctx.fillStyle='#101514';ctx.fillRect(0,704,896,40);ctx.font='14px ui-monospace';ctx.fillStyle='#e9d4b3';ctx.textAlign='left';ctx.fillText(label,24,728);};
for(let tick=0;tick<=720;tick++){
 if(tick)model.step(tick,events.filter(e=>e.tick===tick));
 if(tick%4!==0&&!named.has(tick))continue;
 const pose=model.getPose(),grid=buildFoxGrid(pose);
 const canvas=createCanvas(896,744),ctx=canvas.getContext('2d');
 paintFoxGrid(ctx,grid,896,704);stamp(canvas,`FOX / ${pose.phase.toUpperCase()} / tick ${tick} / native Canvas reference`);
 if(named.has(tick)){
  const name=named.get(tick);await writeFile(join(out,`native-${name}.png`),canvas.toBuffer('image/png'));
  await writeFile(join(out,`frame-${name}.txt`),grid.text+'\n');
  sheets.push({canvas,label:`${name} / tick ${tick}`});
 }
 if(tick%4===0){await writeFile(join(frames,`${String(gifFrames).padStart(4,'0')}.png`),canvas.toBuffer('image/png'));gifFrames++;}
}
const sheet=createCanvas(1120,4*490+80),s=sheet.getContext('2d');
s.fillStyle='#101514';s.fillRect(0,0,sheet.width,sheet.height);s.fillStyle='#f4e4bd';s.font='24px ui-monospace';s.fillText('FOX / seeded native Canvas contact sheet',22,36);
s.font='14px ui-monospace';s.fillText('Actual cell output. Browser interaction and device performance are separate acceptance.',22,62);
sheets.forEach(({canvas},i)=>s.drawImage(canvas,(i%2)*560,80+Math.floor(i/2)*490,560,465));
await writeFile(join(out,'native-contact-sheet.png'),sheet.toBuffer('image/png'));
const neutral=createCanvas(1280,552),n=neutral.getContext('2d');n.fillStyle='#101514';n.fillRect(0,0,1280,552);
for(const [i,facing] of ['right','left'].entries()){
 const canvas=createCanvas(640,512);const grid=buildFoxGrid(staticFoxPose({facing}),{cols:80,rows:32,monochrome:true});
 paintFoxGrid(canvas.getContext('2d'),grid,640,512,{monochrome:true});n.drawImage(canvas,i*640,0);
 n.fillStyle='#f4e4bd';n.font='16px ui-monospace';n.fillText(`80 x 32 / ${facing} / neutral silhouette`,i*640+20,536);
}
await writeFile(join(out,'native-neutral-80x32.png'),neutral.toBuffer('image/png'));
const gif=join(out,'native-fox-replay.gif'),palette=join(frames,'palette.png');
execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','15','-i',join(frames,'%04d.png'),'-vf','palettegen=stats_mode=diff','-frames:v','1',palette],{stdio:'pipe'});
execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','15','-i',join(frames,'%04d.png'),'-i',palette,'-lavfi','paletteuse=dither=none','-loop','0',gif],{stdio:'pipe'});
const state=model.getState();
await writeFile(join(out,'native-render.json'),JSON.stringify({
 evidenceKind:'Native Skia Canvas through @napi-rs/canvas, NOT browser/deployed evidence',
 node:process.version,font:{path:fontPath,sha256:fontHash,bundled:false,registeredAlias:'ui-monospace'},
 surface:{width:896,height:704,cols:112,rows:44,cellWidth:8,cellHeight:16},
 seed:17,ticks:720,gifFrames,gifFps:15,frameSelection:[...named].map(([tick,name])=>({tick,name})),
 finalStateHash:createHash('sha256').update(JSON.stringify(state)).digest('hex'),
 finalCellHash:createHash('sha256').update(buildFoxGrid(model.getPose()).text).digest('hex'),
 note:'GIF cadence is a replay capture setting, not measured animation throughput. No browser/accessibility/performance certification.'
},null,2)+'\n');
model.dispose();console.log(JSON.stringify({out,gifFrames,font:fontPath,evidence:'native Canvas only'}));
