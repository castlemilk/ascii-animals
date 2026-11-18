/** Exact executed text grids. No browser or performance assertion is made. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createOwlDirector,makeOwlDirectorPoster} from '../build/director.js';
import {renderOwlDirectorGrid} from '../build/composition.js';
const out=new URL('../evidence/director/',import.meta.url);await mkdir(out,{recursive:true});
const scenarios=[
 {name:'Twilight lookout',options:{scene:'lookout',count:2,layout:'bough',roles:['sentinel','curious']},ticks:780,selected:[120,300,480,660]},
 {name:'Call and answer',options:{scene:'duet',count:2,layout:'split',roles:['sentinel','dreamer']},ticks:780,selected:[90,270,480,690]},
 {name:'Last light',options:{scene:'roost',count:2,layout:'close',roles:['dreamer','sentinel']},ticks:1080,selected:[90,300,700,1020]},
];
const output={evidenceKind:'Executed director/core -> existing Owl glyph sampler -> composed ASCII; not browser screenshots',node:process.version,seed:7,tickRate:60,frameRate:12,scenes:[],small:[]};
const digest=text=>createHash('sha256').update(text).digest('hex');
for(const scenario of scenarios){
 const d=createOwlDirector(scenario.options,{seed:7});const frames=[],selected=[];
 for(let tick=0;tick<=scenario.ticks;tick++){
  if(tick>0)d.advance(tick);
  if(tick%5!==0&&!scenario.selected.includes(tick))continue;
  const state=d.getState(),grid=renderOwlDirectorGrid(state,{cols:144,rows:60});
  const frame={tick,phase:state.phase.kind,motives:state.actors.map(a=>a.motive),text:grid.text,cols:grid.cols,rows:grid.rows,sha256:digest(grid.text)};
  if(tick%5===0)frames.push(frame);if(scenario.selected.includes(tick))selected.push(frame);
 }
 output.scenes.push({...scenario,frames,selected});
 const still=makeOwlDirectorPoster(d.getState(),{kind:'stretch',target:1});
 for(const gridOptions of [{cols:128,rows:48},{cols:64,rows:80},{cols:80,rows:90,silhouette:true}]){
  const grid=renderOwlDirectorGrid(still,gridOptions);
  output.small.push({title:scenario.name+' / '+grid.layout+(gridOptions.silhouette?' silhouette':''),cols:grid.cols,rows:grid.rows,text:grid.text,sha256:digest(grid.text)});
 }
 d.dispose();
}
const fixture=JSON.parse(await readFile(new URL('../fixtures/director-replay.json',import.meta.url),'utf8'));
const d=createOwlDirector(fixture.options,{seed:fixture.seed});const samples=[];
let accepted=0,ignored=0;
for(let tick=1;tick<=fixture.finalTick;tick++){
 const result=d.advance(tick,fixture.events.filter(e=>e.tick===tick));accepted+=result.acceptedCues;ignored+=result.ignoredCues;
 if(tick%30===0){const grid=renderOwlDirectorGrid(result.state);samples.push({tick,phase:result.state.phase.kind,sha256:digest(grid.text)});}
}
await writeFile(new URL('logical-scenes.json',out),JSON.stringify(output));
await writeFile(new URL('replay-result.json',out),JSON.stringify({fixture:'fixtures/director-replay.json',accepted,ignored,samples,finalState:d.getState()},null,2)+'\n');
d.dispose();
console.log(JSON.stringify({scenes:output.scenes.length,frames:output.scenes.reduce((s,v)=>s+v.frames.length,0),selected:12,small:output.small.length,accepted,ignored}));
