import test from 'node:test';
import assert from 'node:assert/strict';
import { createButterflyArtwork, createButterflyModel } from '../lib/public/butterfly.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';

// These are behavior and logical-rendering checks against the built public
// Butterfly module. They are not substitutes for the real-browser captures,
// anatomical review, touch checks, or physical-device performance acceptance.
const single = (director = {}, appearance = {}) => ({
  seed: 31,
  ...appearance,
  director: { scene: 'nectar', count: 1, roles: ['forager'], sceneSeconds: 24, ...director },
});
const member = model => model.getGarden().members[0];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const range = values => Math.max(...values) - Math.min(...values);

function advance(model, ticks, partition = [600]) {
  let index = 0;
  while (ticks > 0) {
    const chunk = Math.min(ticks, partition[index++ % partition.length]);
    model.advanceTicks(chunk);
    ticks -= chunk;
  }
}

function runsOf(samples, kind) {
  const runs = [];
  let run = [];
  for (const sample of samples) {
    if (sample.activity.kind === kind) run.push(sample);
    else if (run.length) { runs.push(run); run = []; }
  }
  if (run.length) runs.push(run);
  return runs;
}

test('autonomous flight has powered wingbeats and sustained moving glides', () => {
  const model = createButterflyModel(single({ scene: 'morning', roles: ['scout'], sceneSeconds: 60 }));
  // The exploration act is long enough to observe flight without a scene change.
  model.nextAct();
  model.nextAct();
  const samples = [];
  for (let tick = 0; tick < 720; tick++) {
    model.advanceTicks(1);
    samples.push(member(model));
  }
  const flutter = runsOf(samples, 'flutter').sort((a, b) => b.length - a.length)[0];
  const glide = runsOf(samples, 'glide').sort((a, b) => b.length - a.length)[0];
  assert(flutter?.length >= 24, 'The scout needs a visible powered-flight bout.');
  assert(glide?.length >= 48, 'A glide must persist long enough to read as a held pose.');
  assert(range(flutter.map(m => m.opening)) > .2, 'Powered flight must visibly beat the wings.');
  const settledGlide = glide.slice(20);
  assert(range(settledGlide.map(m => m.opening)) < .14, 'The established glide must hold the wings.');
  assert(settledGlide.every(m => m.opening > .76), 'A glide has a readable open-wing silhouette.');
  assert(distance(settledGlide[0], settledGlide.at(-1)) > .01, 'A held wing pose must still travel.');
});

test('a passing breeze braces before a directional escape, glides, shelters, and recovers', () => {
  for (const direction of [-1, 1]) {
    const model = createButterflyModel(single({ breeze: direction }));
    // Start from an open pose so the anticipation's fold can be observed;
    // a naturally closed wingbeat would not have room for that comparison.
    for (let tick = 0; tick < 240 && member(model).opening < .8; tick++) model.advanceTicks(1);
    const origin = member(model);
    assert(origin.opening >= .8, 'The deterministic initial flight exposes an open pose.');
    model.cue('breeze');
    const samples = [member(model)];
    for (let tick = 1; tick <= 300; tick++) {
      model.advanceTicks(1);
      samples.push(member(model));
      assert(distance(samples[tick - 1], samples[tick]) < .09, `No teleport at cue tick ${tick}.`);
      assert(Number.isFinite(samples[tick].heading));
    }
    assert.equal(samples[12].activity.kind, 'shelter', 'Anticipation reads as a brace.');
    assert.equal(samples[60].activity.kind, 'flutter', 'The escape uses powered flight.');
    assert.equal(samples[130].activity.kind, 'glide', 'The escaped butterfly settles into a glide.');
    assert.equal(samples[200].activity.kind, 'shelter', 'It chooses shelter after the glide.');
    assert.equal(samples[260].activity.kind, 'recover', 'The cue finishes with recovery.');
    assert(Math.max(...samples.slice(0, 24).map(m => distance(m, origin))) < .05,
      'The butterfly must not already be escaping while it braces.');
    assert(samples[23].opening < origin.opening - .12, 'The brace folds the wings before launch.');
    assert((samples[91].x - origin.x) * direction > .07, 'The launch travels with the chosen breeze.');
    assert(samples[130].opening > .76, 'The glide opens the wing silhouette.');
    assert.equal(model.getGarden().cue, 'none', 'The existing 300-tick cue lifetime is retained.');
  }
});

test('flower visits approach before feeding, hold contact, and fan their wings at both grid limits', () => {
  for (const [columns, rows] of [[80, 32], [180, 90]]) {
    const model = createButterflyModel(single({}, { columns, rows }));
    model.nextAct();
    const samples = [];
    for (let tick = 0; tick < 710; tick++) {
      const garden = model.getGarden();
      const actor = garden.members[0];
      samples.push(actor);
      if (actor.activity.kind === 'nectar') {
        const flower = garden.flowers.find(f => f.id === actor.activity.flower);
        assert(flower, 'Every feeding target is a real flower.');
        assert(distance(actor, flower) < .3, 'Feeding cannot start while the butterfly is still far from the bloom.');
        assert(Math.abs(actor.x - flower.x) < .1, 'The landing must align with its flower.');
        assert(Math.cos(actor.heading) < -.75, 'The head must face the bloom before feeding.');
      }
      model.advanceTicks(1);
    }
    assert(samples.slice(0, 24).every(m => m.activity.kind !== 'nectar'), 'Flight cannot become an instantaneous distant feed.');
    assert(samples.some(m => m.activity.kind === 'inspect'), 'The bloom gets an approach/inspection interval.');
    const feed = runsOf(samples, 'nectar').sort((a, b) => b.length - a.length)[0];
    assert(feed?.length >= 120, `${columns}×${rows}: the butterfly must land and remain long enough to feed.`);
    const held = feed.slice(30, 150);
    assert(range(held.map(m => m.x)) < .05 && range(held.map(m => m.y)) < .05,
      'Wing fanning must retain contact with the bloom instead of moving the whole body.');
    assert(range(held.map(m => m.opening)) > .08, 'Feeding includes an observable wing fan.');
    const contact = feed.at(-1);
    model.advanceTicks(240);
    const departed = member(model);
    assert.notEqual(departed.activity.kind, 'nectar', 'The visit must release feeding contact during departure.');
    assert(distance(contact, departed) > .06, 'Recovery must carry the butterfly away from the bloom.');
  }
});

test('six foragers physically reach the lowest blooms on tall phone grids and fan without losing contact', () => {
  for (const [columns, rows] of [[104, 86], [80, 90]]) {
    const options = {
      seed: 7, columns, rows,
      director: { scene: 'nectar', count: 6, sceneSeconds: 32, roles: Array(6).fill('forager') },
    };
    const model = createButterflyModel(options);
    advance(model, 1200);
    const poses = Array.from({ length: 6 }, () => []);
    // Geometric oracle from the exported pose, the declared .56 cell aspect,
    // anatomical head attachment and small-grid wing-detail floor. It does not
    // reuse the director's landing target or trust its activity label alone.
    const worldW = Math.max(6, 3.7 * columns * .56 / rows);
    const worldH = worldW * rows / (columns * .56);
    for (let tick = 0; tick <= 120; tick++) {
      const garden = model.getGarden();
      const frame = tick === 0 ? model.frame() : null;
      for (const actor of garden.members) {
        assert.equal(actor.activity.kind, 'nectar', `${columns}×${rows}: visitor ${actor.id + 1} must reach its bloom.`);
        const flower = garden.flowers.find(f => f.id === actor.activity.flower);
        assert(flower);
        const scale = Math.max(actor.scale, worldW / (columns - 1) * 5.4);
        const hx = actor.x * worldW * .5 + .53 * Math.sin(actor.heading) * scale;
        const hy = actor.y * worldH * .5 - .53 * Math.cos(actor.heading) * scale;
        const fx = flower.x * worldW * .5, fy = flower.y * worldH * .5;
        assert(Math.hypot(fx - hx, fy - hy) < scale * .6,
          `${columns}×${rows}: visitor ${actor.id + 1} needs a short physical head-to-flower connection.`);
        if (frame) {
          const column = x => Math.round((x / worldW + .5) * (columns - 1));
          const row = y => Math.round((y / worldH + .5) * (rows - 1));
          const left = Math.max(0, Math.min(column(hx), column(fx)) - 1);
          const right = Math.min(columns - 1, Math.max(column(hx), column(fx)) + 1);
          const top = Math.max(0, Math.min(row(hy), row(fy)) - 1);
          const bottom = Math.min(rows - 1, Math.max(row(hy), row(fy)) + 1);
          let visibleConnection = false;
          for (let r = top; r <= bottom; r++) for (let c = left; c <= right; c++) {
            const cell = frame.cells[r * columns + c];
            visibleConnection ||= cell.ink === 11 && cell.glyph === '.';
          }
          assert(visibleConnection, `${columns}×${rows}: visitor ${actor.id + 1} must render its reachable feeding connection.`);
        }
        poses[actor.id].push(actor);
      }
      model.advanceTicks(1);
    }
    for (const samples of poses) {
      assert(range(samples.map(m => m.x)) < .01 && range(samples.map(m => m.y)) < .01,
        'The landed root must stay anchored through the fan.');
      assert(range(samples.map(m => m.opening)) > .08, 'Each landed visitor must fan its wings.');
    }
  }
});

test('flight, landing and escape replay equally with irregular tick partitions', () => {
  const options = {
    seed: 907, columns: 180, rows: 90, speed: .75,
    director: { scene: 'nectar', count: 6, path: 'ribbon', sceneSeconds: 24,
      roles: ['forager', 'scout', 'basker', 'wanderer', 'forager', 'scout'] },
  };
  const a = createButterflyModel(options), b = createButterflyModel(options);
  const compare = label => {
    assert.deepEqual(a.getState(), b.getState(), `${label}: state`);
    assert.deepEqual(a.getGarden(), b.getGarden(), `${label}: garden`);
    assert.deepEqual(a.frame(), b.frame(), `${label}: logical frame`);
  };
  const tick = (n, label) => {
    advance(a, n);
    advance(b, n, [1, 17, 3, 60, 11, 97]);
    compare(label);
  };
  const input = (apply, label) => { apply(a); apply(b); compare(label); };
  tick(137, 'initial flight');
  input(m => m.nextAct(), 'flower inspection');
  tick(480, 'landing and wing fan');
  input(m => { m.guide(.53, .36); m.cue('gather'); }, 'invitation');
  tick(79, 'invitation response');
  input(m => m.cue('breeze'), 'interrupt with breeze');
  tick(23, 'brace');
  tick(69, 'escape');
  tick(78, 'glide');
  input(m => m.configure({ palette: 'rose', scale: .8 }), 'appearance change');
  tick(130, 'recovery and expiry');
  input(m => m.release(), 'release');
  input(m => m.configure({ columns: 80, rows: 32 }), 'boundary-grid resize');
  tick(313, 'continued autonomous motion');
});

test('live cues cannot be extended by repeats and can be interrupted without an input queue', () => {
  for (const [cue, lifetime] of [['gather', 300], ['breeze', 300], ['rest', 420]]) {
    const model = createButterflyModel(single());
    model.cue(cue);
    advance(model, lifetime - 1);
    model.cue(cue);
    model.advanceTicks(1);
    assert.equal(model.getGarden().cue, 'none', `${cue} repeats must not postpone recovery indefinitely.`);
  }
  const model = createButterflyModel(single());
  model.cue('gather');
  model.advanceTicks(100);
  model.cue('breeze');
  model.advanceTicks(50);
  assert.equal(model.getGarden().cue, 'breeze');
  model.release();
  assert.equal(model.getGarden().cue, 'none');
  model.advanceTicks(300);
  assert.equal(model.getGarden().cue, 'none', 'The earlier invitation must not be queued for later.');
});

test('an offered flower without a pointer recovers to autonomous flight after the cue expires', () => {
  const options = single({ scene: 'morning', roles: ['scout'], sceneSeconds: 60 });
  const invited = createButterflyModel(options);
  const unattended = createButterflyModel(options);
  for (const model of [invited, unattended]) { model.nextAct(); model.nextAct(); }
  invited.cue('gather');
  let approachedFlower = false;
  for (let tick = 0; tick < 300; tick++) {
    const garden = invited.getGarden();
    const activity = garden.members[0].activity;
    assert.equal(garden.pointer.active, false, 'A button invitation cannot leave synthetic hover attention behind.');
    approachedFlower ||= (activity.kind === 'inspect' && activity.target === 'flower') || activity.kind === 'nectar';
    invited.advanceTicks(1);
    unattended.advanceTicks(1);
  }
  assert(approachedFlower, 'The default nectar invitation must approach a physical bloom.');
  assert.equal(invited.getGarden().cue, 'none');
  assert.equal(invited.getGarden().pointer.active, false);
  assert(['flutter', 'glide'].includes(member(invited).activity.kind), 'Expiry restores the authored exploration flight.');
  advance(invited, 180);
  advance(unattended, 180);
  assert.equal(member(invited).activity.kind, member(unattended).activity.kind);
  assert(distance(member(invited), member(unattended)) < .02,
    'The released invitation must converge on the same autonomous path, not keep orbiting its bloom.');
});

test('wing detail and motion accents remain bounded ASCII with no render-history state', () => {
  for (const [columns, rows] of [[80, 32], [180, 90]]) {
    for (const scene of ['specimen', 'nectar', 'breeze']) {
      const model = createButterflyModel(single({ scene, count: scene === 'specimen' ? 1 : 6 }, { columns, rows, scale: 1.3 }));
      model.cue('breeze');
      model.advanceTicks(67);
      const state = model.getGarden();
      const frame = model.frame();
      assert.equal(frame.cells.length, columns * rows);
      assert.equal(frame.text.split('\n').length, rows);
      assert(frame.text.split('\n').every(row => row.length === columns));
      assert(/^[\x20-\x7e\n]+$/.test(frame.text));
      assert(frame.cells.every(cell => Number.isInteger(cell.tone) && cell.tone >= 0 && cell.tone <= 9));
      assert(frame.cells.every(cell => Number.isInteger(cell.ink ?? 0) && (cell.ink ?? 0) >= 0));
      assert(new Set(frame.cells.filter(cell => cell.glyph !== ' ').map(cell => cell.glyph)).size >= 5);
      assert(Object.isFrozen(frame) && Object.isFrozen(frame.cells));
      for (let repeat = 0; repeat < 3; repeat++) {
        assert.deepEqual(model.frame(), frame, 'Sampling a frame cannot accumulate or age a motion trail.');
        assert.deepEqual(model.getGarden(), state, 'Rendering cannot mutate the flight model.');
      }
    }
  }
});

test('paused and reduced-motion cue tableaux do not animate or accumulate rendering history', () => {
  for (const reducedMotion of [false, true]) {
    const host = fakeBrowser({ reducedMotion });
    const canvas = host.canvas(390, 620);
    const art = createButterflyArtwork(canvas, {
      ...single({ count: 3 }, { columns: 80, rows: 32 }), paused: !reducedMotion,
    });
    host.intersect(canvas, true);
    art.nextAct();
    art.cue('breeze');
    const tick = art.getStatus().tick;
    const garden = art.getGarden();
    const frame = art.getFrame();
    assert(frame.cells.every(cell => cell.glyph === ' ' || cell.ink !== 12),
      'A deliberate still tableau must omit the semantic wing-echo ink.');
    for (let callback = 0; callback < 8; callback++) {
      host.frame(1000);
      assert.equal(art.getStatus().tick, tick);
      assert.deepEqual(art.getGarden(), garden);
      assert.deepEqual(art.getFrame(), frame);
      assert.equal(host.pending, 0);
    }
    if (reducedMotion) {
      art.play();
      assert.equal(host.pending, 0);
      assert.equal(art.getStatus().tick, tick);
    }
    art.dispose();
    assert.equal(canvas.listenerCount, 0);
    assert.equal(host.resizes.size, 0);
    assert.equal(host.intersections.size, 0);
  }
});

test('pausing a live powered wingbeat removes the echo without advancing its pose', () => {
  const host = fakeBrowser();
  const canvas = host.canvas();
  const art = createButterflyArtwork(canvas, single());
  host.intersect(canvas, true);
  art.cue('breeze');
  let sawEcho = false;
  for (let callback = 0; callback < 160; callback++) {
    host.frame(1000 / 60);
    if (art.getFrame().cells.some(cell => cell.glyph !== ' ' && cell.ink === 12)) {
      sawEcho = true;
      break;
    }
  }
  assert(sawEcho, 'A live powered beat should demonstrate the bounded wing-edge echo.');
  const tick = art.getStatus().tick;
  const garden = art.getGarden();
  art.pause();
  assert.equal(art.getStatus().tick, tick);
  assert.deepEqual(art.getGarden(), garden, 'Removing a motion accent must preserve the held pose.');
  assert(art.getFrame().cells.every(cell => cell.glyph === ' ' || cell.ink !== 12),
    'Pause must render a clean wing edge instead of freezing a blur trail.');
  assert.equal(host.pending, 0);
  art.dispose();
});
