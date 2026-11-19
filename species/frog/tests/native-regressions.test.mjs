/**
 * Actual @napi-rs/canvas pixels through the canonical frog controller/demo.
 * Window, layout, observers, event delivery and DOM are controlled doubles.
 * This catches destructive bitmap clears and stale scene labels; it is NOT
 * browser/device, layout, font parity, accessibility or performance evidence.
 *
 * Run after compiling the exact source:
 *   node --test species/frog/tests/native-regressions.test.mjs
 * Optional FROG_TEST_ROOT selects a separate baseline checkout, not other code.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { FakeTarget, makeHost } from './fake-host.mjs';

const root = process.env.FROG_TEST_ROOT
  ? pathToFileURL(`${resolve(process.env.FROG_TEST_ROOT)}/`)
  : new URL('../../../', import.meta.url);
const source = path => new URL(path, root);
const isolated = process.env.FROG_NATIVE_REGRESSION_CASE === '1';
const { createCanvas } = isolated ? await import(source('species/frog/scripts/native-host.mjs')) : {};
const { mountFrog } = isolated ? await import(source('species/frog/generated/controller.mjs')) : {};
const { createLegacyFrogPreview } = isolated ? await import(source('species/frog/generated/legacy-preview.mjs')) : {};
const { loadImage } = isolated ? createRequire(import.meta.url)(process.env.FROG_CANVAS_MODULE ||
  (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
    ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/@napi-rs/canvas` : '@napi-rs/canvas')) : {};

if (!isolated) {
  // Each case releases native font/bitmap caches with the child process.
  for (const pattern of ['native bitmap redraw', 'native demo labels']) {
    test(pattern, () => {
      const { NODE_TEST_CONTEXT: inherited, ...environment } = process.env;
      const child = spawnSync(process.execPath, ['--expose-gc', '--test', '--test-reporter=tap',
        `--test-name-pattern=^${pattern}`, fileURLToPath(import.meta.url)], {
        env: { ...environment, FROG_NATIVE_REGRESSION_CASE: '1' }, encoding: 'utf8', maxBuffer: 1024 * 1024,
      });
      assert.equal(child.status, 0, child.stdout + child.stderr + String(child.error ?? child.signal ?? ''));
      assert.match(child.stdout, /# pass 1\b/);
    });
  }
} else {
  async function nativeHost(width = 720, height = 440) {
    // A decoded native Image is asynchronous even when .complete and dimensions
    // already report success. Predecode fixture atlases, then select by the hash
    // of the exact freshly built atlas inside synchronous controller.resize().
    const images = new Map();
    let primeAtlas;
    const primeCanvas = createCanvas(1, 1);
    primeCanvas.ownerDocument = { createElement: () => {
      primeAtlas = createCanvas(1, 1); return primeAtlas;
    } };
    const primePreview = createLegacyFrogPreview(primeCanvas, { cols: 180, rows: 100 });
    for (const [w, h, dpr] of [[720, 440, 1], [390, 520, 1], [360, 260, 2]]) {
      primePreview.resize(w, h, dpr);
      const bytes = primeAtlas.toBuffer('image/png');
      images.set(createHash('sha256').update(bytes).digest('hex'), await loadImage(bytes));
    }
    primePreview.dispose();
    globalThis.gc?.();
    const host = makeHost({ width, height, reducedMotion: true });
    const canvas = host.canvas(), bitmap = createCanvas(width, height);
    host.window.innerWidth = width;
    host.window.innerHeight = Math.max(600, height + 40);
    canvas.rect.left = 0;
    canvas.rect.top = 20;
    canvas.getBoundingClientRect = () => ({ ...canvas.rect,
      right: canvas.rect.left + canvas.rect.width, bottom: canvas.rect.top + canvas.rect.height });
    Object.defineProperties(canvas, {
      width: { get: () => bitmap.width, set: value => { bitmap.width = value; }, configurable: true },
      height: { get: () => bitmap.height, set: value => { bitmap.height = value; }, configurable: true },
    });
    const context = bitmap.getContext('2d');
    canvas.getContext = () => context;
    let atlas, immutableAtlas;
    host.document.createElement = name => {
      assert.equal(name, 'canvas', 'renderer may create only its atlas here');
      atlas = createCanvas(1, 1); return atlas;
    };
    // @napi retains deferred mutable-atlas work per drawImage and can exhaust
    // memory before a frame flush. Capture only the completed atlas to a native
    // Image after resize/update; draw the exact same pixels from that immutable
    // bitmap. This is a native test-host workaround, never browser/source code.
    // Native PNG reimport has a small documented rounding/sampling delta from
    // mutable-canvas blits; no cross-path or browser pixel identity is claimed.
    const drawImage = context.drawImage.bind(context);
    context.drawImage = (image, ...args) => drawImage(image === atlas ? immutableAtlas : image, ...args);
    const snapshotAtlas = () => {
      const hash = createHash('sha256').update(atlas.toBuffer('image/png')).digest('hex');
      immutableAtlas = images.get(hash);
      assert(immutableAtlas, 'exact resized atlas must have a fully decoded fixture image');
      assert(immutableAtlas.width === atlas.width && immutableAtlas.height === atlas.height);
    };
    const previewFactory = (target, options) => {
      const preview = createLegacyFrogPreview(target, options);
      return Object.freeze({ ...preview,
        resize(...args) { preview.resize(...args); snapshotAtlas(); },
        update(...args) { preview.update(...args); snapshotAtlas(); },
      });
    };
    return { host, canvas, bitmap, previewFactory };
  }

  function pixels(bitmap) {
    // The native renderer retains deferred sprite work: explicitly flush its
    // PNG encoder before reading pixels, as in the existing native harness.
    bitmap.toBuffer('image/png');
    const data = bitmap.getContext('2d').getImageData(0, 0, bitmap.width, bitmap.height).data;
    let bright = 0, opaque = 0;
    const colors = new Set();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 255) opaque++;
      if (Math.max(data[i], data[i + 1], data[i + 2]) > 60) {
        bright++;
        colors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
      }
    }
    const result = { width: bitmap.width, height: bitmap.height, bright, colors: colors.size,
      opaque, hash: createHash('sha256').update(data).digest('hex') };
    globalThis.gc?.();
    return result;
  }

  function assertDrawn(bitmap, label) {
    const result = pixels(bitmap);
    assert.equal(result.opaque, result.width * result.height, `${label}: background is painted`);
    // Deliberately modest, fixed nonblank gate; anatomy recognition is reviewed
    // separately in full-resolution captures. No threshold is derived from run output.
    assert(result.bright > 200, `${label}: ${result.bright} bright pixels, expected > 200`);
    assert(result.colors > 24, `${label}: ${result.colors} bright colors, expected > 24`);
    return result;
  }

  function noResources(host) {
    assert.equal(host.frames.size, 0);
    assert.equal(host.listenerCount, 0);
    assert(host.resizeObservers.every(observer => observer.disconnected && observer.targets.size === 0));
    assert(host.intersectionObservers.every(observer => observer.disconnected && observer.targets.size === 0));
  }

  test('native bitmap redraw survives desktop/phone sizes, zero size and deferred offscreen scene changes', async () => {
    const { host, canvas, bitmap, previewFactory } = await nativeHost();
    const snapshots = [];
    const controller = mountFrog(canvas, {
      seed: 23, paused: true, director: { autonomy: false },
      preview: { cols: 180, rows: 100, labels: false },
      previewFactory,
      onPondChange: state => snapshots.push(state),
    });
    assertDrawn(bitmap, 'initial desktop');
    for (const [width, height, dpr] of [[390, 520, 1], [360, 260, 2], [720, 440, 1]]) {
      canvas.rect.width = width; canvas.rect.height = height;
      host.window.devicePixelRatio = dpr;
      host.resize(canvas);
      assert.equal(bitmap.width, width * dpr);
      assert.equal(bitmap.height, height * dpr);
      assertDrawn(bitmap, `${width}×${height} DPR ${dpr}`);
      assert.equal(controller.getPondState().tick, 0);
      assert.equal(host.frames.size, 0);
    }

    // A real Canvas dimension write erases its pixels. While hidden, keep the
    // old bitmap intact, publish current scene state, and delay that write.
    canvas.rect.top = 1200;
    host.intersect(canvas, false);
    assert.equal(controller.getStatus().offscreen, true);
    const before = pixels(bitmap);
    canvas.rect.width = 390; canvas.rect.height = 520;
    host.resize(canvas);
    controller.updateDirector({ scene: 'stillwater', count: 2 });
    controller.call();
    assert.equal(snapshots.at(-1).config.scene, 'stillwater');
    assert.equal(snapshots.at(-1).actors.length, 2);
    assert.deepEqual(pixels(bitmap), before, 'offscreen resize/config must not clear the last painted bitmap');

    // Layout becomes visible before IntersectionObserver reports the new state.
    // A requested resize must reconcile that lag and paint in the same call.
    canvas.rect.top = 20;
    host.resize(canvas);
    assert.equal(controller.getStatus().offscreen, false);
    assert.equal(bitmap.width, 390); assert.equal(bitmap.height, 520);
    assertDrawn(bitmap, 'restored phone with latest scene and static call');
    assert.equal(controller.getStatus().tick, 0);
    assert.equal(controller.getStatus().scheduled, false);

    canvas.rect.width = 0; canvas.rect.height = 0;
    host.resize(canvas);
    assert.equal(bitmap.width, 1); assert.equal(bitmap.height, 1);
    assert.equal(controller.getStatus().zeroSize, true);
    canvas.rect.width = 720; canvas.rect.height = 440;
    host.resize(canvas);
    assert.equal(controller.getStatus().zeroSize, false);
    assertDrawn(bitmap, 'restored from zero-size host');
    controller.dispose(); controller.dispose();
    assert.equal(bitmap.width, 1); assert.equal(bitmap.height, 1);
    noResources(host);
  });

  class ElementDouble extends FakeTarget {
    constructor(id = '') {
      super(); this.id = id; this.attributes = new Map(); this.value = '';
      this.checked = false; this.hidden = false; this.disabled = false;
      this.textContent = ''; this.options = [];
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
  }

  async function nativeDemo() {
    const { host, canvas, bitmap, previewFactory } = await nativeHost();
    const html = readFileSync(source('species/frog/demo/index.html'), 'utf8');
    const module = readFileSync(source('species/frog/generated/demo.mjs'), 'utf8');
    const expectedImport = "import { mountFrog } from './controller.mjs';";
    assert(module.includes(expectedImport), 'inspect the new demo import before adapting this trusted-code harness');
    const compiled = module.replace(expectedImport, 'const mountFrog = __mountFrog;');
    const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, new ElementDouble(id)]));
    elements.set('frog', canvas);
    const scenes = ['scene-stillwater', 'scene-firefly', 'scene-chorus'].map((id, i) => {
      const input = elements.get(id); input.value = ['stillwater', 'firefly-supper', 'moonlit-chorus'][i]; return input;
    });
    const options = html.match(/<select id="target"[^>]*>([\s\S]*?)<\/select>/)[1];
    elements.get('target').options = [...options.matchAll(/<option\s+value="([^"]*)"/g)]
      .map(([, value]) => Object.assign(new ElementDouble(), { value }));
    elements.get('fallback').hidden = true;
    host.document.fonts = { ready: Promise.resolve() };
    host.document.querySelector = selector => {
      const element = elements.get(selector.slice(1)); assert(element, selector); return element;
    };
    host.document.querySelectorAll = selector => {
      if (selector === 'input[name="scene"]') return scenes;
      if (selector === 'button,input,select') return [...elements.values()];
      throw new Error(`Unsupported DOM-double selector ${selector}`);
    };
    await vm.runInNewContext(`(async () => { ${compiled}\n })()`, {
      document: host.document, window: host.window,
      __mountFrog: (target, options) => mountFrog(target, { ...options, previewFactory }), Error,
    });
    assert.equal(elements.get('fallback').hidden, true, elements.get('status').textContent);
    assert(host.window.__frogDemo, 'actual demo initialized its local review hook');
    return { host, canvas, bitmap, elements, controller: host.window.__frogDemo.controller };
  }

  test('native demo labels follow actual scene state while offscreen and repaint after viewport changes', async () => {
    const { host, canvas, bitmap, elements, controller } = await nativeDemo();
    const element = id => elements.get(id);
    assert.equal(element('scene-title').textContent, 'Moonlit chorus');
    assertDrawn(bitmap, 'actual demo initial scene');
    const choices = [
      ['scene-stillwater', 'stillwater', 'Stillwater', 390, 520],
      ['scene-firefly', 'firefly-supper', 'Firefly supper', 720, 440],
      ['scene-chorus', 'moonlit-chorus', 'Moonlit chorus', 390, 520],
    ];
    for (const [id, scene, title, width, height] of choices) {
      canvas.rect.top = 1400; host.intersect(canvas, false);
      assert.equal(controller.getStatus().offscreen, true);
      const prior = pixels(bitmap);
      canvas.rect.width = width; canvas.rect.height = height; host.resize(canvas);
      element(id).checked = true; element(id).fire('change');
      assert.equal(controller.getPondState().config.scene, scene);
      assert.equal(element('scene-title').textContent, title, 'scene label cannot depend on canvas visibility');
      for (const [radio, value] of choices) assert.equal(element(radio).checked, value === scene);
      assert.deepEqual(pixels(bitmap), prior, 'hidden scene changes preserve the prior bitmap until redraw');
      canvas.rect.top = 20; host.resize(canvas);
      assert.equal(bitmap.width, width); assert.equal(bitmap.height, height);
      assert.equal(controller.getStatus().offscreen, false);
      assert.equal(element('scene-title').textContent, title);
      assertDrawn(bitmap, `actual demo ${scene} ${width}×${height}`);
      assert.equal(controller.getPondState().tick, 0);
      assert.equal(host.frames.size, 0, 'reduced motion never resumes during a scene/viewport change');
    }
    element('pose').value = 'airborne'; element('pose').fire('change');
    canvas.fire('keydown', { key: 'h' });
    assert.equal(element('pose').value, '', 'focused-key static hunt clears a stale anatomical pose label');
    assert.match(element('status').textContent, /^Static hunt study\./);
    assertDrawn(bitmap, 'reduced-motion hunt after scene/viewport changes');
    host.window.__frogDemo.dispose();
    for (const node of elements.values()) assert.equal(node.listenerCount, 0);
    noResources(host);
  });
}
