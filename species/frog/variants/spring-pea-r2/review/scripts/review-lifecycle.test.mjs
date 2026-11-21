/** Page event doubles check ownership only; they do not emulate browser layout. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

class Events {
  listeners = new Map();
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  dispatch(type, detail = {}) { for (const fn of [...this.listeners.get(type) ?? []]) fn({ type, target: this, ...detail }); }
  count() { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0); }
}
class Element extends Events {
  value = ''; textContent = ''; hidden = false; disabled = false; checked = false; dataset = {}; attributes = {};
  constructor(id) { super(); this.id = id; }
  setAttribute(name, value) { this.attributes[name] = value; }
  replaceChildren(...children) { this.children = children; this.value = children[0]?.value ?? ''; }
  getBoundingClientRect() { return this.rect ?? { width: 356, height: 300, top: 100, bottom: 400, left: 16, right: 372 }; }
  scrollIntoView() { this.rect = { width: 356, height: 300, top: 100, bottom: 400, left: 16, right: 372 }; }
  click() { this.dispatch('click'); }
}
async function page() {
  const ids = ['frog','status','pause','landing','renderer-label','phase','motion','pose','view','silhouette','fallback','leap','hunt','lure','leap-controls','hunt-controls','reset','snapshot','diagnostics','export-text','ascii','export-log'];
  const elements = Object.fromEntries(ids.map(id => [id, new Element(id)])); elements.view.value = 'front'; elements.lure.value = 'upper-right';
  const renderers = ['original','spring-pea-r2'].map(value => Object.assign(new Element(value), { value, checked: value === 'spring-pea-r2' }));
  const moments = ['leap','hunt'].map(value => Object.assign(new Element(value), { value, checked: value === 'leap' }));
  const controls = [...Object.values(elements), ...renderers, ...moments];
  const document = { hidden: false, body: { dataset: {} }, getElementById: id => elements[id], createElement: tag => new Element(tag),
    querySelectorAll(selector) { return selector.includes('name="renderer"') ? renderers : selector.includes('name="moment"') ? moments : controls; },
    querySelector(selector) { return renderers.find(input => selector.includes(`value="${input.value}"`)); },
  };
  const window = new Events(), media = new Events(), frames = new Map(), timers = new Map(), observers = new Set(); let sequence = 0;
  media.matches = false; Object.assign(window, { innerWidth: 390, innerHeight: 844, matchMedia: () => media,
    requestAnimationFrame(fn) { const id = ++sequence; frames.set(id, fn); return id; }, cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(fn) { const id = ++sequence; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
    IntersectionObserver: class { constructor(fn) { this.fn = fn; observers.add(this); } observe() {} disconnect() { observers.delete(this); } },
  });
  const mounted = []; let active = 0, maximumActive = 0;
  const factory = renderer => (canvas, options) => {
    assert.equal(active, 0, 'previous controller must be disposed before constructing a replacement');
    active++; maximumActive = Math.max(maximumActive, active);
    const status = { tick: 0, paused: options.paused, reducedMotion: false, offscreen: false, zeroSize: false, disposed: false };
    const pond = { selectedId: 0, tick: 0, firefly: null, actors: [{ id: 0, padId: 0, reservedPad: null, motive: { kind: 'rest' }, model: { behavior: { kind: 'idle' }, position: { x: -.5, y: .3 }, config: { maxDistance: 2 } } }], pads: [{ id: 0, label: 'Pad 1', point: { x: -.5, y: .3 } }, { id: 1, label: 'Pad 2', point: { x: .1, y: -.2 } }] };
    const controller = { getStatus: () => ({ ...status }), getPondState: () => pond,
      setPaused(value) { status.paused = value; options.onAction(value ? 'Paused.' : 'Playing.'); },
      reset() { status.tick = 0; options.onPondChange(pond); }, target() {}, leap() {}, hunt() {}, updatePreview() {}, exportText: () => '(o o)',
      setStaticPose() { status.paused = true; },
      dispose() { if (!status.disposed) { status.disposed = true; active--; } },
    };
    mounted.push({ renderer, controller, status, options }); options.onPondChange(pond); return controller;
  };
  const context = vm.createContext({ document, window, location: { search: '' }, URLSearchParams, URL, Blob, console });
  const module = new vm.SourceTextModule(await readFile(new URL('../review.mjs', import.meta.url), 'utf8'), { context });
  const bridge = new vm.SourceTextModule(await readFile(new URL('../visible-action.mjs', import.meta.url), 'utf8'), { context });
  const original = new vm.SyntheticModule(['createFrogArtwork'], function () { this.setExport('createFrogArtwork', factory('original')); }, { context });
  const variant = new vm.SyntheticModule(['createSpringPeaArtwork'], function () { this.setExport('createSpringPeaArtwork', factory('spring-pea-r2')); }, { context });
  await module.link(specifier => specifier.includes('lib/public/frog') ? original : specifier === '../index.mjs' ? variant : bridge); await module.evaluate();
  return { elements, renderers, window, media, mounted, frames, timers, observers, controls, get active() { return active; }, get maximumActive() { return maximumActive; } };
}

test('Original/R2 toggle has exactly one mounted controller and preserves explicit pause', async () => {
  const h = await page(); assert.equal(h.active, 1); assert.equal(h.mounted[0].renderer, 'spring-pea-r2');
  assert.equal(h.mounted[0].options.seed, 23); assert.equal(h.mounted[0].options.director.count, 1); assert.equal(h.mounted[0].options.director.autonomy, false);
  h.elements.pause.click(); assert.equal(h.mounted[0].status.paused, true);
  h.renderers[0].checked = true; h.renderers[0].dispatch('change');
  assert.equal(h.mounted[0].status.disposed, true); assert.equal(h.mounted[1].renderer, 'original'); assert.equal(h.mounted[1].status.paused, true);
  h.renderers[1].checked = true; h.renderers[1].dispatch('change');
  assert.equal(h.active, 1); assert.equal(h.maximumActive, 1); h.window.__frogR2Review.dispose(); assert.equal(h.active, 0);
});
test('real page exit disposes pending visibility work and UI listeners; BFcache preserves state', async () => {
  const h = await page(); h.window.dispatch('pagehide', { persisted: true }); assert.equal(h.active, 1);
  h.mounted[0].status.offscreen = true; h.elements.frog.rect = { width: 356, height: 300, top: -400, bottom: -100, left: 16, right: 372 };
  h.elements.leap.click(); assert.equal(h.observers.size, 1); assert.equal(h.timers.size, 1);
  h.window.dispatch('pagehide', { persisted: false }); h.window.__frogR2Review.dispose();
  assert.equal(h.active, 0); assert.equal(h.frames.size + h.timers.size + h.observers.size, 0);
  assert.equal(h.controls.reduce((sum, element) => sum + element.count(), 0) + h.window.count() + h.media.count(), 0);
});
