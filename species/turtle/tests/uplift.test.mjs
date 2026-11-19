import test from 'node:test';
import assert from 'node:assert/strict';
import { createTurtleArtwork, createTurtleModel } from '../../../lib/public/turtle.js';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';

// Behavioral acceptance for the turtle's authored breath and dive. These are
// pure-model and synthetic browser-host tests, not visual/browser acceptance.
// Geometry, scute attachment and actual phone readability require matched renders.
const options = {
  scene: 'blue-drift', count: 1, director: 'hold', seed: 7,
  columns: 160, rows: 64, facing: 'left'
};
const cueY = { breath: -.9, dive: .9 };
const member = model => model.getDirectorState().members[0];
const pose = m => ({ x: m.x, y: m.y, depth: m.depth, heading: m.heading, bank: m.bank, stroke: m.stroke });
function advance(model, ticks, group = 600) {
  while (ticks > 0) {
    const batch = Math.min(ticks, group);
    model.advanceTicks(batch); ticks -= batch;
  }
}

function traceCue(kind, facing = 'left', ticks = 340) {
  const model = createTurtleModel({ ...options, facing });
  const reference = createTurtleModel({ ...options, facing });
  model.inspect(0, cueY[kind]);
  const trace = [{ tick: 0, actual: member(model), reference: member(reference) }];
  for (let tick = 1; tick <= ticks; tick++) {
    model.advanceTicks(1); reference.advanceTicks(1);
    trace.push({ tick, actual: member(model), reference: member(reference) });
  }
  return { model, reference, trace };
}

test('breath and dive replay exactly across 1/2/5-tick presentation groups, including pace changes', () => {
  function replay(group) {
    const m = createTurtleModel(options);
    const events = [
      [12, () => m.inspect(0, cueY.breath)],
      [149, () => m.configure({ speed: 1.4, current: -.45 })],
      [285, () => m.clearGuide()],
      [370, () => m.inspect(0, cueY.dive)],
      [489, () => m.configure({ speed: .65 })],
      [680, () => m.clearGuide()]
    ];
    let tick = 0, event = 0;
    while (tick < 740) {
      if (events[event]?.[0] === tick) events[event++][1]();
      const nextEvent = events[event]?.[0] ?? 740;
      const count = Math.min(group, nextEvent - tick, 740 - tick);
      m.advanceTicks(count); tick += count;
      m.frame(); // Presentation frequency must not affect the simulation.
    }
    return { state: m.getState(), director: m.getDirectorState(), frame: m.frame() };
  }
  const one = replay(1);
  assert.deepEqual(replay(2), one);
  assert.deepEqual(replay(5), one);
});

test('breath rises and dive descends, then both recover depth and lane while keeping forward progress', () => {
  for (const facing of ['left', 'right']) for (const kind of ['breath', 'dive']) {
    const { trace, model } = traceCue(kind, facing);
    const sign = kind === 'breath' ? -1 : 1;
    const vertical = trace.map(({ actual: a, reference: b }) => sign * (a.y - b.y));
    const depth = trace.map(({ actual: a, reference: b }) => sign * (a.depth - b.depth));
    assert(Math.max(...vertical) >= .18, `${facing} ${kind} needs a visible vertical excursion`);
    assert(Math.max(...depth) >= .04, `${facing} ${kind} must change water depth, not only rotate`);
    const end = trace.at(-1);
    assert(Math.abs(end.actual.y - end.reference.y) < .08, `${facing} ${kind} must recover its lane`);
    assert(Math.abs(end.actual.depth - end.reference.depth) < .06, `${facing} ${kind} must recover water depth`);
    assert(Math.abs(end.actual.heading - end.reference.heading) < .12, `${facing} ${kind} must relevel`);
    assert.equal(end.actual.reaction.kind, 'none');
    assert.equal(model.getState().tick, 340);

    const forward = facing === 'left' ? -1 : 1;
    const first = trace[0].actual;
    assert((end.actual.x - first.x) * forward > .06, `${facing} ${kind} needs forward travel`);
    // A 0.2-second window ignores insignificant raster-scale/anticipatory jitter,
    // while detecting the old return-to-slot backward slide through recovery.
    for (let tick = 12; tick < trace.length; tick += 12) {
      const progress = (trace[tick].actual.x - trace[tick - 12].actual.x) * forward;
      assert(progress >= -.001, `${facing} ${kind} reversed through tick ${tick}: ${progress}`);
    }
  }
});

test('meaningful vertical travel is accompanied by matching nose pitch in either facing', () => {
  for (const facing of ['left', 'right']) for (const kind of ['breath', 'dive']) {
    const { trace } = traceCue(kind, facing, 280);
    let travelingWindows = 0, alignedWindows = 0;
    // Opening anticipation and the final relevel may lead/lag translation.
    // During substantial ascent/descent the turtle must face its vertical travel.
    for (let tick = 54; tick <= 270; tick += 18) {
      const start = trace[tick - 18].actual, end = trace[tick].actual;
      const dy = end.y - start.y;
      if (Math.abs(dy) < .012) continue;
      travelingWindows++;
      const heading = (start.heading + end.heading) / 2;
      const noseY = Math.sin(heading) * (facing === 'left' ? -1 : 1);
      if (Math.abs(noseY) > .035 && noseY * dy > 0) alignedWindows++;
    }
    assert(travelingWindows >= 2, `${facing} ${kind} has too little vertical travel to assess`);
    assert(alignedWindows / travelingWindows >= .7,
      `${facing} ${kind} pitched with travel in only ${alignedWindows}/${travelingWindows} windows`);
  }
});

test('cue phase joins preserve continuous position, depth and pitch without a swivel', () => {
  for (const facing of ['left', 'right']) for (const kind of ['breath', 'dive']) {
    const { trace } = traceCue(kind, facing);
    for (let tick = 1; tick < trace.length; tick++) {
      const a = trace[tick - 1].actual, b = trace[tick].actual;
      assert(Object.values(pose(b)).every(Number.isFinite));
      assert(b.depth >= 0 && b.depth <= 1);
      assert(Math.hypot(b.x - a.x, b.y - a.y) < .035, `${kind} position jumped at ${tick}`);
      assert(Math.abs(b.depth - a.depth) < .025, `${kind} depth jumped at ${tick}`);
      assert(Math.abs(b.heading - a.heading) < .035, `${kind} pitch jumped at ${tick}`);
      assert(Math.abs(b.heading) < .85, `${kind} rotated beyond a bounded swimming pitch at ${tick}`);
    }
  }
});

test('surface breath keeps the owned silhouette clear of the top and bottom crop at phone and minimum grids', () => {
  // Added after the matched native renders exposed a clipped far foreflipper.
  // This checks actual logical output, not a duplicate of the projection math.
  for (const [columns, rows] of [[80, 32], [100, 40]]) for (const facing of ['left', 'right']) {
    const m = createTurtleModel({ ...options, columns, rows, facing });
    m.inspect(0, cueY.breath);
    advance(m, 100);
    for (const tick of [100, 110, 120]) {
      if (tick > 100) advance(m, 10);
      const f = m.frame();
      const border = [...f.cells.slice(0, columns), ...f.cells.slice((rows - 1) * columns)];
      assert(border.every(cell => cell.ownerId === null),
        `${columns}x${rows} ${facing} breath silhouette touches a vertical crop at tick ${tick}`);
    }
  }
});

test('a running cue is neither retargeted nor retriggered, and its cooldown remains effective', () => {
  const m = createTurtleModel(options), uninterrupted = createTurtleModel(options);
  m.inspect(0, cueY.breath); uninterrupted.inspect(0, cueY.breath);
  advance(m, 60); advance(uninterrupted, 60);
  const responseTick = m.getState().responseTick;
  for (let i = 0; i < 50; i++) m.inspect((i % 3 - 1) * .4, cueY.dive);
  assert.equal(m.getState().responseTick, responseTick);
  assert.equal(member(m).reaction.kind, 'inspect');
  for (let i = 0; i < 220; i++) {
    m.advanceTicks(1); uninterrupted.advanceTicks(1);
    assert.deepEqual(pose(member(m)), pose(member(uninterrupted)), 'an in-flight breath must keep its captured trajectory');
  }
  assert.equal(member(m).reaction.kind, 'none');
  m.inspect(0, cueY.dive);
  assert.equal(member(m).reaction.kind, 'none', 'cooldown must survive recovery');
  advance(m, 60);
  m.inspect(0, cueY.dive);
  assert.equal(member(m).reaction.kind, 'inspect', 'a fresh cue is accepted after cooldown');
});

test('breath and dive affect only the selected traveler', () => {
  for (const kind of ['breath', 'dive']) {
    const ensemble = { ...options, scene: 'reef-passage', count: 3 };
    const m = createTurtleModel(ensemble), reference = createTurtleModel(ensemble);
    m.inspect(0, cueY[kind], 1);
    for (let tick = 1; tick <= 340; tick++) {
      m.advanceTicks(1); reference.advanceTicks(1);
      const actual = m.getDirectorState(), expected = reference.getDirectorState();
      assert.equal(actual.selectedId, 1);
      for (const id of [0, 2]) assert.deepEqual(actual.members[id], expected.members[id], `cue leaked to traveler ${id} at ${tick}`);
    }
  }
});

test('reset clears cue travel and restores a fresh equivalent model', () => {
  const m = createTurtleModel(options);
  m.inspect(0, cueY.dive); advance(m, 340);
  m.inspect(0, cueY.breath); advance(m, 163);
  m.configure({ speed: .7, current: .3 }); m.reset();
  const fresh = createTurtleModel({ ...options, speed: .7, current: .3 });
  assert.deepEqual(m.getState(), fresh.getState());
  assert.deepEqual(m.getDirectorState(), fresh.getDirectorState());
  assert.deepEqual(m.frame(), fresh.frame());
});

test('later looping passages retain their visible cast instead of accumulating offstage drift', () => {
  // The initial candidate used global life for forward route displacement: by
  // passage eight, the linger composition contained no animal glyphs at all.
  const m = createTurtleModel({ ...options, scene: 'reef-passage', count: 3, director: 'loop' });
  const checked = new Set();
  for (let second = 0; second < 300; second++) {
    m.advanceTicks(60);
    const d = m.getDirectorState();
    if (d.phase !== 'linger' || d.progress < .4 || d.progress >= .5 ||
        ![0, 3, 7].includes(d.cycle) || checked.has(d.cycle)) continue;
    checked.add(d.cycle);
    const owners = new Set(m.frame().cells.map(cell => cell.ownerId));
    for (const id of [0, 1, 2]) assert(owners.has(id), `traveler ${id} disappeared from passage ${d.cycle + 1}`);
  }
  assert.deepEqual([...checked], [0, 3, 7]);
});

test('the default centered study remains visible after two minutes of automatic breaths and resets cleanly', () => {
  const m = createTurtleModel(), fresh = createTurtleModel();
  advance(m, 120 * 60);
  const d = m.getDirectorState(), f = m.frame();
  assert.equal(m.getState().tick, 7200);
  assert.equal(d.scene, 'study'); assert.equal(d.members.length, 1);
  assert(Math.abs(d.members[0].x) < 1e-12, 'the study camera must retain its centered screen position');
  assert(f.cells.filter(cell => cell.ownerId === 0).length > 80,
    'repeated automatic breaths must not carry the default study permanently out of view');
  m.reset();
  assert.deepEqual(m.getState(), fresh.getState());
  assert.deepEqual(m.getDirectorState(), fresh.getDirectorState());
  assert.deepEqual(m.frame(), fresh.frame());
});

test('paused and reduced-motion breath/dive posters are distinct without ticks or scheduler work', () => {
  for (const reducedMotion of [false, true]) {
    const h = fakeBrowser({ reducedMotion });
    const canvas = h.canvas(390, 280);
    const art = createTurtleArtwork(canvas, { ...options, columns: 100, rows: 40, paused: !reducedMotion });
    h.intersect(canvas, true);
    const tick = art.getStatus().tick, initial = art.getFrame().text;
    art.inspect(0, cueY.breath);
    const breath = art.getFrame().text, breathDepth = art.getDirectorState().members[0].depth;
    art.inspect(0, cueY.dive);
    const dive = art.getFrame().text, diveDepth = art.getDirectorState().members[0].depth;
    assert.equal(new Set([initial, breath, dive]).size, 3, 'each deliberate still action needs a useful distinct pose');
    assert(diveDepth > breathDepth + .04, 'still depth must reflect the requested sequence');
    assert.equal(art.getStatus().tick, tick); assert(art.getStatus().paused); assert.equal(h.pending, 0);
    canvas.emit('pointermove', { clientX: 20, clientY: 40 }); h.frame(10000);
    assert.equal(art.getFrame().text, dive); assert.equal(art.getStatus().tick, tick); assert.equal(h.pending, 0);
    art.dispose();
    assert.equal(canvas.listenerCount, 0); assert.equal(h.pending, 0);
    assert.equal(h.resizes.size, 0); assert.equal(h.intersections.size, 0);
  }
});

test('CSS and grid resize during a dive preserve its clock, pose and continuing trajectory', () => {
  const h = fakeBrowser(), canvas = h.canvas(1008, 720);
  const art = createTurtleArtwork(canvas, options), reference = createTurtleModel(options);
  h.intersect(canvas, true);
  art.inspect(0, cueY.dive); reference.inspect(0, cueY.dive);
  h.frame(0);
  for (let tick = 0; tick < 45; tick++) h.frame(1000 / 60);
  advance(reference, 45);
  const before = art.getDirectorState(), tick = art.getStatus().tick;
  assert.equal(tick, 45);
  canvas.rect.width = 390; canvas.rect.height = 280; art.resize();
  art.update({ columns: 100, rows: 40 }); reference.configure({ columns: 100, rows: 40 });
  assert.equal(art.getStatus().tick, tick);
  assert.deepEqual(art.getDirectorState(), before);
  assert.equal(art.getFrame().columns, 100); assert.equal(art.getFrame().rows, 40);
  for (let step = 0; step < 120; step++) h.frame(1000 / 60);
  advance(reference, 120);
  assert.equal(art.getStatus().tick, 165);
  assert.deepEqual(art.getDirectorState(), reference.getDirectorState());
  assert.deepEqual(art.getFrame(), reference.frame());
  art.dispose(); assert.equal(h.pending, 0);
});

test('focused B/D keys match explicit cues, ignore modified chords, and preserve still playback', () => {
  for (const mode of ['running', 'paused', 'reduced']) {
    const h = fakeBrowser({ reducedMotion: mode === 'reduced' });
    const canvas = h.canvas(), referenceCanvas = h.canvas();
    const config = { ...options, paused: mode === 'paused' };
    const art = createTurtleArtwork(canvas, config), explicit = createTurtleArtwork(referenceCanvas, config);
    h.intersect(canvas, true); h.intersect(referenceCanvas, true);
    let prevented = 0;
    const key = (key, modifiers = {}) => canvas.emit('keydown', {
      key, preventDefault() { prevented++; }, ...modifiers
    });
    const unchanged = art.getDirectorState(), unchangedTick = art.getStatus().tick;
    for (const name of ['b', 'B', 'd', 'D']) for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) key(name, { [modifier]: true });
    assert.equal(prevented, 0, 'browser/platform key chords must remain available');
    assert.deepEqual(art.getDirectorState(), unchanged);
    assert.equal(art.getStatus().tick, unchangedTick);

    for (const name of ['b', 'B', 'd', 'D']) {
      art.restart(); explicit.restart();
      // A distant prior marker must not change the meaning of B/D.
      art.guide(.7, .25); explicit.guide(.7, .25);
      const selected = art.getDirectorState().members[0];
      const x = Math.max(-1, Math.min(1, selected.x));
      key(name);
      explicit.inspect(x, name.toLowerCase() === 'b' ? cueY.breath : cueY.dive);
      assert.deepEqual(art.getDirectorState(), explicit.getDirectorState());
      assert.deepEqual(art.getFrame(), explicit.getFrame());
      if (mode === 'running') {
        h.frame(0);
        for (let tick = 0; tick < 110; tick++) h.frame(1000 / 60);
        assert.equal(art.getStatus().tick, 110);
        assert.deepEqual(art.getDirectorState(), explicit.getDirectorState());
      } else {
        const poster = art.getFrame().text;
        h.frame(2000);
        assert.equal(art.getStatus().tick, 0);
        assert(art.getStatus().paused); assert.equal(h.pending, 0);
        assert.equal(art.getFrame().text, poster);
      }
    }
    assert.equal(prevented, 4);
    art.dispose(); explicit.dispose();
    assert.equal(canvas.listenerCount, 0); assert.equal(referenceCanvas.listenerCount, 0);
    assert.equal(h.pending, 0); assert.equal(h.resizes.size, 0); assert.equal(h.intersections.size, 0);
  }
});
