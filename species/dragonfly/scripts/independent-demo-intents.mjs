/** Independent demo review using the actual compiled demo in a DOM/controller mock.
 * Usage: node independent-demo-intents.mjs /absolute/path/to/ascii-animals
 * This replaces module imports with explicit instrumented dependencies; it is
 * not a browser, native Canvas or physical-device check.
 */
import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const repo = resolve(process.argv[2] || '.');
const originalSource = fs.readFileSync(join(repo, 'species/dragonfly/lib/demo.js'), 'utf8');
const source = originalSource.replace(/^import .*\n/gm, '');
class E {
  constructor(id = '') {
    this.id = id; this.value = ''; this.dataset = {};
    this.selectedOptions = [{ textContent: 'Left' }];
    this.classList = { toggle() {} }; this.listeners = new Map(); this.scrolls = 0;
  }
  addEventListener(k, f) {
    if (!this.listeners.has(k)) this.listeners.set(k, []);
    this.listeners.get(k).push(f);
  }
  removeEventListener(k, f) { this.listeners.set(k, (this.listeners.get(k) || []).filter(x => x !== f)); }
  emit(k) { for (const f of [...this.listeners.get(k) || []]) f({}); }
  setAttribute() {}
  querySelector() { return null; }
  scrollIntoView() { this.scrolls++; }
}
const e = new Map();
const get = id => e.get(id) || e.set(id, new E(id)).get(id);
const selection = new E('selection'); selection.dataset.select = '2';
const doc = new E(), win = new E();
doc.hidden = false; doc.getElementById = get;
doc.querySelectorAll = q => q === '[data-select]' ? [selection] : [];
let notify, offscreen = true, calls = [];
const opts = {
  route: 'banks', labels: true, tempo: 1, spread: 1, breeze: .12, scale: .4,
  roles: ['patroller', 'sentinel', 'skimmer', 'wanderer'],
};
const value = () => ({
  paused: false, motion: 'full', requestedMotion: 'full', reducedMotion: false,
  hidden: doc.hidden, offscreen, zeroSized: false, disposed: false,
  director: { arc: 'patrol', scene: 'patrol', selected: 2,
    members: [0, 1, 2].map(id => ({ id, label: 'Fly' + id, role: 'patroller', phase: { kind: 'hover' } })) },
});
const host = {
  getStatus: value, getDirectorOptions: () => opts, getState: () => ({}), exportText: () => '',
  selectIndividual(id) { calls.push(['selection', id]); notify(value()); },
  setTarget(x, y) { calls.push(['guide', x, y]); notify(value()); },
  cue(x) { calls.push(['cue', x]); notify(value()); },
  clearTarget() { calls.push(['clear']); },
  configureDirector(x) { calls.push(['configure', x]); notify(value()); },
  reset() { calls.push(['reset']); notify(value()); },
  dispose() { calls.push(['dispose']); },
};
vm.runInNewContext(source, {
  document: doc, window: win,
  mountDragonfly(c, o) { notify = o.onStatus; return host; }, console,
});
selection.emit('click'); get('guide').value = 'left'; get('guide').emit('change');
get('perch').emit('click'); get('dart').emit('click');
assert.deepEqual(calls, []);
offscreen = false; notify(value());
assert.deepEqual(calls, [['selection', 2], ['guide', -.8, 0], ['cue', 'dart']]);
notify(value()); assert.equal(calls.length, 3);

calls = []; offscreen = true; selection.emit('click'); get('perch').emit('click');
doc.hidden = true; doc.emit('visibilitychange'); doc.hidden = false;
offscreen = false; notify(value()); assert.deepEqual(calls, []);

offscreen = true; selection.emit('click'); get('perch').emit('click');
get('population').value = '1'; get('population').emit('change');
calls = []; offscreen = false; notify(value()); assert.deepEqual(calls, []);

offscreen = true; selection.emit('click'); get('perch').emit('click'); get('reset').emit('click');
calls = []; offscreen = false; notify(value()); assert.deepEqual(calls, []);

console.log(JSON.stringify({
  evidence: 'Actual compiled demo executed with instrumented DOM/controller mocks; not a browser',
  node: process.version,
  sourceSha256: { 'species/dragonfly/lib/demo.js': createHash('sha256').update(originalSource).digest('hex') },
  compiledDemoMock: 'passed',
  checks: ['offscreen deferral', 'latest cue wins', 'selection guide cue ordering',
    'reentrant status no repeats', 'hidden cancellation', 'population change cancellation', 'reset cancellation'],
  scrollRequests: get('dragonfly').scrolls,
}, null, 2));
