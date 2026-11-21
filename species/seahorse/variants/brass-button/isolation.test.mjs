/** Private integration checks. The fake DOM establishes ownership, not browser rendering. */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { getEventListeners } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as Original from '../../../../lib/public/seahorse.js';
import { getBrowserScheduler } from '../../../../lib/core/scheduler.js';
import { fakeBrowser } from '../../../../test/helpers/fake-browser.mjs';
import { buildBrassButton } from './build.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
// Capture this checkout before the private operation. Legitimate changes to
// Original, other species or packaging are not pinned to a historical commit.
const protectedPaths = [
  'src/public/seahorse.ts', 'lib/public/seahorse.js', 'lib/public/seahorse.d.ts',
  'src/index.js', 'lib/index.js', 'package.json',
  'src/core/scheduler.js', 'lib/core/scheduler.js',
  'demo/src/lib/renderers.ts', 'species/seahorse/demo/demo.js',
  'dist/seahorse/runtime/public/seahorse.js',
];
async function protectedHashes() {
  return Object.fromEntries(await Promise.all(protectedPaths.map(async relative => [relative,
    createHash('sha256').update(await readFile(path.join(root, relative))).digest('hex')])));
}
const beforePrivateBuild = await protectedHashes();
async function assertOriginalFilesUnchanged() {
  assert.deepEqual(await protectedHashes(), beforePrivateBuild,
    'private build/import/use must not rewrite Original or its existing entry points');
}
const output = await mkdtemp(path.join(tmpdir(), 'seahorse-brass-button-isolation-'));
after(async () => {
  try { await assertOriginalFilesUnchanged(); }
  finally { await rm(output, { recursive: true, force: true }); }
});
let built;
try { built = await buildBrassButton(output); }
catch (error) { await rm(output, { recursive: true, force: true }); throw error; }
const runtimeURL = pathToFileURL(built.runtime).href;
const adapterURL = pathToFileURL(built.adapter).href;

function hostHarness(options = {}) {
  const browser = fakeBrowser(options), elements = [], removals = [];
  const host = {
    ownerDocument: browser.document, children: [],
    appendChild(element) {
      assert.equal(element.parentNode, null, 'a mount owns a new child');
      element.parentNode = this; this.children.push(element); return element;
    },
  };
  browser.document.createElement = name => {
    assert.equal(name.toLowerCase(), 'canvas');
    const element = browser.canvas(390, 530), attributes = new Map();
    Object.assign(element, {
      tagName: 'CANVAS', parentNode: null, dataset: {}, style: {}, className: '', tabIndex: -1,
      setAttribute(name, value) { attributes.set(name, String(value)); },
      getAttribute(name) { return attributes.get(name) ?? null; },
      focus() { browser.document.activeElement = element; },
      remove() {
        removals.push({ listeners: element.listenerCount, scheduler: getBrowserScheduler(browser.view).size,
          resizes: browser.resizes.size, intersections: browser.intersections.size });
        if (!element.parentNode) return;
        const parent = element.parentNode;
        parent.children.splice(parent.children.indexOf(element), 1); element.parentNode = null;
      },
    });
    elements.push(element); return element;
  };
  const resources = () => ({
    children: host.children.length,
    canvasListeners: elements.reduce((n, element) => n + element.listenerCount, 0),
    documentListeners: browser.document.listenerCount, windowListeners: browser.view.listenerCount,
    mediaListeners: browser.motion.listenerCount, resizes: browser.resizes.size,
    intersections: browser.intersections.size, subscribers: getBrowserScheduler(browser.view).size,
    raf: browser.pending,
  });
  return { ...browser, host, elements, removals, resources, browser,
    get pending() { return browser.pending; }, get now() { return browser.now; } };
}

const noResources = Object.freeze({ children: 0, canvasListeners: 0, documentListeners: 0,
  windowListeners: 0, mediaListeners: 0, resizes: 0, intersections: 0, subscribers: 0, raf: 0 });
function assertClean(harness) { assert.deepEqual(harness.resources(), noResources); }
function mountOriginal(harness) {
  const element = harness.document.createElement('canvas');
  harness.host.appendChild(element);
  const controller = Original.createSeahorseArtwork(element, { paused: false, seed: 19 });
  harness.intersect(element, true);
  return { controller, element, dispose() { controller.dispose(); element.remove(); } };
}
function tick(harness, count = 4) { for (let i = 0; i < count; i++) harness.frame(); }
function originalReplay() {
  const snapshots = [];
  for (const scene of ['study', 'kelp-garden', 'tidal-duet', 'drift-passage']) for (const facing of ['left', 'right']) {
    const model = Original.createSeahorseModel({ scene, facing, seed: 19, count: scene === 'study' ? 1 : 3,
      columns: 100, rows: 60, choreography: 'hold' });
    const capture = () => snapshots.push({ frame: model.frame(), state: model.getState(), director: model.getDirectorState() });
    capture(); model.guide(.72, -.48); model.greet(); model.advanceTicks(31); capture();
    model.direct({ type: 'startle' }, true); model.advanceTicks(77); capture();
    model.direct({ type: 'release' }, true); model.advanceTicks(90); capture();
    model.configure({ current: -.6 }); capture(); model.reset(); capture();
  }
  return snapshots;
}

test('private build preserves the starting Original bytes and existing entry points', async () => {
  await assertOriginalFilesUnchanged();
});

test('root and Seahorse package exports still resolve Original and expose no private variant', async () => {
  const [publicRoot, publicSeahorse] = await Promise.all([import('ascii-animals-review'), import('ascii-animals-review/seahorse')]);
  const names = ['SEAHORSE_DEFAULTS', 'createSeahorseArtwork', 'createSeahorseModel', 'normalizeSeahorseOptions'];
  for (const name of names) {
    assert.equal(publicSeahorse[name], Original[name], name);
    assert.equal(publicRoot[name], Original[name], `root ${name}`);
  }
  const brassButton = /brass[-_]?button/i;
  for (const exports of [publicRoot, publicSeahorse])
    assert(!Object.keys(exports).some(name => brassButton.test(name)), 'Brass Button has no public factory/default export');
  const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  assert.deepEqual(metadata.exports['./seahorse'], {
    types: './lib/public/seahorse.d.ts', import: './lib/public/seahorse.js', default: './lib/public/seahorse.js',
  });
  assert(!brassButton.test(JSON.stringify(metadata.exports)), 'Brass Button has no package export mapping');
  const [packed] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  assert(packed.files.length > 0, 'packing inspection found actual package files');
  assert(!packed.files.some(file => brassButton.test(file.path)), 'Brass Button remains outside package contents');
  await assert.rejects(import('ascii-animals-review/seahorse/brass-button'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
  assert.throws(() => Original.normalizeSeahorseOptions({ variant: 'brass-button' }),
    'the private character cannot be selected through Original options');
});

test('loading and exercising the private runtime leaves all Original replay frames and state unchanged', async () => {
  const before = originalReplay();
  const { createBrassButtonModel } = await import(runtimeURL);
  for (const facing of ['left', 'right']) for (const current of [-1, 1]) {
    const variant = createBrassButtonModel({ seed: 19, facing, current, choreography: 'hold' });
    variant.guide(current * .8, -.5); variant.direct({ type: 'release' }); variant.advanceTicks(200); variant.frame();
    variant.advanceTicks(40); variant.direct({ type: 'startle' }); variant.advanceTicks(80); variant.frame(); variant.reset();
  }
  assert.deepEqual(originalReplay(), before);
  await assertOriginalFilesUnchanged();
});

test('adapter import is inert; explicit mount owns one accessible child and keeps playback intent separate from motion policy', async () => {
  const h = hostHarness(), before = h.resources();
  const { mountBrassButton } = await import(adapterURL);
  assert.deepEqual(h.resources(), before); assert.equal(h.elements.length, 0);
  const session = await mountBrassButton(h.host, { paused: true, reducedMotion: false,
    label: 'Brass Button seahorse', descriptionId: 'private-help', configuration: { seed: 19 } });
  try {
    assert.equal(session.species, 'seahorse'); assert.equal(session.variation, 'brass-button');
    assert.equal(session.element.dataset.rendererVariation, 'brass-button');
    assert.equal(session.element.className, 'renderer-canvas');
    assert.equal(session.canvas, session.element); assert.equal(session.controller.canvas, session.element);
    assert.equal(session.element.parentNode, h.host); assert.equal(h.host.children.length, 1);
    assert.equal(session.element.tabIndex, 0); assert.equal(session.element.getAttribute('role'), 'img');
    assert.equal(session.element.getAttribute('aria-label'), 'Brass Button seahorse');
    assert.equal(session.element.getAttribute('aria-describedby'), 'private-help');
    assert.equal(session.disposed, false);
    h.intersect(session.element, true);
    assert.equal(getBrowserScheduler(h.view).size, 0);
    session.play(); assert.equal(getBrowserScheduler(h.view).size, 1); tick(h);
    assert(session.controller.getStatus().tick > 0);
    session.setReducedMotion(true); session.play(); session.restart();
    assert.equal(getBrowserScheduler(h.view).size, 0); assert.equal(h.pending, 0);
    const stopped = session.controller.getStatus().tick; tick(h, 8);
    assert.equal(session.controller.getStatus().tick, stopped);
    session.pause(); session.setReducedMotion(false);
    assert.equal(getBrowserScheduler(h.view).size, 0, 'removing motion policy preserves user pause');
    session.play(); h.setReduced(true);
    assert.equal(getBrowserScheduler(h.view).size, 0, 'system preference remains authoritative');
    session.play(); assert.equal(getBrowserScheduler(h.view).size, 0);
    h.setReduced(false); assert.equal(getBrowserScheduler(h.view).size, 1);
  } finally { session.dispose(); }
  assertClean(h);
  assert(h.removals.every(removal => removal.listeners === 0), 'controller listeners release before child removal');
});

test('Original and Brass Button borrow one shared scheduler per window and release only their own resources', async () => {
  const { mountBrassButton } = await import(adapterURL);
  const h = hostHarness(), original = mountOriginal(h);
  const variant = await mountBrassButton(h.host, { paused: false, reducedMotion: false });
  try {
    h.intersect(variant.element, true);
    assert.equal(getBrowserScheduler(h.view).size, 2); assert.equal(h.pending, 1);
    assert.equal(h.resizes.size, 2); assert.equal(h.intersections.size, 2);
    tick(h); assert(original.controller.getStatus().tick > 0); assert(variant.controller.getStatus().tick > 0);
    variant.dispose(); assert.equal(getBrowserScheduler(h.view).size, 1); assert.equal(h.pending, 1);
    assert.equal(h.resizes.size, 1); assert.equal(h.intersections.size, 1);
    assert.equal(variant.element.listenerCount, 0); assert(original.element.listenerCount > 0);
    const tickBefore = original.controller.getStatus().tick; tick(h);
    assert(original.controller.getStatus().tick > tickBefore, 'private disposal cannot stop Original');
    const otherWindow = hostHarness();
    const other = await mountBrassButton(otherWindow.host, { paused: false, reducedMotion: false });
    otherWindow.intersect(other.element, true);
    assert.notEqual(getBrowserScheduler(otherWindow.view), getBrowserScheduler(h.view));
    assert.equal(getBrowserScheduler(otherWindow.view).size, 1); assert.equal(otherWindow.pending, 1);
    other.dispose(); assertClean(otherWindow); assert.equal(getBrowserScheduler(h.view).size, 1);
  } finally { variant.dispose(); original.dispose(); }
  assertClean(h);
});

test('an explicit Original → Brass Button → Original switch disposes each owner before the next mount', async () => {
  const { mountBrassButton } = await import(adapterURL);
  const h = hostHarness();
  const first = mountOriginal(h); tick(h); const originalFrame = first.controller.getFrame();
  first.dispose(); assertClean(h); assert.equal(first.controller.disposed, true);
  const variant = await mountBrassButton(h.host, { paused: false, reducedMotion: false, configuration: { seed: 19 } });
  h.intersect(variant.element, true); tick(h);
  assert.equal(h.host.children.length, 1); assert.equal(getBrowserScheduler(h.view).size, 1);
  assert.notDeepEqual(variant.controller.getFrame(), originalFrame, 'selection really reaches the private character');
  variant.dispose(); assertClean(h); assert.equal(variant.disposed, true);
  const last = mountOriginal(h); tick(h);
  try {
    assert.deepEqual(last.controller.getFrame(), originalFrame, 'returning uses the same Original replay');
    assert.equal(h.host.children.length, 1); assert.equal(getBrowserScheduler(h.view).size, 1);
  } finally { last.dispose(); }
  assertClean(h);
  assert(h.removals.every(removal => removal.listeners === 0 && removal.scheduler === 0 &&
    removal.resizes === 0 && removal.intersections === 0), 'teardown precedes DOM removal at every switch');
});

test('repeated private mounts leave no listeners, observers, abort handlers or RAF subscriptions', async () => {
  const { mountBrassButton } = await import(adapterURL), h = hostHarness();
  for (let i = 0; i < 6; i++) {
    const abort = new AbortController();
    const session = await mountBrassButton(h.host, { paused: i % 2 === 0, reducedMotion: false, signal: abort.signal });
    h.intersect(session.element, true); session.play(); tick(h);
    assert.equal(h.resizes.size, 1); assert.equal(h.intersections.size, 1);
    assert.equal(getBrowserScheduler(h.view).size, 1); assert.equal(h.pending, 1);
    assert(session.element.listenerCount > 0); assert(getEventListeners(abort.signal, 'abort').length > 0);
    session.dispose(); session.dispose(); session.play(); session.pause(); session.restart(); session.setReducedMotion(false);
    abort.abort(); assert.equal(session.disposed, true); assert.equal(session.controller.disposed, true);
    assert.equal(getEventListeners(abort.signal, 'abort').length, 0); assertClean(h);
  }
});

test('abort before or during the lazy-load await never acquires a canvas or lifecycle resources', async () => {
  const { mountBrassButton } = await import(adapterURL);
  for (const timing of ['before', 'during']) {
    const h = hostHarness(), abort = new AbortController();
    if (timing === 'before') abort.abort();
    const pending = mountBrassButton(h.host, { paused: false, reducedMotion: false, signal: abort.signal });
    if (timing === 'during') abort.abort();
    await assert.rejects(pending, error => error.name === 'AbortError', timing);
    assert.equal(h.elements.length, 0, `${timing}: cancellation precedes DOM construction`);
    assert.equal(getEventListeners(abort.signal, 'abort').length, 0); assertClean(h);
  }
});

test('abort after mount disposes controller and owned child without disturbing caller-owned content', async () => {
  const { mountBrassButton } = await import(adapterURL), h = hostHarness(), abort = new AbortController();
  const retained = { callerOwned: true }; h.host.children.push(retained);
  const session = await mountBrassButton(h.host, { paused: false, reducedMotion: false, signal: abort.signal });
  h.intersect(session.element, true); tick(h); abort.abort();
  assert.equal(session.disposed, true); assert.equal(session.controller.disposed, true);
  assert.deepEqual(h.host.children, [retained]); assert.equal(getEventListeners(abort.signal, 'abort').length, 0);
  h.host.children.pop(); assertClean(h);
  assert(h.removals.every(removal => removal.listeners === 0 && removal.scheduler === 0));
});
