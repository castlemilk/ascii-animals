import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { fakeBrowser } from '../../../../test/helpers/fake-browser.mjs';

// These tests execute the generated script with a simulated browser document.
// They establish bundling, control wiring and ownership, not rendered-page,
// physical-touch, responsive-CSS or browser-accessibility acceptance.
const here = fileURLToPath(new URL('..', import.meta.url));
const directory = mkdtempSync(path.join(tmpdir(), 'octopus-trickster-standalone-'));
const output = path.join(directory, 'pocket-trickster.html');
const receipt = JSON.parse(execFileSync(process.execPath, [path.join(here, 'build.mjs'), output], { encoding: 'utf8' }));
const html = readFileSync(output, 'utf8');
const scripts = [...html.matchAll(/<script\s+type="module">([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length, 1);
const script = scripts[0][1];
process.on('exit', () => rmSync(directory, { recursive: true, force: true }));

class LocalAbortController {
  constructor() {
    const callbacks = new Set();
    this.signal = { aborted: false,
      addEventListener(type, callback) { if (type === 'abort') callbacks.add(callback); },
      removeEventListener(type, callback) { if (type === 'abort') callbacks.delete(callback); } };
    this.abort = () => {
      if (this.signal.aborted) return;
      this.signal.aborted = true;
      for (const callback of [...callbacks]) callback();
      callbacks.clear();
    };
  }
}

function fixture({ reducedMotion = false, missing = null } = {}) {
  const host = fakeBrowser({ reducedMotion });
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const nodes = Object.fromEntries(ids.map(id => {
    const node = host.canvas(id === 'octopus' ? 960 : 1, id === 'octopus' ? 600 : 1);
    const attributes = new Map();
    Object.assign(node, { id, textContent: '', hidden: false, disabled: false, dataset: {},
      setAttribute(name, value) { attributes.set(name, value); },
      getAttribute(name) { return attributes.get(name) ?? null; } });
    return [id, node];
  }));
  host.document.getElementById = id => id === missing ? null : nodes[id] || null;
  // The generic numerical fake does not interpret AbortSignal options. This
  // fixture supplies the ordinary DOM listener lifetime used by preview.mjs.
  for (const target of [host.view, host.document, host.motion, ...Object.values(nodes)]) {
    const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target);
    target.addEventListener = (type, callback, options) => {
      if (options?.signal?.aborted) return;
      add(type, callback);
      options?.signal?.addEventListener('abort', () => remove(type, callback), { once: true });
    };
  }
  const ctx = nodes.octopus.getContext('2d');
  let draws = 0, glyphs = [];
  ctx.fillRect = () => { draws++; glyphs = []; };
  ctx.fillText = (text, x, y) => { glyphs.push([text, x, y, ctx.fillStyle]); };
  const errors = [];
  const sandbox = { document: host.document, window: host.view,
    matchMedia: host.view.matchMedia, AbortController: LocalAbortController,
    console: { error(error) { errors.push(String(error)); } } };
  vm.createContext(sandbox);
  new vm.Script(script, { filename: 'pocket-trickster-inline.js' }).runInContext(sandbox);
  return { host, nodes, errors, get draws() { return draws; }, get glyphs() { return glyphs; } };
}

function press(node, key, patch = {}) {
  node.emit('keydown', { target: node, key, preventDefault() {}, ...patch });
}

test('build includes the exact seven inputs and records their combined source SHA-256', () => {
  const expected = ['../../../src/core/scheduler.js', 'core.mjs', 'render.mjs', 'browser.mjs', 'preview.mjs', 'style.css', 'index.html'];
  assert.deepEqual(receipt.inputs, expected);
  const digest = createHash('sha256').update(expected.map(file => file + '\0' + readFileSync(path.resolve(here, file), 'utf8')).join('\0')).digest('hex');
  assert.equal(receipt.sourceSha256, digest);
  assert(html.includes(`<meta name="octopus-source-sha256" content="${digest}">`));
  assert.equal(receipt.bytes, Buffer.byteLength(html));
  assert.equal(receipt.runtimeDependencies, 0);
  assert.equal(receipt.publication, false);
});

test('standalone HTML has no external runtime requests and the script compiles without module imports', () => {
  assert(!/<script\b[^>]*\bsrc\s*=/i.test(html));
  assert(!/<link\b[^>]*rel=["']stylesheet["']/i.test(html));
  assert(!/<(?:img|iframe|audio|video)\b[^>]*\bsrc\s*=/i.test(html));
  assert(!/\b(?:fetch\s*\(|XMLHttpRequest|WebSocket|import\s*\()/m.test(script));
  assert(!/^\s*(?:import|export)\s/m.test(script));
  assert(!/url\s*\(/i.test(html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || ''));
  assert.doesNotThrow(() => new vm.Script(script));
});

test('all ARIA ID references and preview control IDs resolve in the source HTML', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'IDs are unique');
  for (const match of html.matchAll(/\baria-(?:labelledby|describedby)="([^"]+)"/g)) {
    for (const id of match[1].split(/\s+/)) assert(ids.includes(id), `Missing ARIA target ${id}`);
  }
  for (const id of ['octopus', 'reach', 'ink', 'release', 'pause', 'restart', 'status', 'motion', 'playback']) assert(ids.includes(id));
});

test('the exact bundled script mounts, draws ASCII, handles controls and tears down', () => {
  const f = fixture();
  assert.deepEqual(f.errors, []);
  assert.equal(f.host.pending, 1);
  assert(f.glyphs.length > 100);
  assert(f.glyphs.every(glyph => glyph[0].length === 1 && glyph[0].charCodeAt(0) >= 32 && glyph[0].charCodeAt(0) <= 126));
  assert.equal(f.nodes.pause.textContent, 'Pause');
  f.nodes.reach.emit('click');
  assert.match(f.nodes.status.textContent, /pearl|arm|eyes/i);
  const first = JSON.stringify(f.glyphs);
  f.host.frame(); for (let i = 0; i < 30; i++) f.host.frame(1000 / 60);
  assert.notEqual(JSON.stringify(f.glyphs), first);
  f.nodes.reach.emit('click'); assert.match(f.nodes.status.textContent, /settle/i);
  f.nodes.ink.emit('click'); assert.match(f.nodes.status.textContent, /disturbance|peek/i);
  f.host.frame(1000 / 60);
  f.nodes.ink.emit('click'); assert.match(f.nodes.status.textContent, /already|underway/i);
  f.nodes.pause.emit('click');
  assert.equal(f.nodes.pause.textContent, 'Play'); assert.equal(f.host.pending, 0);
  const before = f.draws;
  f.nodes.ink.emit('click'); f.host.frame(10000);
  assert.equal(f.draws, before); assert.match(f.nodes.status.textContent, /still|Play/i);
  f.nodes.restart.emit('click'); assert.equal(f.nodes.pause.textContent, 'Play'); assert.equal(f.host.pending, 0);
  press(f.nodes.octopus, ' '); assert.equal(f.nodes.pause.textContent, 'Pause'); assert.equal(f.host.pending, 1);
  f.host.view.emit('pagehide', { persisted: false });
  assert.equal(f.host.pending, 0);
  for (const node of Object.values(f.nodes)) assert.equal(node.listenerCount, 0);
  assert.equal(f.host.document.listenerCount, 0); assert.equal(f.host.view.listenerCount, 0);
  assert.equal(f.host.motion.listenerCount, 0); assert.equal(f.host.resizes.size, 0); assert.equal(f.host.intersections.size, 0);
});

test('the reduced-motion preview starts still and its keyboard Play action updates the visible controls', () => {
  const f = fixture({ reducedMotion: true });
  assert.deepEqual(f.errors, []);
  assert.equal(f.host.pending, 0); assert.equal(f.nodes.pause.textContent, 'Play');
  assert.equal(f.nodes.motion.hidden, false);
  f.nodes.reach.emit('click'); f.nodes.ink.emit('click');
  assert.equal(f.host.pending, 0);
  press(f.nodes.octopus, ' ');
  assert.equal(f.nodes.pause.textContent, 'Pause'); assert.equal(f.host.pending, 1);
  f.host.setReduced(true);
  assert.equal(f.nodes.pause.textContent, 'Play'); assert.equal(f.host.pending, 0);
  f.host.setReduced(false);
  assert.equal(f.nodes.pause.textContent, 'Play'); assert.equal(f.host.pending, 0);
  f.host.view.emit('pagehide', { persisted: false });
});

test('a preview binding failure releases the successfully created controller and remaining listeners', () => {
  const f = fixture({ missing: 'ink' });
  assert.equal(f.host.pending, 0, 'a failed preview must not leave an invisible animation running');
  assert.equal(f.host.resizes.size, 0); assert.equal(f.host.intersections.size, 0);
  assert.equal(f.nodes.status.dataset.error, 'true');
  assert.equal(f.nodes.octopus.listenerCount, 0); assert.equal(f.nodes.reach.listenerCount, 0);
});
