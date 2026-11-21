import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createOctopusState, stepOctopus } from '../core.mjs';
import { PALETTE, gridMetrics, rasterizeOctopus, gridToText, renderOctopus } from '../render.mjs';

// Logical-cell tests only. Native raster images and browser behavior have
// separate evidence; these checks do not establish visual or device acceptance.
const DIMENSIONS = [[320, 240], [320, 460], [390, 460], [390, 640], [960, 600], [1280, 720], [1440, 1100], [4096, 4096]];
const colorId = name => Object.keys(PALETTE).indexOf(name);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const advance = (state, ticks) => { for (let i = 0; i < ticks; i++) stepOctopus(state); return state; };
const indexAt = (grid, x, y) => Math.floor((grid.cy + y * grid.scale) / grid.cellH) * grid.cols
  + Math.floor((grid.cx + x * grid.scale) / grid.cellW);
const worldAt = (grid, index) => [((index % grid.cols + .5) * grid.cellW - grid.cx) / grid.scale,
  ((Math.floor(index / grid.cols) + .5) * grid.cellH - grid.cy) / grid.scale];
const frameDigest = grid => digest([grid.cols, grid.rows, [...grid.chars], [...grid.colors], [...grid.owners], grid.pose]);

test('all supported sizes stay under 4096 cells and export exact-width printable ASCII', () => {
  for (const [width, height] of DIMENSIONS) {
    for (const age of [0, 56, 110, 220]) {
      const state = createOctopusState(17);
      if (age) { stepOctopus(state, [{ type: 'startle', x: -.8, y: .3 }]); advance(state, age - 1); }
      const grid = rasterizeOctopus(state, { width, height }), text = gridToText(grid);
      assert(grid.chars.length <= 4096);
      assert.equal(grid.chars.length, grid.cols * grid.rows);
      assert.equal(grid.colors.length, grid.chars.length);
      assert.equal(grid.owners.length, grid.chars.length);
      assert.match(text, /^[\x20-\x7e\n]+$/);
      const rows = text.split('\n');
      assert.equal(rows.length, grid.rows);
      assert(rows.every(row => row.length === grid.cols));
      assert([...grid.chars].every(code => code >= 32 && code <= 126));
      assert([...grid.colors].every(index => index < Object.keys(PALETTE).length));
      assert([...grid.owners].every(owner => owner === 0 || owner === 1 || owner === 2));
      assert(grid.glyphCount > 20);
    }
  }
});

test('zero and invalid dimensions reject before any cell allocation', () => {
  for (const [width, height] of [[0, 500], [500, 0], [-1, 500], [500, -1], [NaN, 500],
    [500, NaN], [Infinity, 500], [500, Infinity], ['390', 460], [390, '460'], [null, 460]]) {
    assert.throws(() => gridMetrics(width, height), RangeError);
    assert.throws(() => rasterizeOctopus(createOctopusState(), { width, height }), RangeError);
  }
  // An implementation may reject subnormal dimensions or normalize them, but
  // must never emit zero cell metrics that turn world/cell conversion into NaN.
  for (const [width, height] of [[Number.MIN_VALUE, 500], [500, Number.MIN_VALUE], [Number.MIN_VALUE, Number.MIN_VALUE]]) {
    let metrics;
    try { metrics = gridMetrics(width, height); }
    catch (error) { assert(error instanceof RangeError); continue; }
    for (const key of ['cellW', 'cellH', 'scale']) assert(Number.isFinite(metrics[key]) && metrics[key] > 0, key);
  }
});

test('a contact marker shares the actual selected tip cell and rays wait for contact', () => {
  for (const [width, height] of [[390, 460], [960, 600]]) for (const x of [-.76, .76]) {
    const state = createOctopusState(17);
    stepOctopus(state, [{ type: 'invite', x, y: .33 }]);
    const notice = rasterizeOctopus(state, { width, height });
    assert.equal(notice.pose.stage, 'notice');
    assert.equal(notice.pose.contact.active, false);
    const earlyRay = indexAt(notice, x, .33 - .10);
    assert(!(notice.chars[earlyRay] === '|'.charCodeAt(0) && notice.colors[earlyRay] === colorId('cream')),
      'contact ray must not appear during anticipation');
    advance(state, 95);
    const grid = rasterizeOctopus(state, { width, height });
    const { contact, arms } = grid.pose, tip = arms[contact.arm].tip;
    assert(contact.active);
    assert.deepEqual(tip, [x, .33]);
    assert.equal(indexAt(grid, ...tip), indexAt(grid, contact.x, contact.y));
    const index = indexAt(grid, ...tip);
    assert.equal(String.fromCharCode(grid.chars[index]), '@');
    assert.equal(grid.colors[index], colorId('contact'));
    assert.equal(grid.owners[index], 0, 'the pearl remains an unowned interaction target');
    const rays = [[x - .06, .33 - .065, '\\'], [x + .06, .33 - .065, '/'], [x, .33 - .10, '|']];
    for (const [rx, ry, glyph] of rays) {
      const i = indexAt(grid, rx, ry);
      assert.equal(String.fromCharCode(grid.chars[i]), glyph);
      assert.equal(grid.colors[i], colorId('cream'));
    }
  }
});

test('both eyes retain cream cells and a dark slit at intended phone and desktop grids', () => {
  for (const [width, height] of [[320, 460], [390, 460], [960, 600]]) {
    const grid = rasterizeOctopus(createOctopusState(17), { width, height });
    for (const side of [-1, 1]) {
      let cream = 0, pupil = 0;
      for (let i = 0; i < grid.chars.length; i++) {
        const [x, y] = worldAt(grid, i);
        if (x * side <= 0 || Math.abs(x) > .38 || y < -.42 || y > .08) continue;
        if (grid.owners[i] !== 1) continue;
        if (grid.colors[i] === colorId('cream') && grid.chars[i] !== 32) cream++;
        if (grid.colors[i] === colorId('pupil') && grid.chars[i] === '='.charCodeAt(0)) pupil++;
      }
      assert(cream >= 3, `${width}px eye ${side} retains its eye patch`);
      assert(pupil >= 1, `${width}px eye ${side} retains a slit pupil`);
    }
  }
});

test('left and right invitation cells and selected arms are visibly distinct', () => {
  const frames = [-.78, .78].map(x => {
    const state = createOctopusState(17);
    stepOctopus(state, [{ type: 'invite', x, y: .36 }]); advance(state, 99);
    return rasterizeOctopus(state, { width: 390, height: 460 });
  });
  assert.equal(frames[0].pose.contact.arm, 1);
  assert.equal(frames[1].pose.contact.arm, 6);
  assert(indexAt(frames[0], -.78, .36) % frames[0].cols < frames[0].cols / 2);
  assert(indexAt(frames[1], .78, .36) % frames[1].cols > frames[1].cols / 2);
  assert.notEqual(gridToText(frames[0]), gridToText(frames[1]));
  assert.notEqual(frameDigest(frames[0]), frameDigest(frames[1]));
});

test('full ink concealment leaves no character pixels or character hit ownership', () => {
  for (const [width, height] of [[320, 460], [390, 460], [960, 600], [1280, 720]]) for (const x of [-.8, .8]) {
    const state = createOctopusState(17);
    stepOctopus(state, [{ type: 'startle', x, y: .3 }]); advance(state, 55);
    const grid = rasterizeOctopus(state, { width, height });
    assert.equal(grid.pose.stage, 'hide');
    assert.equal(grid.pose.ink.amount, 1);
    assert.equal(grid.pose.ink.conceal, 1);
    assert.equal(grid.pose.ink.peek, 0);
    assert.equal(grid.characterCells, 0, `${width}x${height}, side ${Math.sign(x)} must fully conceal the original character`);
    assert(grid.inkCells > 100);
    for (let i = 0; i < grid.owners.length; i++) {
      assert.notEqual(grid.owners[i], 1);
      if (grid.owners[i] === 2) assert.equal(grid.hitTest(...worldAt(grid, i)), false);
    }
  }
});

test('peek reveals only the chosen edge while the opposite side stays hidden', () => {
  for (const [width, height] of [[320, 460], [390, 460], [960, 600]]) for (const side of [-1, 1]) {
    const state = createOctopusState(17);
    stepOctopus(state, [{ type: 'startle', x: side * .8, y: .3 }]); advance(state, 55);
    const hidden = rasterizeOctopus(state, { width, height });
    advance(state, 54);
    const peek = rasterizeOctopus(state, { width, height });
    assert.equal(peek.pose.stage, 'peek');
    assert.equal(peek.pose.ink.peek, 1);
    assert(peek.characterCells > 10 && peek.characterCells < 150);
    assert.notEqual(gridToText(peek), gridToText(hidden));
    for (let i = 0; i < peek.owners.length; i++) if (peek.owners[i] === 1) {
      const p = worldAt(peek, i);
      assert(p[0] * side > 0, `unexpected opposite-side character cell at ${p}`);
      assert.equal(peek.hitTest(...p), true);
    }
    advance(state, 170);
    const settled = rasterizeOctopus(state, { width, height });
    assert.equal(settled.pose.stage, 'idle');
    assert.equal(settled.inkCells, 0);
    assert(settled.characterCells > peek.characterCells);
  }
});

test('rendering at 1/2/5-tick groupings preserves identical state and cell checkpoints', () => {
  const inputs = new Map([[20, [{ type: 'invite', x: .75, y: .33 }]], [150, [{ type: 'release' }]],
    [230, [{ type: 'startle', x: -.8, y: .2 }]], [300, [{ type: 'startle' }]]]);
  const checkpoints = new Set([60, 120, 180, 286, 340, 430, 510]);
  function replay(group) {
    const state = createOctopusState(17), frames = [];
    for (let tick = 0; tick <= 510; tick++) {
      stepOctopus(state, inputs.get(tick) || []);
      if (tick % group === 0 || checkpoints.has(state.tick)) {
        const before = digest(state);
        const grid = rasterizeOctopus(state, { width: 320, height: 240 });
        assert.equal(digest(state), before, 'cell generation cannot consume time or state');
        if (checkpoints.has(state.tick)) frames.push([state.tick, frameDigest(grid)]);
      }
    }
    return { frames, state: digest(state) };
  }
  assert.deepEqual(replay(1), replay(2));
  assert.deepEqual(replay(1), replay(5));
});

test('Canvas adapter draws only printable glyphs over one background rectangle', () => {
  const calls = [];
  const context = {
    setTransform: (...args) => calls.push(['setTransform', ...args]),
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    fillText: (...args) => calls.push(['fillText', ...args]),
  };
  const canvas = { clientWidth: 390, clientHeight: 460,
    getContext(type) { assert.equal(type, '2d'); return context; } };
  const result = renderOctopus(canvas, createOctopusState(17), { dpr: 2 });
  assert.equal(calls.filter(c => c[0] === 'fillRect').length, 1);
  assert.deepEqual(calls.find(c => c[0] === 'setTransform'), ['setTransform', 2, 0, 0, 2, 0, 0]);
  const glyphCalls = calls.filter(c => c[0] === 'fillText');
  assert.equal(glyphCalls.length, result.glyphCount);
  assert(glyphCalls.every(c => /^[\x21-\x7e]$/.test(c[1]) && c.slice(2).every(Number.isFinite)));
  assert.throws(() => renderOctopus({ clientWidth: 390, clientHeight: 460, getContext: () => null }, createOctopusState()), /Canvas 2D/);
});
