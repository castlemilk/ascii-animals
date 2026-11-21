import test from 'node:test';
import assert from 'node:assert/strict';
import { createPuppetState, cuePuppet, stepPuppet, samplePuppet } from './model.mjs';
import { rasterizePuppet, drawPuppetGrid, gridToText, PUPPET_GLYPHS, PUPPET_PALETTE } from './render.mjs';

// Logical glyph/shape tests. These do not establish actual browser appearance.
const viewports = [{ width: 390, height: 560 }, { width: 1100, height: 640 }];
function frame(action = null, seconds = 0, target = { x: .3, y: -.12 }, viewport = viewports[0], size = 1) {
  const state = createPuppetState(7);
  if (action) assert.equal(cuePuppet(state, { type: action, ...target }), true);
  stepPuppet(state, Math.round(seconds * 60));
  const pose = samplePuppet(state);
  return { pose, grid: rasterizePuppet(pose, { ...viewport, size, habitat: false }) };
}
function animalAt(grid, index, includeFeeding = true) {
  return grid.owners[index] > 0 && grid.owners[index] <= (includeFeeding ? 6 : 5);
}
function geometry(grid) {
  return grid.owners.map(owner => owner > 0 && owner <= 6 ? 1 : 0);
}
function components(grid) {
  const seen = new Set(), result = [];
  for (let start = 0; start < grid.owners.length; start++) {
    if (!animalAt(grid, start) || seen.has(start)) continue;
    const pending = [start]; let size = 0;
    seen.add(start);
    while (pending.length) {
      const index = pending.pop(), x = index % grid.cols, y = Math.floor(index / grid.cols);
      size++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, next = ny * grid.cols + nx;
        if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows || seen.has(next) || !animalAt(grid, next)) continue;
        seen.add(next); pending.push(next);
      }
    }
    result.push(size);
  }
  return result.sort((a, b) => b - a);
}

test('every generated glyph is declared printable ASCII and text export has equal row lengths', () => {
  for (const viewport of viewports) for (const action of [null, 'investigate', 'retreat']) {
    const { grid } = frame(action, action ? 2.3 : 0, { x: -.35, y: -.2 }, viewport);
    for (const glyph of grid.glyphs) {
      if (!glyph) continue;
      assert.ok(glyph >= 32 && glyph <= 126, `Non-ASCII codepoint ${glyph}`);
      assert.ok(PUPPET_GLYPHS.includes(String.fromCharCode(glyph)), `Undeclared glyph ${String.fromCharCode(glyph)}`);
    }
    for (const color of grid.colors) assert.ok(color < PUPPET_PALETTE.length);
    const text = gridToText(grid), rows = text.split('\n');
    assert.equal(rows.length, grid.rows);
    assert.ok(rows.every(row => row.length === grid.cols));
    assert.ok(/^[\x20-\x7e\n]*$/.test(text));
  }
});

test('grid allocation stays within the declared 180×100 logical-cell budget', () => {
  const pose = samplePuppet(createPuppetState());
  for (const [width, height] of [[1, 1], [320, 568], [390, 560], [1100, 640],
    [16384, 1], [1, 16384], [16384, 16384], [1801, 999]]) {
    const grid = rasterizePuppet(pose, { width, height });
    assert.ok(grid.cols <= 180 && grid.rows <= 100);
    assert.ok(grid.glyphs.length <= 18000);
    assert.equal(grid.glyphs.length, grid.cols * grid.rows);
    assert.equal(grid.colors.length, grid.glyphs.length);
    assert.equal(grid.owners.length, grid.glyphs.length);
  }
  for (const width of [0, -1, Infinity, NaN, 16385]) assert.throws(() => rasterizePuppet(pose, { width }), RangeError);
  assert.throws(() => rasterizePuppet({ ...pose, x: NaN }), TypeError);
  assert.throws(() => rasterizePuppet(pose, { size: 0 }), RangeError);
});

test('the normal and small visitors remain fully in view through target extremes', () => {
  for (const viewport of viewports) for (const size of [.35, 1]) {
    for (const action of ['investigate', 'retreat']) for (const x of [-.5, .5]) {
      for (const seconds of [0, .65, 1.05, 1.8, 2.4, 4.3, 6]) {
        const { grid } = frame(action, seconds, { x, y: 0 }, viewport, size);
        assert.ok(grid.animalCells > 20,
          `${viewport.width}px size=${size} ${action} x=${x} t=${seconds}: ${grid.animalCells} cells falls below the 20-glyph recognition floor`);
        let edgeCells = 0;
        for (let index = 0; index < grid.owners.length; index++) {
          if (!animalAt(grid, index)) continue;
          const column = index % grid.cols, row = Math.floor(index / grid.cols);
          if (column === 0 || column === grid.cols - 1 || row === 0 || row === grid.rows - 1) edgeCells++;
        }
        assert.equal(edgeCells, 0,
          `${viewport.width}px size=${size} ${action} x=${x} t=${seconds}: body reaches the grid boundary`);
      }
    }
  }
});

test('notice, reach and retreat change actual glyph geometry, independently of palette', () => {
  for (const viewport of viewports) {
    const neutral = frame(null, 0, undefined, viewport).grid;
    const gathered = frame('investigate', .65, undefined, viewport).grid;
    const reached = frame('investigate', 2.3, undefined, viewport).grid;
    const jet = frame('retreat', 2.3, undefined, viewport).grid;
    assert.notDeepEqual(geometry(neutral), geometry(gathered));
    assert.notDeepEqual(geometry(gathered), geometry(reached));
    assert.notDeepEqual(geometry(reached), geometry(jet));
    assert.equal(neutral.owners.some(owner => owner === 6), false);
    assert.equal(gathered.owners.some(owner => owner === 6), false);
    assert.equal(reached.owners.some(owner => owner === 6), true, 'feeding pair emerges during reach');
    assert.equal(jet.owners.some(owner => owner === 8), true, 'jet produces bounded ink glyphs');
    assert.ok(jet.owners.filter(owner => owner === 8).length <= 34);
    const left = frame('investigate', 2.3, { x: -.35, y: -.12 }, viewport).grid;
    assert.notDeepEqual(geometry(left), geometry(reached), 'the selected side changes the visible result');
  }
});

test('primary arm crown remains connected to the body in representative poses', () => {
  for (const viewport of viewports) for (const x of [-.3, .3]) {
    for (const [action, seconds] of [[null, 0], ['investigate', .65], ['investigate', 2.4], ['retreat', 1.05], ['retreat', 2.4]]) {
      const { grid } = frame(action, seconds, { x, y: -.12 }, viewport);
      assert.deepEqual(components(grid).length, 1,
        `${viewport.width}px ${action} x=${x} t=${seconds} has a detached primary part`);
    }
  }
});

test('Canvas output paints one flat field then only the logical ASCII glyphs', () => {
  const { grid } = frame('investigate', 2.3), calls = [];
  const ctx = new Proxy({}, {
    get(target, key) {
      if (['setTransform', 'fillRect', 'fillText'].includes(key)) return (...args) => calls.push([key, ...args]);
      throw new Error(`Unexpected raster primitive: ${String(key)}`);
    },
    set(target, key, value) { target[key] = value; return true; }
  });
  drawPuppetGrid(ctx, grid, { dpr: 2 });
  assert.equal(calls.filter(call => call[0] === 'fillRect').length, 1);
  const text = calls.filter(call => call[0] === 'fillText');
  assert.equal(text.length, grid.glyphCount);
  assert.ok(text.every(([, glyph, x, y]) => glyph.length === 1 && Number.isFinite(x) && Number.isFinite(y)));
});
