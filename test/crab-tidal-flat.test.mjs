import test from 'node:test';
import assert from 'node:assert/strict';
import { createCrabArtwork, createCrabModel } from '../lib/public/crab.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';

// Logical-model and numerical lifecycle tests, not a browser or pixel renderer.
// The continuity budget was chosen before running the candidate: at 60 Hz a
// toe may travel at most 6% of the neutral full walking-foot spread per tick.
// This permits a fast complete swing but rejects a foot dropping its entire
// lift on the tick when the body stops. It is unchanged across all three speeds.
const TOE_TRAVEL_FRACTION = 0.06;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const resident = model => model.getScene().actors[0];
const ownedCells = (frame, id = 0) => frame.cells.filter(cell => cell.layer === 'crab' && cell.owner === id).length;
const advance = (model, ticks, chunk = 600) => {
  while (ticks > 0) {
    const count = Math.min(chunk, ticks);
    model.advanceTicks(count);
    ticks -= count;
  }
};
const settled = (options = {}) => {
  const model = createCrabModel({ scene: 'forage', count: 1, director: 'manual', sway: 0, ...options });
  model.setBeat('forage', true);
  return model;
};

test('a sand invitation anticipates in place, scuttles sideways, works the claw and recovers', () => {
  const model = settled(), origin = resident(model);
  model.guide(origin.x + 0.14, origin.y);
  model.cue('forage');
  model.clearGuide(); // An accepted destination survives release of the pointer.

  model.advanceTicks(12);
  const anticipated = resident(model);
  assert.equal(anticipated.behavior.kind, 'scuttle');
  assert(distance(anticipated, origin) < 0.001, 'notice the invitation before travelling');
  assert(anticipated.feet.every(foot => foot.planted), 'anticipation must read as a grounded pose');

  model.advanceTicks(63);
  const crossing = resident(model);
  assert.equal(crossing.behavior.kind, 'scuttle');
  assert(crossing.x > origin.x + 0.05, 'the crab must actually travel toward the invitation');
  assert(Math.abs(crossing.x - origin.x) > Math.abs(crossing.y - origin.y) * 2, 'sideways travel should dominate');

  model.advanceTicks(35);
  assert.equal(resident(model).behavior.kind, 'forage');
  assert(resident(model).leftClaw < 0, 'the working claw lowers to the sand');
  model.advanceTicks(125);
  assert.equal(resident(model).behavior.kind, 'return');
  model.advanceTicks(125);
  assert(distance(resident(model), origin.patch) < 0.025, 'complete the excursion and recover the patch');
  assert.equal(model.getScene().guide.active, false);
});

test('a claw display anticipates, raises the second claw later, holds and lowers before releasing its cue', () => {
  const model = settled(), origin = resident(model);
  model.cue('signal');
  model.advanceTicks(12);
  const early = resident(model);
  assert.equal(early.behavior.kind, 'signal');
  assert(Math.max(early.leftClaw, early.rightClaw) < 0.25, 'begin with a low anticipatory pose');
  assert(distance(early, origin) < 0.001, 'the display begins from planted ground');

  model.advanceTicks(33);
  const raising = resident(model);
  assert(raising.leftClaw > raising.rightClaw + 0.08, 'the second claw must lag, rather than copy the first');
  model.advanceTicks(65);
  const held = resident(model);
  assert(held.leftClaw > 0.65 && held.rightClaw > 0.3, 'both claws must reach a clear display');
  model.advanceTicks(25);
  const stillHeld = resident(model);
  assert.equal(stillHeld.behavior.kind, 'signal');
  assert(Math.abs(stillHeld.leftClaw - held.leftClaw) < 0.12, 'hold the primary claw instead of immediately reversing a sine');
  assert(Math.abs(stillHeld.rightClaw - held.rightClaw) < 0.12, 'the secondary claw should settle into the held display');

  model.advanceTicks(145);
  const recovered = resident(model);
  assert.equal(recovered.behavior.kind, 'rest');
  assert(Math.max(Math.abs(recovered.leftClaw), Math.abs(recovered.rightClaw)) < 0.15, 'lower and recover before the action ends');
  model.advanceTicks(30);
  assert.notEqual(resident(model).behavior.kind, 'signal');
  assert.equal(model.getScene().beat, 'forage', 'a cue does not replace the selected chapter');
});

test('shelter has a grounded warning, visible retreat, occluded refuge, peek and re-emergence', () => {
  const model = settled(), origin = resident(model), openCount = ownedCells(model.frame());
  assert(openCount > 0);
  model.cue('shelter');
  model.advanceTicks(12);
  const warning = resident(model);
  assert.equal(warning.behavior.kind, 'brace');
  assert(distance(warning, origin) < 0.001, 'brace at the cue origin before heading for cover');

  model.advanceTicks(43);
  const retreating = resident(model);
  assert.equal(retreating.behavior.kind, 'retreat');
  assert(distance(retreating, retreating.home) < distance(origin, origin.home), 'retreat must make physical progress toward shelter');

  model.advanceTicks(65);
  const hidden = resident(model), shelteredFrame = model.frame();
  assert.equal(hidden.behavior.kind, 'shelter');
  assert(hidden.crouch > 0.8);
  assert(distance(hidden, hidden.home) < 0.04);
  assert(ownedCells(shelteredFrame) < openCount * 0.75, 'the refuge must cover anatomy, rather than merely change its activity label');
  assert(shelteredFrame.cells.some(cell => cell.layer === 'rock' && cell.glyph !== ' '));
  assert(shelteredFrame.cells.filter(cell => cell.layer === 'rock').every(cell => cell.owner === undefined), 'covering rock must not retain a hidden crab hit target');

  model.advanceTicks(58);
  assert.equal(resident(model).behavior.kind, 'inspect', 'check outside before leaving cover');
  model.advanceTicks(52);
  assert.equal(resident(model).behavior.kind, 'return');
  model.advanceTicks(130);
  assert(distance(resident(model), origin.patch) < 0.04, 'emerge and recover the foraging patch');
  assert(resident(model).crouch < 0.03);
  assert(ownedCells(model.frame()) > ownedCells(shelteredFrame), 're-emergence restores visible anatomy');
});

for (const speed of [0.25, 1, 2]) {
  test(`planted scuttle finishes airborne steps continuously through stops and reversals at speed ${speed}`, () => {
    const model = settled({ speed }), origin = resident(model);
    const spread = Math.max(...origin.feet.map(foot => foot.x)) - Math.min(...origin.feet.map(foot => foot.x));
    const maxToeTravel = spread * TOE_TRAVEL_FRACTION;
    let previous = origin, stableContacts = 0, swings = 0, forward = 0, backward = 0, stationary = 0;

    for (const direction of [1, -1]) {
      model.guide(origin.patch.x + direction * 0.14, origin.patch.y + 0.04);
      model.cue('forage');
      model.clearGuide();
      for (let elapsed = 0; elapsed < 600; elapsed++) {
        model.advanceTicks(1);
        const current = resident(model), dx = current.x - previous.x;
        const moving = distance(current, previous) > 0.00008;
        if (dx > 0.00008) forward++;
        if (dx < -0.00008) backward++;
        if (!moving) stationary++;
        if (moving) assert(current.feet.filter(foot => foot.planted).length >= 4, 'retain at least four support contacts while travelling');
        for (let index = 0; index < current.feet.length; index++) {
          const before = previous.feet[index], after = current.feet[index];
          const travel = Math.hypot(after.x - before.x, (after.y - after.lift) - (before.y - before.lift));
          assert(travel <= maxToeTravel + 1e-12,
            `toe ${index} jumped ${travel.toFixed(6)} at tick ${model.getState().tick}; predeclared limit ${maxToeTravel.toFixed(6)}`);
          if (before.planted && after.planted) {
            assert.equal(after.x, before.x, 'a planted toe cannot slide horizontally');
            assert.equal(after.y, before.y, 'a planted toe cannot slide vertically');
            stableContacts++;
          }
          if (!after.planted && after.lift > 0) swings++;
        }
        previous = current;
      }
    }
    assert(forward > 20 && backward > 20, 'exercise both travel directions');
    assert(stationary > 20, 'exercise genuine body stops');
    assert(swings > 10 && stableContacts > 100, 'exercise swing and stance instead of passing with a frozen crab');
  });
}

test('a visible shelter rock targets its resident and keeps the accepted refuge cue after touch cancellation', () => {
  const harness = fakeBrowser(), canvas = harness.canvas();
  const art = createCrabArtwork(canvas, { scene: 'forage', count: 3, paused: true });
  try {
    harness.intersect(canvas, true);
    art.setBeat('forage');
    const frame = art.getFrame(), intended = art.getScene().actors[2];
    const candidates = frame.cells.flatMap((cell, index) => cell.layer === 'rock' && cell.glyph !== ' ' ? [{
      index,
      x: index % frame.columns / (frame.columns - 1) * 2 - 1,
      y: Math.floor(index / frame.columns) / (frame.rows - 1) * 2 - 1,
    }] : []);
    candidates.sort((a, b) => distance(a, intended.home) - distance(b, intended.home));
    const rock = candidates[0];
    assert(rock && distance(rock, intended.home) < 0.2, 'the intended resident needs a visible shelter');
    assert.equal(frame.cells[rock.index].owner, undefined, 'a rock is habitat, not an invisible crab hitbox');

    canvas.emit('pointerdown', {
      isPrimary: true, pointerType: 'touch',
      clientX: canvas.rect.left + (rock.x + 1) * 0.5 * canvas.rect.width,
      clientY: canvas.rect.top + (rock.y + 1) * 0.5 * canvas.rect.height,
    });
    assert.equal(art.getScene().selectedId, intended.id, 'a rock selects its own resident rather than the curious sand forager');
    assert.equal(art.getScene().actors[intended.id].behavior.kind, 'shelter', 'a paused rock tap composes the shelter poster');
    canvas.emit('pointercancel', { pointerType: 'touch' });
    assert.equal(art.getScene().guide.active, false);
    assert.equal(art.getScene().actors[intended.id].behavior.kind, 'shelter', 'cancellation releases guidance, not an accepted action');
    assert.equal(art.getStatus().tick, 0);
    assert.equal(harness.pending, 0);
  } finally {
    art.dispose();
  }
});

test('the full scuttle, display and refuge event log replays identically in one-, two- and five-tick batches', () => {
  const replay = chunk => {
    const model = createCrabModel({ scene: 'tide', count: 3, seed: 91, actDuration: 240, formation: 'terraces' });
    const checkpoints = [];
    const record = () => checkpoints.push({ state: model.getState(), scene: model.getScene(), text: model.frame().text });
    advance(model, 17, chunk);
    const patch = resident(model).patch;
    model.guide(patch.x + 0.12, patch.y + 0.03);
    model.cue('forage', 0);
    advance(model, 12, chunk); record();
    model.clearGuide();
    advance(model, 93, chunk); record();
    model.cue('signal', 2);
    advance(model, 125, chunk); record();
    advance(model, 94, chunk);
    model.cue('shelter', 0);
    advance(model, 12, chunk); record();
    advance(model, 108, chunk); record();
    advance(model, 118, chunk); record();
    advance(model, 122, chunk); record();
    return checkpoints;
  };
  const individual = replay(1);
  assert.deepEqual(replay(2), individual);
  assert.deepEqual(replay(5), individual);
});

test('the current changes water direction and zero current keeps every water mark stationary', () => {
  const water = frame => frame.cells.flatMap((cell, index) => cell.layer === 'water'
    ? [[index, cell.glyph, cell.tone]] : []);
  const create = current => settled({ current, columns: 120, rows: 90 });
  const left = create(-1), right = create(1), still = create(0);
  left.advanceTicks(120);
  right.advanceTicks(120);
  const leftWater = water(left.frame()), rightWater = water(right.frame());
  assert(leftWater.length > 0 && rightWater.length > 0, 'exercise visible water rather than an empty layer');
  assert.notDeepEqual(leftWater, rightWater, 'reversing current must change the rendered water at the same logical tick');

  const stationaryWater = water(still.frame());
  for (let interval = 0; interval < 10; interval++) {
    still.advanceTicks(60);
    assert.deepEqual(water(still.frame()), stationaryWater,
      `zero current must keep near and distant water marks fixed at tick ${still.getState().tick}`);
  }
});

test('large fitted residents can reach their homes and patches after grid and size reconfiguration', () => {
  const model = createCrabModel({ scene: 'tide', count: 2, director: 'manual', sway: 0 });
  const configurations = [
    { columns: 120, rows: 90, scale: 1.3, cast: [{ size: 1.2 }, { size: 1.2 }] },
    { columns: 80, rows: 32, scale: 0.6, cast: [{ size: 0.8 }, { size: 0.8 }] },
    { columns: 180, rows: 90, scale: 1.3, cast: [{ size: 1.2 }, { size: 1.2 }] },
  ];
  // A 0.001 normalized-world error is substantially below one logical cell on
  // every supported grid, while allowing the model's finite settling tolerance.
  const arrivalTolerance = 0.001;
  for (const configuration of configurations) {
    model.configure(configuration);
    model.setBeat('shelter');
    model.advanceTicks(600);
    for (const actor of model.getScene().actors) {
      assert(distance(actor, actor.home) < arrivalTolerance,
        `resident ${actor.id} cannot reach home after ${configuration.columns}x${configuration.rows} / scale ${configuration.scale}`);
    }

    model.setBeat('forage');
    model.advanceTicks(600);
    for (const actor of model.getScene().actors) {
      assert(distance(actor, actor.patch) < arrivalTolerance,
        `resident ${actor.id} cannot recover its patch after ${configuration.columns}x${configuration.rows} / scale ${configuration.scale}`);
    }
  }
});
