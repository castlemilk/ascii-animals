import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLagoonScout } from '../scripts/build-lagoon-scout.mjs';
const { createLagoonScoutArtwork: createTurtleArtwork, createLagoonScoutModel: createTurtleModel } = await loadLagoonScout();
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';

// Outcome acceptance for the character's two midwater invitations. These are
// numerical/cell and synthetic-host tests, not browser or visual evidence.
const options = {
  scene: 'blue-drift', count: 1, director: 'hold', seed: 7,
  columns: 120, rows: 50, facing: 'left'
};
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const member = model => model.getDirectorState().members[0];
const pose = m => ({ x: m.x, y: m.y, depth: m.depth, heading: m.heading, bank: m.bank, stroke: m.stroke });
function advance(model, ticks, group = 600) {
  while (ticks > 0) { const n = Math.min(ticks, group); model.advanceTicks(n); ticks -= n; }
}
function input(model, distance, height = 0) {
  const m = member(model), dir = model.getOptions().facing === 'left' ? -1 : 1;
  return [clamp(m.x + dir * distance, -1, 1), clamp(m.y + height, -.50, .50)];
}
function trace(distance, height = 0, facing = 'left') {
  const model = createTurtleModel({ ...options, facing });
  const reference = createTurtleModel({ ...options, facing });
  model.inspect(...input(model, distance, height));
  const samples = [];
  for (let tick = 0; tick <= 340; tick++) {
    samples.push({ tick, actual: member(model), reference: member(reference) });
    if (tick < 340) { model.advanceTicks(1); reference.advanceTicks(1); }
  }
  return { model, samples };
}
const earned = (sample, facing) => (sample.actual.x - sample.reference.x) * (facing === 'left' ? -1 : 1);

test('near and distant midwater invitations have different movement outcomes in either facing', () => {
  for (const facing of ['left', 'right']) {
    const near = trace(.08, 0, facing), far = trace(.80, 0, facing);
    const quietTravel = earned(near.samples.at(-1), facing);
    const glideTravel = earned(far.samples.at(-1), facing);
    assert(glideTravel > quietTravel + .15,
      `${facing}: a distant invitation must earn substantially more travel than a guarded peek`);
    assert(quietTravel < .08, 'tuck/peek should remain a close encounter');
    assert(glideTravel < .65, 'a single invitation must remain bounded');
    assert.equal(near.samples.at(-1).actual.reaction.kind, 'none');
    assert.equal(far.samples.at(-1).actual.reaction.kind, 'none');
    assert.notDeepEqual(pose(near.samples[105].actual), pose(far.samples[105].actual),
      'the principal response must differ in actual posture, not only its guide marker');
  }
});

test('a close greeting keeps a broad near-horizontal attitude instead of turning into a steep dive', () => {
  // Added after native five-key review showed a thin near-vertical shell during
  // tuck/peek: a route tangent is ill-conditioned while forward travel waits.
  // This guards the public pose outcome; visual character recognition remains
  // a separate review of the actual cells and browser captures.
  for (const scene of ['study', 'blue-drift']) for (const facing of ['left', 'right']) {
    for (const height of [-.12, .12]) {
      const model = createTurtleModel({ ...options, scene, facing });
      // The solo capture that exposed the defect began at tick 60. Blue drift
      // starts neutral instead: its ordinary route can already be pitched more
      // than .18 by tick 60, and a cue must not snap that prior attitude away.
      // The .18 acceptance bound is unchanged; this fixture isolates cue tilt.
      if (scene === 'study') advance(model, 60);
      model.inspect(...input(model, .08, height));
      const duration = scene === 'study' ? 180 : 280;
      for (let tick = 0; tick < duration; tick++) {
        model.advanceTicks(1);
        assert(Math.abs(member(model).heading) <= .18,
          `${scene} ${facing} close greeting became a dive at cue tick ${tick + 1}`);
      }
    }
  }
});

test('glide anticipates before travel, retains earned distance and visibly recovers', () => {
  for (const facing of ['left', 'right']) {
    const { samples } = trace(.80, -.18, facing);
    const total = earned(samples.at(-1), facing);
    assert(Math.abs(earned(samples[24], facing)) < total * .12,
      'shoulder preparation needs a quiet interval before forward commitment');
    assert(earned(samples[150], facing) > total * .25,
      'the middle of the cue must have committed to visible travel');
    assert(Math.abs(samples.at(-1).actual.y - samples.at(-1).reference.y) < .04,
      'recovery must return to the continuing route lane');
    assert(Math.abs(samples.at(-1).actual.heading - samples.at(-1).reference.heading) < .12,
      'recovery must level the animal');
    for (let tick = 12; tick < samples.length; tick += 12) {
      assert(earned(samples[tick], facing) >= earned(samples[tick - 12], facing) - .002,
        `earned travel was unwound during recovery at tick ${tick}`);
    }
  }
});

test('distance changes glide commitment while target height changes its excursion', () => {
  const nearer = trace(.50), farther = trace(.90);
  assert(earned(farther.samples.at(-1), 'left') > earned(nearer.samples.at(-1), 'left') + .05,
    'two distant invitations must not replay the same amount of travel');
  for (const height of [-.25, .25]) {
    const { samples } = trace(.75, height);
    const sign = Math.sign(height);
    assert(Math.max(...samples.map(s => sign * (s.actual.y - s.reference.y))) > .07,
      'a rising/falling midwater invitation must change the route, not only the eye direction');
    assert(Math.abs(samples.at(-1).actual.y - samples.at(-1).reference.y) < .04,
      'height choice must not leave a permanent displaced lane');
  }
});

test('a captured midwater cue is not redirected, restarted or queued by a burst of later invitations', () => {
  for (const distance of [.08, .80]) {
    const actual = createTurtleModel(options), reference = createTurtleModel(options);
    actual.inspect(...input(actual, distance, -.12));
    reference.inspect(...input(reference, distance, -.12));
    advance(actual, 70); advance(reference, 70);
    const responseTick = actual.getState().responseTick;
    for (let i = 0; i < 500; i++) actual.inspect(i % 2 ? -.95 : .95, i % 3 ? .45 : -.45);
    assert.equal(actual.getState().responseTick, responseTick);
    for (let tick = 70; tick < 340; tick++) {
      actual.advanceTicks(1); reference.advanceTicks(1);
      assert.deepEqual(pose(member(actual)), pose(member(reference)), `captured cue changed at ${tick + 1}`);
    }
    assert.equal(member(actual).reaction.kind, 'none', 'a burst must not leave queued responses');
  }
});

test('both character moments replay exactly across 1/2/5-tick presentation groups and restart', () => {
  function replay(group) {
    const m = createTurtleModel(options);
    const events = [
      [12, () => m.inspect(...input(m, .08, .08))],
      [127, () => m.configure({ speed: 1.3 })],
      [300, () => m.clearGuide()],
      [380, () => m.inspect(...input(m, .80, -.20))],
      [493, () => m.configure({ speed: .65, current: .25 })],
      [700, () => m.clearGuide()]
    ];
    let tick = 0, event = 0;
    while (tick < 730) {
      if (events[event]?.[0] === tick) events[event++][1]();
      const n = Math.min(group, (events[event]?.[0] ?? 730) - tick, 730 - tick);
      m.advanceTicks(n); tick += n; m.frame();
    }
    return m;
  }
  const one = replay(1);
  for (const group of [2, 5]) {
    const other = replay(group);
    assert.deepEqual(other.getState(), one.getState());
    assert.deepEqual(other.getDirectorState(), one.getDirectorState());
    assert.deepEqual(other.frame(), one.frame());
  }
  one.reset();
  const fresh = createTurtleModel(one.getOptions());
  assert.deepEqual(one.getState(), fresh.getState());
  assert.deepEqual(one.getDirectorState(), fresh.getDirectorState());
  assert.deepEqual(one.frame(), fresh.frame());
});

test('tuck and glide preserve owned printable cells and vertical crop clearance at small grids', () => {
  for (const [columns, rows] of [[80, 32], [100, 40]]) for (const facing of ['left', 'right']) {
    for (const distance of [.08, .80]) {
      const m = createTurtleModel({ ...options, scene: 'study', columns, rows, facing });
      m.inspect(...input(m, distance, -.15));
      let previous = 0;
      for (const tick of [18, 45, 75, 110, 150, 180]) {
        advance(m, tick - previous); previous = tick;
        const frame = m.frame();
        assert(/^[\x20-\x7e\n]+$/.test(frame.text));
        assert(frame.text.split('\n').every(row => row.length === columns));
        assert(frame.cells.some(cell => cell.ownerId === 0 && cell.glyph !== ' '), 'the character must stay in view');
        assert(frame.cells.every(cell => cell.ownerId === 0 || cell.ownerId === null));
        const border = [...frame.cells.slice(0, columns), ...frame.cells.slice((rows - 1) * columns)];
        assert(border.every(cell => cell.ownerId === null), `${facing} ${columns}x${rows} clipped at cue tick ${tick}`);
      }
    }
  }
});

// P/G are deliberately self-contained invitations. Arrows + Enter remain the
// path for a user-positioned guide. This helper is the documented input mapping,
// not the private behavior calculation.
function keyTarget(art, kind) {
  const d = art.getDirectorState(), m = d.members[d.selectedId], y = clamp(m.y, -.50, .50);
  if (kind === 'p') return [clamp(m.x, -1, 1), y];
  const dir = art.getOptions().facing === 'left' ? -1 : 1;
  let x = clamp(m.x + dir * .70, -1, 1);
  if (Math.abs(x - m.x) < .40) x = clamp(m.x - dir * .70, -1, 1);
  return [x, y];
}

test('P/G keyboard invitations match explicit actions and keep reduced/paused poses still', () => {
  for (const mode of ['running', 'paused', 'reduced']) for (const facing of ['left', 'right']) {
    const h = fakeBrowser({ reducedMotion: mode === 'reduced' });
    const canvas = h.canvas(390, 280), referenceCanvas = h.canvas(390, 280);
    const config = { ...options, facing, paused: mode === 'paused' };
    const art = createTurtleArtwork(canvas, config), reference = createTurtleArtwork(referenceCanvas, config);
    h.intersect(canvas, true); h.intersect(referenceCanvas, true);
    let prevented = 0;
    const key = (key, modifiers = {}) => canvas.emit('keydown', { key, preventDefault() { prevented++; }, ...modifiers });
    const before = art.getDirectorState();
    for (const name of ['p', 'P', 'g', 'G']) for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) key(name, { [modifier]: true });
    assert.equal(prevented, 0); assert.deepEqual(art.getDirectorState(), before);
    const posters = [];
    for (const name of ['p', 'g']) {
      art.restart(); reference.restart();
      art.guide(.35, .45); reference.guide(.35, .45);
      const target = keyTarget(reference, name);
      key(name); reference.inspect(...target);
      assert.deepEqual(art.getDirectorState(), reference.getDirectorState());
      assert.deepEqual(art.getFrame(), reference.getFrame());
      if (mode === 'running') {
        h.frame(0);
        for (let tick = 0; tick < 100; tick++) h.frame(1000 / 60);
        assert.equal(art.getStatus().tick, 100);
        assert.deepEqual(art.getDirectorState(), reference.getDirectorState());
      } else {
        posters.push(art.getFrame().text);
        h.frame(10000);
        canvas.emit('pointermove', { clientX: 20, clientY: 40 }); h.frame(10000);
        assert.equal(art.getStatus().tick, 0); assert(art.getStatus().paused); assert.equal(h.pending, 0);
        assert.equal(art.getFrame().text, posters.at(-1));
      }
    }
    if (mode !== 'running') assert.notEqual(posters[0], posters[1], 'deliberate still invitations need different useful poses');
    assert.equal(prevented, 2);
    art.dispose(); reference.dispose();
    assert.equal(canvas.listenerCount, 0); assert.equal(referenceCanvas.listenerCount, 0);
    assert.equal(h.pending, 0); assert.equal(h.resizes.size, 0); assert.equal(h.intersections.size, 0);
  }
});

test('touch positions invoke the same captured close/far outcomes as normalized API input', () => {
  for (const distance of [.08, .80]) {
    const h = fakeBrowser({ dpr: 2 }), canvas = h.canvas(390, 280), referenceCanvas = h.canvas(390, 280);
    canvas.rect.left = 37; canvas.rect.top = 113;
    const art = createTurtleArtwork(canvas, options), reference = createTurtleArtwork(referenceCanvas, options);
    h.intersect(canvas, true); h.intersect(referenceCanvas, true);
    const [x, y] = input(reference, distance, .10);
    const clientX = canvas.rect.left + (x + 1) / 2 * canvas.rect.width;
    const clientY = canvas.rect.top + (y + 1) / 2 * canvas.rect.height;
    // Use the same CSS-rectangle normalization for the explicit event. DPR must
    // never enter either input path; decimal rounding is not replay equivalence.
    const normalized = [(clientX - canvas.rect.left) / canvas.rect.width * 2 - 1,
      (clientY - canvas.rect.top) / canvas.rect.height * 2 - 1];
    canvas.emit('pointerdown', { button: 0, pointerType: 'touch', clientX, clientY });
    reference.inspect(...normalized);
    h.frame(0); for (let tick = 0; tick < 110; tick++) h.frame(1000 / 60);
    assert.deepEqual(art.getDirectorState(), reference.getDirectorState());
    assert.deepEqual(art.getFrame(), reference.getFrame());
    art.dispose(); reference.dispose(); assert.equal(h.pending, 0);
  }
});

test('blank shell interiors retain their traveler hit ownership while genuine water uses selection', () => {
  // Sparse shell artwork leaves intentional spaces inside an occluding body.
  // Those spaces must not tap through to an unrelated selected traveler.
  const h = fakeBrowser({ dpr: 2 }), canvas = h.canvas(840, 600);
  canvas.rect.left = 37; canvas.rect.top = 113;
  const art = createTurtleArtwork(canvas, {
    scene: 'reef-passage', count: 3, director: 'hold', columns: 160, rows: 64,
    seed: 7, showLabels: false, paused: true
  });
  h.intersect(canvas, true); art.stage('linger');
  const frame = art.getFrame();
  let interior = -1;
  for (let r = 1; r < frame.rows - 1 && interior < 0; r++) {
    for (let c = 1; c < frame.columns - 1; c++) {
      const i = r * frame.columns + c;
      if (frame.cells[i].glyph === ' ' &&
          [i - 1, i + 1, i - frame.columns, i + frame.columns].every(j => frame.cells[j].ownerId === 2)) {
        interior = i; break;
      }
    }
  }
  assert(interior >= 0, 'the sparse shell must provide an enclosed blank cell for this interaction fixture');
  const tapCell = (f, index) => {
    const column = index % f.columns, row = Math.floor(index / f.columns);
    canvas.emit('pointerdown', {
      button: 0, pointerType: 'touch',
      clientX: canvas.rect.left + (column + .5) / f.columns * canvas.rect.width,
      clientY: canvas.rect.top + (row + .5) / f.rows * canvas.rect.height
    });
  };
  assert.equal(art.getDirectorState().selectedId, 0);
  tapCell(frame, interior);
  let state = art.getDirectorState();
  assert.equal(state.selectedId, 2, 'a blank shell cell belongs to its visible traveler, not the prior selection');
  assert.notEqual(state.members[2].reaction.kind, 'none');
  assert(state.members.filter(m => m.id !== 2).every(m => m.reaction.kind === 'none'));

  art.restart(); art.stage('linger'); art.select(1);
  const waterFrame = art.getFrame(), row = Math.floor(waterFrame.rows / 2);
  let water = -1;
  for (let c = 1; c < waterFrame.columns - 1; c++) {
    const i = row * waterFrame.columns + c;
    if (waterFrame.cells[i].glyph === ' ' &&
        [i, i - 1, i + 1, i - waterFrame.columns, i + waterFrame.columns].every(j => waterFrame.cells[j].ownerId === null)) {
      water = i; break;
    }
  }
  assert(water >= 0, 'the fixture must include true unowned midwater');
  tapCell(waterFrame, water);
  state = art.getDirectorState();
  assert.equal(state.selectedId, 1, 'genuine empty water must preserve the selected-traveler invitation');
  assert.notEqual(state.members[1].reaction.kind, 'none');
  assert(state.members.filter(m => m.id !== 1).every(m => m.reaction.kind === 'none'));
  assert.equal(art.getStatus().tick, 0); assert.equal(h.pending, 0);
  art.dispose(); assert.equal(canvas.listenerCount, 0); assert.equal(h.pending, 0);
});
