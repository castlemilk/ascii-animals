/** Executed API/scheduler bookkeeping with explicit DOM and Canvas mocks. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFoxArtwork, createFoxDirector } from '../lib/public/fox.js';
import { buildFoxSceneGrid, routeFoxScenePointer } from '../lib/species/fox/director-render.js';
import { CuttlefishArtwork } from '../lib/animals/cuttlefish.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';

function mount(options = {}, environment = {}) {
  const { width = 900, height = 600, ...hostOptions } = environment;
  const host = fakeBrowser(hostOptions), canvas = host.canvas(width, height);
  const fox = createFoxArtwork(canvas, { director: { count: 3 }, ...options });
  host.intersect(canvas, true);
  return { host, canvas, fox };
}
function steps(host, n = 1) { for (let i = 0; i <= n; i++) host.frame(); }

test('three directed foxes and marine artwork borrow one scheduler; teardown leaves neighbours running', () => {
  const { host, canvas, fox } = mount();
  const fish = new CuttlefishArtwork(host.canvas(), { count: 1 });
  assert.equal(host.pending, 1);
  steps(host, 8);
  assert.equal(fox.getDirectorState().actors.length, 3);
  assert.equal(fox.getState().schemaVersion, 1);
  assert.equal(fox.getState().species, 'fox');
  assert.equal(fox.getStatus().ownAnimationFrames, 0);
  assert.equal(fox.getStatus().subscribed, true);
  fox.selectFox(2); assert.equal(fox.getDirectorState().selectedId, 2);
  fox.pause(); assert.equal(host.pending, 1);
  const tick = fox.getState().tick;
  host.frame(10000); assert.equal(fox.getState().tick, tick);
  fox.dispose(); fox.dispose();
  assert.equal(canvas.width, 1); assert.equal(canvas.listenerCount, 0);
  assert.equal(host.pending, 1); assert.equal(fox.getStatus().disposed, true);
  fish.destroy(); assert.equal(host.pending, 0);
});

test('director guide/cue storms coalesce to one ordered pair without invoking legacy callback', () => {
  const batches = []; let legacy = 0;
  const { host, fox } = mount({ onDirectorInputs: batch => batches.push(batch), onInputs: () => legacy++ });
  for (let i = 0; i < 3000; i++) { fox.guide((i % 100) / 100, .1); fox.cue('rustle', 1); }
  fox.guide(.6, -.2);
  assert.equal(fox.getStatus().pendingInputs, 2);
  steps(host);
  assert.deepEqual(batches[0], [
    { type: 'guide', tick: 1, seq: 0, x: .6, y: -.2 },
    { type: 'cue', tick: 1, seq: 1, cue: 'rustle', id: 1 },
  ]);
  assert.equal(legacy, 0); assert.equal(fox.getStatus().pendingInputs, 0);
  assert(Object.isFrozen(batches[0]) && Object.isFrozen(batches[0][0]));
  fox.dispose();
});

test('pointer routing preserves visible ownership through desktop/portrait letterboxes and DPR', () => {
  const reference = createFoxDirector({ count: 3 });
  for (const [width, height, cols] of [[900, 600, 160], [390, 600, 112]]) {
    const grid = buildFoxSceneGrid(reference.getFrame(), { cols, rows: 64 });
    const cell = grid.owners.findIndex(owner => owner === 1);
    assert(cell >= 0, 'second actor must own visible cells');
    const col = cell % grid.cols, row = Math.floor(cell / grid.cols);
    const x = (col + .5) / grid.cols * 2 - 1, y = (row + .5) / grid.rows * 2 - 1;
    const expected = routeFoxScenePointer(grid, x, y);
    const ch = Math.min(height / grid.rows, width / (grid.cols * .5)), cw = ch * .5;
    const ox = (width - grid.cols * cw) / 2, oy = (height - grid.rows * ch) / 2;
    const results = [];
    for (const dpr of [1, 3]) {
      const batches = [];
      const { host, canvas, fox } = mount({ onDirectorInputs: batch => batches.push(batch) }, { dpr, width, height });
      canvas.emit('pointerdown', { clientX: ox + (col + .5) * cw, clientY: oy + (row + .5) * ch });
      steps(host);
      results.push(batches[0]);
      assert.equal(batches[0][1].id, 1);
      assert(Math.abs(batches[0][0].x - expected.point.x) < 1e-12);
      assert(Math.abs(batches[0][0].y - expected.point.y) < 1e-12);
      assert.equal(fox.getStatus().backingWidth, width * Math.min(dpr, 2));
      fox.dispose();
    }
    assert.deepEqual(results[0], results[1]);
  }
  reference.dispose();
});

test('reduced-motion cues and actor selection produce distinct tableaux without ticks or subscriptions', () => {
  const { host, canvas, fox } = mount({}, { reducedMotion: true });
  const rest = fox.exportText();
  assert.equal(host.pending, 0); assert.equal(fox.getStatus().tableau, 'rest');
  canvas.emit('pointermove', { clientX: 680, clientY: 300 });
  assert.equal(fox.exportText(), rest);
  fox.selectFox(1); fox.cue('rustle', 1);
  const listen = fox.exportText();
  assert.equal(fox.getStatus().tableau, 'listen');
  fox.cue('pounce', 1);
  const pounce = fox.exportText();
  assert.equal(fox.getStatus().tableau, 'pounce');
  assert.notEqual(rest, listen); assert.notEqual(listen, pounce);
  assert.equal(fox.getState().tick, 0); assert.equal(fox.getDirectorState().tick, 0);
  assert.equal(fox.getDirectorState().selectedId, 1);
  assert.equal(fox.getStatus().pendingInputs, 0); assert.equal(host.pending, 0);
  fox.play(); fox.restart(); assert.equal(host.pending, 0);
  fox.showTableau('rest'); host.setReduced(false);
  assert.equal(fox.getStatus().paused, true); assert.equal(host.pending, 0);
  fox.dispose();
});

test('portrait empty-space rustles choose the nearest presented fox while hover keeps deliberate selection', () => {
  const reference = createFoxDirector({ count: 3 });
  const grid = buildFoxSceneGrid(reference.getFrame(), { cols: 112, rows: 64 });
  const anchor = grid.anchors.find(item => item.id === 1), units = 28;
  let best = -1, distance = Infinity;
  for (let i = 0; i < grid.owners.length; i++) if (grid.owners[i] === -1) {
    const wx = (i % 112 + .5 - 56) * .5 / units;
    const wy = (Math.floor(i / 112) + .5 - 64 * .35) / units;
    const d = Math.hypot(wx - anchor.center.x, wy - anchor.center.y);
    if (d < distance) { distance = d; best = i; }
  }
  assert(best >= 0);
  const x = (best % 112 + .5) / 112 * 2 - 1;
  const y = (Math.floor(best / 112) + .5) / 64 * 2 - 1;
  assert.equal(routeFoxScenePointer(grid, x, y).id, 1);
  const batches = [], width = 390, height = 600;
  const { host, canvas, fox } = mount({ onDirectorInputs: batch => batches.push(batch) }, { width, height });
  const ch = width / 56, paintedHeight = 64 * ch;
  const clientX = (x + 1) * width / 2, clientY = (height - paintedHeight) / 2 + (y + 1) * paintedHeight / 2;
  canvas.emit('pointerdown', { clientX, clientY }); steps(host);
  assert.equal(batches[0][1].id, 1);
  fox.selectFox(2);
  reference.step(1, batches[0]); reference.select(2);
  // Replay the accepted batch to account for the first tick's movement.
  const currentGrid = buildFoxSceneGrid(reference.getFrame(), { cols: 112, rows: 64 });
  const preferred = routeFoxScenePointer(currentGrid, x, y, 2);
  const before = fox.getDirectorState().selectedId;
  canvas.emit('pointermove', { clientX, clientY }); host.frame();
  assert.equal(before, 2); assert.equal(fox.getDirectorState().selectedId, 2);
  assert.equal(batches.at(-1).length, 1); assert.equal(batches.at(-1)[0].type, 'guide');
  assert(Math.abs(batches.at(-1)[0].x - preferred.point.x) < 1e-12);
  assert(Math.abs(batches.at(-1)[0].y - preferred.point.y) < 1e-12);
  fox.dispose(); reference.dispose();
});

test('suspension clears transient director input, preserves user pause and performs no hidden catch-up', () => {
  const batches = [];
  const { host, canvas, fox } = mount({ onDirectorInputs: batch => batches.push(batch) });
  fox.guide(.7, .3); steps(host, 3);
  fox.cue('pounce'); fox.pause();
  assert.equal(fox.getStatus().pendingInputs, 0); assert.equal(host.pending, 0);
  fox.configureDirector({ scene: 'den-watch', count: 2 });
  fox.update({ tailSway: .1 }); fox.restart();
  assert.equal(fox.getStatus().paused, true); assert.equal(host.pending, 0);
  fox.play(); host.hide(true); host.intersect(canvas, false);
  canvas.rect.width = 0; for (const observer of host.resizes) observer.callback([]);
  host.hide(false); host.intersect(canvas, true);
  assert.equal(host.pending, 0);
  canvas.rect.width = 900; for (const observer of host.resizes) observer.callback([]);
  const before = fox.getState().tick;
  host.frame(300000); assert.equal(fox.getState().tick, before);
  host.frame(); assert.equal(fox.getState().tick, before + 1);
  assert.equal(fox.getStatus().droppedMilliseconds, 0);
  fox.dispose();
});

test('invalid director operations are atomic and do not dispose a healthy mount', () => {
  const { fox } = mount();
  const before = fox.getDirectorState(), options = fox.getDirectorOptions();
  for (const action of [() => fox.configureDirector({ count: 4 }), () => fox.cue('ink'),
    () => fox.cue('pounce', -1), () => fox.cue('rustle', 1, { x: NaN, y: 0 }),
    () => fox.selectFox(10), () => fox.showTableau('ink'), () => fox.configureDirector({ pace: Infinity })]) assert.throws(action);
  assert.deepEqual(fox.getDirectorState(), before); assert.deepEqual(fox.getDirectorOptions(), options);
  assert.equal(fox.disposed, false); fox.dispose();
});

test('director callback failures and late callbacks release only owned resources', () => {
  const { host, canvas, fox } = mount({ onDirectorInputs() { throw new Error('record failed'); } });
  fox.guide(.3, .1); host.frame();
  // The fake host reports the error synchronously; the Fox still tears down.
  assert.throws(() => host.frame(), /record failed/);
  assert.equal(fox.disposed, true); assert.equal(host.pending, 0);
  assert.equal(canvas.listenerCount, 0);
  const state = fox.getStatus().director;
  host.intersect(canvas, true); host.hide(false); host.frame(100000);
  assert.deepEqual(fox.getStatus().director, state);
  for (const action of [() => fox.configureDirector({}), () => fox.getDirectorOptions(),
    () => fox.getDirectorState(), () => fox.cue('rest'), () => fox.selectFox(0), () => fox.showTableau('listen')]) assert.throws(action, /disposed/);
});

test('reset inside an input callback retires the old catch-up frame for director and legacy mounts', () => {
  for (const enabled of [false, true]) {
    const host = fakeBrowser(), canvas = host.canvas();
    let fox, callbacks = 0;
    const resetFromInput = () => { callbacks++; fox.reset(); };
    fox = createFoxArtwork(canvas, { ...(enabled ? { director: { count: 3 } } : {}),
      onInputs: resetFromInput, onDirectorInputs: resetFromInput });
    host.intersect(canvas, true); host.frame();
    fox.guide(.4, .2); host.frame(1000);
    assert.equal(callbacks, 1);
    assert.equal(fox.getState().tick, 0, 'retired frame must not advance reset simulation');
    assert.equal(host.pending, 1, 'new subscription remains scheduled once');
    host.frame(); assert.equal(fox.getState().tick, 0, 'new clock takes its first timestamp');
    host.frame(); assert.equal(fox.getState().tick, 1);
    fox.dispose(); assert.equal(host.pending, 0);
  }
});

test('director construction is explicit and bounded; legacy mounts keep their absent-director result', () => {
  const host = fakeBrowser(), canvas = host.canvas();
  for (const director of [null, [], false, { count: -1 }, { count: 1.5 }, { count: 4 }, { unknown: true }, { seed: 9 }, { fox: { seed: 9 } }]) {
    assert.throws(() => createFoxArtwork(canvas, { director }));
    assert.equal(canvas.listenerCount, 0); assert.equal(host.pending, 0);
  }
  const fox = createFoxArtwork(canvas); host.intersect(canvas, true);
  assert.equal(fox.getDirectorState(), null); assert.equal(fox.getDirectorOptions(), null);
  assert.throws(() => fox.cue('rest'), /not enabled/);
  assert.equal(fox.getStatus().cols, 112); assert.equal(fox.getStatus().rows, 44);
  fox.dispose();
});
