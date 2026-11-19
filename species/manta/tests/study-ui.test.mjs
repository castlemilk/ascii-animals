// Actual study module and adapter with mocked DOM/default button activation.
// This verifies wiring and cleanup, not browser keyboard or accessibility behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { reefTestHost } from './reef-test-host.mjs';

class Element {
  constructor(tag, attributes, text, document) {
    this.tagName = tag.toUpperCase(); this.attributes = attributes; this.textContent = text;
    this.ownerDocument = document; this.listeners = new Map();
    this.dataset = Object.fromEntries([...attributes].filter(([name]) => name.startsWith('data-'))
      .map(([name, value]) => [name.slice(5), value]));
    this.disabled = attributes.has('disabled'); this.hidden = attributes.has('hidden');
    this.checked = attributes.has('checked'); this.value = attributes.get('value') ?? '';
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  emit(type, event = {}) { for (const listener of [...(this.listeners.get(type) || [])]) listener(event); }
  focus() { this.ownerDocument.activeElement = this; }
  get listenerCount() { return [...this.listeners.values()].reduce((sum, list) => sum + list.size, 0); }
}

async function studyDOM(htmlURL = new URL('../index.html', import.meta.url)) {
  const host = reefTestHost(), document = host.document, canvas = host.canvas(390, 500);
  const html = await readFile(htmlURL, 'utf8');
  const elements = [], ids = new Map();
  // Read the shipped control elements as fixture data. This bounded parser is
  // intentionally not an HTML renderer, CSS engine or accessibility-tree test.
  for (const match of html.matchAll(/<(canvas|button|select|input|p|span|strong|output)\b([^>]*)>/g)) {
    const [opening, tag, attributeText] = match;
    const attributes = new Map();
    for (const attribute of attributeText.matchAll(/([^\s=]+)(?:\s*=\s*"([^"]*)")?/g)) {
      attributes.set(attribute[1], attribute[2] ?? '');
    }
    const end = html.indexOf(`</${tag}>`, match.index + opening.length);
    const inner = tag === 'input' || end < 0 ? '' : html.slice(match.index + opening.length, end);
    const text = inner.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const element = tag === 'canvas' ? canvas : new Element(tag, attributes, text, document);
    if (tag === 'canvas') {
      canvas.focus = () => { document.activeElement = canvas; };
      canvas.tagName = 'CANVAS';
    }
    elements.push(element);
    if (attributes.has('id')) ids.set(attributes.get('id'), element);
  }
  document.getElementById = id => ids.get(id) ?? null;
  document.querySelectorAll = selector => {
    if (selector === '[data-action]') return elements.filter(element => element.dataset?.action);
    if (selector === '[data-mode]') return elements.filter(element => element.dataset?.mode);
    if (selector === 'button, input') return elements.filter(element => ['BUTTON', 'INPUT'].includes(element.tagName));
    if (selector === '[data-still]') return elements.filter(element => element.dataset?.still);
    if (selector === 'button,select,input') return elements.filter(element => ['BUTTON', 'SELECT', 'INPUT'].includes(element.tagName));
    throw new Error(`Unsupported mock selector: ${selector}`);
  };
  const drawnGlyphs = [], context = canvas.getContext('2d');
  context.fillRect = (x, y, width, height) => {
    if (x === 0 && y === 0 && width === canvas.rect.width && height === canvas.rect.height) drawnGlyphs.length = 0;
  };
  context.drawImage = (_source, ...coordinates) => { drawnGlyphs.push(coordinates); };
  const raster = () => createHash('sha256').update(JSON.stringify(drawnGlyphs)).digest('hex');
  return { host, canvas, ids, elements, raster, get glyphs() { return drawnGlyphs.length; } };
}

function key(target, value, { repeat = false } = {}) {
  target.focus();
  const event = { key: value, repeat, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; } };
  target.emit('keydown', event);
  return event;
}

function activateButton(button) {
  assert.equal(button.tagName, 'BUTTON');
  assert.equal(button.disabled, false);
  const event = key(button, 'Enter');
  // Simulate the browser's default semantic button activation. The real click
  // handler comes from study.mjs; the test does not implement its action.
  if (!event.defaultPrevented) button.emit('click', { detail: 0 });
}

test('mocked DOM: actual study keyboard actions affect the renderer and pagehide releases resources', async () => {
  const dom = await studyDOM(), { host, canvas, ids, elements } = dom;
  const previous = new Map(['window', 'document', 'setInterval', 'clearInterval']
    .map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const timers = new Map(); let timerId = 0;
  const install = (name, value) => Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  install('window', host.view); install('document', host.document);
  install('setInterval', (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; });
  install('clearInterval', id => timers.delete(id));
  try {
    await import('../study.mjs?mocked-dom-integration');
    assert.equal(ids.get('error').hidden, true, ids.get('error').textContent);
    assert.equal(timers.size, 1); assert.equal([...timers.values()][0].delay, 300);
    assert.equal(host.pending, 1); assert(dom.glyphs > 20, 'actual adapter must draw visible glyphs');
    const play = ids.get('play'), bankStill = elements.find(element => element.dataset?.still === 'bank');
    const glideStill = elements.find(element => element.dataset?.still === 'glide');
    const statusTimer = [...timers.values()][0].callback;
    host.frame(); host.frame(80);

    activateButton(play);
    assert.equal(play.textContent, 'Play'); assert.equal(host.pending, 0);
    assert.equal(ids.get('motion-state').textContent, 'Paused');
    const paused = dom.raster(); host.frame(5000); statusTimer();
    assert.equal(dom.raster(), paused, 'semantic Pause must stop actual rendering progression');

    activateButton(glideStill);
    assert.equal(play.textContent, 'Resume live');
    assert.equal(play.getAttribute('aria-label'), 'Resume the saved live manta route');
    assert.equal(ids.get('motion-state').textContent, 'Still study');
    assert.equal(glideStill.getAttribute('aria-pressed'), 'true');
    assert(ids.get('interaction-help').textContent.includes('saved route'));
    const glide = dom.raster();
    assert.equal(key(canvas, 'ArrowRight').defaultPrevented, true);
    assert.equal(bankStill.getAttribute('aria-pressed'), 'true');
    assert.notEqual(dom.raster(), glide, 'focused ArrowRight must change actual glyph draw calls');
    assert.equal(host.pending, 0, 'a keyboard bank must not defeat pause');
    const right = dom.raster();
    key(canvas, 'ArrowLeft', { repeat: true });
    assert.equal(dom.raster(), right, 'held-key repeats must not flip the composed pose');
    assert.equal(key(canvas, 'ArrowLeft').defaultPrevented, true);
    assert.notEqual(dom.raster(), right, 'left and right should be real different poses');

    activateButton(play);
    assert.equal(play.textContent, 'Pause'); assert.equal(host.pending, 1);
    assert.equal(ids.get('motion-state').textContent, 'Live study');
    assert.equal(bankStill.getAttribute('aria-pressed'), 'false');
    host.frame(); host.frame(80);
    assert.equal(key(canvas, ' ').defaultPrevented, true);
    assert.equal(host.pending, 0); assert.equal(play.textContent, 'Play');
    assert.equal(key(canvas, 'Enter').defaultPrevented, true); assert.equal(host.pending, 1);
    key(canvas, 'Escape'); assert.equal(host.pending, 0);

    activateButton(play); host.frame(); host.frame(80);
    key(canvas, 'ArrowRight');
    assert.equal(ids.get('left-bank').disabled, true); assert.equal(ids.get('right-bank').disabled, true);
    const beforeBank = dom.raster();
    for (let index = 0; index < 12; index++) host.frame(50);
    assert.notEqual(dom.raster(), beforeBank, 'live keyboard bank must advance rendered geometry');
    host.view.emit('pagehide', { persisted: true });
    assert.equal(host.pending, 0); assert.equal(timers.size, 1);
    host.view.emit('pageshow', { persisted: true });
    assert.equal(host.pending, 0, 'returning from the page cache must not silently resume');

    host.view.emit('pagehide', { persisted: false });
    assert.equal(timers.size, 0, 'status timer must be removed');
    assert.equal(host.pending + host.resizes.size + host.intersections.size, 0);
    assert.equal(host.document.listenerCount + host.view.listenerCount + host.motion.listenerCount
      + elements.reduce((sum, element) => sum + element.listenerCount, 0), 0);
    const finalRaster = dom.raster(), finalLabel = play.textContent;
    host.frame(10000); statusTimer(); key(canvas, 'Enter');
    assert.equal(dom.raster(), finalRaster); assert.equal(play.textContent, finalLabel);
    host.view.emit('pagehide', { persisted: false });
  } finally {
    host.view.emit('pagehide', { persisted: false });
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});


test('actual generated classic manta bundle parses, boots visible glyphs and disposes', async () => {
  const html = await readFile(new URL('../../../dist/manta-reef.html', import.meta.url), 'utf8');
  const code = html.match(/<script data-manta-bundle>([\s\S]*?)<\/script>/)?.[1];
  assert(code, 'published classic entry exists');
  const script = new Script(code, { filename: 'published-manta-reef.js' });
  const dom = await studyDOM(), timers = new Map(); let next=0;
  try {
    script.runInNewContext({ window: dom.host.view, document: dom.host.document,
      setInterval(callback) { timers.set(++next,callback); return next; }, clearInterval(id) { timers.delete(id); },
      console });
    assert.equal(dom.ids.get('error').hidden,true,dom.ids.get('error').textContent);
    assert(dom.glyphs > 20, 'generated bundle must draw actual glyphs, not only parse');
    assert.equal(timers.size,1);
    activateButton(dom.ids.get('play'));
    assert.equal(dom.ids.get('play').textContent,'Play');
    dom.host.view.emit('pagehide',{persisted:false});
    assert.equal(timers.size,0); assert.equal(dom.host.pending,0);
  } finally { dom.host.view.emit('pagehide',{persisted:false}); }
});

test('actual generated cuttlefish data-module graph imports and draws a nonblank study', async () => {
  const html = await readFile(new URL('../../../dist/cuttlefish-study.html', import.meta.url), 'utf8');
  const entry = html.match(/<script type="module" src="(data:text\/javascript;base64,[^"]+)"/)[1];
  const dom = await studyDOM(new URL('../../../examples/cuttlefish-study/index.html',import.meta.url));
  const previous = new Map(['window','document','location','setInterval','clearInterval'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const timers = new Map(); let next=0, module;
  const install = (name,value)=>Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
  install('window',dom.host.view); install('document',dom.host.document); install('location',{search:'?manual'});
  install('setInterval',callback=>{timers.set(++next,callback);return next;}); install('clearInterval',id=>timers.delete(id));
  try {
    try { module=await import(entry); } catch(error) { throw new Error(`Generated cuttlefish graph failed: ${error.message}`); }
    assert(dom.glyphs>20,'published data-module graph must draw actual glyphs');
    assert(!dom.ids.get('phase').textContent.includes('Unavailable'));
    dom.ids.get('pause').emit('click');
    assert.equal(module.study.paused,true);
    module.dispose(); assert.equal(timers.size,0); assert.equal(dom.host.pending,0);
  } finally {
    module?.dispose();
    for(const [name,descriptor] of previous) { if(descriptor) Object.defineProperty(globalThis,name,descriptor); else delete globalThis[name]; }
  }
});
