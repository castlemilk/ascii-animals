/** Real compiled Gecko scene raster + native Canvas. NOT browser/performance evidence. */
import {mkdir,readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createGeckoDirector,geckoDirectorPoster} from '../compiled/director.js';
import {renderGeckoDirectorGrid} from '../compiled/director-preview.js';
import {drawGeckoGrid} from '../compiled/preview.js';

const root=fileURLToPath(new URL('..',import.meta.url));
const destination=resolve(process.env.GECKO_DIRECTOR_EVIDENCE??join(root,'director/evidence'));
const canvasModule=process.env.GECKO_CANVAS_MODULE??(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ?pathToFileURL(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas/index.js')).href:'@napi-rs/canvas');
const {createCanvas,GlobalFonts}=await import(canvasModule);
const film=process.argv.includes('--gif'),temporary=film?await mkdtemp(join(tmpdir(),'gecko-director-')):null;
await mkdir(join(destination,'frames'),{recursive:true});
const frames=[],movie=[],seed=37;
const scenes=[
  {id:'moonlit-wall',stills:[0,360,690],filmStart:0,filmEnd:360},
  {id:'lantern-hunt',stills:[180,720,820,1060],filmStart:480,filmEnd:960},
  {id:'passing-shadow',stills:[550,625,770,1080],filmStart:540,filmEnd:1020},
];
function draw(state,options={},width=1000,height=680){
  const canvas=createCanvas(width,height),grid=renderGeckoDirectorGrid(state,options);
  drawGeckoGrid(canvas.getContext('2d'),grid,width,height);return {canvas,grid};
}
const summary=state=>({tick:state.tick,arc:state.arc,selectedId:state.selectedId,moth:state.moth,shadow:state.shadow,
  individuals:state.individuals.map(a=>({id:a.id,role:a.role,position:a.body.position,scale:a.scale,heading:a.body.heading,
    motive:a.motive,emotion:a.emotion,tailExpression:a.tailExpression,phase:a.body.behavior.kind,catches:a.catches,
    contacts:a.body.feet.map(f=>({id:f.id,phase:f.phase,position:f.position}))}))});
async function huntDetail(){
  const director=createGeckoDirector({seed,options:{scene:'lantern-hunt'}}),details=[];
  for(let tick=0;tick<=1060;tick++){
    if(tick)director.step();if(![720,820,1060].includes(tick))continue;
    const state=director.getSnapshot(),{canvas,grid}=draw(state,{focus:'pip',cols:112,rows:72},360,360);
    await writeFile(join(destination,`hunt-close-${tick}.png`),canvas.toBuffer('image/png'));
    details.push({tick,canvas,state:summary(state),samples:grid.samples});
  }
  const sheet=createCanvas(1080,400),ctx=sheet.getContext('2d');ctx.fillStyle='#0a1418';ctx.fillRect(0,0,1080,400);
  details.forEach((f,i)=>{ctx.drawImage(f.canvas,i*360,34);ctx.fillStyle='#e6e4d6';ctx.font='14px sans-serif';
    ctx.fillText(`Pip / ${f.state.individuals[1].motive} / tick ${f.tick}`,i*360+14,24);});
  await writeFile(join(destination,'hunt-close-contact-sheet.png'),sheet.toBuffer('image/png'));
  await writeFile(join(destination,'hunt-close-capture.json'),JSON.stringify({kind:'actual native Canvas; not browser or motion playback',seed,grid:[112,72],size:[360,360],
    frames:details.map(({canvas,...f})=>f),directorSha256:createHash('sha256').update(await readFile(join(root,'compiled/director.js'))).digest('hex'),
    previewSha256:createHash('sha256').update(await readFile(join(root,'compiled/director-preview.js'))).digest('hex')},null,2)+'\n');
  director.dispose();
}
if(process.argv.includes('--hunt-detail')){await huntDetail();console.log('Captured three native hunt close frames.');process.exit(0);}
try{
  for(const scene of scenes){
    const director=createGeckoDirector({seed,options:{scene:scene.id}});
    const end=Math.max(...scene.stills,film?scene.filmEnd:0);
    for(let tick=0;tick<=end;tick++){
      if(tick)director.step();
      if(!scene.stills.includes(tick)&&!(film&&tick>=scene.filmStart&&tick<=scene.filmEnd&&(tick-scene.filmStart)%4===0))continue;
      const state=director.getSnapshot();
      if(scene.stills.includes(tick)){
        const {canvas,grid}=draw(state),name=`${scene.id}-${String(tick).padStart(4,'0')}`;
        await writeFile(join(destination,'frames',`${name}.png`),canvas.toBuffer('image/png'));
        await writeFile(join(destination,'frames',`${name}.txt`),grid.text+'\n');
        frames.push({name,canvas,state:summary(state),samples:grid.samples,occupied:grid.occupied});
      }
      if(film&&tick>=scene.filmStart&&tick<=scene.filmEnd&&(tick-scene.filmStart)%4===0){
        const {canvas}=draw(state,{},840,560),ctx=canvas.getContext('2d');
        ctx.fillStyle='#0d181d';ctx.fillRect(0,0,840,28);ctx.fillStyle='#e6e4d6';ctx.font='14px sans-serif';
        ctx.fillText(`${scene.id} / ${state.arc.beat} / tick ${tick} / native Canvas`,420,16);
        await writeFile(join(temporary,`frame-${String(movie.length).padStart(4,'0')}.png`),canvas.toBuffer('image/png'));
        movie.push({scene:scene.id,tick});
      }
    }
    director.dispose();
  }
  const chosen=[0,2,4,5,8,10].map(i=>frames[i]),tileW=720,tileH=530;
  const sheet=createCanvas(tileW*2,tileH*3),sc=sheet.getContext('2d');
  sc.fillStyle='#0a1418';sc.fillRect(0,0,sheet.width,sheet.height);
  chosen.forEach((f,i)=>{const x=i%2*tileW,y=Math.floor(i/2)*tileH;
    sc.drawImage(f.canvas,x,y+35,tileW,tileW*680/1000);
    sc.fillStyle='#e6e4d6';sc.font='16px sans-serif';sc.fillText(`${f.name}  /  ${f.state.arc.beat}`,x+20,y+24);
  });
  await writeFile(join(destination,'contact-sheet.png'),sheet.toBuffer('image/png'));
  const model=createGeckoDirector({seed});for(let tick=0;tick<360;tick++)model.step();
  const state=model.getSnapshot(),neutral=draw(state,{neutral:true});
  await writeFile(join(destination,'neutral-wide.png'),neutral.canvas.toBuffer('image/png'));
  const close=createCanvas(720,800),cc=close.getContext('2d');cc.fillStyle='#0a1418';cc.fillRect(0,0,720,800);
  const poses=[['mica',false],['pip',false],['slate',false],['mica',true]];
  for(let i=0;i<poses.length;i++){
    const [focus,plain]=poses[i],{canvas,grid}=draw(state,{focus,cols:112,rows:72,neutral:plain},360,360);
    const x=i%2*360,y=Math.floor(i/2)*400;cc.drawImage(canvas,x,y+32);
    cc.fillStyle='#e6e4d6';cc.font='14px sans-serif';cc.fillText(`${focus} / 112x72 / ${plain?'neutral':'close'}`,x+14,y+24);
    await writeFile(join(destination,`minimum-${focus}${plain?'-neutral':''}.png`),canvas.toBuffer('image/png'));
    await writeFile(join(destination,`minimum-${focus}${plain?'-neutral':''}.txt`),grid.text+'\n');
  }
  await writeFile(join(destination,'minimum-contact-sheet.png'),close.toBuffer('image/png'));
  const minimum=draw(state,{focus:'mica',cols:112,rows:72},320,320);
  await writeFile(join(destination,'minimum-native-320.png'),minimum.canvas.toBuffer('image/png'));
  const still=draw(geckoDirectorPoster(state,{type:'shadow',id:'mica'}),{focus:'mica',cols:112,rows:72},360,360);
  await writeFile(join(destination,'reduced-motion-shadow.png'),still.canvas.toBuffer('image/png'));
  model.dispose();
  await huntDetail();
  if(film){
    const result=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate','15','-i',join(temporary,'frame-%04d.png'),
      '-filter_complex','[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0',join(destination,'gecko-director-native.gif')],
      {encoding:'utf8',timeout:60000});
    if(result.status!==0)throw new Error(`FFmpeg failed: ${result.error?.message??result.stderr}`);
  }
  const hashes={};
  for(const name of ['director','director-preview','gecko','geometry','preview','types'])for(const extension of ['src/'+name+'.ts','compiled/'+name+(name==='types'?'.d.ts':'.js')])
    hashes[extension]=createHash('sha256').update(await readFile(join(root,extension))).digest('hex');
  const manifest={kind:'actual native Canvas of compiled scene geometry, rasterizer and painter; NOT browser or deployed evidence',
    seed,inputs:[],options:'default director except scene, per independent replay',runtime:process.version,
    nativeFontAvailable:GlobalFonts.has('Liberation Mono'),wide:{width:1000,height:680,grid:[224,144]},close:{width:360,height:360,grid:[112,72]},minimum:{width:320,height:320,grid:[112,72]},
    frames:frames.map(({canvas,...f})=>f),movie:film?{fps:15,frames:movie,durationSeconds:movie.length/15,editing:'Three labeled chronological excerpts with explicit cuts; 4 real simulation ticks per frame. Looped reset cut.'}:null,
    hashes,performance:'No browser frame time, heap, or device benchmark was run.'};
  await writeFile(join(destination,'native-capture.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({kind:manifest.kind,frames:frames.length,movieFrames:movie.length,destination},null,2));
}finally{if(temporary)await rm(temporary,{recursive:true,force:true});}
