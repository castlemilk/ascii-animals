import test from 'node:test';
import assert from 'node:assert/strict';
import { createDragonfly, replayDragonfly } from '../lib/variants/kite-scout/model.js';
import { createDragonflyDirector, createDragonflyDirectorHost } from '../lib/variants/kite-scout/director.js';
import { mountDragonfly } from '../lib/variants/kite-scout/browser.js';
import { rasterizeDragonfly, gridToText } from '../lib/variants/kite-scout/preview.js';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';

// Fixed-tick behavior and instrumented input/lifecycle acceptance. Browser
// footage remains necessary to judge expression, gesture usability and pacing.
const magnitude = vector => Math.hypot(vector.x, vector.y);
const distance = (a, b) => Math.hypot(a.x-b.x, a.y-b.y);
function step(model, inputs = []) {
  const before = model.getState();
  model.step(before.tick + 1, inputs.map((input, index) => ({
    tick: before.tick + 1, seq: before.lastSeq + index + 1, ...input,
  })));
  return model.getState();
}

test('inquisitive guidance leads with a turn, retains the chosen lookout and settles after release', () => {
  const outcomes = [];
  for (const direction of [-1, 1]) {
    const model = createDragonfly({ hoverRadius: 0 });
    for (let tick = 1; tick <= 360; tick++) {
      const previous = model.getState();
      const state = step(model, tick === 1 ? [{ type: 'pointer', x: direction*.9, y: -.25 }] : []);
      assert(Math.abs(state.heading-previous.heading) <= .012 + 1e-12, 'The pivot never snaps between headings');
      if (tick === 6) {
        assert(state.heading*direction > .05, 'The silhouette starts turning before substantial translation');
        assert(distance(state.position, {x:0,y:0}) < .015, 'The early look does not teleport toward the guide');
      }
    }
    const held = model.getState();
    assert(held.heading*direction > .45, 'A settled visitor continues to face its chosen lookout');
    assert(held.position.x*direction > .2, 'Opposite guides cause opposite body positions');
    assert(magnitude(held.velocity) < .005, 'The guided hover settles instead of endlessly orbiting');
    outcomes.push(held);
    step(model, [{ type: 'leave' }]);
    for (let tick = 0; tick < 360; tick++) step(model);
    assert(Math.abs(model.getState().heading) < .01, 'Releasing the guide settles the pivot');
    assert(magnitude(model.getState().velocity) < .005);
    model.dispose();
  }
  assert(distance(outcomes[0].position, outcomes[1].position) > .4,
    'Input direction must change the visible outcome, not only a status label');
});

test('a snap-dart visibly draws back before rapid travel and a stationary brake in full and slow motion', () => {
  for (const motion of ['full', 'slow']) for (const side of [-1, 1]) {
    const model = createDragonfly({ motion, hoverRadius: 0 });
    const first = step(model, [{ type:'pointer',x:side*.8,y:-.5 }, {type:'dart'}]);
    assert.equal(first.behavior.kind, 'dart');
    const duration = first.behavior.duration;
    assert.equal(duration, motion === 'slow' ? 80 : 20, 'The accepted dartTicks duration remains intact');
    const origin = first.behavior.from, destination = first.behavior.to;
    const length = distance(origin, destination);
    const lane = {x:(destination.x-origin.x)/length,y:(destination.y-origin.y)/length};
    const anticipation = Math.round(duration*.3), states = [first];
    for (let elapsed = 2; elapsed <= duration; elapsed++) states.push(step(model));
    const load = states[anticipation-1];
    const loadDistance = (load.position.x-origin.x)*lane.x+(load.position.y-origin.y)*lane.y;
    assert(loadDistance < -.02 && loadDistance > -.06, 'The anticipation is a small reverse movement in the selected lane');
    assert(magnitude(load.velocity) < 1e-10, 'The character visibly gathers itself before releasing');
    const preparationSpeed = Math.max(...states.slice(0,anticipation).map(state=>magnitude(state.velocity)));
    const travelSpeed = Math.max(...states.slice(anticipation).map(state=>magnitude(state.velocity)));
    assert(travelSpeed > preparationSpeed*3, 'The response reads as a snap after the deliberate preparation');
    assert(destination.x*side > .3, 'Guide position determines the resulting dart direction');
    for (let index=1;index<states.length;index++)
      assert(distance(states[index].position,states[index-1].position)<.08,'The fast response remains spatially continuous');
    assert.equal(states.at(-1).behavior.kind,'recover');
    assert.deepEqual(states.at(-1).position,destination);
    assert.deepEqual(states.at(-1).velocity,{x:0,y:0});
    for (let index=0;index<12;index++) {
      const settling=step(model);
      assert.deepEqual(settling.position,destination,'The brake holds the landing location while wings settle');
    }
    model.dispose();
  }
});

test('an explicit dart lane overrides the guide and cannot be retargeted halfway through its preparation', () => {
  const model=createDragonfly({hoverRadius:0});
  const first=step(model,[{type:'pointer',x:-1,y:0},{type:'dart',direction:{x:1,y:0}}]);
  const destination=first.behavior.to;
  assert(destination.x>.4);
  for(let tick=2;tick<=20;tick++) {
    const state=step(model,[{type:'pointer',x:tick%2?1:-1,y:.8},{type:'dart',direction:{x:-1,y:0}}]);
    if(state.behavior.kind==='dart')assert.deepEqual(state.behavior.to,destination);
  }
  assert.deepEqual(model.getState().position,destination);
  model.dispose();
});

test('same-tick guide and classic dart commit different lookout angles and different backward lanes', () => {
  const outcomes=[];
  for(const direction of [-1,1]) {
    const director=createDragonflyDirector({count:1,scene:'attention'},{seed:17});
    for(let tick=0;tick<180;tick++)step(director);
    const start=director.getState().members[0].position;
    let state=step(director,[{type:'pointer',x:direction,y:-.25},{type:'cue',cue:'dart'}]);
    const launch=[];const travel=[];
    for(let index=0;index<220;index++) {
      const member=state.members[0];
      if(member.phase.kind==='launch')launch.push(member);
      if(member.phase.kind==='dart'||member.phase.kind==='settle')travel.push(member);
      if(member.phase.kind==='return')break;
      state=step(director,index===8?[{type:'pointer',x:-direction,y:.4}]:[]);
    }
    assert(launch.length>=24);
    assert(launch.at(-1).heading*direction>.5,'Preparation completes the input-directed pivot before darting');
    const end=travel.at(-1);
    assert(end.heading*direction>.5,'Changing the guide mid-cue cannot bend a committed fast response');
    assert((end.position.x-start.x)*direction<-.18,'The backward dart follows the lookout selected by the input');
    outcomes.push(end.position);
    director.dispose();
  }
  assert(distance(outcomes[0],outcomes[1])>.5,'Left and right guides cannot produce the same classic response');
});

test('director expression interpolation preserves the preceding exact pose and does not mutate accepted state', () => {
  const host=createDragonflyDirectorHost({count:1,scene:'attention'},{seed:17});
  const {director,samplePresentation}=host;
  for(let tick=0;tick<90;tick++)step(director);
  const before=director.sample();
  step(director,[{type:'pointer',x:-1,y:-.4},{type:'cue',cue:'dart'}]);
  const after=director.sample(),state=director.getState(),legacy=director.getPrimaryState();
  assert.deepEqual(samplePresentation(0).map(({geometry,position})=>({geometry,position})),
    before.map(({geometry,position})=>({geometry,position})),
    'New look/load information cannot leak into the previous visible pose; phase metadata remains current');
  assert.deepEqual(samplePresentation(1),after);
  for(const alpha of [.25,.5,.75])samplePresentation(alpha);
  assert.deepEqual(director.getState(),state);
  assert.deepEqual(director.getPrimaryState(),legacy);
  assert.equal(legacy.behavior.kind,'idle','The accepted lead-model snapshot is not relabelled as a solo dart');
  director.dispose();
});

test('the new character response preserves deterministic state and ASCII cells across render grouping', () => {
  const record={schemaVersion:1,speciesVersion:'dragonfly-v1',options:{seed:991,hoverRadius:0},ticks:213,events:[
    {type:'pointer',tick:1,seq:0,x:-.8,y:-.25},
    {type:'dart',tick:45,seq:1},
    {type:'leave',tick:90,seq:2},
    {type:'pointer',tick:205,seq:3,x:.9,y:.3},
    {type:'dart',tick:205,seq:4},
  ]};
  const outcomes=[1,2,5].map(cadence=>{
    const model=replayDragonfly(record,cadence);
    const state=model.getState(),grid=rasterizeDragonfly(model.sample(),{cols:72,rows:44,view:'oblique',neutral:false});
    assert.equal(grid.clippedSamples,0);
    const text=gridToText(grid);assert.match(text,/^[\x20-\x7e\n]+$/);
    model.dispose();return {state,text};
  });
  assert.deepEqual(outcomes[1],outcomes[0]);assert.deepEqual(outcomes[2],outcomes[0]);
});

function fixture({reduced=false,directed=false}={}) {
  const browser=fakeBrowser({reducedMotion:reduced}),canvas=browser.canvas(390,520);
  canvas.getContext('2d').measureText=()=>({width:5});
  const host=mountDragonfly(canvas,directed?{director:{count:2,scene:'attention'}}:{});
  return {browser,canvas,host,
    key(key,fields={}){const event={key,preventDefault(){this.defaultPrevented=true;},...fields};canvas.emit('keydown',event);return event;},
    frames(count=1){for(let index=0;index<count;index++)browser.frame();},
  };
}

test('focused D and Enter use the existing solo action without hijacking Tab, modifier keys or repeated presses', () => {
  const f=fixture();f.frames(2);
  for(const key of ['d','Enter']) {
    f.host.reset();f.frames(2);f.host.setTarget(.8,-.5);
    assert.equal(f.key(key,{ctrlKey:true}).defaultPrevented,undefined);
    assert.equal(f.key(key,{repeat:true}).defaultPrevented,true);
    assert.equal(f.host.getStatus().pendingInputs,1,'A held key does not repeatedly enqueue a dart');
    assert.equal(f.key(key).defaultPrevented,true);f.frames();
    assert.equal(f.host.getState().behavior.kind,'dart');
    assert(f.host.getState().behavior.to.x>0);
  }
  assert.equal(f.key('Tab').defaultPrevented,undefined);
  assert.equal(f.browser.document.listeners.get('keydown'),undefined);
  assert.equal(f.browser.view.listeners.get('keydown'),undefined);
  f.host.dispose();assert.equal(f.browser.pending,0);assert.equal(f.canvas.listenerCount,0);
});

test('cancellation removes queued reactions and the new shortcut respects offscreen, reduced motion and user pause', () => {
  for(const directed of [false,true]) {
    const f=fixture({directed});f.frames(2);
    f.host.setTarget(-.8,0);f.key('d');
    assert(f.host.getStatus().pendingInputs>=2);
    f.canvas.emit('pointercancel',{pointerType:'touch'});
    assert.equal(f.host.getStatus().pendingInputs,0);f.frames();
    if(directed)assert.notEqual(f.host.getDirectorState().members[0].phase.kind,'launch');
    else assert.notEqual(f.host.getState().behavior.kind,'dart');
    f.browser.intersect(f.canvas,false);
    const tick=f.host.getStatus().tick;f.key('Enter');f.frames(3);
    assert.equal(f.host.getStatus().tick,tick);assert.equal(f.host.getStatus().pendingInputs,0);assert.equal(f.browser.pending,0);
    f.browser.intersect(f.canvas,true);f.host.setPaused(true);f.host.reset();
    const still=f.host.exportText();f.key('d');
    assert.notEqual(f.host.exportText(),still);assert.equal(f.host.getStatus().tick,0);assert.equal(f.browser.pending,0);
    f.browser.setReduced(true);f.host.setPaused(false);f.key('Enter');f.frames(3);
    assert.equal(f.host.getStatus().tick,0);assert.equal(f.browser.pending,0);
    f.host.dispose();assert.equal(f.canvas.listenerCount,0);
  }
});
