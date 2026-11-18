import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwlDirector,resolveOwlDirectorOptions,makeOwlDirectorPoster,validateOwlDirectorCue} from '../build/director.js';
import {renderOwlDirectorGrid,targetOwlActor} from '../build/composition.js';
import {buildOwlGeometry} from '../build/geometry.js';

const advance=(d,to,events=[])=>{for(let tick=d.getState().tick+1;tick<=to;tick++)d.advance(tick,events.filter(e=>e.tick===tick));return d.getState();};
const cue=(tick,seq,kind,target=0)=>({tick,seq,type:'cue',cue:{kind,target,x:-.8,y:-.4}});

test('director defaults and copied role tuple are strict immutable values',()=>{
 const roles=['sentinel','dreamer']; const d=createOwlDirector({roles});roles[0]='curious';
 assert.equal(d.getState().config.roles[0],'sentinel');
 assert(Object.isFrozen(d.getState())&&Object.isFrozen(d.getState().actors)&&Object.isFrozen(d.getState().config.roles));
 for(const options of [null,[],{scene:'marine'},{count:3},{count:1.5},{roles:['sentinel']},{roles:['sentinel','fish']},{tempo:NaN},{tempo:0},{autonomous:1},{breeze:undefined},{unknown:1}])assert.throws(()=>resolveOwlDirectorOptions(options));
 assert.throws(()=>resolveOwlDirectorOptions({scene:{toString:()=> 'lookout'}}));
 assert.throws(()=>resolveOwlDirectorOptions({roles:new Array(2)}));
 assert.throws(()=>resolveOwlDirectorOptions({layout:['split']}));
 assert.throws(()=>validateOwlDirectorCue({kind:new String('call')}));
 d.dispose();
});

test('all authored scenes have ordered arcs and visibly different cell output',()=>{
 const expected={lookout:['survey','listen','alert','settle'],duet:['call','answer','shared-watch','settle'],roost:['survey','stretch','rest','wake']};
 const hashes=[];
 for(const scene of Object.keys(expected)){
  const d=createOwlDirector({scene});const seen=[];const texts=new Set();
  for(let tick=1;tick<=1080;tick++){
   const s=d.advance(tick).state;
   if(seen.at(-1)!==s.phase.kind)seen.push(s.phase.kind);
   if(tick%90===0)texts.add(renderOwlDirectorGrid(s).text);
  }
  assert.deepEqual(seen.slice(0,4),expected[scene]);assert(texts.size>=8);
  hashes.push(renderOwlDirectorGrid(d.getState()).text);d.dispose();
 }
 assert.equal(new Set(hashes).size,3);
});

test('same seed/input log reproduces state and cells across 1/2/5 render grouping',()=>{
 const log=[{tick:60,seq:0,type:'attention',x:-.8,y:-.2,target:0},cue(120,1,'rustle'),cue(121,2,'call',1),{tick:360,seq:3,type:'leave'},cue(480,4,'call',1),cue(840,5,'stretch')];
 const finals=[];
 for(const group of [1,2,5]){
  const d=createOwlDirector({scene:'duet'},{seed:31});
  for(let tick=1;tick<=1080;tick++){
   d.advance(tick,log.filter(e=>e.tick===tick));
   // Rendering is deliberately infrequent to verify it has no simulation effect.
   if(tick%group===0&&tick%30===0)renderOwlDirectorGrid(d.getState());
  }
  finals.push({state:d.getState(),grid:renderOwlDirectorGrid(d.getState()).text});d.dispose();
 }
 assert.deepEqual(finals[0],finals[1]);assert.deepEqual(finals[0],finals[2]);
 const different=createOwlDirector({scene:'duet'},{seed:32});advance(different,1080,log);
 assert.notDeepEqual(finals[0].state,different.getState());different.dispose();
});

test('input batches reject atomically, preserve sequence and coerce no fields',()=>{
 const d=createOwlDirector();const initial=d.getState();
 for(const events of [[cue(1,0,'rustle'),{tick:1,seq:1,type:'attention',x:NaN,y:0}], [cue(1,0,'call'),cue(1,0,'call')], [cue(0,0,'call')], Array.from({length:17},(_,i)=>cue(1,i,'rustle')), [{tick:1,seq:0,type:'attention',x:0,y:0,target:3}], [{tick:1,seq:0,type:'leave',extra:true}]]){
  assert.throws(()=>d.advance(1,events));assert.equal(d.getState(),initial);
 }
 const s=d.advance(1,[{tick:1,seq:0,type:'attention',x:100,y:-100,target:1}]).state;
 assert.equal(s.pointer.x,1);assert.equal(s.pointer.y,-1);assert.equal(s.pointer.target,1);
 assert.throws(()=>d.advance(2,[cue(2,0,'call')]));assert.equal(d.getState(),s);
 assert.throws(()=>validateOwlDirectorCue({kind:'call',target:undefined}));
 assert.throws(()=>validateOwlDirectorCue({kind:'call',x:Infinity}));
 d.dispose();
});

test('one targeted cue wins, repeats cooldown, and companion replies later',()=>{
 const d=createOwlDirector({scene:'roost',roles:['dreamer','dreamer']});
 const first=d.advance(1,[cue(1,0,'call',1),cue(1,1,'stretch',0)]);
 assert.equal(first.acceptedCues,1);assert.equal(first.ignoredCues,1);
 assert.equal(first.state.cue.target,1);
 assert.match(first.state.actors[1].motive,/Offering/);assert.match(first.state.actors[0].motive,/waiting/i);
 const reply=advance(d,110);assert.match(reply.actors[0].motive,/Answering/);
 advance(d,301);assert.equal(d.getState().cue,null);
 assert.equal(d.advance(302,[cue(302,2,'rustle')]).ignoredCues,1);
 advance(d,361);assert.equal(d.advance(362,[cue(362,3,'rustle')]).acceptedCues,1);d.dispose();
});

test('tempo controls only scene beats and autonomous false keeps explicit interaction',()=>{
 const slow=createOwlDirector({tempo:.5}),fast=createOwlDirector({tempo:1.5}),manual=createOwlDirector({autonomous:false});
 for(const d of [slow,fast,manual])advance(d,120);
 assert.equal(slow.getState().beat,60);assert.equal(fast.getState().beat,180);assert.equal(manual.getState().beat,0);
 for(const d of [slow,fast,manual])assert.equal(d.getState().actors[0].simulation.tick,120);
 manual.advance(121,[cue(121,0,'rustle')]);assert.equal(manual.getState().cue.kind,'rustle');assert.equal(manual.getState().beat,0);
 for(const d of [slow,fast,manual])d.dispose();
});

test('stretch acceptance respects captured core cooldowns for both requested turns',()=>{
 const timings={blinkTicks:60,ruffleTicks:120,stretchTicks:180,recoveryTicks:180,cooldownTicks:600};
 const solo=createOwlDirector({count:1,autonomous:false},timings);
 assert.equal(solo.advance(1,[cue(1,0,'stretch')]).acceptedCues,1);
 advance(solo,599);
 const blocked=solo.advance(600,[cue(600,1,'stretch')]);
 assert.equal(blocked.acceptedCues,0);assert.equal(blocked.ignoredCues,1);
 assert.equal(blocked.state.actors[0].simulation.cycle.startTick,1);
 advance(solo,1140);
 assert.equal(solo.advance(1141,[cue(1141,2,'stretch')]).acceptedCues,1);
 assert.equal(solo.getState().actors[0].simulation.cycle.startTick,1141);
 solo.dispose();
 // A busy hidden actor is kept warm; adding it back must not promise a false turn.
 const duet=createOwlDirector({autonomous:false,sociability:0},timings);
 duet.advance(1,[cue(1,0,'stretch',1)]);advance(duet,500);
 duet.update({scene:'roost',sociability:1});
 const partnerBlocked=duet.advance(501,[cue(501,1,'stretch',0)]);
 assert.equal(partnerBlocked.acceptedCues,0);assert.equal(partnerBlocked.ignoredCues,1);
 assert.equal(partnerBlocked.state.actors[0].simulation.cycle,null);
 duet.update({sociability:0});
 assert.equal(duet.advance(502,[cue(502,2,'stretch',0)]).acceptedCues,1);
 duet.dispose();
});

test('a drowsy companion keeps its own scene until the deliberate reply delay',()=>{
 const options={scene:'roost',roles:['dreamer','dreamer']};
 const directed=createOwlDirector(options),control=createOwlDirector(options);
 advance(directed,500);advance(control,500);
 for(let tick=501;tick<549;tick++){
  const a=directed.advance(tick,tick===501?[cue(tick,0,'rustle',0)]:[]).state;
  const b=control.advance(tick).state;
  assert.deepEqual(a.actors[1].pose,b.actors[1].pose,`companion must wait at cue age ${tick-501}`);
 }
 const reply=advance(directed,565),unchanged=advance(control,565);
 assert(reply.actors[1].pose.blink<unchanged.actors[1].pose.blink);
 directed.dispose();control.dispose();
});

test('configuration is atomic and identity survives cast/scene changes',()=>{
 const d=createOwlDirector();advance(d,100);const before=d.getState();
 assert.throws(()=>d.update({count:1,roles:['fish','dreamer']}));assert.equal(d.getState(),before);
 d.update({count:1});advance(d,120);assert.equal(d.getState().actors.length,1);
 assert.throws(()=>d.advance(121,[cue(121,0,'call',1)]));assert.equal(d.getState().tick,120);
 d.update({count:2});assert.equal(d.getState().actors[1].simulation.tick,120);
 assert.equal(d.getState().actors[1].simulation.config.seed,before.actors[1].simulation.config.seed);
 d.update({scene:'roost'});assert.equal(d.getState().tick,120);assert.equal(d.getState().beat,0);
 assert.equal(d.getState().actors[0].simulation.tick,120);d.dispose();
});

test('director posters preserve simulation and show distinct deliberate stills',()=>{
 const d=createOwlDirector({scene:'roost'});const s=advance(d,160);
 const frames=new Set();
 for(const poster of [{kind:'rest'},{kind:'attention',x:.8,y:-.5,target:1},{kind:'rustle',target:0},{kind:'call',target:1},{kind:'stretch',target:0}]){
  const still=makeOwlDirectorPoster(s,poster);assert(still.poster);assert.equal(d.getState(),s);
  assert.equal(still.tick,s.tick);assert.equal(still.beat,s.beat);
  for(let i=0;i<2;i++)assert.equal(still.actors[i].simulation,s.actors[i].simulation);
  frames.add(renderOwlDirectorGrid(still).text);
 }
 assert.equal(frames.size,5);d.dispose();
});

test('wide/stacked compositions retain both actors and their minimum specimen grids',()=>{
 const d=createOwlDirector({scene:'duet'},{headYawLimitDeg:45,headPitchLimitDeg:20,reactionStrength:1});
 for(const layout of ['bough','split','close']){
  d.update({layout});const still=makeOwlDirectorPoster(d.getState(),{kind:'stretch'});
  for(const gridOptions of [{cols:128,rows:48},{cols:144,rows:60},{cols:160,rows:90},{cols:64,rows:80},{cols:80,rows:90},{cols:112,rows:90}]){
   const grid=renderOwlDirectorGrid(still,gridOptions),lines=grid.text.split('\n');
   assert.equal(lines.length,grid.rows);assert(lines.every(l=>l.length===grid.cols));assert.match(grid.text,/^[\x20-\x7e\n]+$/);
   assert.equal(grid.owners.length,grid.cols*grid.rows);assert(grid.cols*grid.rows<=14400);
   for(const id of [0,1]){
    assert(grid.actorRects[id].width>=64&&grid.actorRects[id].height>=36);
    for(const part of ['eye-left','eye-right','foot-left','foot-right','wing-left','wing-right'])assert(grid.parts.some((p,i)=>p===part&&grid.owners[i]===id),`${layout} ${grid.cols}x${grid.rows} ${id} ${part}`);
    assert(grid.owners.filter(x=>x===id).length>200);
   }
   for(let x=0;x<grid.cols;x++){assert.equal(grid.owners[x],-1);assert.equal(grid.owners[(grid.rows-1)*grid.cols+x],-1);}
  }
 }
 for(const options of [{cols:96,rows:54},{cols:127,rows:80},{cols:160,rows:40},{cols:180,rows:90}])assert.throws(()=>renderOwlDirectorGrid(d.getState(),options));
 d.dispose();
});

test('visible part ownership and nearest perch targeting agree in both orientations',()=>{
 const d=createOwlDirector();
 for(const options of [{cols:144,rows:60},{cols:80,rows:90}]){
  const grid=renderOwlDirectorGrid(d.getState(),options);
  for(const id of [0,1]){
   const i=grid.owners.findIndex((owner,i)=>owner===id&&grid.parts[i]==='pupil-left');assert(i>=0);
   const x=(i%grid.cols)/(grid.cols-1)*2-1,y=Math.floor(i/grid.cols)/(grid.rows-1)*2-1;
   assert.equal(targetOwlActor(grid,x,y),id);
  }
 }
 assert.throws(()=>targetOwlActor(renderOwlDirectorGrid(d.getState()),NaN,0));d.dispose();
});

test('the shared bough meets the actual sampled wood edge at supported wide grids',()=>{
 const d=createOwlDirector({layout:'bough'});
 for(const size of [{cols:128,rows:48},{cols:144,rows:60},{cols:160,rows:90}]){
  const grid=renderOwlDirectorGrid(d.getState(),size),lines=grid.text.split('\n');
  const edges=[0,1].map(id=>{
   const cells=grid.parts.flatMap((part,i)=>part==='perch'&&grid.owners[i]===id?[{x:i%grid.cols,y:Math.floor(i/grid.cols)}]:[]);
   const x=id===0?Math.max(...cells.map(p=>p.x)):Math.min(...cells.map(p=>p.x));
   const rows=cells.filter(p=>p.x===x).map(p=>p.y);return{x,y:rows[Math.floor(rows.length/2)]};
  });
  const [a,b]=edges;
  for(let x=a.x+1;x<b.x;x++){
   const y=Math.round(a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x));
   assert.equal(lines[y][x],'=',`${grid.cols}×${grid.rows} bridge gap at ${x},${y}`);
  }
 }
 d.dispose();
});

test('directed poses obey existing head/wing bounds and planted feet through complete arcs',()=>{
 const d=createOwlDirector({scene:'roost',tempo:1.5},{headYawLimitDeg:45,headPitchLimitDeg:20,reactionStrength:1});
 const feet=d.getState().actors.map(a=>buildOwlGeometry(a.pose).landmarks.footLeft);
 for(let tick=1;tick<=1500;tick++){
  const s=d.advance(tick,tick===600?[cue(tick,0,'stretch',1)]:[]).state;
  for(const a of s.actors){
   assert(Math.abs(a.pose.headYawDeg)<=45&&Math.abs(a.pose.headPitchDeg)<=20);
   for(const key of ['blink','ruffle','leftWing','rightWing'])assert(a.pose[key]>=0&&a.pose[key]<=1);
   if(tick%30===0)assert.deepEqual(buildOwlGeometry(a.pose).landmarks.footLeft,feet[a.id]);
  }
 }
 d.dispose();
});

test('reset restores the seeded scene and disposal is isolated and idempotent',()=>{
 const a=createOwlDirector(),b=createOwlDirector();const initial=a.getState();advance(a,80);a.reset();assert.deepEqual(a.getState(),initial);
 a.updateOwl({headYawLimitDeg:12});assert.equal(a.getState().actors[1].simulation.config.headYawLimitDeg,12);
 assert.throws(()=>a.updateOwl({seed:8}));a.dispose();a.dispose();assert(a.disposed);
 assert.throws(()=>a.getState());assert.throws(()=>a.advance(1));assert.throws(()=>a.update({count:1}));assert.throws(()=>a.reset());
 assert.equal(b.advance(1).state.tick,1);b.dispose();
});
