#!/usr/bin/env node
/** Optional REAL-browser acceptance. Requires an installed Playwright + supported
 * Chromium. Launch failures are recorded as blocked, never replaced by stubs.
 * Start: python3 -m http.server 8000 --bind 127.0.0.1 (repository root)
 * Run: node species/dragonfly/scripts/browser-smoke.mjs
 * Optional DRAGONFLY_PLAYWRIGHT_MODULE and DRAGONFLY_CHROMIUM identify existing tools.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, '../evidence/browser');
const target = new URL(process.argv[2] ?? 'http://127.0.0.1:8000/species/dragonfly/');
if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname))
  throw new Error('The acceptance runner only opens a local HTTP specimen');
await mkdir(output, { recursive: true });
const report = { kind: 'real-browser', status: 'not-run', url: target.href, tests: [], artifacts: [], gaps: [
  'Actual phone hardware and screen reader interaction', 'Long-session heap/leak profiling',
  'Real document-hidden transitions (covered by bookkeeping tests only)',
  'Other browser engines and font platforms', 'Target-device performance profiling',
] };
let browser;
try {
  const moduleName = process.env.DRAGONFLY_PLAYWRIGHT_MODULE;
  const { chromium } = moduleName ? await import(pathToFileURL(resolve(moduleName)).href) : await import('playwright');
  const launch = { headless: true };
  if (process.env.DRAGONFLY_CHROMIUM) launch.executablePath = process.env.DRAGONFLY_CHROMIUM;
  try { browser = await chromium.launch(launch); }
  catch (error) { report.status = 'blocked'; report.error = `Browser launch failed before page execution: ${String(error)}`; throw error; }
  report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.route('**/*', route => new URL(route.request().url()).origin === target.origin ? route.continue() : route.abort());
  await page.goto(target.href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.dragonflyPreview?.getStatus().tick >= 4);
  assert.equal(errors.length, 0); report.tests.push('actual Canvas mount and initial animation');
  await page.locator('#dragonfly').focus(); await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => (window.dragonflyPreview.getState().target?.x ?? 0) > 0);
  await page.locator('#dart').click();
  await page.waitForFunction(() => window.dragonflyPreview.getStatus().behavior === 'dart');
  report.tests.push('focused keyboard guidance and native deliberate dart button');
  await page.locator('#pause').click();
  const pausedTick = await page.evaluate(() => window.dragonflyPreview.getStatus().tick);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.dragonflyPreview.getStatus().tick), pausedTick);
  await page.locator('#reset').click();
  assert.deepEqual(await page.evaluate(() => ({ paused: window.dragonflyPreview.getStatus().paused, tick: window.dragonflyPreview.getStatus().tick, raf: window.dragonflyPreview.getStatus().queuedFrames })), { paused: true, tick: 0, raf: 0 });
  report.tests.push('real pause and reset preserve pause with zero queued RAF');
  await page.screenshot({ path: resolve(output, 'desktop.png'), fullPage: true }); report.artifacts.push('desktop.png');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#pause').click();
  await page.waitForFunction(() => window.dragonflyPreview.getStatus().motion === 'static');
  const still = await page.evaluate(() => window.dragonflyPreview.exportText());
  await page.mouse.move(600, 400); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.dragonflyPreview.getStatus().queuedFrames), 0);
  await page.locator('#dart').click();
  assert.notEqual(await page.evaluate(() => window.dragonflyPreview.exportText()), still);
  assert.equal(await page.evaluate(() => window.dragonflyPreview.getStatus().tick), 0);
  report.tests.push('live reduced-motion preference, pointer cannot animate, alternate static pose');
  await page.screenshot({ path: resolve(output, 'reduced-motion.png'), fullPage: true }); report.artifacts.push('reduced-motion.png');
  await page.evaluate(() => { document.getElementById('dragonfly').style.display = 'none'; });
  await page.waitForFunction(() => window.dragonflyPreview.getStatus().zeroSized);
  assert.equal(await page.evaluate(() => window.dragonflyPreview.getStatus().queuedFrames), 0);
  await page.evaluate(() => { document.getElementById('dragonfly').style.display = ''; });
  await page.waitForFunction(() => !window.dragonflyPreview.getStatus().zeroSized);
  report.tests.push('real ResizeObserver zero-size suspension/restoration');
  await page.evaluate(() => { window.dragonflyPreview.dispose(); window.dragonflyPreview.dispose(); });
  assert.deepEqual(await page.evaluate(() => ({ disposed: window.dragonflyPreview.getStatus().disposed, raf: window.dragonflyPreview.getStatus().queuedFrames, width: document.getElementById('dragonfly').width })), { disposed: true, raf: 0, width: 0 });
  report.tests.push('real host idempotent disposal and released Canvas backing storage');
  await context.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const mobile = await phone.newPage();
  await mobile.route('**/*', route => new URL(route.request().url()).origin === target.origin ? route.continue() : route.abort());
  await mobile.goto(target.href, { waitUntil: 'networkidle' });
  await mobile.locator('#dragonfly').scrollIntoViewIfNeeded();
  const box = await mobile.locator('#dragonfly').boundingBox(); assert(box);
  await mobile.touchscreen.tap(box.x + box.width * 0.75, box.y + box.height * 0.5);
  await mobile.waitForFunction(() => window.dragonflyPreview.getState().target !== null);
  await mobile.locator('#dart').tap();
  await mobile.waitForFunction(() => window.dragonflyPreview.getStatus().behavior === 'dart');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mobile.screenshot({ path: resolve(output, 'mobile-emulated.png'), fullPage: true }); report.artifacts.push('mobile-emulated.png');
  report.tests.push('emulated touch guide/action, 390px reflow, DPR2 Canvas');
  await phone.close();
  report.status = 'pass';
} catch (error) {
  if (report.status !== 'blocked') report.status = 'fail';
  report.error ??= String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
