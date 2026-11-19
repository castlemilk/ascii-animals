#!/usr/bin/env node
/** Optional REAL-browser gate for the current fox demo and compiled browser API.
 * A launch denial is recorded as blocked, never as a browser pass.
 * Uses already installed Playwright/Chromium; no downloads or launch overrides.
 *
 * node species/fox/scripts/browser-dusk-smoke.mjs --out=/absolute/evidence
 * FOX_CHROMIUM_PATH may name an already supported browser executable.
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const argument = (key, fallback) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const root = resolve(argument('source', fileURLToPath(new URL('../../..', import.meta.url))));
const output = resolve(argument('out', join(root, 'species/fox/evidence/dusk/browser')));
const require = createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/' : import.meta.url);
const { chromium } = require('playwright');
let browser, server, stage = 'launch';
const checks = [];
const errors = [];
const media = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const lifecycleHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fox browser lifecycle fixture</title>
<style>body{margin:0;background:#10191c}canvas{display:block;width:960px;height:640px;max-width:100vw}</style></head><body>
<canvas id="fixture" aria-label="Fox lifecycle test fixture"></canvas><script type="module">
import { mountFox } from '/species/fox/lib/browser.js';
window.events = [];
window.fox = mountFox(document.getElementById('fixture'), {
 fox: { seed:17 }, director: {scene:'dusk-hunt',count:2,showLabels:false},
 onDirectorInputs(batch) { window.events.push(...batch); }
});
</script></body></html>`;
await mkdir(output, { recursive: true });
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.FOX_CHROMIUM_PATH ?? '/usr/bin/chromium' });
  stage = 'server';
  server = createServer(async (req, res) => {
    try {
      const route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (route === '/__fox_lifecycle.html') {
        res.setHeader('content-type', 'text/html'); res.end(lifecycleHtml); return;
      }
      const file = resolve(root, '.' + route);
      if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
      const path = file.endsWith(sep) ? file + 'index.html' : file;
      res.setHeader('content-type', media[extname(path)] ?? 'application/octet-stream');
      res.end(await readFile(path));
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise((ready, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', ready); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  stage = 'desktop-demo';
  await page.goto(url + '/species/fox/demo/index.html');
  await page.locator('#fox').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.getElementById('playback-label').textContent === 'LIVE MEADOW');
  const canvas = page.locator('#fox');
  const rect = await canvas.boundingBox();
  assert(rect && rect.width > 600);
  await page.mouse.move(rect.x + rect.width * .52, rect.y + rect.height * .55);
  await page.mouse.click(rect.x + rect.width * .55, rect.y + rect.height * .61);
  await page.locator('#pause').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#pause').textContent(), 'Resume');
  await page.locator('#reset').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#pause').textContent(), 'Resume');
  checks.push('Real desktop pointer motion/click and native button keyboard activation; pause survives reset.');
  await canvas.focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  assert.match(await page.locator('#beat-title').textContent(), /Listening/);
  await page.keyboard.press('p');
  assert.match(await page.locator('#beat-title').textContent(), /Crouch/);
  await page.keyboard.press('c');
  assert.match(await page.locator('#action-status').textContent(), /still|held|curiosity|play/i);
  await page.keyboard.press('Tab');
  assert.equal(await canvas.evaluate(element => element === document.activeElement), false);
  checks.push('Canvas-scoped arrows, Enter, P, C and Tab; Tab leaves canvas.');
  await page.locator('#count').selectOption('3');
  assert.equal(await page.locator('#fox-2').isVisible(), true);
  await page.locator('#fox-1').click();
  await page.locator('#tail-curiosity').click();
  assert.equal(await page.locator('#selected-name').textContent(), 'Pip');
  await page.locator('#labels').uncheck();
  await page.locator('#still-listen').click();
  await canvas.scrollIntoViewIfNeeded();
  await canvas.screenshot({ path: join(output, 'real-browser-desktop-canvas.png') });
  await page.screenshot({ path: join(output, 'real-browser-desktop-page.png'), fullPage: true });
  await page.locator('#capture').click();
  assert.match(await page.locator('#text-frame').textContent(), /[#+%]/);
  checks.push('Selected-fox curiosity control, cast changes, still tableau, actual ASCII export and desktop capture.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#pause').click();
  await page.locator('#tail-curiosity').click();
  assert.match(await page.locator('#motion-note').textContent(), /Reduced motion/);
  assert.equal(await page.locator('#playback-label').textContent(), 'STILL MEADOW');
  checks.push('Live reduced-motion preference remains active after resume and curiosity actions.');

  stage = 'phone-demo';
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const mobile = await phone.newPage(); mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(url + '/species/fox/demo/index.html');
  await mobile.locator('#fox').scrollIntoViewIfNeeded();
  await mobile.waitForFunction(() => document.getElementById('playback-label').textContent === 'STILL MEADOW');
  const phoneRect = await mobile.locator('#fox').boundingBox();
  await mobile.touchscreen.tap(phoneRect.x + phoneRect.width * .5, phoneRect.y + phoneRect.height * .38);
  await mobile.locator('#tail-curiosity').tap();
  assert.match(await mobile.locator('#motion-note').textContent(), /Reduced motion/);
  await mobile.locator('#still-listen').tap();
  await mobile.locator('#fox').scrollIntoViewIfNeeded();
  assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.notEqual(await mobile.locator('#fox').evaluate(element => getComputedStyle(element).touchAction), 'none');
  await mobile.locator('#fox').screenshot({ path: join(output, 'real-browser-phone-canvas.png') });
  await mobile.screenshot({ path: join(output, 'real-browser-phone-page.png'), fullPage: true });
  checks.push('390 CSS-pixel touch emulation: canvas tap, native curiosity/still controls, no horizontal overflow or touch-action:none.');
  await phone.close();

  stage = 'browser-api-lifecycle';
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(url + '/__fox_lifecycle.html');
  await page.waitForFunction(() => window.fox?.getStatus().tick > 2);
  const fixture = page.locator('#fixture');
  const fixtureRect = await fixture.boundingBox();
  await page.mouse.click(fixtureRect.x + fixtureRect.width * .35, fixtureRect.y + fixtureRect.height * .65);
  await page.waitForFunction(() => window.events.some(event => event.type === 'cue' && event.cue === 'rustle'));
  const pointer = await page.evaluate(() => window.events.filter(event => event.type === 'cue').at(-1));
  assert(Number.isFinite(pointer.x) && Number.isFinite(pointer.y));
  assert(Math.abs(pointer.x) <= 1 && Math.abs(pointer.y) <= 1);
  await fixture.dispatchEvent('pointercancel');
  await page.waitForFunction(() => !window.fox.getDirectorState().pointer.active);
  await page.evaluate(() => window.fox.setPaused(true));
  const pausedTick = await page.evaluate(() => window.fox.getStatus().tick);
  await page.waitForTimeout(120);
  assert.equal(await page.evaluate(() => window.fox.getStatus().tick), pausedTick);
  assert.equal(await page.evaluate(() => window.fox.getStatus().ownAnimationFrames), 0);
  await page.evaluate(() => window.fox.reset(17));
  assert.equal(await page.evaluate(() => window.fox.getStatus().paused), true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => { window.fox.setPaused(false); window.fox.cue('play'); });
  await page.waitForTimeout(120);
  const reduced = await page.evaluate(() => window.fox.getStatus());
  assert.equal(reduced.tick, 0); assert.equal(reduced.reducedMotion, true); assert.equal(reduced.running, false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.fox.getStatus().cols === 112);
  const sized = await page.evaluate(() => window.fox.getStatus());
  assert(sized.backingWidth <= 2560 && sized.backingHeight <= 1536);
  await fixture.evaluate(element => { element.style.display = 'none'; });
  await page.waitForFunction(() => window.fox.getStatus().zeroSized);
  await fixture.evaluate(element => { element.style.display = 'block'; });
  await page.waitForFunction(() => !window.fox.getStatus().zeroSized);
  assert.equal(await page.evaluate(() => window.fox.getStatus().running), false);
  await page.evaluate(() => { window.fox.dispose(); window.fox.dispose(); });
  await page.waitForTimeout(120);
  const disposed = await page.evaluate(() => window.fox.getStatus());
  assert.equal(disposed.disposed, true); assert.equal(disposed.running, false);
  assert.equal(disposed.ownAnimationFrames, 0); assert.equal(disposed.pendingInputs, 0);
  assert.equal(disposed.backingWidth, 1); assert.equal(disposed.backingHeight, 1);
  checks.push('Actual browser adapter: normalized pointer cue, dispatched cancellation, paused clock/RAF, reduced-motion reset, resize/zero-size composition, repeated disposal.');
  assert.deepEqual(errors, []);
  const result = { result: 'passed', browser: await browser.version(), node: process.version,
    checks, errors, scope: 'Real headless browser DOM/Canvas/input/observer behavior. Touch is emulated, not physical-device acceptance; no heap, screen-reader or frame-performance certification.' };
  await writeFile(join(output, 'browser-dusk-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = { result: stage === 'launch' ? 'blocked-launch' : 'failed', stage, node: process.version,
    checks, errors, error: error.message, scope: 'Only completed checks are listed. No browser pass is implied by a launch denial.' };
  await writeFile(join(output, 'browser-dusk-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.error(JSON.stringify(result, null, 2)); process.exitCode = 1;
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (browser) await browser.close();
}
