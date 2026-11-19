// Real public factories and real species models/renderers in a simulated DOM.
// This suite proves adapter ownership and playback bookkeeping only; Playwright
// remains the separate gate for navigation, focus, visual layout and live frames.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { getEventListeners } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { rendererHost } from './helpers/renderer-host.mjs';

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const demoDirectory = path.dirname(testsDirectory);
const speciesIds = ['cuttlefish', 'manta', 'octopus', 'seahorse', 'crab', 'turtle',
  'pufferfish', 'frog', 'butterfly', 'dragonfly', 'gecko', 'owl', 'fox'];
let temporaryDirectory;
let adapterURL;
let mountRenderer;

before(async () => {
  // Transpile the actual app source into an ephemeral module beside these tests
  // so its unchanged bare imports resolve the installed local review package.
  // No factory is mocked and no permanent copy of the adapter is committed.
  temporaryDirectory = await mkdtemp(path.join(testsDirectory, '.renderer-tests-'));
  const source = await readFile(new URL('../src/lib/renderers.ts', import.meta.url), 'utf8');
  const result = ts.transpileModule(source, {
    fileName: 'renderers.ts', reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, isolatedModules: true },
  });
  assert.equal(result.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0);
  const moduleFile = path.join(temporaryDirectory, 'renderers.mjs');
  await writeFile(moduleFile, result.outputText);
  adapterURL = pathToFileURL(moduleFile).href;
  ({ mountRenderer } = await import(adapterURL));
});

after(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
});

function clock(session) {
  return ['cuttlefish', 'manta', 'octopus'].includes(session.species)
    ? session.controller.getStats().time : session.controller.getStatus().tick;
}

function paused(session) {
  if (['cuttlefish', 'manta', 'octopus'].includes(session.species)) return session.controller.getOptions().paused;
  if (session.species === 'pufferfish') return session.controller.getStatus().userPaused;
  return session.controller.getStatus().paused;
}

function advance(host) {
  host.frame(); host.frame(); host.frame();
}

function assertReleased(host, session, signal) {
  assert.equal(session.disposed, true);
  assert.equal(session.controller.disposed, true, 'The actual native controller was disposed');
  assert.equal(session.element.parentNode, null);
  assert.deepEqual(host.host.children, [host.sibling], 'The caller-owned description survives');
  assert.equal(host.resourceCount, 0, 'No listener, observer or scheduled frame remains');
  if (signal) assert.equal(getEventListeners(signal, 'abort').length, 0);
}

test('adapter and built public package imports are safe without browser globals', () => {
  const modules = ['ascii-animals-review', ...speciesIds.filter(id => !['cuttlefish', 'manta', 'octopus'].includes(id))
    .map(id => `ascii-animals-review/${id}`)];
  const script = `
    for (const name of ['window', 'document', 'requestAnimationFrame']) {
      Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error('DOM read during import: ' + name); } });
    }
    const adapter = await import(${JSON.stringify(adapterURL)});
    if (typeof adapter.mountRenderer !== 'function') throw new Error('Missing adapter');
    const names = ${JSON.stringify(modules)};
    for (const name of names) await import(name);
    process.stdout.write(JSON.stringify({ imported: names.length, domReads: 0 }));
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: demoDirectory, encoding: 'utf8', timeout: 30000,
  });
  assert.deepEqual(JSON.parse(output), { imported: 11, domReads: 0 });
});

for (const species of ['cuttlefish', 'owl']) {
  test(`${species}: abort before load and while import is pending acquire no DOM or browser resources`, async () => {
    for (const abortBeforeLoad of [true, false]) {
      const host = rendererHost(), abort = new AbortController();
      const createdBefore = host.elements.length;
      if (abortBeforeLoad) abort.abort();
      const pending = mountRenderer(species, host.host, { paused: false, reducedMotion: false, signal: abort.signal });
      // Dynamic import always suspends this async function before construction,
      // even if Node has cached the module. This is the stale-load race being
      // tested; no network latency or browser code splitting is simulated.
      if (!abortBeforeLoad) abort.abort();
      await assert.rejects(pending, { name: 'AbortError' });
      assert.equal(host.elements.length, createdBefore, 'The cancelled load created no renderer element');
      assert.deepEqual(host.host.children, [host.sibling]);
      assert.equal(host.resourceCount, 0);
      assert.equal(getEventListeners(abort.signal, 'abort').length, 0);
    }
  });
}

for (const species of speciesIds) {
  test(`${species}: repeated real mounts advance, pause, restart paused and fully dispose`, async () => {
    const host = rendererHost();
    for (let iteration = 0; iteration < 2; iteration++) {
      const abort = new AbortController();
      const session = await mountRenderer(species, host.host, {
        paused: false, reducedMotion: false, signal: abort.signal,
        label: `${species} study`, descriptionId: 'study-instructions',
      });
      try {
        assert.equal(session.controller.species, species);
        assert.equal(session.element.dataset.rendererSpecies, species);
        assert.equal(session.element.tagName, species === 'owl' ? 'DIV' : 'CANVAS');
        assert.equal(session.element.getAttribute('aria-label'), `${species} study`);
        assert.equal(session.element.getAttribute('aria-describedby'), 'study-instructions');
        assert.equal(session.element.tabIndex, 0);
        assert.equal(host.host.children.length, 2, 'Exactly one demo-owned renderer host is attached');
        host.intersectAll();
        assert.equal(host.pending, 1, 'The native scheduler has one outstanding frame');
        advance(host);
        assert(clock(session) > 0, 'Real model time advanced through the public factory');
        session.pause();
        assert.equal(host.pending, 0);
        const frozen = clock(session);
        advance(host);
        assert.equal(clock(session), frozen);
        session.restart();
        assert.equal(paused(session), true);
        assert.equal(clock(session), 0);
        assert.equal(host.pending, 0, 'Restart retains user pause');
        session.play();
        advance(host);
        assert(clock(session) > 0);
        if (species === 'owl') assert(session.controller.exportText().replace(/\s/g, '').length > 50, 'The real Owl sampler produced a text still');
      } finally {
        session.dispose();
        session.dispose();
      }
      assertReleased(host, session, abort.signal);
      // The bridge makes common lifecycle calls safe after disposal, even for
      // native controllers whose own mutators reject after disposal.
      session.play(); session.pause(); session.restart(); session.setReducedMotion(false);
      assert.equal(host.resourceCount, 0);
    }
  });
}

for (const species of ['cuttlefish', 'owl']) {
  test(`${species}: system reduced motion blocks Play and preserves explicit pause across preference changes`, async () => {
    const host = rendererHost({ reducedMotion: true });
    const session = await mountRenderer(species, host.host, { paused: false, reducedMotion: false });
    try {
      host.intersectAll();
      session.play(); session.setReducedMotion(false); advance(host);
      assert.equal(host.pending, 0, 'Actual OS preference wins over a stale caller value');
      assert.equal(clock(session), 0);
      assert.equal(paused(session), true);
      session.restart();
      assert.equal(host.pending, 0);
      host.setReduced(false);
      advance(host);
      assert(clock(session) > 0, 'Clearing the system preference restores Play intent');
      session.pause();
      host.setReduced(true); host.setReduced(false);
      assert.equal(host.pending, 0, 'Preference changes do not clear explicit user pause');
      session.setReducedMotion(true);
      session.play();
      assert.equal(host.pending, 0, 'The shell can apply its preference before the native event arrives');
      session.setReducedMotion(false);
      assert.equal(host.pending, 1);
    } finally { session.dispose(); }
    assertReleased(host, session);
  });

  test(`${species}: hidden and offscreen hosts retain native suspension and later abort cleans everything`, async () => {
    const host = rendererHost(), abort = new AbortController();
    const session = await mountRenderer(species, host.host, { paused: false, reducedMotion: false, signal: abort.signal });
    try {
      host.intersectAll(); advance(host);
      const visibleTime = clock(session);
      host.intersectAll(false); advance(host);
      assert.equal(host.pending, 0);
      assert.equal(clock(session), visibleTime);
      host.intersectAll(true);
      assert.equal(host.pending, 1);
      host.hide(true); session.play(); advance(host);
      assert.equal(host.pending, 0, 'Play does not defeat document visibility policy');
      host.hide(false);
      assert.equal(host.pending, 1);
      abort.abort();
      assertReleased(host, session, abort.signal);
    } finally { session.dispose(); }
  });
}

test('typed pre-mount hook reaches native directors and cannot override initial pause or system policy', async () => {
  const host = rendererHost({ reducedMotion: true });
  const marine = await mountRenderer('cuttlefish', host.host, {
    paused: true, reducedMotion: false,
    configuration: { cuttlefish: { seed: 41, species: 'manta', paused: false, reducedMotion: 'ignore' } },
  });
  assert.equal(marine.controller.species, 'cuttlefish', 'The route owns species identity');
  assert.equal(marine.controller.getOptions().seed, 41);
  assert.equal(marine.controller.getOptions().reducedMotion, 'system');
  assert.equal(marine.controller.getOptions().paused, true);
  assert.equal(host.pending, 0);
  marine.dispose(); assertReleased(host, marine);

  const owl = await mountRenderer('owl', host.host, {
    paused: true, reducedMotion: false,
    configuration: { owl: { paused: false, director: { scene: 'duet', count: 2 } } },
  });
  assert.equal(owl.controller.getDirectorSnapshot().config.scene, 'duet');
  assert.equal(owl.controller.getDirectorSnapshot().actors.length, 2);
  assert.equal(owl.controller.getStatus().paused, true);
  owl.dispose(); assertReleased(host, owl);

  const fox = await mountRenderer('fox', host.host, {
    paused: true, reducedMotion: false,
    configuration: { fox: { fox: { seed: 41, paused: false }, director: { scene: 'den-watch', count: 2 } } },
  });
  assert.equal(fox.controller.getDirectorOptions().scene, 'den-watch');
  assert.equal(fox.controller.getDirectorState().actors.length, 2);
  assert.equal(fox.controller.getStatus().paused, true);
  fox.dispose(); assertReleased(host, fox);
});

test('a rejected real factory configuration removes its attempted host and leaves caller content intact', async () => {
  const host = rendererHost();
  await assert.rejects(mountRenderer('cuttlefish', host.host, {
    paused: false, reducedMotion: false, configuration: { cuttlefish: { count: 0 } },
  }), RangeError);
  assert.deepEqual(host.host.children, [host.sibling]);
  assert.equal(host.resourceCount, 0);
});
