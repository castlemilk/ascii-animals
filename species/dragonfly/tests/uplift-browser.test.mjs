import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mountDragonfly } from '../lib/browser.js';
import { createDragonflyDirector } from '../lib/director.js';
import { DRAGONFLY_CELL_ASPECT, createDragonflyProjector } from '../lib/preview.js';
import { rasterizeDragonflyPond } from '../lib/pond-preview.js';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';

// Instrumented lifecycle/input/paint-operation tests only. The context records
// text operations; it is not a native canvas, real browser or touch device.
const TICK = 1000 / 60;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function fixture({ width = 390, height = 520, dpr = 2, reduced = false } = {}) {
  const browser = fakeBrowser({ reducedMotion: reduced, dpr });
  const canvas = browser.canvas(width, height);
  canvas.rect = { ...canvas.rect, left: 93, top: 61 };
  const context = canvas.getContext('2d');
  const callbacks = new Set(), listenerOptions = new Map();
  let operations = [], time = 1000;
  context.measureText = text => ({ width: text.length * 5 });
  context.fillRect = () => { operations = []; };
  context.fillText = (text, x, y) => operations.push([text, x, y, context.fillStyle, context.globalAlpha]);
  const originalListen = canvas.addEventListener.bind(canvas);
  canvas.addEventListener = (type, callback, options) => {
    listenerOptions.set(type, options); originalListen(type, callback, options);
  };
  const frameSource = { subscribe(callback) { callbacks.add(callback); return () => callbacks.delete(callback); } };
  return {
    browser, canvas, frameSource, listenerOptions,
    get painting() { return digest(operations); },
    get glyphOperations() { return operations.filter(([text]) => text.length === 1); },
    get active() { return callbacks.size; },
    at(timestamp) { time = timestamp; for (const callback of [...callbacks]) callback(timestamp); },
    frame(delta = TICK) { this.at(time + delta); },
    key(key, fields = {}) {
      const event = { key, preventDefault() { this.defaultPrevented = true; }, ...fields };
      canvas.emit('keydown', event); return event;
    },
    touch(localX, localY, fields = {}) {
      const event = { type: 'pointerdown', pointerType: 'touch', button: 0,
        clientX: canvas.rect.left + localX, clientY: canvas.rect.top + localY,
        preventDefault() { this.defaultPrevented = true; }, ...fields };
      canvas.emit(event.type, event); return event;
    },
  };
}

function mount(f, options = {}) {
  return mountDragonfly(f.canvas, { frameSource: f.frameSource, director: { count: 3 }, ...options });
}
function selected(host) {
  const state = host.getDirectorState();
  return state.members.find(member => member.id === state.selected);
}
function paintedText(f, status) {
  const { width, height, cols, rows } = status;
  const cellHeight = Math.min(height / rows, width / (cols * DRAGONFLY_CELL_ASPECT));
  const cellWidth = cellHeight * DRAGONFLY_CELL_ASPECT;
  const left = (width - cols * cellWidth) / 2, top = (height - rows * cellHeight) / 2;
  const cells = Array.from({ length: rows }, () => Array(cols).fill(' '));
  for (const [glyph, x, y] of f.glyphOperations) {
    const col = Math.round((x - left) / cellWidth - .5);
    const row = Math.round((y - top) / cellHeight - .5);
    assert(col >= 0 && col < cols && row >= 0 && row < rows);
    cells[row][col] = glyph;
  }
  return cells.map(row => row.join('')).join('\n');
}
function assertPaintMatches(f, host, message) {
  const exported = host.exportText(), painted = paintedText(f, host.getStatus());
  assert.equal(exported.length, painted.length, 'Paint and text capture have the same grid dimensions');
  let differences = 0;
  for (let index = 0; index < exported.length; index++) differences += Number(exported[index] !== painted[index]);
  assert.equal(differences, 0, `${message}: ${differences} cells differ`);
}

test('touch picks the visible individual in an offset CSS canvas independently of DPR', () => {
  for (const dpr of [1, 2]) {
    const f = fixture({ dpr }), host = mount(f);
    const status = host.getStatus();
    const director = createDragonflyDirector({ count: 3 }, { seed: 17 });
    const options = { cols: status.cols, rows: status.rows, view: 'oblique', neutral: false };
    const grid = rasterizeDragonflyPond(director.sample(), options);
    const body = createDragonflyProjector(options)(director.getState().members[2].position);
    const visible = [...grid.owners].flatMap((owner, cell) => owner === 2 ? [cell] : []);
    assert(visible.length > 0, 'The intended visitor has real visible cells');
    visible.sort((a, b) => {
      const distance = cell => (cell % grid.cols - body.col) ** 2 + (Math.floor(cell / grid.cols) - body.row) ** 2;
      return distance(a) - distance(b);
    });
    const cell = visible[0];
    const cellHeight = Math.min(status.height / grid.rows, status.width / (grid.cols * DRAGONFLY_CELL_ASPECT));
    const cellWidth = cellHeight * DRAGONFLY_CELL_ASPECT;
    const x = (status.width - grid.cols * cellWidth) / 2 + (cell % grid.cols + .5) * cellWidth;
    const y = (status.height - grid.rows * cellHeight) / 2 + (Math.floor(cell / grid.cols) + .5) * cellHeight;
    const touched = f.touch(x, y);
    assert.equal(touched.defaultPrevented, undefined, 'Touch guidance must not block page scrolling');
    assert.equal(f.listenerOptions.get('pointerdown').passive, true);
    assert.equal(host.getStatus().pendingInputs, 2, 'One touch queues selection and guidance');
    f.frame(); f.frame();
    assert.equal(host.getDirectorState().selected, 2);
    assert.equal(selected(host).phase.kind, 'attention');
    assert.equal(host.getStatus().pendingInputs, 0);
    assert.deepEqual(host.getDirectorState().target, {
      x: 2 * x / f.canvas.rect.width - 1, y: 2 * y / f.canvas.rect.height - 1,
    });
    const sequence = host.getDirectorState().lastSeq;
    f.touch(6, 6); f.frame();
    assert.equal(host.getDirectorState().selected, 2, 'An empty-habitat tap guides without changing the selected visitor');
    assert.equal(host.getDirectorState().lastSeq, sequence + 1);
    f.touch(x, y, { type: 'pointercancel' });
    assert.equal(host.getDirectorState().target, null);
    assert.equal(host.getStatus().pendingInputs, 0);
    host.dispose(); director.dispose();
    assert.equal(f.active, 0);
    assert.equal(f.canvas.listenerCount, 0);
  }
});

test('D/L/R cues act on the focused pond selection and preserve static motion policy', () => {
  const f = fixture(), host = mount(f, { director: { count: 2, scene: 'attention' } });
  f.frame(); f.frame();
  const control = f.key('d', { ctrlKey: true });
  assert.equal(control.defaultPrevented, undefined);
  assert.equal(host.getStatus().pendingInputs, 0);
  const select = f.key('2'), dart = f.key('D');
  assert.equal(select.defaultPrevented, true); assert.equal(dart.defaultPrevented, true);
  f.frame();
  assert.equal(host.getDirectorState().selected, 1);
  assert.equal(selected(host).phase.kind, 'launch');
  assert.equal(f.browser.document.listeners.get('keydown'), undefined);
  assert.equal(f.browser.view.listeners.get('keydown'), undefined);
  assert.equal(f.key('Tab').defaultPrevented, undefined, 'Tab remains available to leave the artwork');
  host.reset(); f.frame();
  const land = f.key('l'); assert.equal(land.defaultPrevented, true); f.frame();
  let frames = 0;
  while (selected(host).phase.kind !== 'perched' && frames++ < 250) f.frame(5 * TICK);
  assert.equal(selected(host).phase.kind, 'perched');
  const release = f.key('r'); assert.equal(release.defaultPrevented, true); f.frame();
  assert.equal(selected(host).phase.kind, 'launch', 'R spools up wings and releases the twig before returning');
  host.dispose();

  const still = fixture({ reduced: true }), poster = mount(still, { director: { count: 2 } });
  assert.equal(still.active, 0);
  for (const key of ['d', 'L', 'r']) {
    const before = poster.exportText();
    assert.equal(still.key(key).defaultPrevented, true);
    assert.notEqual(poster.exportText(), before, `${key} has an explicit still-pose equivalent`);
    assert.equal(poster.getDirectorState().tick, 0);
    assert.equal(still.active, 0);
    assert.equal(poster.getStatus().pendingInputs, 0);
  }
  poster.dispose();
});

test('fractional frames preserve exact state and export the cells that were actually painted', () => {
  for (const directed of [false, true]) {
    const f = fixture({ width: 1200, height: 700, dpr: 1 });
    const host = mountDragonfly(f.canvas, { frameSource: f.frameSource,
      ...(directed ? { director: { count: 1, scene: 'attention', scale: .48 } } : {}),
      model: { seed: 17, wingAmplitude: .4, wingHz: 6 } });
    f.at(1000);
    let changed = false, textChanged = false;
    for (let tick = 1; tick <= 24; tick++) {
      f.at(1000 + tick * TICK);
      const state = directed ? host.getDirectorState() : host.getState();
      const text = host.exportText(), firstPainting = f.painting;
      assertPaintMatches(f, host, 'Whole-tick capture agrees with the visible pose');
      for (const fraction of [.25, .5, .75]) {
        f.at(1000 + (tick + fraction) * TICK);
        assert.equal(host.getStatus().tick, tick);
        assert.deepEqual(directed ? host.getDirectorState() : host.getState(), state);
        assertPaintMatches(f, host, 'Text capture must reproduce the visible fractional pose rather than a later simulation pose');
        changed ||= f.painting !== firstPainting;
        textChanged ||= host.exportText() !== text;
      }
    }
    assert(changed, `${directed ? 'Director' : 'Solo'} host must draw intermediate poses between fixed ticks`);
    assert(textChanged, 'Text capture must track the changed presentation without advancing simulation');
    host.setPaused(true);
    const paused = f.painting, tick = host.getStatus().tick;
    f.frame(2000);
    assert.equal(f.painting, paused); assert.equal(host.getStatus().tick, tick); assert.equal(f.active, 0);
    assertPaintMatches(f, host, 'Paused text matches the final visible pose');
    f.browser.setReduced(true); f.browser.setReduced(false);
    assert.equal(f.active, 0, 'Preference changes do not defeat the independent user pause');
    host.dispose();
  }
});
