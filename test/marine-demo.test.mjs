'use strict';
// Deterministic wiring/lifecycle test of the ACTUAL demo script with a STUB
// renderer and a bounded DOM inventory. This does not test browser layout,
// browser input dispatch, real pixels, performance, or end-to-end rendering.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'dist/animals.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'dist/animals-demo.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const checks = [];

function fixture({ query = '', reduced = false } = {}) {
  const nodes = new Map(), all = new Set(), links = [], blobs = [], urls = new Set(), downloads = [], intervals = new Map(), instances = [];
  let sequence = 0;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.events = new Map(); this.attributes = {}; this.dataset = {};
      this.children = []; this.hidden = this.disabled = this.checked = false; this.value = ''; this.textContent = '';
      this.style = { setProperty(key, value) { this[key] = value; } }; this.classes = new Set();
      this.classList = { toggle: (key, enabled) => enabled ? this.classes.add(key) : this.classes.delete(key),
        add: key => this.classes.add(key), remove: key => this.classes.delete(key) };
      all.add(this);
    }
    set id(value) { this._id = value; if (value) nodes.set(value, this); }
    get id() { return this._id; }
    addEventListener(type, handler, options) {
      if (!this.events.has(type)) this.events.set(type, new Map()); this.events.get(type).set(handler, Boolean(options?.once));
    }
    removeEventListener(type, handler) { this.events.get(type)?.delete(handler); }
    emit(type, event = {}) {
      for (const [handler, once] of [...(this.events.get(type) || [])]) {
        if (once) this.events.get(type).delete(handler); handler({ target: this, ...event });
      }
    }
    setAttribute(key, value) { this.attributes[key] = value; }
    appendChild(child) { child.parent = this; this.children.push(child); return child; }
    replaceChildren(...children) { for (const child of this.children) child.remove(); this.children = []; children.forEach(child => this.appendChild(child)); }
    remove() { for (const child of [...this.children]) child.remove(); if (this.id && nodes.get(this.id) === this) nodes.delete(this.id); if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
    click() { if (this.tagName === 'A') downloads.push({ filename: this.download, href: this.href }); else this.emit('click'); }
    get listenerCount() { return [...this.events.values()].reduce((total, listeners) => total + listeners.size, 0); }
  }
  for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/g)) {
    const element = new Element(match[1]), attributes = {};
    for (const item of match[2].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attributes[item[1]] = item[2] ?? item[3];
    element.attributes = attributes;
    if (attributes.id) { assert(!nodes.has(attributes.id), 'Duplicate HTML id: ' + attributes.id); element.id = attributes.id; }
    for (const key of ['min', 'max', 'value']) if (key in attributes) element[key] = attributes[key];
    for (const [key, value] of Object.entries(attributes)) if (key.startsWith('data-')) element.dataset[key.slice(5)] = value;
    if (match[1] === 'script' && attributes.src) links.push(attributes.src);
    if (match[1] === 'link' && attributes.rel === 'stylesheet') links.push(attributes.href);
  }
  assert.deepEqual(links, ['animals-demo.css', 'artwork.js', 'animals-demo.js']);
  for (const asset of links) assert(fs.statSync(path.join(root, 'dist', asset)).isFile(), 'Missing local asset: ' + asset);
  const document = new Element('document'), window = new Element('window'), motion = new Element('media-query');
  document.body = new Element('body'); document.hidden = false;
  document.getElementById = id => nodes.get(id) || null;
  document.createElement = tag => new Element(tag);
  document.querySelectorAll = selector => {
    assert(/^\[data-[a-z]+\]$/.test(selector), 'New fixture selector must be modeled: ' + selector);
    const key = selector.slice(6, -1); return [...all].filter(element => Object.hasOwn(element.dataset, key));
  };
  motion.matches = reduced; window.matchMedia = () => motion; window.location = { search: query };
  class StubArtwork {
    constructor(canvas, options) {
      assert.equal(canvas, nodes.get('animal-canvas')); this.options = plain(options);
      this.paused = options.paused === undefined ? reduced : Boolean(options.paused);
      this.dead = false; this.config = null; this.cues = []; this.stills = []; this.restarts = 0; this.pulses = 0;
      this.chapter = 'engage'; this.time = 10; this.cue = { x: 0, y: 0, active: false, interest: 0 }; instances.push(this);
    }
    alive() { assert(!this.dead, 'No call may reach a destroyed engine.'); }
    setOptions(value) { this.alive(); Object.assign(this.options, plain(value)); if (value.paused !== undefined) this.paused = Boolean(value.paused); }
    setDirector(config) { this.alive(); this.config = config === null ? null : { ...this.config, ...plain(config) }; }
    getDirector() {
      this.alive(); return this.config ? { enabled: true, config: this.config, scene: this.config.scene, title: this.config.scene,
        chapter: this.chapter, chapterLabel: 'Test meeting', progress: this.time / this.config.duration, time: this.time,
        cycle: 0, focused: this.config.focus, cue: this.cue,
        members: this.options.speciesByAnimal.map((species, i) => ({ id: i + 1, species, role: this.config.roles[i] === 'auto' ? 'companion' : this.config.roles[i], motive: 'Test motive ' + i, visible: true, phase: 'Calm' })) }
        : { enabled: false, config: null, members: [], time: this.time, focused: 1 };
    }
    getStats() { this.alive(); return { paused: this.paused, count: this.options.count, visibleCount: this.options.count, glyphs: 321, fps: 57, fish: this.options.speciesByAnimal.map(() => ({ phase: 'Calm', reactionStage: 'idle' })) }; }
    setPaused(value) { this.alive(); this.paused = value; }
    cueDirector(cue) {
      this.alive(); this.cues.push(plain(cue)); if (cue.type === 'invite') this.cue = { ...plain(cue), active: true, interest: 1 };
      if (cue.type === 'release') this.cue.active = false;
      return cue.type !== 'disturb' || !this.paused;
    }
    showDirectorStill(chapter) { this.alive(); this.stills.push(chapter); this.chapter = chapter; this.paused = true; }
    restart() { this.alive(); this.restarts++; this.time = 0; }
    pulse() { this.alive(); this.pulses++; }
    destroy() { this.alive(); this.dead = true; }
  }
  window.CuttlefishArtwork = StubArtwork;
  nodes.get('animal-canvas').toBlob = (callback, mime) => { assert.equal(mime, 'image/png'); blobs.push(callback); };
  const scope = { document, window, console, Blob, URLSearchParams,
    URL: { createObjectURL(blob) { const url = 'fixture:' + ++sequence; urls.add(url); downloads.lastBlob = blob; return url; },
      revokeObjectURL(url) { assert(urls.has(url), 'Revoke only an existing object URL.'); urls.delete(url); } },
    setInterval(callback, delay) { assert.equal(delay, 250); const id = ++sequence; intervals.set(id, callback); return id; },
    clearInterval(id) { intervals.delete(id); }
  };
  vm.runInNewContext(source, scope, { filename: 'animals-demo.js' });
  assert.equal(instances.length, 1); assert(!instances[0].dead, nodes.get('action-status').textContent);
  assert.equal(intervals.size, 1);
  const $ = id => { assert(nodes.has(id), 'Expected UI element ' + id); return nodes.get(id); };
  const input = (id, value, event = 'input') => { $(id).value = String(value); $(id).emit(event); };
  const choice = (key, value) => [...all].find(element => element.dataset[key] === value);
  const key = (key, target = $('animal-canvas'), code = key) => {
    let prevented = 0; $('animal-canvas').emit('keydown', { key, code, target, preventDefault() { prevented++; } }); return prevented;
  };
  const member = (field, index, value) => { const element = $(field + '-' + index); element.value = value; $('cast-rows').emit('change', { target: element }); };
  return { $, input, choice, key, member, window, document, motion, intervals, instances, urls, downloads, blobs,
    get engine() { return instances.at(-1); }, tick() { [...intervals.values()].forEach(callback => callback()); },
    listeners() { return [...all].reduce((total, element) => total + element.listenerCount, 0); } };
}

test('marine director controls preserve cast, classic options, pauses, accessible input scope and lifecycle (stub renderer, not browser)', async () => {
  const f = fixture();
  assert.deepEqual(f.engine.options.speciesByAnimal, ['manta', 'octopus', 'cuttlefish']);
  assert.equal(f.engine.config.scene, 'reef-rendezvous'); assert.equal(f.engine.options.reducedMotion, 'system');
  assert.equal(f.engine.options.count, 3); checks.push('default mixed-three configuration');
  f.choice('scene', 'upwelling-ballet').click();
  assert.deepEqual(f.engine.options.speciesByAnimal, ['manta', 'manta', 'manta', 'cuttlefish', 'octopus']);
  assert.equal(f.engine.config.duration, 44); assert.equal(f.engine.config.current, .65);
  f.choice('scene', 'tidepool-investigation').click(); assert.deepEqual(f.engine.options.speciesByAnimal, ['octopus', 'cuttlefish', 'octopus']);
  assert.equal(f.engine.config.intimacy, 1.25); checks.push('three distinct authored preset casts and scores');
  f.member('role', 0, 'guide'); f.member('species', 1, 'manta'); f.input('density', 1.35); f.choice('palette', 'ember').click();
  assert.equal(f.engine.config.roles[0], 'guide'); assert.equal(f.engine.options.speciesByAnimal[1], 'manta'); assert.equal(f.engine.options.palette, 'ember');
  f.input('count', 6); assert.equal(f.engine.options.count, 6); assert.equal(f.engine.config.roles[0], 'guide');
  f.input('count', 9); assert.equal(f.engine.options.count, 6); f.input('count', 1); assert.equal(f.engine.config.focus, 1);
  checks.push('per-member motive and species persist through drawing changes; authored count bounded to eight');
  f.choice('scene', 'reef-rendezvous').click();
  // Model a canvas tap just before another UI action, without a 250ms tick.
  f.engine.config.focus = 3; f.input('current', .7); assert.equal(f.engine.config.focus, 3);
  f.engine.config.focus = 2; f.key('Enter'); assert.deepEqual(f.engine.cues.at(-1), { type: 'disturb', id: 2 });
  f.engine.config.focus = 3; f.$('react').click(); assert.deepEqual(f.engine.cues.at(-1), { type: 'disturb', id: 3 });
  // Reading the live focus must not overwrite the pending native select value.
  f.input('focus', 1, 'change'); assert.equal(f.engine.config.focus, 1);
  f.engine.config.focus = 3; f.engine.cue = { active: true, x: -.2, y: .3, interest: 1 };
  f.key('ArrowRight'); assert(Math.abs(f.engine.cues.at(-1).x - -.14) < 1e-9); assert.equal(f.engine.cues.at(-1).y, .3);
  assert.equal(f.$('focus').value, '3');
  f.engine.cue = { active: true, x: .28, y: -.21, interest: 1 }; f.$('invite').click();
  assert.deepEqual(f.engine.cues.at(-1), { type: 'invite', x: .28, y: -.21 });
  f.key('2'); f.key('Enter'); assert.deepEqual(f.engine.cues.at(-1), { type: 'disturb', id: 2 });
  assert.equal(f.key(' ', f.$('focus'), 'Space'), 0); assert(!f.engine.paused);
  assert.equal(f.key(' ', f.$('animal-canvas'), 'Space'), 1); assert(f.engine.paused);
  const cueCount = f.engine.cues.length; f.$('react').click(); assert.equal(f.engine.cues.length, cueCount);
  f.key('Home'); assert.deepEqual(f.engine.cues.at(-1), { type: 'invite', x: 0, y: 0 }); f.key('R'); assert.equal(f.engine.cues.at(-1).type, 'release');
  checks.push('live focus and beacon survive actions before telemetry; native focus changes retained; stage-only keyboard; paused startle guarded');
  for (const chapter of ['arrive', 'engage', 'explore', 'depart']) {
    f.choice('still', chapter).click(); assert(f.engine.paused); assert.equal(f.engine.stills.at(-1), chapter); assert.equal(f.choice('still', chapter).attributes['aria-pressed'], 'true');
  }
  f.input('autonomy', .5); f.choice('scene', 'upwelling-ballet').click(); assert(f.engine.paused);
  f.$('replay').click(); assert(f.engine.paused); f.$('reset').click(); assert(f.engine.paused);
  checks.push('four deliberate stills; pause preserved through settings, scene change, replay, reset');
  f.$('classic-mode').click(); assert.equal(f.engine.config, null); assert.equal(f.$('director-controls').hidden, true); assert.equal(f.$('classic-controls').hidden, false);
  for (const formation of ['independent', 'horizontal', 'vertical', 'diagonal', 'random']) { f.input('formation', formation, 'change'); assert.equal(f.engine.options.formation, formation); }
  for (const role of ['auto', 'cruise', 'hover', 'orbit', 'curious', 'encounter']) { f.member('role', 0, role); assert.equal(f.engine.options.behaviors[0], role); }
  f.input('count', 12); assert.equal(f.engine.options.count, 12); f.input('count', 13); assert.equal(f.engine.options.count, 12);
  for (const scene of ['swimby', 'encounter', 'reactive']) { f.input('legacy-scene', scene, 'change'); assert.equal(f.engine.options.scene, scene); }
  f.input('spacing', 1.4); f.$('reverse').checked = true; f.$('reverse').emit('change'); assert.equal(f.engine.options.spacing, 1.4); assert.equal(f.engine.options.reverse, true);
  f.input('render-mode', 'points', 'change'); assert.equal(f.engine.options.mode, 'points');
  f.$('play-pause').click(); f.$('react').click(); assert.equal(f.engine.pulses, 1); assert.equal(f.$('react').textContent, 'Invite a response');
  f.$('reset').click(); assert.equal(f.engine.config, null); assert.equal(f.engine.options.count, 12); assert(!f.engine.paused);
  checks.push('classic three scenes, five formation paths, six roles, twelve-member bound, spacing/reverse/particles and classic-preserving reset');
  f.$('save-score').click(); const exported = JSON.parse(await f.downloads.lastBlob.text());
  assert.equal(exported.director, null); assert.equal(exported.artwork.count, 12); assert.equal(exported.schema, 'ascii-animals/marine-director-score/v1');
  f.choice('scene', 'reef-rendezvous').click(); f.$('save-score').click(); const authored = JSON.parse(await f.downloads.lastBlob.text()); assert.equal(authored.director.scene, 'reef-rendezvous');
  f.$('save-png').click(); f.blobs.at(-1)(new Blob(['fixture canvas'])); assert(f.downloads.at(-1).filename.endsWith('.png')); assert.equal(f.urls.size, 1);
  const oldCallback = [...f.intervals.values()][0]; f.$('save-png').click(); const stalePNG = f.blobs.at(-1);
  f.$('play-pause').click(); assert(f.engine.paused); const beforeListeners = f.listeners(); f.window.emit('pagehide', { persisted: true });
  assert(f.engine.dead); assert.equal(f.intervals.size, 0); assert.equal(f.urls.size, 0); assert.equal(f.listeners(), 1);
  oldCallback(); f.window.emit('pageshow', { persisted: true }); assert.equal(f.instances.length, 2); assert(f.engine.paused); assert.equal(f.intervals.size, 1); assert.equal(f.listeners(), beforeListeners);
  stalePNG(new Blob(['stale'])); assert.equal(f.urls.size, 0); oldCallback();
  f.window.emit('pagehide', { persisted: false }); assert(f.engine.dead); assert.equal(f.intervals.size, 0); assert.equal(f.listeners(), 0);
  checks.push('canvas PNG callback wiring; reusable score JSON; bounded object URLs; pagehide cleanup; single bfcache restore; stale callbacks harmless');
  const reduced = fixture({ reduced: true }); assert(reduced.engine.paused); assert.deepEqual(reduced.engine.stills, ['engage']);
  assert.equal(reduced.$('motion-note').hidden, false); reduced.$('play-pause').click(); assert(!reduced.engine.paused); assert(reduced.$('motion-note').textContent.includes('by your choice'));
  reduced.window.emit('pagehide'); checks.push('simulated reduced-motion initialization uses composed still and only explicit Play starts');
  for (const species of ['manta', 'octopus', 'cuttlefish']) {
    const solo = fixture({ query: '?species=' + species }); assert.deepEqual(solo.engine.options.speciesByAnimal, [species]); assert.equal(solo.engine.options.count, 1); solo.window.emit('pagehide');
  }
  for (const query of ['?species=unknown', '?species=__proto__', '?species=constructor', '?species=%3Cscript%3E']) {
    const safe = fixture({ query }); assert.equal(safe.engine.options.count, 3); safe.window.emit('pagehide');
  }
  checks.push('whitelisted species query preserves all three solo entry points; arbitrary query values fall back safely');
  const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
  console.log(JSON.stringify({ fixture: 'Marine director UI wiring and lifecycle using stub renderer', passed: true,
    source: { 'dist/animals.html': sha256(html), 'dist/animals-demo.js': sha256(source) }, checks,
    browserTested: false, rendererEndToEndTested: false, visualTested: false, performanceMeasured: false }, null, 2));
});
