/** Numerical cells and contract checks. These are not browser pixel evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fakeBrowser} from '../../../../../test/helpers/fake-browser.mjs';
import {createFrog,stepFrog} from '../../../generated/frog.mjs';
import {createFrogPond,stepFrogPond} from '../../../generated/pond.mjs';
import {createLegacyFrogPreview,validatePreview} from '../../../generated/legacy-preview.mjs';

const copy=value=>JSON.parse(JSON.stringify(value));
const ascii=text=>assert.match(text,/^[\x20-\x7e\n]+$/);
const variants=()=>import('../preview.mjs');
function preview(factory,width=320,height=240,options={cols:72,rows:40}){
  const host=fakeBrowser(),canvas=host.canvas(width,height),renderer=factory(canvas,options);
  renderer.resize(width,height,1);
  return {host,canvas,renderer};
}
function bounded(frame,maximum=32000){
  assert(frame.samples>0&&frame.samples<=maximum,'sample budget');
  assert(frame.cols>0&&frame.rows>0&&frame.cols<=180&&frame.rows<=100&&frame.cols*frame.rows<=18000,'cell budget');
  assert(frame.glyphs>0&&frame.glyphs<=frame.cols*frame.rows,'occupied glyphs');
  for(const point of[frame.geometry.bounds.min,frame.geometry.bounds.max])
    assert([point.x,point.y,point.z].every(Number.isFinite),'finite sampled geometry');
}

test('R2 preserves every protected current-main file and records a new reconstruction base',async()=>{
  const base=JSON.parse(await readFile(new URL('../BASE.json',import.meta.url),'utf8'));
  assert.equal(base.base,'26ee6ffc623e0adb2256e66d5b7cefc9ff36c7dd');
  assert.equal(base.original_bytes_recovered,false);
  for(const[file,expected]of Object.entries(base.canonical_sha256)){
    const bytes=await readFile(new URL('../../../../../'+file,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,`${file} must remain byte-identical to current main`);
  }
});

test('importing and drawing R2 leaves Original defaults and Original cell output unchanged',async()=>{
  const state=createFrog({seed:23}),defaults=copy(validatePreview());
  const original=preview(createLegacyFrogPreview,720,540,{});
  const first=original.renderer.draw(state,{motion:false,staticPose:'rest'}),before=original.renderer.toText();
  assert.equal(first.cols,144);assert.equal(first.rows,80);ascii(before);
  const {createSpringPeaPreview}=await variants();
  const variant=preview(createSpringPeaPreview,720,540,{});
  try{
    const stateBefore=copy(state),frame=variant.renderer.draw(state,{motion:false,staticPose:'rest'});
    bounded(frame);ascii(variant.renderer.toText());
    assert.notEqual(variant.renderer.toText(),before,'the opt-in direction has its own cell output');
    assert.deepEqual(state,stateBefore,'drawing does not alter canonical state');
    assert.deepEqual(validatePreview(),defaults,'Original preview defaults stay intact');
    original.renderer.draw(state,{motion:false,staticPose:'rest'});
    assert.equal(original.renderer.toText(),before,'existing Original instance remains unchanged');
    const fresh=preview(createLegacyFrogPreview,720,540,{});
    try{fresh.renderer.draw(state,{motion:false,staticPose:'rest'});assert.equal(fresh.renderer.toText(),before);}
    finally{fresh.renderer.dispose();}
    assert.equal(original.host.pending,0);assert.equal(variant.host.pending,0,'standalone previews never schedule animation');
  }finally{variant.renderer.dispose();original.renderer.dispose();}
});

test('R2 single-frog cells and canonical state replay identically across 1/2/5 presentation groups',async()=>{
  const {createSpringPeaPreview}=await variants();
  const events=[{tick:1,seq:0,type:'target',x:.65,y:.05},{tick:10,seq:1,type:'leap'},
    {tick:15,seq:2,type:'target',x:-.8,y:.5},{tick:20,seq:3,type:'leap'},{tick:100,seq:4,type:'leave'}];
  const run=group=>{
    const {renderer,host}=preview(createSpringPeaPreview);let state=createFrog({seed:23});const cells=[],phases=new Set();
    try{
      for(let tick=1;tick<=140;tick++){
        state=stepFrog(state,tick,events.filter(event=>event.tick===tick)).state;phases.add(state.behavior.kind);
        if(tick%group===0){const before=copy(state);bounded(renderer.draw(state));assert.deepEqual(state,before);}
        if(tick%10===0){renderer.draw(state);cells.push(renderer.toText());ascii(cells.at(-1));}
      }
      assert(phases.has('crouch')&&phases.has('flight')&&phases.has('landing')&&phases.has('recovery'));
      assert.equal(host.pending,0);
      return {state,cells};
    }finally{renderer.dispose();}
  };
  const every=run(1);assert.deepEqual(run(2),every);assert.deepEqual(run(5),every);
});

test('R2 director raster replays the same canonical hunt and call without mutating state',async()=>{
  const {createSpringPeaPreview}=await variants();
  const events=[{type:'hunt',frogId:0,x:.7,y:-.5,tick:1,seq:0},
    {type:'call',frogId:0,tick:200,seq:1},{type:'call',frogId:0,tick:240,seq:2}];
  const run=group=>{
    const {renderer,host}=preview(createSpringPeaPreview);let state=createFrogPond({seed:23,director:{count:1,layout:'shelter',scene:'firefly-supper',autonomy:false}});
    const cells=[],motives=new Set();
    try{
      for(let tick=1;tick<=400;tick++){
        const result=stepFrogPond(state,tick,events.filter(event=>event.tick===tick));state=result.state;motives.add(state.actors[0].motive.kind);
        if(tick===200)assert.equal(result.ignoredActions,1,'a call during hunt settling remains ignored');
        if(tick===240)assert.equal(result.ignoredActions,0,'a deliberate call after recovery is accepted');
        if(tick%group===0){const before=copy(state);bounded(renderer.drawPond(state),60000);assert.deepEqual(state,before);}
        if(tick%20===0){renderer.drawPond(state);cells.push(renderer.toText());ascii(cells.at(-1));}
      }
      // Hunt is an action; the canonical state stages are track/hop/strike/settle.
      for(const stage of['track','strike','settle','call'])assert(motives.has(stage),`exercise canonical ${stage} stage`);
      assert.equal(state.actors[0].motive.kind,'rest');assert.equal(state.firefly,null);assert.equal(host.pending,0);
      return {state,cells};
    }finally{renderer.dispose();}
  };
  const every=run(1);assert.deepEqual(run(2),every);assert.deepEqual(run(5),every);
});

test('R2 aim mapping changes the latched landing; preview validation and work remain bounded',async()=>{
  const {createSpringPeaPreview}=await variants();
  const {renderer,host,canvas}=preview(createSpringPeaPreview,720,540,{});
  try{
    renderer.draw(createFrog({seed:23}));
    const land=point=>{
      let state=createFrog({seed:23});
      const target=renderer.targetAt(point);
      for(let tick=1;tick<=140;tick++)state=stepFrog(state,tick,tick===1?
        [{type:'target',...target,tick,seq:0},{type:'leap',tick,seq:1}]:[]).state;
      assert.equal(state.jumps,1);return state.position;
    };
    const left=land({x:-.45,y:.4}),right=land({x:.45,y:.4});
    assert(Math.hypot(left.x-right.x,left.y-right.y)>.25,'different aims produce distinguishable destinations');
    const before=renderer.toText();assert.throws(()=>renderer.update({cols:100000}));assert.equal(renderer.toText(),before);
    assert.throws(()=>renderer.update({view:'dorsal'}));assert.throws(()=>renderer.resize(0,240,1));
    renderer.resize(9000,5000,4);bounded(renderer.draw(createFrog()));
    assert(canvas.width<=2400&&canvas.height<=1400,'absolute backing budget');
    assert.equal(host.pending,0);assert(Object.isFrozen(renderer));
  }finally{renderer.dispose();}
  assert.equal(canvas.width,1);renderer.dispose();assert.throws(()=>renderer.toText(),/disposed/i);
});
