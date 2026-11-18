/** Executes the real demo controls with an injected controller and explicit DOM
 * doubles. These assertions do not certify browser layout, touch or accessibility. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../demo/index.html', import.meta.url), 'utf8');
const source = (await readFile(new URL('../demo/demo.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');

class Element {
  listeners = new Map(); attributes = new Map(); dataset = {}; textContent = ''; value = ''; hidden = false;
  disabled = false; checked = false; open = false;
  constructor(id = '', tag = '') { this.id = id; this.tag = tag; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, callback, options = {}) {
    if (options.signal?.aborted) return;
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
    options.signal?.cleanups.push(() => this.listeners.get(type)?.delete(callback));
  }
  emit(type, fields = {}) {
    const event = { type, prevented: false, preventDefault() { this.prevented = true; }, ...fields };
    for (const callback of [...(this.listeners.get(type) ?? [])]) callback(event);
    return event;
  }
  click() { if (!this.disabled) this.emit('click'); }
  remove() { this.removed = true; }
}
class AbortControllerDouble {
  signal = { aborted: false, cleanups: [] };
  abort() { this.signal.aborted = true; for (const cleanup of this.signal.cleanups.splice(0)) cleanup(); }
}
function host({ failMount = false } = {}) {
  const elements = new Map();
  for (const match of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    const element = new Element(match[3], match[1]);
    for (const attribute of match[2].matchAll(/([\w-]+)="([^"]*)"/g)) element.setAttribute(attribute[1], attribute[2]);
    element.hidden = /\shidden\b/.test(match[2]);
    elements.set(element.id, element);
  }
  const beatElements = [...html.matchAll(/<li data-beat="([^"]+)"/g)].map(match => {
    const element = new Element(); element.dataset.beat = match[1]; return element;
  });
  const links = [], blobs = [], revoked = [], calls = [], window = new Element();
  const document = {
    getElementById(id) { assert(elements.has(id), `Missing control ${id}`); return elements.get(id); },
    querySelectorAll(selector) {
      if (selector === '[data-beat]') return beatElements;
      if (selector === 'button,input,select') return [...elements.values()].filter(element => ['button', 'input', 'select'].includes(element.tag));
      throw Error(`Unexpected selector ${selector}`);
    },
    createElement(tag) { assert.equal(tag, 'a'); const element = new Element('', tag); links.push(element); return element; },
    body: { append(element) { element.appended = true; } },
  };
  let options = { scene: 'dusk-hunt', count: 2, pace: 1, curiosity: .7, wind: .3, spacing: 1, roles: ['auto', 'auto', 'auto'], showLabels: true };
  let selectedId = 0, paused = false, tableau = null, onStatus;
  const state = () => ({ scene: options.scene, seed: 17, beat: 'arrival', selectedId,
    actors: ['Ember', 'Pip', 'Bracken'].slice(0, options.count).map((name, id) => ({ id, name, role: 'hunter', action: 'arriving' })) });
  const status = () => ({ paused, reducedMotion: false, director: state(), tableau });
  const controller = {
    getDirectorOptions() { return options; }, getDirectorState: state, getStatus: status,
    configureDirector(patch) {
      calls.push(['configureDirector', JSON.parse(JSON.stringify(patch))]); options = { ...options, ...patch };
      selectedId = Math.min(selectedId, options.count - 1); onStatus(status()); return options;
    },
    selectFox(id) { calls.push(['selectFox', id]); selectedId = id; onStatus(status()); },
    cue(...args) {
      calls.push(['cue', ...JSON.parse(JSON.stringify(args))]);
      if (paused) { tableau = args[0] === 'rest' ? 'rest' : args[0] === 'rustle' ? 'listen' : 'pounce'; onStatus(status()); }
    },
    guide(...args) { calls.push(['guide', ...args]); }, leave() { calls.push(['leave']); },
    setPaused(value) { calls.push(['setPaused', value]); paused = value; onStatus(status()); },
    reset(seed) { calls.push(['reset', seed]); selectedId = 0; onStatus(status()); },
    showTableau(value) { calls.push(['showTableau', value]); tableau = value; paused = true; onStatus(status()); },
    exportText() { return '<actual ASCII>\nfox & meadow'; },
    dispose() { calls.push(['dispose']); },
  };
  let pngCallback;
  elements.get('fox').toBlob = callback => { calls.push(['toBlob']); pngCallback = callback; };
  const context = vm.createContext({ document, window, AbortController: AbortControllerDouble,
    URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:actual-canvas'; }, revokeObjectURL(url) { revoked.push(url); } },
    mountFox(canvas, settings) {
      calls.push(['mount', settings.director]);
      if (failMount) throw Error('No Canvas');
      onStatus = settings.onStatus; onStatus(status()); return controller;
    },
    staticFoxPose() { return {}; }, buildFoxGrid() { return { text: 'STATIC FOX' }; },
  });
  vm.runInContext(source, context, { filename: 'demo.js' });
  return { element: id => elements.get(id), window, calls, controller, links, blobs, revoked,
    finishPng(blob = { actualCanvas: true }) { assert(pngCallback); pngCallback(blob); },
    change(id, value) { elements.get(id).value = value; elements.get(id).emit('change'); },
    status: () => status(), listeners: () => [...elements.values(), window].reduce((n, element) => n + [...element.listeners.values()].reduce((a, b) => a + b.size, 0), 0) };
}

test('scene selection changes only the authored scene; selected cast routes deliberate cues', () => {
  const env = host();
  env.element('pause').click();
  env.element('scene-moon-play').click();
  assert.deepEqual(env.calls.filter(call => call[0] === 'configureDirector'), [['configureDirector', { scene: 'moon-play' }]]);
  assert.equal(env.status().paused, true);
  env.element('fox-1').click(); env.element('scene-cue').click();
  assert.deepEqual(env.calls.at(-1), ['cue', 'play', 1]);
  assert.equal(env.element('selected-name').textContent, 'Pip');
  assert.equal(env.element('beat-title').textContent, 'Crouch, held still');
  assert.equal(env.element('action-status').textContent, 'Pip: Crouch, held still. Playback stays still.');
  env.change('count', '1');
  assert.equal(env.element('fox-1').hidden, true);
  assert.equal(env.element('role-1').disabled, true);
  assert.equal(env.element('selected-name').textContent, 'Ember');
});

test('keyboard equivalents are canvas-scoped, bounded, modifier-safe and repeat-safe', () => {
  const env = host(), canvas = env.element('fox');
  assert.equal(env.window.listeners.has('keydown'), false);
  for (let index = 0; index < 40; index++) assert.equal(canvas.emit('keydown', { key: 'ArrowRight' }).prevented, true);
  assert.deepEqual(env.calls.at(-1), ['guide', 1, .15]);
  const previous = env.calls.length;
  canvas.emit('keydown', { key: 'ArrowLeft', ctrlKey: true });
  canvas.emit('keydown', { key: 'Enter', repeat: true });
  assert.equal(env.calls.length, previous);
  canvas.emit('keydown', { key: 'Enter', repeat: false });
  assert.deepEqual(env.calls.at(-1), ['cue', 'rustle', 0, { x: 1, y: .15 }]);
  canvas.emit('keydown', { key: 'P' });
  assert.deepEqual(env.calls.at(-1), ['cue', 'pounce', 0, { x: 1, y: .15 }]);
  canvas.emit('keydown', { key: ' ' }); assert.equal(env.status().paused, true);
  canvas.emit('keydown', { key: 'Escape' }); assert.deepEqual(env.calls.at(-1), ['leave']);
  assert.equal(canvas.emit('keydown', { key: 'Tab' }).prevented, false);
});

test('static tableaux pause explicitly and text export assigns actual cells as text', () => {
  const env = host(); env.element('still-rest').click();
  assert.deepEqual(env.calls.at(-1), ['showTableau', 'rest']);
  assert.equal(env.status().paused, true);
  assert.equal(env.element('beat-title').textContent, 'The meadow at rest');
  env.element('capture').click();
  assert.equal(env.element('text-frame').textContent, '<actual ASCII>\nfox & meadow');
  assert.equal(env.element('text-export').open, true);
  assert.equal(env.element('text-frame').innerHTML, undefined);
});

test('PNG uses the current Canvas, prevents concurrent export and releases its blob URL', () => {
  const env = host(); env.element('save-png').click(); env.element('save-png').click();
  assert.equal(env.calls.filter(call => call[0] === 'toBlob').length, 1);
  env.element('scene-den-watch').click(); // An async encoding must keep its capture metadata.
  const blob = { pixels: 'actual current canvas' }; env.finishPng(blob);
  assert.equal(env.blobs[0], blob);
  assert.equal(env.links.length, 1);
  assert.equal(env.links[0].download, 'fox-dusk-hunt-seed-17.png');
  assert.equal(env.links[0].removed, true);
  assert.deepEqual(env.revoked, ['blob:actual-canvas']);
  assert.equal(env.element('save-png').disabled, false);
});

test('bfcache retains controls, genuine departure cleans up and suppresses late PNG downloads', () => {
  const env = host();
  env.window.emit('pagehide', { persisted: true });
  env.element('rest').click(); assert.deepEqual(env.calls.at(-1), ['cue', 'rest', 0]);
  env.element('save-png').click();
  env.window.emit('pagehide', { persisted: false });
  assert.equal(env.calls.filter(call => call[0] === 'dispose').length, 1);
  assert.equal(env.listeners(), 0);
  env.finishPng(); assert.equal(env.links.length, 0);
  env.element('pounce').click(); assert.equal(env.calls.at(-1)[0], 'dispose');
});

test('failed Canvas setup exposes a truthful static fallback and removes action listeners', () => {
  const env = host({ failMount: true });
  assert.equal(env.element('fox').hidden, true);
  assert.equal(env.element('text-frame').textContent, 'STATIC FOX');
  assert.equal(env.element('text-export').open, true);
  assert.equal(env.element('scene-cue').disabled, true);
  assert.equal(env.listeners(), 0);
  assert.match(env.element('action-status').textContent, /unavailable.*static fox specimen/);
});
