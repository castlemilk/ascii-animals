import test from 'node:test';
import assert from 'node:assert/strict';
import { createFoxDirector } from '../lib/director.js';
import { buildFoxSceneGrid, routeFoxScenePointer } from '../lib/director-render.js';

function cellPoint(grid, col, row) {
  return { x: (col + .5) / grid.cols * 2 - 1, y: (row + .5) / grid.rows * 2 - 1 };
}
function worldToCell(grid, point) {
  const units = Math.min(grid.cols / 4, grid.rows / 1.6);
  return { col: grid.cols / 2 + point.x * units * 2, row: grid.rows * .35 + point.y * units };
}
function worldToPointer(grid, point) {
  const { col, row } = worldToCell(grid, point);
  return { x: col / grid.cols * 2 - 1, y: row / grid.rows * 2 - 1 };
}

test('empty-space portrait cues select the presented fox instead of its landscape location', () => {
  const director = createFoxDirector({ count: 3 });
  const grid = buildFoxSceneGrid(director.getFrame(), { cols: 112, rows: 64 });
  const anchor = grid.anchors.find(item => item.id === 0);
  const center = worldToCell(grid, anchor.center);
  let nearest = null, distance = Infinity;
  for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++) {
    if (grid.owners[row * grid.cols + col] !== -1) continue;
    const d = Math.hypot((col + .5 - center.col) * .5, row + .5 - center.row);
    if (d < distance) { distance = d; nearest = cellPoint(grid, col, row); }
  }
  assert(distance < 8, 'there must be reachable empty space near Ember');
  assert.equal(routeFoxScenePointer(grid, nearest.x, nearest.y).id, 0);
  // The pre-fix code compared these screen coordinates to unarranged actor homes.
  const oldNearest = [...director.getState().actors].sort((a, b) =>
    Math.hypot(nearest.x - a.x, nearest.y - a.y) - Math.hypot(nearest.x - b.x, nearest.y - b.y))[0].id;
  assert.notEqual(oldNearest, 0, 'this fixture must expose the actual portrait regression');
  assert(Object.isFrozen(grid.anchors) && Object.isFrozen(anchor.origin));
  director.dispose();
});

test('hover directions remain local to the selected fox through both arrangements', () => {
  const director = createFoxDirector({ count: 3 });
  for (const cols of [112, 160]) {
    const grid = buildFoxSceneGrid(director.getFrame(), { cols, rows: 64 });
    for (const anchor of grid.anchors) {
      for (const dx of [-.12, .12]) {
        const p = worldToPointer(grid, { x: anchor.origin.x + dx * anchor.scale, y: anchor.origin.y });
        const routed = routeFoxScenePointer(grid, p.x, p.y, anchor.id);
        assert.equal(routed.id, anchor.id);
        assert.equal(Math.sign(routed.point.x - anchor.logical.x), Math.sign(dx));
        assert(Math.abs(routed.point.x - anchor.logical.x - dx) < 1e-12);
      }
      const above = worldToPointer(grid, { x: anchor.origin.x, y: anchor.origin.y - .2 * anchor.scale });
      assert(routeFoxScenePointer(grid, above.x, above.y, anchor.id).point.y < anchor.logical.y);
    }
    assert.equal(routeFoxScenePointer(grid, 1.01, 0), null);
    assert.throws(() => routeFoxScenePointer(grid, NaN, 0));
    assert.throws(() => routeFoxScenePointer(grid, 0, 0, 3));
  }
  director.dispose();
});

test('resting den foxes keep their ground anchors through changing scene time', () => {
  const director = createFoxDirector({ count: 3, scene: 'den-watch' });
  for (let tick = 1; tick <= 220; tick++) director.step(tick);
  const before = director.getState().actors.filter(actor => actor.role === 'dreamer');
  for (let tick = 221; tick <= 400; tick++) {
    director.step(tick);
    for (const start of before) {
      const actor = director.getState().actors[start.id];
      assert.equal(actor.action, 'resting');
      assert.equal(actor.x, start.x); assert.equal(actor.y, start.y);
    }
  }
  director.dispose();
});
