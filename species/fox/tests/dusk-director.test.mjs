import test from 'node:test';
import assert from 'node:assert/strict';
import { createFoxDirector } from '../lib/director.js';
import { buildFoxSceneGrid } from '../lib/director-render.js';

function invitation(cue, options = {}) {
  const director = createFoxDirector({ seed: 17, count: 1, ...options });
  const snapshots = [];
  for (let age = 1; age <= 420; age++) {
    const inputs = age === 1 ? [{ type: 'cue', tick: 1, seq: 0, cue, id: 0, x: .8, y: .68 }] : [];
    snapshots.push(director.step(age, inputs).state.actors[0]);
  }
  director.dispose();
  return snapshots;
}

test('hunt triangulates before travel, plants between two creeps, and releases the prey guide after its leap', () => {
  const frames = invitation('rustle');
  const listening = frames.slice(0, 44);
  assert(listening.every(a => a.action === 'listening' && a.state.rootX === 0));
  assert(listening.some(a => Math.abs(a.expression.earNear - a.expression.earFar) > .25),
    'independent ears cross-check while all paws hold');
  assert(listening.some(a => a.expression.headPitch < -.10), 'the head follows the initial ear response');
  assert(frames[80].state.rootX > .025, 'the first deliberate creep changes the root');
  const firstPause = frames.slice(108, 129); // Cue ages 109..129; the second creep starts at 130.
  assert(firstPause.every(a => a.action === 'sniffing'));
  assert(firstPause.at(-1).state.rootX - firstPause[0].state.rootX < .002,
    'the sniff interval contains a real planting pause rather than continuous travel');
  assert(firstPause.at(-1).state.feet.every(f => f.mode === 'planted'),
    'every swing finishes before the second creep begins');
  assert(frames[162].state.rootX > frames[120].state.rootX + .025, 'a second distinct creep follows the pause');
  const swinging = new Set(frames.slice(44, 165).flatMap(a => a.state.feet.filter(f => f.mode === 'swing').map(f => f.id)));
  assert(swinging.size >= 2, 'the approach uses separately articulated feet');
  assert.equal(frames[203].state.behavior.kind, 'sniff');
  assert.equal(frames[204].state.behavior.kind, 'crouch');
  for (const phase of ['airborne', 'landing', 'recover', 'cooldown']) {
    assert(frames.some(a => a.state.behavior.kind === phase), `the captured response includes ${phase}`);
  }
  const recovery = frames.filter(a => ['recover', 'cooldown'].includes(a.state.behavior.kind));
  assert(recovery.every(a => a.action === 'recovering' && !a.state.target.active),
    'recovery does not keep driving or sniffing toward the stale cue');
  assert(frames.slice(385).every(a => a.state.behavior.kind === 'idle' && a.action === 'recovering'));
  assert(Math.abs(frames.at(-1).expression.headPitch) < .001);
  assert(Math.abs(frames.at(-1).expression.tailLift) < .001);
});

test('curiosity is visibly tail-led, then turns the head, bows, steps and recovers from its answering hop', () => {
  const frames = invitation('play');
  assert(frames.slice(0, 20).every(a => a.expression.headPitch === 0 && a.expression.earNear === 0
    && a.expression.earFar === 0 && a.expression.bow === 0 && a.state.rootX === 0),
  'head, ears, shoulders and root wait while the brush starts the invitation');
  assert(frames[19].expression.tailLift < -.10, 'the tail has visibly raised before the head begins');
  assert(frames[47].expression.headPitch < -.10, 'the head follows the tail');
  assert(frames[79].expression.bow > .5, 'the shoulder bow follows the head response');
  assert(frames.slice(0, 75).every(a => a.state.rootX === 0), 'the whole-body approach follows the appendage sequence');
  assert(frames[124].state.rootX > .02, 'the curiosity sequence includes actual paw-driven approach');
  assert.equal(frames[129].state.behavior.kind, 'crouch', 'the original play cue delay stays 130 ticks');
  assert(frames.some(a => a.state.behavior.kind === 'airborne'));
  assert(frames.slice(310).every(a => a.action === 'recovering' && !a.state.target.active));
  assert(Math.abs(frames.at(-1).expression.tailLift) < .001, 'the tail settles back after the response');
});

test('a cue from an existing pose keeps its original head still during the tail lead', () => {
  const director = createFoxDirector({ count: 1, scene: 'den-watch' });
  for (let tick = 1; tick <= 260; tick++) director.step(tick);
  const origin = director.getState().actors[0].expression;
  assert(origin.rest > .9, 'this invitation begins with a tucked fox');
  for (let age = 1; age <= 20; age++) {
    const tick = 260 + age;
    director.step(tick, age === 1 ? [{ type: 'cue', tick, seq: 0, cue: 'play', id: 0 }] : []);
    const expression = director.getState().actors[0].expression;
    assert.equal(expression.headPitch, origin.headPitch, 'tail lead preserves the current head angle, not a replacement neutral pose');
    assert.equal(expression.earNear, origin.earNear);
    assert.equal(expression.earFar, origin.earFar);
  }
  assert(director.getState().actors[0].expression.tailLift < origin.tailLift - .15);
  director.dispose();
});

test('stationary ground anchors preserve planted world paws; only deliberate layout edits reframe the cast', () => {
  const director = createFoxDirector({ count: 2, roles: ['lookout', 'lookout'], scene: 'moon-play' });
  for (let tick = 1; tick <= 260; tick++) director.step(tick);
  const stance = director.getState().actors;
  for (let tick = 261; tick <= 450; tick++) {
    const actors = director.step(tick).state.actors;
    for (const a of actors) {
      const prior = stance[a.id];
      assert.equal(a.x, prior.x); assert.equal(a.y, prior.y);
      for (let i = 0; i < 4; i++) {
        assert.equal(a.state.feet[i].mode, 'planted');
        assert.equal(a.x + a.state.feet[i].x * a.size, prior.x + prior.state.feet[i].x * prior.size,
          'a planted paw cannot slide because of an unrelated director sine wave');
      }
    }
  }
  const beforeEdit = director.getState();
  director.configure({ spacing: .8 });
  const afterEdit = director.getState();
  assert.equal(afterEdit.tick, beforeEdit.tick);
  assert.notEqual(afterEdit.actors[0].x, beforeEdit.actors[0].x, 'spacing remains an effective composition control');
  assert.equal(director.step(451).state.actors[0].x, afterEdit.actors[0].x);
  director.dispose();
});

test('ambient hunt uses the full cue anticipation instead of going directly into its pounce', () => {
  const director = createFoxDirector({ count: 1, scene: 'dusk-hunt' });
  for (let tick = 1; tick <= 625; tick++) director.step(tick);
  assert.equal(director.getState().actors[0].intent.kind, 'autonomous');
  const start = director.step(626).state.actors[0];
  assert.equal(start.intent.kind, 'investigate');
  assert.equal(start.intent.age, 1);
  assert.equal(start.intent.playful, false);
  assert.equal(start.action, 'listening');
  for (let tick = 627; tick <= 830; tick++) director.step(tick);
  assert.equal(director.getState().actors[0].state.behavior.kind, 'crouch');
  director.dispose();
});

test('scene and animal edits during a hop preserve its captured response and recovery expression', () => {
  const directors = [createFoxDirector({ count: 1 }), createFoxDirector({ count: 1 })];
  for (let tick = 1; tick <= 170; tick++) {
    for (const director of directors) director.step(tick, tick === 1
      ? [{ type: 'cue', tick, seq: 0, cue: 'play', id: 0, x: .8, y: .68 }] : []);
  }
  assert.equal(directors[0].getState().actors[0].state.behavior.kind, 'airborne');
  directors[1].configure({ scene: 'den-watch' });
  directors[1].configureFox({ pounceHeight: .34, landingTicks: 25, recoveryTicks: 80 });
  for (let tick = 171; tick <= 309; tick++) {
    const actors = directors.map(d => d.step(tick).state.actors[0]);
    assert.deepEqual(actors[1].state.behavior, actors[0].state.behavior, 'the leap retains its captured animal options');
    assert.deepEqual(actors[1].expression, actors[0].expression, 'its playful return remains the same after the scene changes');
    assert.equal(actors[1].state.target.active, false, 'no replacement scene guide leaks into the busy response');
  }
  directors.forEach(d => d.dispose());
});

test('the two directed sequences replay identical states and cells across presentation groupings', () => {
  const events = new Map([
    [1, [{ type: 'cue', tick: 1, seq: 0, cue: 'rustle', id: 0, x: .8, y: .6 }]],
    [230, [{ type: 'cue', tick: 230, seq: 1, cue: 'rustle', id: 0, x: -.8, y: .2 }]],
    [430, [{ type: 'cue', tick: 430, seq: 2, cue: 'play', id: 0, x: -.65, y: .4 }]],
    [451, [{ type: 'leave', tick: 451, seq: 3 }]],
  ]);
  function run(group) {
    const director = createFoxDirector({ seed: 103, count: 2, roles: ['hunter', 'lookout'] });
    const samples = [];
    for (let tick = 1; tick <= 900; tick++) {
      director.step(tick, events.get(tick) ?? []);
      if (tick % group === 0) director.getFrame();
      if (tick % 30 === 0) samples.push({ state: director.getState(),
        cells: buildFoxSceneGrid(director.getFrame(), { cols: 112, rows: 64 }).text });
    }
    director.dispose();
    return samples;
  }
  const one = run(1);
  assert.deepEqual(run(2), one);
  assert.deepEqual(run(5), one);
});
