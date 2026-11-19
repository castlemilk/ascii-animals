/** Native Canvas replay of the exact public director inputs used by Climb/Offer moth.
 * NOT browser-input or performance evidence. Requires an existing @napi-rs/canvas
 * installation and ffmpeg. Both authored encounters run at their actual 60 Hz
 * simulation speed, with four ticks per encoded 15 fps frame.
 */
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const arg=(key,fallback)=>{const n=process.argv.indexOf(`--${key}`);return n<0?fallback:process.argv[n+1];};
const root=resolve(arg('species',fileURLToPath(new URL('..',import.meta.url))));
const out=resolve(arg('out',join(root,'review/anchored-wall/evidence')));
const moduleRef=process.env.GECKO_CANVAS_MODULE??pathToFileURL(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES??'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','@napi-rs/canvas/index.js')).href;
const {createCanvas,loadImage}=await import(moduleRef);
const {createGeckoDirector}=await import(pathToFileURL(join(root,'compiled/director.js')).href);
const {renderGeckoDirectorGrid}=await import(pathToFileURL(join(root,'compiled/director-preview.js')).href);
const {drawGeckoGrid}=await import(pathToFileURL(join(root,'compiled/preview.js')).href);
const hash=b=>createHash('sha256').update(b).digest('hex');
const hashFiles=['director','director-preview','gecko','geometry','preview','types'].flatMap(n=>[`src/${n}.ts`,`compiled/${n}.js`]);
const hashes={};for(const file of hashFiles)hashes[file]=hash(await readFile(join(root,file)));
await mkdir(out,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'gecko-user-sequences-'));
const manifest={kind:'native Canvas replay of exact compiled Gecko; not browser or native-device interaction evidence',seed:37,node:process.version,hashes,scenarios:[],frames:[],movie:null,changedDuringCapture:[]};
const scenarios=[
  {name:'climb',type:'inspect',labels:[[42,'Assess the next hold'],[62,'Peel and reach'],[75,'Grip and transfer'],[270,'Settle on the wall']]},
  {name:'moth',type:'moth',labels:[[72,'Track the insect'],[108,'Brace before pouncing'],[132,'Pounce and catch'],[208,'Replant and recover']]}
];
function render(state,width,height,cols,rows,focus){
  const canvas=createCanvas(width,height),grid=renderGeckoDirectorGrid(state,{cols,rows,focus});
  drawGeckoGrid(canvas.getContext('2d'),grid,width,height);return canvas;
}
let frame=0;
try{
  for(const scene of scenarios){
    const director=createGeckoDirector({seed:37,options:{scene:'moonlit-wall',autonomy:false}});
    const initial=director.getSnapshot().individuals[0];
    const event={type:scene.type,id:'mica',tick:30,seq:1,...(scene.type==='inspect'?{
      x:initial.body.position.x*initial.scale/3.3,y:(initial.body.position.y*initial.scale-.55)/2.2}:{})};
    manifest.scenarios.push({name:scene.name,recipe:director.exportRecipe(),events:[event],ticks:[0,360]});
    for(let tick=0;tick<=360;tick++){
      if(tick)director.step(tick===30?[event]:[]);
      const label=scene.labels.find(([at])=>at===tick);
      if(tick%4!==0&&!label)continue;
      const state=director.getSnapshot(),actor=state.individuals[0];
      const close=render(state,390,390,112,72,'mica');
      if(label){
        const file=`after-native-directed-${scene.name}-${String(tick).padStart(4,'0')}.png`,bytes=close.toBuffer('image/png');
        await writeFile(join(out,file),bytes);
        manifest.frames.push({file,title:label[1],sha256:hash(bytes),tick,scene:scene.name,motive:actor.motive,catches:actor.catches,
          position:actor.body.position,feet:actor.body.feet,steps:actor.body.stepsCompleted,moth:state.moth});
      }
      if(tick%4===0){
        const canvas=createCanvas(1010,510),ctx=canvas.getContext('2d');ctx.fillStyle='#0a1418';ctx.fillRect(0,0,1010,510);
        ctx.drawImage(render(state,620,422,224,112,null),0,52);ctx.drawImage(close,620,52);
        ctx.fillStyle='#e0e2ce';ctx.font='14px sans-serif';ctx.fillText(`${scene.name==='climb'?'CLIMB':'OFFER MOTH'} / ${actor.motive} / tick ${tick} / catches ${actor.catches}`,18,25);
        ctx.fillStyle='#a6b4a7';ctx.font='12px sans-serif';ctx.fillText('Native Canvas · exact 60 Hz model · normal-speed replay · cue at tick 30',18,494);
        ctx.fillText('390px portrait',636,466);
        await writeFile(join(temp,`frame-${String(frame++).padStart(4,'0')}.png`),canvas.toBuffer('image/png'));
      }
    }
    director.dispose();
    const sheet=createCanvas(780,908),ctx=sheet.getContext('2d');ctx.fillStyle='#0a1418';ctx.fillRect(0,0,780,908);
    const stills=manifest.frames.filter(f=>f.scene===scene.name);
    for(let i=0;i<stills.length;i++){
      const f=stills[i],x=(i%2)*390,y=Math.floor(i/2)*454;ctx.drawImage(await loadImage(join(out,f.file)),x,y+64);
      ctx.fillStyle='#e0e2ce';ctx.font='15px sans-serif';ctx.fillText(f.title,x+16,y+25);
      ctx.fillStyle='#a6b4a7';ctx.font='11px sans-serif';ctx.fillText(`Native Canvas · seed37 · tick ${f.tick}`,x+16,y+46);
    }
    await writeFile(join(out,`after-native-directed-${scene.name}-states.png`),sheet.toBuffer('image/png'));
  }
  const file='after-native-directed-sequences.mp4';
  const ffmpeg=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate','15','-i',join(temp,'frame-%04d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',join(out,file)],{encoding:'utf8',timeout:60000});
  if(ffmpeg.status!==0)throw new Error(`FFmpeg: ${ffmpeg.error?.message??ffmpeg.stderr}`);
  manifest.movie={file,sha256:hash(await readFile(join(out,file))),fps:15,frames:frame,durationSeconds:frame/15,editing:'Two complete chronological 0..360-tick encounters, explicit cut at 6.0667s; no speed-up, interpolation or simulated browser input'};
  for(const file of hashFiles)if(hash(await readFile(join(root,file)))!==hashes[file])manifest.changedDuringCapture.push(file);
  await writeFile(join(out,'after-native-directed-replay.json'),JSON.stringify(manifest,null,2)+'\n');
  if(manifest.changedDuringCapture.length)throw new Error(`Source changed during capture: ${manifest.changedDuringCapture.join(', ')}`);
  console.log(JSON.stringify({movie:manifest.movie,frames:manifest.frames.map(f=>({file:f.file,title:f.title,feet:f.feet.map(p=>({id:p.id,phase:p.phase,lift:p.lift??0}))})),stableSource:true},null,2));
}finally{await rm(temp,{recursive:true,force:true});}
