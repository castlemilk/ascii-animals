import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { CuttlefishArtwork } from '../../../src/animals/cuttlefish.js';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';

// Actual preview controls + actual source engine, with explicit DOM/event and
// Canvas stubs. This verifies wiring, input routing and cleanup, not browser
// layout, trusted touch dispatch, accessibility-tree output or visual quality.
const previewDirectory = fileURLToPath(new URL('../', import.meta.url));
const source = readFileSync(path.join(previewDirectory, 'preview.js'), 'utf8');
const html = readFileSync(path.join(previewDirectory, 'preview.html'), 'utf8');
const importLine = "import { CuttlefishArtwork } from '../../lib/animals/cuttlefish.js';";
assert(source.startsWith(importLine));
const scope = { CuttlefishArtwork };
vm.runInNewContext(source.replace(importLine, '').replace(/^export (?=function )/gm, '')
  + '\nglobalThis.mount = mountOctopusPreview;', scope, { filename: 'octopus-preview.js' });

class Element {
  listeners = new Map(); attributes = {}; dataset = {}; textContent = ''; hidden = false; disabled = false;
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  emit(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) || [])]) listener({ type, target: this, ...event });
  }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  get listenerCount() { return [...this.listeners.values()].reduce((n, set) => n + set.size, 0); }
  click() { this.emit('click'); }
}
class FixtureAbortController {
  signal = Object.assign(new Element(), { aborted: false });
  abort() { if (!this.signal.aborted) { this.signal.aborted = true; this.signal.emit('abort'); this.signal.listeners.clear(); } }
}
class FixturePointerEvent {
  constructor(type, values) { this.type = type; Object.assign(this, values); }
}

function signalAware(target) {
  const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target);
  target.addEventListener = (type, callback, options = {}) => {
    if (options.signal?.aborted) return;
    add(type, callback, options);
    options.signal?.addEventListener('abort', () => remove(type, callback));
  };
  target.dispatchEvent = event => { target.emit(event.type, event); return true; };
  return target;
}

function fixture(reducedMotion = false) {
  const host = fakeBrowser({ reducedMotion });
  const canvas = signalAware(host.canvas(390, 640));
  signalAware(host.view); signalAware(host.motion);
  host.view.AbortController = FixtureAbortController; host.view.PointerEvent = FixturePointerEvent;
  const nodes = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(match => [match[1], signalAware(new Element())]));
  nodes.set('octopus-canvas', canvas);
  host.document.getElementById = id => nodes.get(id) || null;
  const engines = [];
  class ActualArtwork extends CuttlefishArtwork {
    constructor(target, options) { super(target, options); engines.push(this); }
  }
  const controller = scope.mount(host.document, ActualArtwork);
  const key = (value, target = canvas, extra = {}) => {
    let prevented = 0;
    canvas.emit('keydown', { key: value, target, preventDefault() { prevented++; }, ...extra });
    return prevented;
  };
  return { host, canvas, nodes, controller, key, artwork: engines[0],
    frames(count) { for (let i = 0; i < count; i++) host.frame(50); },
    click(id) { nodes.get(id).click(); },
    listeners() { return [...nodes.values()].reduce((total, node) => total + node.listenerCount, 0)
      + host.document.listenerCount + host.view.listenerCount + host.motion.listenerCount; } };
}

test('actual controls produce a reach, release, startle and pause-safe restart; shortcuts stay canvas-scoped', () => {
  const f = fixture(), a = f.artwork;
  assert.equal(a.options.species, 'octopus'); assert.equal(a.options.size, 1.3); assert.equal(a.options.density, 1.45);
  assert.equal(a.options.palette, 'ember'); assert.equal(a.options.autoStart, true); assert.equal(f.host.pending, 1);
  f.click('examine');
  assert.equal(a.pointer.active, true); assert.equal(a.fish[0].speciesState.diagnostics.sequence, 'notice');
  f.frames(45);
  assert.equal(a.fish[0].speciesState.diagnostics.sequence, 'examine');
  assert(a.fish[0].speciesState.reachWeights.some(value => value > .1));
  const x = a.pointer.tx; assert.equal(f.key('ArrowRight'), 1); assert(a.pointer.tx > x);
  assert.equal(f.key('Escape'), 1); assert.equal(a.pointer.active, false);
  f.frames(1); assert.equal(a.fish[0].speciesState.diagnostics.sequence, 'peel-and-settle');
  assert.equal(f.key('J'), 1); assert.equal(a.getStats().reactionStage, 'react');
  f.frames(13); assert(a.ink.length > 0);
  assert.equal(f.key(' '), 1); assert.equal(a.paused, true); assert.equal(f.host.pending, 0);
  const held = a.time; f.click('examine'); f.click('startle'); f.frames(20); assert.equal(a.time, held);
  f.click('restart'); assert.equal(a.paused, true); assert.equal(a.time, 0); assert.equal(f.host.pending, 0);
  assert.equal(f.nodes.get('pause').textContent, 'Play');
  assert.equal(f.key(' ', f.nodes.get('examine')), 0); assert.equal(a.paused, true);
  assert.equal(f.key('Tab'), 0); assert.equal(f.key('Enter', f.canvas, { ctrlKey: true }), 0);
  f.click('pause'); assert.equal(a.paused, false); assert.equal(f.host.pending, 1);
  // Repeating a deliberate invitation at the same point remains meaningful.
  f.click('examine'); f.frames(145); f.click('examine'); f.frames(28);
  assert.equal(a.pointer.active, true);
  assert(['notice', 'unfold'].includes(a.fish[0].speciesState.diagnostics.sequence));
  f.controller.dispose(); assert.equal(f.listeners(), 0); assert.equal(f.host.pending, 0);
});

test('empty-water touch invites while an actual animal hit keeps the native startle', () => {
  const f = fixture(), a = f.artwork;
  const empty = a.owners.findIndex((owner, i) => owner < 0
    && a._hitFish((i % a.cols + .5) * a.cellW, (Math.floor(i / a.cols) + .5) * a.cellH) < 0);
  assert(empty >= 0);
  const tap = index => f.canvas.emit('pointerdown', { pointerType: 'touch', button: 0,
    clientX: (index % a.cols + .5) * a.cellW, clientY: (Math.floor(index / a.cols) + .5) * a.cellH });
  const before = a.time; tap(empty);
  assert.equal(a.getStats().reactionStage, 'idle'); assert.equal(a.pointer.active, true); assert.equal(a.time, before);
  assert.equal(a.fish[0].speciesState.diagnostics.sequence, 'notice');
  const occupied = a.owners.findIndex((owner, i) => owner === 0 && a.visibility[i] >= .2);
  assert(occupied >= 0); tap(occupied);
  assert.equal(a.getStats().reactionStage, 'react'); assert.equal(a.ink.length, 0);
  assert.match(f.nodes.get('action-status').textContent, /gathers its arms/);
  f.controller.dispose();
});

test('reduced-motion controls remain static; AbortController and pagehide remove all shell and engine work', () => {
  const f = fixture(true), a = f.artwork;
  assert.equal(a.paused, true); assert.equal(f.host.pending, 0); assert.equal(f.nodes.get('motion-note').hidden, false);
  f.click('examine'); f.click('startle'); f.key('ArrowRight'); f.frames(5);
  assert.equal(a.time, 0); assert.equal(a.pointer.active, false); assert.equal(a.ink.length, 0);
  assert.match(f.nodes.get('action-status').textContent, /will not resume it automatically/);
  f.click('pause'); f.frames(3); assert(a.time > 0);
  f.host.setReduced(false); f.host.setReduced(true);
  assert.equal(a.paused, true); assert.equal(f.nodes.get('pause').textContent, 'Play'); assert.equal(f.host.pending, 0);
  f.host.setReduced(false); assert.equal(a.paused, true);
  const staleClick = [...f.nodes.get('examine').listeners.get('click')][0];
  const status = f.nodes.get('action-status').textContent;
  f.host.view.emit('pagehide'); f.controller.dispose(); staleClick();
  assert.equal(a.destroyed, true); assert.equal(f.listeners(), 0); assert.equal(f.host.pending, 0);
  assert.equal(f.host.resizes.size + f.host.intersections.size, 0);
  assert.equal(f.nodes.get('action-status').textContent, status);
});

test('history-cached page remains interactive and later ordinary navigation disposes', () => {
  const f = fixture(), a = f.artwork;
  f.host.view.emit('pagehide', { persisted: true });
  assert.equal(a.destroyed, false);
  assert(f.listeners() > 0);
  f.host.view.emit('pageshow', { persisted: true });
  f.click('examine');
  assert.equal(a.pointer.active, true);
  assert.equal(a.fish[0].speciesState.diagnostics.sequence, 'notice');
  f.host.view.emit('pagehide', { persisted: false });
  assert.equal(a.destroyed, true);
  assert.equal(f.listeners(), 0);
  assert.equal(f.host.pending, 0);
});

test('standalone preview contains exact canonical sources and has no local module or stylesheet dependency', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'octopus-preview-test-'));
  try {
    const output = path.join(directory, 'preview.html');
    const result = JSON.parse(execFileSync(process.execPath,
      [path.join(previewDirectory, 'scripts/build-preview.mjs'), '--out', output], { encoding: 'utf8' }));
    assert.equal(result.output, output); assert.equal(result.sharedOutputsWritten, false);
    const standalone = readFileSync(output, 'utf8');
    assert(!/<script\b[^>]*\bsrc=/i.test(standalone)); assert(!/<link\b[^>]*rel="stylesheet"/i.test(standalone));
    const octopus = readFileSync(new URL('../../../src/animals/octopus.js', import.meta.url), 'utf8');
    assert(standalone.includes(octopus.replace(/^export (?=const )/gm, '')));
    assert(standalone.includes(`octopus-source-sha256" content="${result.sourceSha256}`));
    const script = standalone.match(/<script type="module" data-octopus-source>([\s\S]*?)<\/script>/)?.[1];
    assert(script); assert(!/^\s*import\s/m.test(script));
    new vm.Script(script.replace(/^export (?=function )/gm, ''), { filename: 'octopus-standalone-parse-only.js' });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
