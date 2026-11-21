/** Character-level acceptance for the Reef Curmudgeon. These inspect real
 * printable cells and owner masks; browser imagery remains a separate gate. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_MARKS, CHARACTER_PALETTE, createCharacterGrid, composePufferfishFrame } from '../build/character-grid.js';
import { createPufferfish, pufferfishPoster, stepPufferfish } from '../build/model.js';
import { createPufferfishDirector, stepPufferfishDirector } from '../build/director.js';
import { createPufferfishCharacterPainter } from '../build/character-painter.js';
import { fakeBrowser } from './fake-browser.mjs';

const phone = Object.freeze({ width: 360, height: 270, view: 'front', staticPose: true, sceneScale: 1 });
const frame = (state, options = phone, grid = createCharacterGrid(72, 40)) => {
  composePufferfishFrame(grid, state, options);
  return grid;
};
const snapshot = grid => ({ cells: [...grid.cells], colors: [...grid.colors], owners: [...grid.owners], samples: grid.samples });
function marks(grid, { owner = 0, glyph, color } = {}) {
  const result = [];
  for (let i = 0; i < grid.cells.length; i++) {
    if (grid.owners[i] !== owner || grid.cells[i] === 32) continue;
    if (glyph !== undefined && grid.cells[i] !== glyph.charCodeAt(0)) continue;
    if (color !== undefined && grid.colors[i] !== color) continue;
    result.push({ x: i % grid.cols, y: Math.floor(i / grid.cols), glyph: String.fromCharCode(grid.cells[i]) });
  }
  return result;
}
function bounds(points) {
  assert.ok(points.length > 0, 'character must have visible owned cells');
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs) + 1, height: Math.max(...ys) - Math.min(...ys) + 1 };
}
const centroidX = points => points.reduce((sum, point) => sum + point.x, 0) / points.length;
function advance(state, target, log = []) {
  while (state.tick < target) state = stepPufferfish(state, {
    tick: state.tick + 1, events: log.filter(event => event.tick === state.tick + 1),
  }).state;
  return state;
}
function advanceScene(state, target, log = []) {
  while (state.tick < target) state = stepPufferfishDirector(state, {
    tick: state.tick + 1, events: log.filter(event => event.tick === state.tick + 1),
  }).state;
  return state;
}

test('the smallest supported solo frame has two separate eyes, a mouth, paired paddles and declared ASCII marks', () => {
  const calm = createPufferfish({ seed: 23 });
  for (const view of ['front', 'left', 'right']) for (const inflated of [false, true]) {
    const grid = frame(pufferfishPoster(calm, inflated), { ...phone, view });
    const pupils = marks(grid, { glyph: inflated ? 'O' : 'o', color: 2 });
    assert.equal(pupils.length, 2, `${view}/${inflated}: both pupils survive the 72x40 grid`);
    assert.ok(Math.abs(pupils[0].x - pupils[1].x) >= 4, 'eyes read separately instead of merging into a single feature');
    const mouth = inflated ? marks(grid, { glyph: 'o', color: 4 })
      : marks(grid, { color: 2 }).filter(mark => mark.y > pupils[0].y && Math.abs(mark.x - centroidX(pupils)) < 3);
    assert.ok(mouth.length > 0, 'mouth remains below and between the eyes');
    const fins = marks(grid, { color: 3 });
    assert.ok(fins.some(mark => mark.x < pupils[0].x) && fins.some(mark => mark.x > pupils[1].x),
      'paired paddles survive on both sides of the face');
    for (const code of grid.cells) assert.ok(CHARACTER_MARKS.includes(String.fromCharCode(code)), 'no shading-ramp noise enters the artwork');
    for (const color of grid.colors) assert.ok(color < CHARACTER_PALETTE.length);
    assert.ok(grid.samples > 0 && grid.samples <= 16000);
  }
});

test('early retreat changes the actual puff silhouette while sustained approach reaches a round response', () => {
  const begin = { tick: 1, seq: 0, type: 'approach' };
  const held = advance(createPufferfish(), 120, [begin]);
  const shortened = advance(createPufferfish(), 49, [begin, { tick: 49, seq: 1, type: 'retreat' }]);
  assert.equal(held.phase.kind, 'holding'); assert.equal(shortened.phase.kind, 'recovering');
  assert.equal(held.reactions, 1); assert.equal(shortened.reactions, 1);
  assert.ok(shortened.inflation > 0 && shortened.inflation < .55);
  const heldBounds = bounds(marks(frame(held))), shortBounds = bounds(marks(frame(shortened)));
  assert.ok(heldBounds.height > shortBounds.height * 1.3,
    'sustained input produces a materially taller inflated outline than an early release');
  const notice = advance(createPufferfish(), 24, [begin]);
  const idleGrid = snapshot(frame(createPufferfish())), noticeGrid = snapshot(frame(notice));
  assert.notDeepEqual(noticeGrid.cells, idleGrid.cells, 'anticipation changes the drawing before inflation');
  assert.equal(notice.inflation, 0);
  assert.notDeepEqual(noticeGrid.cells, snapshot(frame(held)).cells, 'anticipation is distinct from the peak puff');
});

test('opposite invitations change travel and gaze without causing an automatic puff', () => {
  const start = createPufferfishDirector({ count: 1, curiosity: 1, labels: false }, { seed: 23 });
  const destinations = [-.45, .45].map(x => advanceScene(start, 180,
    [{ tick: 1, seq: 0, type: 'invite', x, y: -.2 }]));
  const [left, right] = destinations.map(scene => scene.actors[0]);
  assert.ok(right.x - left.x > .3, 'the actual invitation position changes the destination');
  assert.ok(left.gaze.x < 0 && right.gaze.x > 0, 'the gaze follows the requested point');
  assert.ok(destinations.every(scene => scene.actors[0].state.reactions === 0));
  const leftCells = bounds(marks(frame(destinations[0]))), rightCells = bounds(marks(frame(destinations[1])));
  assert.ok(rightCells.left - leftCells.left >= 8, 'requested travel is visible on the smallest grid');
  // Isolate eye aim from whole-body travel to ensure gaze is not merely a route label.
  const gazes = [-1, 1].map(x => ({ ...start,
    actors: [{ ...start.actors[0], gaze: { x, y: 0 } }],
  }));
  const eyes = gazes.map(scene => marks(frame(scene), { glyph: 'o', color: 2 }));
  assert.ok(eyes.every(pair => pair.length === 2), 'both eyes remain visible at either gaze extreme');
  assert.ok(centroidX(eyes[1]) - centroidX(eyes[0]) >= 1, 'gaze moves actual pupils by at least one phone cell');
});

test('draw order, prior frames and ambient time cannot change a logical character frame', () => {
  const state = advance(createPufferfish({ seed: 91 }), 100, [{ tick: 1, seq: 0, type: 'approach' }]);
  const grid = createCharacterGrid(72, 40), options = { ...phone, staticPose: false };
  const expected = snapshot(frame(state, options, grid));
  frame(createPufferfishDirector({ count: 3, labels: true }, { seed: 46 }), options, grid);
  const before = JSON.stringify(state), random = Math.random, now = Date.now;
  Math.random = () => { throw new Error('ambient randomness is forbidden'); };
  Date.now = () => { throw new Error('wall clock is forbidden'); };
  try { assert.deepEqual(snapshot(frame(state, options, grid)), expected); }
  finally { Math.random = random; Date.now = now; }
  assert.equal(JSON.stringify(state), before, 'drawing cannot mutate the simulation snapshot');
});

test('calm and puffed static posters freeze ambient motion at different ticks', () => {
  for (const inflated of [false, true]) {
    const base = pufferfishPoster(createPufferfish({ seed: 23 }), inflated);
    const early = snapshot(frame(base)), late = snapshot(frame({ ...base, tick: 800 }));
    assert.deepEqual(early, late, 'static pose must not advance fins, tail, water or body bob');
  }
});

test('largest supported populations retain visible faces and padding at narrow and desktop dimensions', () => {
  for (const [width, height] of [[360, 270], [390, 540], [900, 506]]) {
    for (const count of [1, 2, 3]) for (const view of ['front', 'left', 'right']) {
      const env = fakeBrowser(), painter = createPufferfishCharacterPainter(env.canvas, { quality: 'small', view });
      painter.resize(width, height, 2);
      const start = createPufferfishDirector({ count, size: 1.1, spacing: 1.2, labels: false }, { inflationScale: 1.8 });
      const scene = { ...start, actors: start.actors.map(actor => ({ ...actor, state: pufferfishPoster(actor.state, true) })) };
      const drawn = painter.drawScene(scene, true);
      const lines = drawn.text.split('\n');
      assert.equal(lines[0].trim(), ''); assert.equal(lines.at(-1).trim(), '');
      assert.ok(lines.every(line => line.startsWith(' ') && line.endsWith(' ')), 'no clipped edge can masquerade as an outline');
      assert.equal([...drawn.text].filter(char => char === 'O').length, count * 2,
        `${width}x${height}/${count}/${view}: both surprised pupils remain visible for every actor`);
      const visible = new Set();
      for (let row = 0; row < drawn.rows; row++) for (let col = 0; col < drawn.cols; col++) {
        const owner = painter.hitActor((col + .5) / drawn.cols * 2 - 1, (row + .5) / drawn.rows * 2 - 1);
        if (owner !== null) visible.add(owner);
      }
      assert.equal(visible.size, count);
      assert.ok(drawn.samples <= 16000);
      painter.dispose();
    }
  }
});

test('ASCII and points share exact text, visible ownership and bounded character statistics', () => {
  const env = fakeBrowser(), painter = createPufferfishCharacterPainter(env.canvas, { quality: 'small' });
  painter.resize(360, 270, 1);
  const state = pufferfishPoster(createPufferfish(), true);
  const ascii = painter.draw(state, true);
  const owners = [];
  for (let row = 0; row < ascii.rows; row++) for (let col = 0; col < ascii.cols; col++)
    owners.push(painter.hitActor((col + .5) / ascii.cols * 2 - 1, (row + .5) / ascii.rows * 2 - 1));
  assert.match(ascii.text, /^[\x20-\x7e\n]+$/);
  assert.equal(ascii.glyphs, [...ascii.text].filter(char => char !== ' ' && char !== '\n').length);
  assert.ok(ascii.samples >= ascii.glyphs && ascii.samples <= 16000);
  painter.configure({ mode: 'points' });
  const points = painter.draw(state, true);
  assert.equal(points.text, ascii.text); assert.equal(points.samples, ascii.samples);
  const pointOwners = [];
  for (let row = 0; row < points.rows; row++) for (let col = 0; col < points.cols; col++)
    pointOwners.push(painter.hitActor((col + .5) / points.cols * 2 - 1, (row + .5) / points.rows * 2 - 1));
  assert.deepEqual(pointOwners, owners);
  painter.dispose();
});

test('grid allocation rejects noninteger and excessive dimensions before allocating buffers', () => {
  for (const [cols, rows] of [[0, 40], [161, 40], [72, 0], [72, 91], [72.5, 40], [72, NaN], [Infinity, 40]])
    assert.throws(() => createCharacterGrid(cols, rows));
  const maximum = createCharacterGrid(160, 90);
  assert.equal(maximum.cells.length, 14400); assert.equal(maximum.colors.length, 14400); assert.equal(maximum.owners.length, 14400);
});
