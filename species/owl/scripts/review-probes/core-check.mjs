import assert from 'node:assert/strict';
import {createOwlDirector,makeOwlDirectorPoster} from '../../build/director.js';
import {renderOwlDirectorGrid,targetOwlActor,OWL_SCENE_GLYPHS} from '../../build/composition.js';
import {buildOwlGeometry} from '../../build/geometry.js';
const checked={deterministicFrames:0,grids:0,ownerTargets:0,geometryPoses:0,atomicInvalids:0};
const fixture=new Map([[1,[{type:'attention',x:-.9,y:.6,target:1,tick:1,seq:0}]],[10,[{type:'cue',cue:{kind:'rustle',target:1},tick:10,seq:1}]],[50,[{type:'leave',tick:50,seq:2}]],[400,[{type:'cue',cue:{kind:'call',target:0},tick:400,seq:3}]],[800,[{type:'cue',cue:{kind:'stretch',target:1},tick:800,seq:4}]]]);
for(const scene of ['lookout','duet','roost']){
 const models=[1,2,5].map(()=>createOwlDirector({scene,tempo:1.3,breeze:1}, {seed:71,headYawLimitDeg:45,headPitchLimitDeg:20,reactionStrength:1}));
 for(let tick=1;tick<=1200;tick++){
  models.forEach((d,i)=>{d.advance(tick,fixture.get(tick)||[]);if(tick%[1,2,5][i]===0&&tick%30===0)renderOwlDirectorGrid(d.getState());});
  if(tick%30===0){assert.deepEqual(models[0].getState(),models[1].getState());assert.deepEqual(models[0].getState(),models[2].getState());checked.deterministicFrames++;}
  if(tick%60===0)for(const a of models[0].getState().actors){const g=buildOwlGeometry(a.pose);assert(g.surfaces.length<=96);assert.deepEqual(g.landmarks.footLeft,[-.18,.915]);assert.deepEqual(g.landmarks.footRight,[.18,.915]);checked.geometryPoses++;}
 }
 const before=models[0].getState();
 for(const input of [[{type:'attention',x:Infinity,y:0,tick:1201,seq:5}], [{type:'attention',x:0,y:0,tick:1201,seq:5},{type:'cue',cue:{kind:'bad'},tick:1201,seq:6}], [{type:'leave',tick:1200,seq:5}],Array(17).fill({type:'leave',tick:1201,seq:5})]){assert.throws(()=>models[0].advance(1201,input));assert.equal(models[0].getState(),before);checked.atomicInvalids++;}
 for(const model of models)model.dispose();
}
for(const layout of ['bough','split','close']){
 const d=createOwlDirector({layout});
 const snapshots=[d.getState(),makeOwlDirectorPoster(d.getState(),{kind:'stretch'}),makeOwlDirectorPoster(d.getState(),{kind:'attention',target:1,x:1,y:-1})];
 for(const state of snapshots)for(const [cols,rows] of [[128,48],[144,60],[160,90],[64,80],[80,90],[112,80]]){
  const g=renderOwlDirectorGrid(state,{cols,rows});checked.grids++;
  assert.equal(g.text.split('\n').length,rows);assert(g.text.split('\n').every(s=>s.length===cols));
  assert([...g.text].every(c=>c==='\n'||OWL_SCENE_GLYPHS.includes(c)));
  assert.equal(g.owners.length,cols*rows);assert(g.owners.every(x=>[-1,0,1].includes(x)));
  for(const r of g.actorRects){assert(r.left>=0&&r.top>=0&&r.left+r.width<=cols&&r.top+r.height<=rows);}
  for(let i=0;i<g.owners.length;i+=7){const id=g.owners[i];if(id<0)continue;assert.equal(targetOwlActor(g,(i%cols)/(cols-1)*2-1,Math.floor(i/cols)/(rows-1)*2-1),id);checked.ownerTargets++;}
  for(const id of [0,1])for(const part of ['body','head','face','eye-left','eye-right','beak','wing-left','wing-right','foot-left','foot-right'])assert(g.parts.some((p,i)=>g.owners[i]===id&&p===part),`${layout}:${cols}x${rows}: actor${id} missing ${part}`);
 }
 d.dispose();
}
console.log(JSON.stringify({status:'passed',...checked,scope:'Real generated core/composition; no native browser or performance claim'},null,2));
