import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createDragonflyDirector, DRAGONFLY_DIRECTOR_LIMITS } from '../lib/director.js';

// Headless numerical/property tests. These do not certify the rendered ensemble's
// recognizability, browser input, screen-reader output, or device performance.
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,(a.z ?? 0)-(b.z ?? 0));
const selected = director => {
  const state = director.getState();
  const member = state.members.find(item => item.id === state.selected);
  assert(member, 'The selected ID resolves to an active member');
  return member;
};
function step(director, inputs = []) {
  const state = director.getState();
  director.step(state.tick+1, inputs.map((input,index) => ({ tick:state.tick+1,seq:state.lastSeq+index+1,...input })));
  return director.getState();
}
function until(director, predicate, maximum = 1600) {
  const trace = [];
  for (let index=0;index<maximum;index++) {
    const member = selected(director);
    if (trace.at(-1) !== member.phase.kind) trace.push(member.phase.kind);
    if (predicate(member,director.getState())) return trace;
    const previous = member.position;
    step(director);
    assert(distance(previous,selected(director).position)<.2,'A directed transition must not teleport between route anchors');
  }
  assert.fail(`Director did not reach the required state in ${maximum} ticks; phases=${trace.join(',')}`);
}

test('director validates bounded scene configuration before constructing members', () => {
  const defaults = createDragonflyDirector();
  assert.equal(defaults.getOptions().count,3);
  assert.equal(defaults.getState().members.length,3);
  assert.equal(defaults.getState().tick,0);
  assert.equal(new Set(defaults.getState().members.map(member=>member.id)).size,3);
  for (const count of [1,2,3,4]) assert.equal(createDragonflyDirector({count}).getState().members.length,count);
  for (const bad of [null,[],{count:0},{count:5},{count:1.5},{count:NaN},{count:'3'},
    {scene:'aquarium'},{route:'teleport'},{tempo:0},{tempo:Infinity},{spread:NaN},
    {scale:9},{breeze:100},{labels:1},{roles:['patroller']},{roles:new Array(4)},
    {roles:['patroller','sentinel','skimmer','invented']},{unknown:true}])
    assert.throws(()=>createDragonflyDirector(bad),undefined,JSON.stringify(bad));
  assert.throws(()=>createDragonflyDirector({}, {seed:NaN}));
  assert.throws(()=>createDragonflyDirector({}, {wingAmplitude:Infinity}));
});

test('configuration and model updates are atomic and preserve separate typed domains', () => {
  const director=createDragonflyDirector({count:3},{seed:17}); step(director);
  const before=director.getState(), options=director.getOptions(), modelOptions=director.getModelOptions();
  assert.throws(()=>director.configure({count:4,scene:'attention',tempo:NaN}));
  assert.deepEqual(director.getState(),before);
  assert.deepEqual(director.getOptions(),options);
  assert.throws(()=>director.configureModel({motion:'static',wingHz:NaN}));
  assert.deepEqual(director.getState(),before);
  assert.deepEqual(director.getModelOptions(),modelOptions);
  assert.throws(()=>director.configure({wingHz:3}));
  assert.throws(()=>director.configureModel({count:2}));
  director.configure({scene:'attention'});
  assert.equal(director.getState().tick,before.tick);
  for(const member of director.getState().members)
    assert.deepEqual(member.position,before.members.find(old=>old.id===member.id).position);
  assert.equal(director.getState().scene,'attention');
});

test('count changes retain existing identity, seed, pose and local clocks', () => {
  const director=createDragonflyDirector({count:2},{seed:17});
  for(let index=0;index<37;index++)step(director);
  const initial=director.getState();
  director.configure({count:4});
  const expanded=director.getState();
  assert.equal(expanded.tick,initial.tick); assert.equal(expanded.members.length,4);
  assert.equal(new Set(expanded.members.map(member=>member.seed)).size,4);
  for(const member of initial.members) {
    const retained=expanded.members.find(other=>other.id===member.id);
    assert(retained); assert.equal(retained.seed,member.seed); assert.deepEqual(retained.position,member.position);
    assert.equal(retained.modelTick,member.modelTick);
  }
  const newcomer=expanded.members.find(member=>!initial.members.some(old=>old.id===member.id));
  assert(newcomer); const newcomerTick=newcomer.modelTick;
  step(director);
  assert.equal(director.getState().members.find(member=>member.id===newcomer.id).modelTick,newcomerTick+1,
    'A newly added model uses its own next integer tick, not the older scene tick');
  step(director,[{type:'select',id:expanded.members.at(-1).id}]);
  director.configure({count:1});
  assert.equal(director.getState().members.length,1);
  assert.equal(director.getState().selected,director.getState().members[0].id);
  assert.equal(director.getState().members[0].seed,initial.members[0].seed);
  step(director);
});

test('exact ticks and complete ordered event batches reject invalid inputs atomically', () => {
  const batches=[
    [{type:'pointer',tick:1,seq:0,x:1.1,y:0}],
    [{type:'pointer',tick:1,seq:0,x:NaN,y:0}],
    [{type:'pointer',tick:1,seq:0,x:'0',y:0}],
    [{type:'select',tick:1,seq:0,id:999}],
    [{type:'select',tick:1,seq:0,id:.5}],
    [{type:'cue',tick:1,seq:0,cue:'startle'}],
    [{type:'cue',tick:2,seq:0,cue:'dart'}],
    [{type:'leave',tick:1,seq:-1}],
    [{type:'leave',tick:1,seq:1.5}],
    [{type:'leave',tick:1,seq:2**53}],
    [{type:'leave',tick:1,seq:0,unexpected:true}],
    [{type:'pointer',tick:1,seq:0,x:.8,y:.2},{type:'select',tick:1,seq:0,id:0}],
    [{type:'pointer',tick:1,seq:0,x:.8,y:.2},{type:'cue',tick:1,seq:1,cue:'bad'}],
    Array.from({length:17},(_,seq)=>({type:'leave',tick:1,seq})),
  ];
  for(const events of batches) {
    const director=createDragonflyDirector({count:2}),before=director.getState();
    assert.throws(()=>director.step(1,events)); assert.deepEqual(director.getState(),before);
  }
  const director=createDragonflyDirector({count:2});
  for(const tick of [0,2,-1,.5,NaN,Infinity,'1']) assert.throws(()=>director.step(tick));
  director.step(1,[{type:'pointer',tick:1,seq:8,x:1,y:-1}]);
  const before=director.getState();
  assert.throws(()=>director.step(2,[{type:'leave',tick:2,seq:8}]));
  assert.deepEqual(director.getState(),before);
  director.step(2,[{type:'leave',tick:2,seq:9}]);
  assert.equal(director.getState().target,null);
});

test('same scene event log is invariant under 1/2/5-tick sampling cadence', () => {
  const log=new Map([
    [25,[{type:'pointer',x:.7,y:-.4}]],
    [50,[{type:'select',id:1},{type:'cue',cue:'dart'}]],
    [95,[{type:'leave'}]],
    [160,[{type:'select',id:2},{type:'cue',cue:'perch'}]],
    [260,[{type:'cue',cue:'return'}]],
  ]);
  const results=[1,2,5].map(cadence=>{
    const director=createDragonflyDirector({count:3,scene:'patrol',route:'figure-eight'},{seed:17});
    for(let tick=1;tick<=360;tick++) {
      step(director,log.get(tick)??[]);
      if(tick%cadence===0)director.sample();
    }
    const before=director.getState();
    const result={state:digest(before),geometry:digest(director.sample())};
    director.sample();assert.deepEqual(director.getState(),before,'Sampling is observation only');
    director.dispose();return result;
  });
  assert.deepEqual(results[1],results[0]);assert.deepEqual(results[2],results[0]);
});

test('retained actors do not synchronize their independent seeds or local wing phases', () => {
  const director=createDragonflyDirector({count:4},{seed:17});
  const pristine=director.sample();
  const wingHistories=new Map(pristine.map(member=>[member.id,[]]));
  for(let tick=1;tick<=80;tick++) {
    step(director);
    if(tick%8===0)for(const member of director.sample())
      wingHistories.get(member.id).push(member.geometry.wings.map(wing=>wing.angle));
  }
  assert.equal(new Set([...wingHistories.values()].map(digest)).size,4);
  const other=createDragonflyDirector({count:4},{seed:991});
  assert.notEqual(digest(pristine),digest(other.sample()));
});

test('patrol routes remain finite, bounded and continuous over a long closed performance', () => {
  for(const route of ['banks','figure-eight','orbit']) {
    const director=createDragonflyDirector({count:4,route,tempo:1.6});
    let previous=director.getState();
    for(let tick=1;tick<=3600;tick++) {
      step(director);const state=director.getState();
      assert.equal(state.tick,tick);
      for(const member of state.members) {
        const prior=previous.members.find(other=>other.id===member.id);
        assert([member.position.x,member.position.y,member.position.z,member.velocity.x,member.velocity.y,member.heading].every(Number.isFinite));
        assert(Math.abs(member.position.x)<=DRAGONFLY_DIRECTOR_LIMITS.rootX);
        assert(member.position.y>=DRAGONFLY_DIRECTOR_LIMITS.rootYMin && member.position.y<=DRAGONFLY_DIRECTOR_LIMITS.rootYMax);
        assert(member.position.z>=.04 && member.position.z<=.32);
        assert(distance(prior.position,member.position)<.2,`${route} has a route-seam jump at tick ${tick}`);
      }
      previous=state;
    }
    director.dispose();
  }
});

test('velocity stays acceleration-bounded across dart, settle and return phase boundaries', () => {
  // Before the fix, default cue tick30 produced 48.0449786 units/s² at tick77
  // (dart→settle), because the cruise speed cap instantly truncated velocity.
  for(const [motion,tempo] of [['full',1],['full',1.6],['slow',1]]) {
    const pace=tempo*(motion==='slow'?.25:1);
    const director=createDragonflyDirector({count:1,scene:'attention',tempo},{motion});
    let sawDart=false,sawSettle=false;
    for(let tick=1;tick<=Math.ceil(360/pace);tick++) {
      const previous=selected(director);
      step(director,tick===30?[{type:'cue',cue:'dart'}]:[]);
      const member=selected(director);
      const acceleration=distance(previous.velocity,member.velocity)*60;
      const speed=Math.hypot(member.velocity.x,member.velocity.y);
      assert(acceleration<=DRAGONFLY_DIRECTOR_LIMITS.dartAcceleration*pace+1e-9,
        `${motion} tempo${tempo} tick${tick} ${previous.phase.kind}→${member.phase.kind}: acceleration ${acceleration}`);
      assert(speed<=DRAGONFLY_DIRECTOR_LIMITS.dartSpeed*pace+1e-10,
        'Cruise speed is a desired envelope; the global dart limit remains a hard bound');
      sawDart ||= member.phase.kind==='dart';sawSettle ||= member.phase.kind==='settle';
    }
    assert(sawDart && sawSettle,'The assertion crosses the response phase boundary');
  }
});

test('selection and deliberate cues affect the selected individual without stopping its peers', () => {
  const director=createDragonflyDirector({count:3,scene:'patrol'});
  for(let index=0;index<30;index++)step(director);
  const target=director.getState().members[1].id;
  const before=director.getState();
  step(director,[{type:'select',id:target},{type:'cue',cue:'dart'}]);
  assert.equal(director.getState().selected,target);
  assert.equal(selected(director).phase.kind,'launch');
  for(const peer of director.getState().members.filter(member=>member.id!==target))
    assert.notEqual(peer.phase.kind,'launch');
  for(let index=0;index<12;index++)step(director);
  for(const peer of director.getState().members.filter(member=>member.id!==target)) {
    const old=before.members.find(member=>member.id===peer.id);
    assert(peer.modelTick>old.modelTick,'Peers keep independent local animation');
    assert(distance(peer.position,old.position)>0,'Peers continue their own route');
  }
});

test('manual dart returns to the captured pre-cue position through its complete phases', () => {
  const director=createDragonflyDirector({count:1,scene:'patrol',tempo:1},{motion:'full'});
  for(let index=0;index<20;index++)step(director);
  const home=selected(director).position;
  step(director,[{type:'cue',cue:'dart'}]);
  const trace=until(director,member=>member.phase.kind==='cooldown');
  assert.deepEqual(trace,['launch','dart','settle','return','cooldown']);
  const landing=selected(director).position;
  for(let index=0;index<20;index++)step(director,[{type:'cue',cue:'dart'}]);
  assert.equal(selected(director).phase.kind,'cooldown');
  assert(distance(selected(director).position,landing)<.2);
  until(director,member=>member.phase.kind==='patrol'||member.phase.kind==='hover'||member.phase.kind==='attention');
  assert(distance(selected(director).position,home)<.03,'Completed return converges on the captured anchor, not the advancing patrol target');
  assert(Math.hypot(selected(director).velocity.x,selected(director).velocity.y)<.08,'Return stabilizes before ordinary flight resumes');
  const restartTick=director.getState().tick;
  step(director,[{type:'cue',cue:'dart'}]);
  assert.equal(selected(director).phase.kind,'launch');assert.equal(director.getState().tick,restartTick+1);
});

test('a dart from an attended pointer makes a meaningful excursion and returns to the captured hover', () => {
  const director=createDragonflyDirector({count:1,scene:'attention'},{seed:17,motion:'full'});
  for(let tick=1;tick<=320;tick++)step(director,tick===1?[{type:'pointer',x:.9,y:.6}]:[]);
  assert(Math.hypot(selected(director).velocity.x,selected(director).velocity.y)<.08,
    'The fixture has completed its approach and is attending the pointer before the cue');
  const home=selected(director).position;
  step(director,[{type:'cue',cue:'dart'}]);
  let excursion=0;
  const trace=until(director,member=>{
    if(member.phase.kind==='dart'||member.phase.kind==='settle')
      excursion=Math.max(excursion,Math.hypot(member.position.x-home.x,member.position.y-home.y));
    return member.phase.kind==='cooldown';
  });
  assert.deepEqual(trace,['launch','dart','settle','return','cooldown']);
  until(director,member=>['hover','patrol','attention'].includes(member.phase.kind));
  assert(excursion>.12,`An already-attended pointer reduced the complete dart/settle excursion to ${excursion} scene units`);
  assert(distance(selected(director).position,home)<.03,'The intentional excursion returns to its captured hover anchor');
  assert(Math.hypot(selected(director).velocity.x,selected(director).velocity.y)<.08);
  director.dispose();
});

test('repeated dart/perch cues cannot restart an active sequence; Return cancels into a smooth return', () => {
  const director=createDragonflyDirector({count:1,scene:'patrol'});
  step(director,[{type:'cue',cue:'dart'}]);
  const duration=selected(director).phase.duration;
  for(let index=0;index<10;index++)step(director,[{type:'cue',cue:index%2?'perch':'dart'}]);
  assert.equal(selected(director).phase.kind,'launch');
  assert(selected(director).phase.elapsed>1);assert.equal(selected(director).phase.duration,duration);
  until(director,member=>member.phase.kind==='dart');
  for(let index=0;index<4;index++)step(director);
  const before=selected(director).position;
  step(director,[{type:'cue',cue:'return'}]);
  assert.equal(selected(director).phase.kind,'return');assert(distance(selected(director).position,before)<.2);
  const trace=until(director,member=>!['return','settle'].includes(member.phase.kind));
  assert(trace.includes('settle'),'Explicit Return stabilizes before rejoining the current route');
  assert.notEqual(selected(director).phase.kind,'dart');
});

test('distant landing approach keeps wing geometry animated until the perch is near', () => {
  const director=createDragonflyDirector({count:1,scene:'attention'},{seed:17,motion:'full'});
  for(let tick=1;tick<=90;tick++)step(director,tick===1?[{type:'pointer',x:.9,y:.6}]:[]);
  director.configure({scene:'relay'});
  let airborneFrames=0,previousAngles=null;
  for(let tick=91;tick<150;tick++) {
    step(director,tick===91?[{type:'leave'}]:[]);
    const member=selected(director),remaining=distance(member.position,member.perch);
    if(remaining<=.18)continue;
    assert.equal(member.phase.kind,'land');
    // Local flap angles isolate appendage animation from root travel and heading.
    const angles=director.sample()[0].geometry.wings.map(wing=>wing.angle);
    assert(angles.some(angle=>Math.abs(angle)>1e-6),
      `Wings became a still pose at tick ${tick} while the perch remained ${remaining} units away`);
    if(previousAngles)assert(angles.some((angle,index)=>Math.abs(angle-previousAngles[index])>1e-6),
      `Wing geometry stopped animating during the distant landing approach at tick ${tick}`);
    previousAngles=angles;airborneFrames++;
  }
  assert(airborneFrames>=20,'The fixture exercises sustained travel before the landing zone');
  director.dispose();
});

test('perch becomes a stationary held pose; pointer activity cannot wake it and a dart lands back', () => {
  const director=createDragonflyDirector({count:1,scene:'attention'});
  step(director,[{type:'cue',cue:'perch'}]);
  const arrival=until(director,member=>member.phase.kind==='perched');
  assert(arrival.includes('land'),'Perch has a landing transition');
  const perch=selected(director).position;
  const still=digest(director.sample()[0].geometry);
  for(let index=0;index<80;index++) {
    step(director,[{type:'pointer',x:Math.sin(index),y:Math.cos(index)}]);
    assert.equal(selected(director).phase.kind,'perched');assert.deepEqual(selected(director).position,perch);
  }
  assert.equal(digest(director.sample()[0].geometry),still,'Perched appendages and root are a still pose');
  step(director,[{type:'cue',cue:'dart'}]);
  assert.equal(selected(director).phase.kind,'launch');
  const excursion=until(director,member=>member.phase.kind==='perched');
  assert.deepEqual(excursion,['launch','dart','settle','return','land','perched']);
  assert(distance(selected(director).position,perch)<1e-8);
  step(director,[{type:'cue',cue:'return'}]);
  assert.notEqual(selected(director).phase.kind,'perched');
});

test('attention responds to normalized guidance without violating continuous scene motion', () => {
  const left=createDragonflyDirector({count:1,scene:'attention'},{seed:17});
  const right=createDragonflyDirector({count:1,scene:'attention'},{seed:17});
  step(left,[{type:'pointer',x:-.9,y:0}]);step(right,[{type:'pointer',x:.9,y:0}]);
  for(let index=0;index<100;index++) {
    const lp=selected(left).position,rp=selected(right).position;
    step(left);step(right);
    assert(distance(selected(left).position,lp)<.2);assert(distance(selected(right).position,rp)<.2);
  }
  assert(selected(left).position.x<selected(right).position.x,'Opposed targets produce opposed attention positions');
  assert.notEqual(digest(left.sample()),digest(right.sample()));
  step(left,[{type:'leave'}]);assert.equal(left.getState().target,null);
});

test('scene sampling transforms samples and named anatomical landmarks together within a four-member budget', () => {
  const director=createDragonflyDirector({count:4});
  for(let tick=1;tick<=180;tick++) {
    step(director,tick===30?[{type:'select',id:1},{type:'cue',cue:'dart'}]:[]);
    if(tick%12!==0)continue;
    const members=director.sample();assert.equal(members.length,4);
    assert(members.reduce((count,member)=>count+member.geometry.samples.length,0)<=4*6144);
    for(const member of members) {
      const {geometry}=member;
      assert.equal(geometry.wings.length,4);assert.equal(geometry.eyes.length,2);
      assert(geometry.samples.length>0 && geometry.samples.length<=6144);
      for(const point of geometry.samples)
        assert([point.x,point.y,point.z,point.tone].every(Number.isFinite));
      for(const wing of geometry.wings) {
        assert(geometry.samples.some(point=>point.part===wing.id && distance(point,wing.root)<1e-10),
          'Transformed wing roots and transformed samples remain attached');
        assert(distance(wing.root,wing.tip)>.1 && distance(wing.root,wing.tip)<2);
      }
      assert(distance(geometry.eyes[0],geometry.eyes[1])>.04);
      assert(distance(geometry.abdomenTip,member.position)>.1);
    }
  }
  const sample=director.sample(),expected=digest(director.sample());
  try { sample[0].geometry.samples[0].x=999; } catch(error) { assert(error instanceof TypeError); }
  assert.equal(digest(director.sample()),expected,'Callers cannot mutate future scene geometry');
});

test('scene snapshots and option roles are deeply immutable; independent directors do not share state', () => {
  const roles=['patroller','sentinel','skimmer','wanderer'];
  const director=createDragonflyDirector({roles}),other=createDragonflyDirector({roles});
  roles[0]='sentinel';assert.equal(director.getOptions().roles[0],'patroller');
  const state=director.getState(),options=director.getOptions();
  for(const mutate of [()=>{state.tick=9;},()=>{state.members.push(state.members[0]);},
    ()=>{state.members[0].position.x=9;},()=>{state.members[0].phase.kind='perched';},()=>{options.roles[0]='sentinel';}])
    assert.throws(mutate,TypeError);
  const otherState=digest(other.getState()),otherGeometry=digest(other.sample());
  step(director,[{type:'cue',cue:'dart'}]);director.configure({count:1});director.reset(42);director.dispose();
  assert.equal(digest(other.getState()),otherState);assert.equal(digest(other.sample()),otherGeometry);
  step(other);assert.equal(other.getState().tick,1);
});

test('pause/static validate without consuming scene ticks or inputs; reset preserves options and user pause', () => {
  const director=createDragonflyDirector({count:4,scene:'relay'},{seed:17});
  step(director);director.setPaused(true);
  const frozen=director.getState();step(director,[{type:'cue',cue:'dart'}]);
  assert.deepEqual(director.getState(),frozen);
  assert.throws(()=>step(director,[{type:'select',id:999}]));assert.deepEqual(director.getState(),frozen);
  director.configure({route:'orbit'});director.configureModel({wingHz:2});director.reset(17);
  assert.equal(director.getState().tick,0);assert.equal(director.getOptions().count,4);
  assert.equal(director.getOptions().route,'orbit');assert.equal(director.getModelOptions().wingHz,2);
  step(director);assert.equal(director.getState().tick,0,'Reset did not resume user pause');
  director.setPaused(false);step(director);assert.equal(director.getState().tick,1);
  director.configureModel({motion:'static'});
  const staticState=director.getState();step(director,[{type:'cue',cue:'dart'}]);
  assert.deepEqual(director.getState(),staticState);
  const before=digest(director.sample());director.setStaticPose(1);
  assert.notEqual(digest(director.sample()),before);assert.equal(director.getState().tick,staticState.tick);
  assert.throws(()=>director.setPaused('false'));assert.throws(()=>director.setStaticPose(2));
});

test('clearTarget and idempotent disposal preserve read-only evidence and reject later mutations', () => {
  const director=createDragonflyDirector();step(director,[{type:'pointer',x:.8,y:.1}]);
  director.clearTarget();assert.equal(director.getState().target,null);
  const tick=director.getState().tick;
  director.dispose();director.dispose();assert.equal(director.getState().tick,tick);
  assert.equal(director.getOptions().count,3);assert(director.getPrimaryState());
  for(const mutate of [()=>step(director),()=>director.configure({}),()=>director.configureModel({}),
    ()=>director.setPaused(false),()=>director.reset(),()=>director.setStaticPose(1),()=>director.clearTarget(),()=>director.sample()])
    assert.throws(mutate,/disposed/);
});

test('headless director imports and runs without DOM globals, clocks or ambient randomness', () => {
  const url=new URL('../lib/director.js',import.meta.url).href;
  const script=`
    for(const key of ['window','document','performance'])Object.defineProperty(globalThis,key,{get(){throw new Error('Unexpected '+key)}});
    Date.now=()=>{throw new Error('Unexpected Date.now')};Math.random=()=>{throw new Error('Unexpected random')};
    const {createDragonflyDirector}=await import(${JSON.stringify(url)});
    const director=createDragonflyDirector({count:4},{seed:17});director.step(1);director.sample();director.dispose();
  `;
  const result=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});
