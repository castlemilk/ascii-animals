/** Exact-source native Canvas comparison and replay. NOT real-browser evidence.
 * Build the chosen species first, then:
 * node species/gecko/scripts/capture-anchored-wall-native.mjs --label after
 *   --species /absolute/path/to/species/gecko --out /absolute/evidence/path --movie
 * The same command accepts the pristine worktree's --species for the baseline.
 */
import { mkdir, readFile, writeFile, mkdtemp, rm, access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const arg=(name,fallback)=>{const at=process.argv.indexOf(`--${name}`);return at<0?fallback:process.argv[at+1];};
const species=resolve(arg('species',fileURLToPath(new URL('..',import.meta.url))));
const out=resolve(arg('out',join(species,'review/anchored-wall/evidence')));
const label=arg('label','after'),film=process.argv.includes('--movie'),sceneFilter=arg('scene','all');
if(!['all','moonlit-wall','lantern-hunt'].includes(sceneFilter))throw new Error('Unknown --scene filter');
const canvasRef=process.env.GECKO_CANVAS_MODULE??pathToFileURL(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES??'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','@napi-rs/canvas/index.js')).href;
const {createCanvas,GlobalFonts,loadImage}=await import(canvasRef);
const {createGeckoDirector}=await import(pathToFileURL(join(species,'compiled/director.js')).href);
const {renderGeckoDirectorGrid}=await import(pathToFileURL(join(species,'compiled/director-preview.js')).href);
const {drawGeckoGrid}=await import(pathToFileURL(join(species,'compiled/preview.js')).href);
await mkdir(out,{recursive:true});
const seed=37,frames=[],movies=[];
const manifest={kind:'actual native Canvas renders of compiled Gecko source; not a browser, UI interaction, device or performance test',label,sceneFilter,seed,node:process.version,font:GlobalFonts.has('Liberation Mono')?'Liberation Mono available':'system fallback',scenarios:[],frames,movies,contactSheets:[],hashes:{}};
const scenarios=[
  {scene:'moonlit-wall',focus:'mica',stills:[0,120,128,360,600,690],film:[0,660]},
  {scene:'lantern-hunt',focus:'pip',stills:[180,690,720,800,820,850,900,1060],film:[540,1140]},
];
const sizes=[{name:'desktop',width:1000,height:680,cols:224,rows:144,focus:null},
  {name:'phone',width:390,height:390,cols:112,rows:72,focus:true}];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashFiles=['director','director-preview','gecko','geometry','preview','types'].flatMap(name=>[`src/${name}.ts`,`compiled/${name}.js`]);
for(const file of hashFiles)manifest.hashes[file]=sha(await readFile(join(species,file)));
function summary(state){return {tick:state.tick,arc:state.arc,moth:state.moth,selectedId:state.selectedId,
  individuals:state.individuals.map(a=>({id:a.id,motive:a.motive,emotion:a.emotion,catches:a.catches,
    position:a.body.position,heading:a.body.heading,feet:a.body.feet,stepsCompleted:a.body.stepsCompleted,
    action:a.body.action??null,tailExpression:a.tailExpression}))};}
function draw(state,size,focus){
  const canvas=createCanvas(size.width,size.height);
  const grid=renderGeckoDirectorGrid(state,{cols:size.cols,rows:size.rows,focus:size.focus?focus:null});
  drawGeckoGrid(canvas.getContext('2d'),grid,size.width,size.height);
  return {canvas,grid};
}
const temp=film?await mkdtemp(join(tmpdir(),'gecko-anchored-replay-')):null;
try{
  for(const scenario of scenarios.filter(s=>sceneFilter==='all'||s.scene===sceneFilter)){
    const model=createGeckoDirector({seed,options:{scene:scenario.scene}});
    model.select(scenario.focus);
    manifest.scenarios.push({scene:scenario.scene,focus:scenario.focus,options:model.exportRecipe(),inputs:[]});
    let movieIndex=0;
    const last=film?Math.max(...scenario.stills,scenario.film[1]):Math.max(...scenario.stills);
    const sceneTemp=temp?join(temp,scenario.scene):null;
    if(sceneTemp)await mkdir(sceneTemp,{recursive:true});
    for(let tick=0;tick<=last;tick++){
      if(tick)model.step();
      const still=scenario.stills.includes(tick);
      const movie=film&&tick>=scenario.film[0]&&tick<=scenario.film[1]&&(tick-scenario.film[0])%4===0;
      if(!still&&!movie)continue;
      const state=model.getSnapshot();
      if(still)for(const size of sizes){
        const {canvas,grid}=draw(state,size,scenario.focus),file=`${label}-native-${size.name}-${scenario.scene}-${String(tick).padStart(4,'0')}.png`;
        const bytes=canvas.toBuffer('image/png');
        await writeFile(join(out,file),bytes);
        frames.push({file,size,sha256:sha(bytes),samples:grid.samples,occupied:grid.occupied,state:summary(state)});
      }
      if(movie){
        const width=1010,height=510,canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
        ctx.fillStyle='#0a1418';ctx.fillRect(0,0,width,height);
        const wide=draw(state,{width:620,height:422,cols:224,rows:144,focus:null},scenario.focus);
        const close=draw(state,{width:390,height:390,cols:112,rows:72,focus:true},scenario.focus);
        ctx.drawImage(wide.canvas,0,52);ctx.drawImage(close.canvas,620,52);
        ctx.fillStyle='#d7d8c9';ctx.font='14px sans-serif';ctx.fillText(`${label.toUpperCase()} / ${scenario.scene} / tick ${tick} / ${state.arc.beat}`,18,25);
        ctx.font='12px sans-serif';ctx.fillText(`Native Canvas · exact 60 Hz simulation · normal speed · selected ${scenario.focus}`,18,494);
        ctx.fillText('390px close view',636,466);
        await writeFile(join(sceneTemp,`frame-${String(movieIndex++).padStart(4,'0')}.png`),canvas.toBuffer('image/png'));
      }
    }
    if(film){
      const file=`${label}-native-${scenario.scene}.mp4`;
      const r=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate','15','-i',join(sceneTemp,'frame-%04d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',join(out,file)],{encoding:'utf8',timeout:60000});
      if(r.status!==0)throw new Error(`FFmpeg failed: ${r.error?.message??r.stderr}`);
      movies.push({file,fps:15,frames:movieIndex,startTick:scenario.film[0],endTick:scenario.film[1],seconds:movieIndex/15,editing:'Uninterrupted chronological excerpt, four true simulation ticks per frame; real browser not exercised',sha256:sha(await readFile(join(out,file)))});
    }
    model.dispose();
  }
  async function contactSheet(file,items,width,height,columns=items.length){
    const canvas=createCanvas(width*columns,(height+64)*Math.ceil(items.length/columns)),ctx=canvas.getContext('2d');
    ctx.fillStyle='#0a1418';ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let i=0;i<items.length;i++){
      const x=(i%columns)*width,y=Math.floor(i/columns)*(height+64);
      ctx.drawImage(await loadImage(join(out,items[i].file)),x,y+64,width,height);
      ctx.fillStyle='#e0e2ce';ctx.font='15px sans-serif';ctx.fillText(items[i].title,x+16,y+24);
      ctx.fillStyle='#a6b4a7';ctx.font='11px sans-serif';ctx.fillText('Native Canvas · seed 37 · exact compiled source',x+16,y+46);
    }
    const bytes=canvas.toBuffer('image/png');await writeFile(join(out,file),bytes);
    manifest.contactSheets.push({file,sha256:sha(bytes),items});
  }
  if(label==='after'){
    for(const size of sizes){
      const before=`before-native-${size.name}-moonlit-wall-0360.png`,after=`after-native-${size.name}-moonlit-wall-0360.png`;
      if(!frames.some(f=>f.file===after))continue;
      try{await access(join(out,before));}catch{continue;}
      await contactSheet(`matched-native-${size.name}.png`,[{file:before,title:'BEFORE · Moonlit wall · tick 360'},{file:after,title:'AFTER · Moonlit wall · tick 360'}],size.width,size.height);
    }
    for(const [scene,ticks,labels] of [['moonlit-wall',[120,128,360,600],['Support','Front-left foot lifts','Climb / weight transfer','Inspect the next hold']],['lantern-hunt',[720,820,900,1060],['Brace before pouncing','Pounce / moth caught','Replant / recovery','Return']]]){
      if(!frames.some(f=>f.file===`after-native-phone-${scene}-${String(ticks[0]).padStart(4,'0')}.png`))continue;
      const items=ticks.map((tick,i)=>{
        const file=`after-native-phone-${scene}-${String(tick).padStart(4,'0')}.png`,record=frames.find(f=>f.file===file),actor=record.state.individuals.find(a=>a.id===(scene==='lantern-hunt'?'pip':'mica'));
        return {file,title:`${labels[i]} · tick ${tick}`};
      });
      await contactSheet(`after-native-${scene}-states.png`,items,390,390,2);
    }
  }
  manifest.changedDuringCapture=[];
  for(const file of hashFiles)if(sha(await readFile(join(species,file)))!==manifest.hashes[file])manifest.changedDuringCapture.push(file);
  await writeFile(join(out,`${label}-native${sceneFilter==='all'?'':`-${sceneFilter}`}-capture.json`),JSON.stringify(manifest,null,2)+'\n');
  if(manifest.changedDuringCapture.length)throw new Error(`Source changed during capture: ${manifest.changedDuringCapture.join(', ')}`);
  console.log(JSON.stringify({kind:manifest.kind,label,frames:frames.length,movies:movies.map(m=>m.file),out},null,2));
}finally{if(temp)await rm(temp,{recursive:true,force:true});}
