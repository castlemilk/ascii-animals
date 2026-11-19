/**
 * Reusable REAL Chromium runner for a normally served frog demo.
 * No native-canvas substitute, security flags, browser fallback or result mocks.
 * It records blocked launch/navigation as a failure and leaves a readable report.
 *
 * After building and serving dist/:
 *   node species/frog/scripts/check-browser-regressions.mjs \
 *     http://127.0.0.1:8000/frog/ /absolute/review/browser
 *
 * Uses installed Playwright. FROG_PLAYWRIGHT_MODULE and FROG_BROWSER_EXECUTABLE
 * may identify already available packages/binaries. No dependency install runs.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const modulePath = process.env.FROG_PLAYWRIGHT_MODULE ||
  (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
    ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright') : 'playwright');
const url = new URL(process.argv[2] ?? 'http://127.0.0.1:8000/frog/');
assert(['http:', 'https:'].includes(url.protocol), 'Serve the actual demo over HTTP(S)');
const output = path.resolve(process.argv[3] ?? 'frog-browser-regressions');
await mkdir(output, { recursive: true });
const report = {
  evidence: 'Real Chromium, normal demo entry; phone is browser emulation, not physical hardware',
  status: 'running', url: url.href, started: new Date().toISOString(), node: process.version,
  browser: null, sourceSha256: {}, servedAssets: {}, scenarios: [], errors: [],
  limitations: ['No physical-device, screen-reader, heap or p95/p99 performance claim.'],
};
for (const name of ['choreography', 'controller', 'demo', 'frog', 'geometry', 'index', 'legacy-preview', 'pond', 'pond-types', 'types']) {
  const file = new URL(`../src/${name}.mts`, import.meta.url);
  report.sourceSha256[`species/frog/src/${name}.mts`] = createHash('sha256').update(await readFile(file)).digest('hex');
}

let browser;
const pendingAssets = [];
try {
  const { chromium } = require(modulePath);
  browser = await chromium.launch({ headless: true, chromiumSandbox: true,
    ...(process.env.FROG_BROWSER_EXECUTABLE ? { executablePath: process.env.FROG_BROWSER_EXECUTABLE } : {}) });
  report.browser = browser.version();

  for (const scenario of [
    { name: 'desktop', width: 1440, height: 1000, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
    { name: 'phone', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  ]) {
    const viewport = { width: scenario.width, height: scenario.height };
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce',
      deviceScaleFactor: scenario.deviceScaleFactor, isMobile: scenario.isMobile, hasTouch: scenario.hasTouch });
    const page = await context.newPage();
    const record = { ...scenario, frames: [], checks: [] };
    report.scenarios.push(record);
    page.on('pageerror', error => report.errors.push(`${scenario.name}: ${error.message}`));
    page.on('response', response => {
      if (!/\.(?:m?js|css)(?:\?|$)/.test(response.url())) return;
      pendingAssets.push(response.body().then(bytes => {
        report.servedAssets[response.url()] = createHash('sha256').update(bytes).digest('hex');
      }).catch(error => { report.errors.push(`Asset hash: ${response.url()}: ${error.message}`); }));
    });
    await page.goto(url.href, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__frogDemo?.controller), undefined, { timeout: 10000 });
    assert.equal(await page.locator('#fallback').isVisible(), false);
    const canvas = page.locator('#frog');
    async function visible() {
      await canvas.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => {
        const status = window.__frogDemo.controller.getStatus();
        return !status.offscreen && !status.zeroSize;
      }, undefined, { timeout: 5000 });
    }
    async function inspect(label) {
      await visible();
      const metrics = await page.evaluate(() => {
        const canvas = document.querySelector('#frog'), context = canvas.getContext('2d');
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let bright = 0, opaque = 0; const colors = new Set();
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] === 255) opaque++;
          if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 60) {
            bright++; colors.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
          }
        }
        const controller = window.__frogDemo.controller, state = controller.getPondState();
        return { width: canvas.width, height: canvas.height, bright, colors: colors.size, opaque,
          scene: state.config.scene, label: document.querySelector('#scene-title').textContent,
          status: controller.getStatus(), glyphs: controller.exportText().replace(/\s/g, '').length };
      });
      assert.equal(metrics.opaque, metrics.width * metrics.height, `${label}: fully painted canvas`);
      assert(metrics.bright > 200, `${label}: nonblank pixel gate`);
      assert(metrics.colors > 24, `${label}: visible glyph palette`);
      assert(metrics.glyphs > 250, `${label}: logical field is populated`);
      assert.equal(metrics.status.scheduled, false, `${label}: reduced/paused must not schedule travel`);
      const file = `${scenario.name}-${label}.png`;
      await canvas.screenshot({ path: path.join(output, file) });
      record.frames.push({ label, file, ...metrics });
      return metrics;
    }

    await inspect('initial');
    await page.screenshot({ path: path.join(output, `${scenario.name}-page.png`), fullPage: true });
    for (const [id, scene, label] of [
      ['scene-stillwater', 'stillwater', 'Stillwater'],
      ['scene-firefly', 'firefly-supper', 'Firefly supper'],
      ['scene-chorus', 'moonlit-chorus', 'Moonlit chorus'],
    ]) {
      // Scene radios are above the canvas. A short viewport leaves the canvas
      // wholly offscreen when the native control changes its scene.
      await page.setViewportSize({ width: viewport.width, height: 360 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForFunction(() => window.__frogDemo.controller.getStatus().offscreen, undefined, { timeout: 5000 });
      await page.locator(`#${id}`).check();
      const hiddenState = await page.evaluate(() => ({
        scene: window.__frogDemo.controller.getPondState().config.scene,
        title: document.querySelector('#scene-title').textContent,
        checked: document.querySelector('input[name="scene"]:checked').value,
      }));
      assert.deepEqual(hiddenState, { scene, title: label, checked: scene });
      await page.setViewportSize(viewport);
      await inspect(`restored-${scene}`);
    }
    record.checks.push('Scene controls update labels/state offscreen; visible restoration paints real Canvas at both viewport sizes.');

    await visible(); await canvas.focus();
    await canvas.press('2');
    assert.equal(await page.evaluate(() => window.__frogDemo.controller.getPondState().selectedId), 1);
    for (const [key, action] of [['c', 'call'], ['h', 'hunt'], ['r', 'ripple']]) {
      await canvas.press(key);
      assert.match(await page.locator('#status').innerText(), new RegExp(`^Static ${action} study`));
      await inspect(`keyboard-${action}`);
    }
    await canvas.press('Enter');
    assert.equal(await page.evaluate(() => window.__frogDemo.controller.getStatus().staticPose), 'crouch');
    record.checks.push('Focused keyboard selects a frog and routes Call/Hunt/Ripple/Hop to static studies under reduced motion.');

    if (scenario.hasTouch) {
      await page.locator('#select-2').tap();
      assert.equal(await page.evaluate(() => window.__frogDemo.controller.getPondState().selectedId), 2);
      await page.locator('#hunt').tap();
      await inspect('touch-hunt');
      record.checks.push('Browser-emulated touch selects Fern and activates Hunt through native controls.');
    }
    await visible();
    const box = await canvas.boundingBox(); assert(box);
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .15);
    await page.mouse.click(box.x + box.width * .5, box.y + box.height * .15);
    const pointerStatus = await page.evaluate(() => window.__frogDemo.controller.getStatus());
    assert.equal(pointerStatus.tick, 0);
    assert.equal(pointerStatus.scheduled, false);
    await inspect('pointer-still');
    record.checks.push('Pointer motion/tap cannot override reduced motion.');

    // Explicit pause must survive a preference change, restart and another
    // viewport change even when reduced motion is no longer holding the clock.
    await page.evaluate(() => window.__frogDemo.controller.setPaused(true));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('#reset').click();
    await page.setViewportSize({ width: viewport.width, height: viewport.height - 40 });
    await page.setViewportSize(viewport);
    await inspect('paused-reset');
    const paused = await page.evaluate(() => window.__frogDemo.controller.getStatus());
    assert.equal(paused.paused, true); assert.equal(paused.tick, 0); assert.equal(paused.scheduled, false);
    record.checks.push('Explicit pause survives OS preference change, reset and viewport restoration.');

    // Exercise authored travel and feeding with real browser event timing.
    // This proves state transitions and input routing, not frame-perfect replay
    // or a hardware frame-time budget. The deterministic native capture owns
    // matched representative pose evidence separately.
    await page.locator('#autonomy').uncheck();
    await page.locator('#count').selectOption('1');
    await visible();
    const origin = await page.evaluate(() => window.__frogDemo.controller.getState().position);
    await page.evaluate(() => window.__frogDemo.controller.setPaused(false));
    await canvas.focus(); await canvas.press('Enter');
    await page.waitForFunction(() => window.__frogDemo.controller.getState().jumps === 1, undefined, { timeout: 5000 });
    await page.waitForFunction(() => {
      const actor = window.__frogDemo.controller.getPondState().actors[0];
      return actor.model.jumps === 1 && ['idle', 'interest'].includes(actor.model.behavior.kind);
    }, undefined, { timeout: 9000 });
    const landing = await page.evaluate(() => {
      const actor = window.__frogDemo.controller.getPondState().actors[0];
      return { position: actor.model.position, reservedPad: actor.reservedPad };
    });
    assert.notDeepEqual(landing.position, origin);
    assert.equal(landing.reservedPad, null);
    await page.waitForFunction(() => window.__frogDemo.controller.getPondState().actors[0].motive.kind === 'rest',
      undefined, { timeout: 5000 });
    await canvas.press('h');
    await page.waitForFunction(() => window.__frogDemo.controller.getPondState().actors[0].motive.kind === 'track',
      undefined, { timeout: 5000 });
    await page.waitForFunction(() => window.__frogDemo.controller.getPondState().firefly?.phase === 'caught',
      undefined, { timeout: 9000 });
    await page.waitForFunction(() => ['rest', 'settle'].includes(window.__frogDemo.controller.getPondState().actors[0].motive.kind),
      undefined, { timeout: 5000 });
    await page.evaluate(() => window.__frogDemo.controller.setPaused(true));
    await inspect('live-hop-and-hunt-recovered');
    record.checks.push('Focused Enter completes a real hop and frees its destination; H reaches track, contact and recovery under live browser timing.');

    const disposal = await page.evaluate(() => {
      const controller = window.__frogDemo.controller;
      window.__frogDemo.dispose(); controller.dispose();
      window.dispatchEvent(new Event('resize'));
      const canvas = document.querySelector('#frog');
      return { disposed: controller.getStatus().disposed, scheduled: controller.getStatus().scheduled,
        width: canvas.width, height: canvas.height };
    });
    assert.deepEqual(disposal, { disposed: true, scheduled: false, width: 1, height: 1 });
    record.checks.push('Double disposal releases the bitmap and leaves the instance unscheduled.');
    await Promise.allSettled(pendingAssets);
    await context.close();
  }
  await Promise.allSettled(pendingAssets);
  assert.deepEqual(report.errors, [], 'No runtime or asset errors are accepted');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed-or-blocked';
  report.errors.push(error.stack ?? String(error));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  report.completed = new Date().toISOString();
  await writeFile(path.join(output, 'browser-regressions.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, status: report.status, browser: report.browser,
    scenarios: report.scenarios.length, error: report.errors.at(-1) ?? null }, null, 2));
}
