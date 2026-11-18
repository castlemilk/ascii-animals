/**
 * Reproducible real-browser checks for the generated butterfly demo.
 *
 * Build first, then run:
 *   node species/butterfly/tests/browser-check.mjs
 *
 * Optional, already-installed runtime locations:
 *   BUTTERFLY_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs
 *   BUTTERFLY_CHROMIUM_PATH=/absolute/path/to/chromium
 *   BUTTERFLY_EVIDENCE_DIR=/absolute/path/to/review-output
 *
 * This script does not install dependencies, download browsers, change browser
 * security settings, or use a private artwork/model handle. A missing module,
 * denied loopback listener, or denied normal browser launch reports `blocked`.
 * Screenshots are saved only after the corresponding assertions have passed.
 * Mobile checks are Chromium touch emulation, not physical-device acceptance.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';

const root = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const runId = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const evidenceDirectory = path.resolve(process.env.BUTTERFLY_EVIDENCE_DIR ?? path.join(root, 'species/butterfly/evidence/browser', runId));
const stageNames = ['desktop-director', 'paused-and-keyboard', 'reduced-motion', 'mobile-touch'];
const summary = {
  schemaVersion: 1,
  status: 'not-run',
  startedAt: new Date().toISOString(),
  environment: { node: process.version, platform: process.platform, architecture: process.arch, osRelease: os.release(), browser: null },
  target: 'dist/butterfly/index.html',
  stages: stageNames.map(name => ({ name, status: 'not-run' })),
  screenshots: [],
  limitations: ['Chromium only; mobile is viewport/touch emulation.', 'This suite does not establish physical-device performance, memory-leak freedom, or WCAG certification.']
};
let server;
let browser;
let context;
let activeStage;
let executionPhase = 'module';
const networkErrors = [];
const pageErrors = [];

const hash = value => createHash('sha256').update(value).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function poll(check, message, timeout = 7000) {
  const deadline = Date.now() + timeout;
  do {
    if (await check()) return;
    await delay(70);
  } while (Date.now() < deadline);
  assert.fail(message);
}

function observePage(page, name, origin) {
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(15000);
  page.on('pageerror', error => pageErrors.push({ page: name, message: error.message }));
  page.on('response', response => {
    const url = response.url();
    if (url.startsWith(origin) && response.status() >= 400 && !url.endsWith('/favicon.ico')) {
      networkErrors.push({ page: name, url, status: response.status() });
    }
  });
  page.on('requestfailed', request => {
    if (request.url().startsWith(origin) && !request.url().endsWith('/favicon.ico')) {
      networkErrors.push({ page: name, url: request.url(), error: request.failure()?.errorText ?? 'request failed' });
    }
  });
}

function assertNoErrors() {
  assert.deepEqual(pageErrors, [], 'The page must not report uncaught errors.');
  assert.deepEqual(networkErrors, [], 'The demo and every imported resource must load without 404 or request failure.');
}

async function ready(page, origin) {
  const response = await page.goto(`${origin}/dist/butterfly/`, { waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200, 'Demo document must load.');
  await page.locator('#roles .role-card').first().waitFor({ state: 'visible' });
  assert.equal(await page.locator('#error').isVisible(), false, 'Initialization must succeed.');
  assert.equal(await page.locator('#animal').isVisible(), true, 'The real canvas must be visible.');
  const pixels = await page.locator('#animal').evaluate(canvas => {
    const ctx = canvas.getContext('2d');
    if (!ctx || canvas.width < 1 || canvas.height < 1) return { width: canvas.width, height: canvas.height, colors: 0 };
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set();
    for (let i = 0; i < data.length && colors.size < 32; i += 4) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`);
    return { width: canvas.width, height: canvas.height, colors: colors.size };
  });
  assert(pixels.width > 0 && pixels.height > 0 && pixels.colors > 3, 'Canvas must contain rendered character detail, not a blank surface.');
  assertNoErrors();
  return pixels;
}

async function canvasHash(page) {
  return hash(await page.locator('#animal').evaluate(canvas => canvas.toDataURL('image/png')));
}

async function stableCanvas(page, message, duration = 450) {
  const before = await canvasHash(page);
  await delay(duration);
  assert.equal(await canvasHash(page), before, message);
  return before;
}

async function expectPaused(page) {
  await poll(async () => (await page.locator('#pause').textContent()).trim() === 'Play', 'User pause must remain selected.');
  assert.equal(await page.locator('#pause').isDisabled(), false, 'User pause must remain independently controllable.');
}

async function expectCue(page, cue) {
  const id = { gather: 'gather', breeze: 'send-breeze', rest: 'rest' }[cue];
  await poll(async () => await page.locator(`#${id}`).getAttribute('data-active') === 'true', `${cue} cue must remain active after the input completes.`);
}

async function assertNoOverflow(page) {
  const size = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert(size.scrollWidth <= size.width + 1, `No horizontal page overflow: ${size.scrollWidth}px document in ${size.width}px viewport.`);
  return size;
}

async function beginStage(name) {
  activeStage = summary.stages.find(stage => stage.name === name);
  activeStage.status = 'running';
  activeStage.startedAt = new Date().toISOString();
}

async function finishStage(page, filename, details) {
  assertNoErrors();
  const screenshot = await page.screenshot({ fullPage: true });
  assertNoErrors();
  await mkdir(evidenceDirectory, { recursive: true });
  const destination = path.join(evidenceDirectory, filename);
  await writeFile(destination, screenshot);
  activeStage.status = 'passed';
  activeStage.finishedAt = new Date().toISOString();
  activeStage.details = details;
  activeStage.screenshot = destination;
  summary.screenshots.push({ stage: activeStage.name, file: destination, sha256: hash(screenshot) });
  activeStage = undefined;
}

async function loadPlaywright() {
  const input = process.env.BUTTERFLY_PLAYWRIGHT_MODULE ?? 'playwright';
  const specifier = path.isAbsolute(input) ? pathToFileURL(input).href : input;
  const module = await import(specifier);
  const chromium = module.chromium ?? module.default?.chromium;
  if (!chromium || typeof chromium.launch !== 'function') throw new Error('The specified Playwright module must expose chromium.launch.');
  return chromium;
}

async function startServer() {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
  server = createServer(async (request, response) => {
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return; }
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
      if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
      let file = path.resolve(root, `.${pathname}`);
      if (file !== root && !file.startsWith(`${root}${path.sep}`)) { response.writeHead(403); response.end(); return; }
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      const body = await readFile(file);
      response.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      response.writeHead(error?.code === 'ENOENT' ? 404 : 400, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Resource unavailable');
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address === 'object', 'A loopback server address is required.');
  return `http://127.0.0.1:${address.port}`;
}

try {
  const chromium = await loadPlaywright();
  executionPhase = 'server';
  const origin = await startServer();
  executionPhase = 'launch';
  // Deliberately no custom flags or fallback launches. The normal toolchain launch
  // settings remain unchanged; a blocked launch is a remaining gate, not a workaround.
  browser = await chromium.launch({ headless: true, ...(process.env.BUTTERFLY_CHROMIUM_PATH ? { executablePath: process.env.BUTTERFLY_CHROMIUM_PATH } : {}) });
  summary.environment.browser = browser.version();
  executionPhase = 'checks';

  await beginStage('desktop-director');
  context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  let page = await context.newPage();
  observePage(page, 'desktop', origin);
  const initialPixels = await ready(page, origin);
  assert.equal(await page.locator('#roles .role-card').count(), 4, 'Default scene must have four visitors.');
  assert.equal(await page.locator('[data-scene="morning"]').getAttribute('aria-pressed'), 'true');
  await page.locator('#count').focus();
  await page.locator('#count').press('Home');
  await poll(async () => await page.locator('#roles .role-card').count() === 1, 'Keyboard Home must select one visitor.');
  await page.locator('#count').press('End');
  await poll(async () => await page.locator('#roles .role-card').count() === 6, 'Keyboard End must select the bounded six visitors.');
  await page.locator('#role-0').selectOption('wanderer');
  assert.equal(await page.locator('#role-0').inputValue(), 'wanderer', 'Individual roles must be configurable.');
  await page.locator('#path').selectOption('ribbon');
  assert.equal(await page.locator('#path').inputValue(), 'ribbon');
  await page.locator('#pause').click();
  await expectPaused(page);
  await page.mouse.move(0, 0);
  await stableCanvas(page, 'Paused canvas must remain unchanged over time.');

  const sceneRecords = [];
  for (const [scene, count, flightPath] of [['morning', 4, 'meadow'], ['nectar', 5, 'meadow'], ['breeze', 4, 'ribbon'], ['roost', 4, 'spiral']]) {
    await page.locator(`[data-scene="${scene}"]`).click();
    await expectPaused(page);
    assert.equal(await page.locator('[data-scene][aria-pressed="true"]').count(), 1, 'Only one scene may be selected.');
    assert.equal(await page.locator(`[data-scene="${scene}"]`).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#roles .role-card').count(), count, 'Scene must compose its authored population.');
    assert.equal(await page.locator('#path').inputValue(), flightPath, 'Scene must compose its authored path.');
    assert.equal(await page.locator('#act-timeline li').count(), 4, 'Scene must expose four named acts.');
    const firstAct = (await page.locator('#current-act').textContent()).trim();
    const firstImage = await canvasHash(page);
    await page.locator('#next-act').click();
    const secondAct = (await page.locator('#current-act').textContent()).trim();
    assert.notEqual(secondAct, firstAct, 'Advancing the act must change the readable scene phase.');
    assert.notEqual(await canvasHash(page), firstImage, 'Advancing a paused act must select a distinct still composition.');
    await stableCanvas(page, 'Selecting a paused act must not start playback.');
    sceneRecords.push({ scene, count, path: flightPath, firstAct, secondAct });
  }
  await page.locator('[data-scene="nectar"]').click();
  await page.locator('#next-act').click();
  for (const [id, name] of [['gather', 'gather'], ['send-breeze', 'breeze'], ['rest', 'rest']]) {
    const before = await canvasHash(page);
    await page.locator(`#${id}`).click();
    await expectCue(page, name);
    assert.notEqual(await canvasHash(page), before, `${name} must select a visibly different paused pose.`);
    await stableCanvas(page, `${name} must not resume a paused canvas.`);
  }
  await page.locator('#release').click();
  await expectPaused(page);
  assert.equal((await page.locator('#cue-state').textContent()).trim(), 'Following the meadow');
  await finishStage(page, 'desktop-director.png', { viewport: { width: 1440, height: 1080 }, initialPixels, scenes: sceneRecords, countBounds: [1, 6], cues: ['gather', 'breeze', 'rest'], overflow: await assertNoOverflow(page) });

  await beginStage('paused-and-keyboard');
  await page.locator('#animal').focus();
  let priorAct = (await page.locator('#current-act').textContent()).trim();
  await page.locator('#animal').press('n');
  assert.notEqual((await page.locator('#current-act').textContent()).trim(), priorAct, 'N on the canvas advances the act.');
  const priorInvitation = await canvasHash(page);
  await page.locator('#animal').press('ArrowRight');
  assert.notEqual(await canvasHash(page), priorInvitation, 'An arrow key moves the deliberate static invitation.');
  await page.locator('#animal').press('b');
  await expectCue(page, 'breeze');
  await page.locator('#animal').press('Escape');
  assert.equal((await page.locator('#cue-state').textContent()).trim(), 'Following the meadow');
  await page.locator('#animal').press('Enter');
  await expectCue(page, 'gather');
  const focusStyle = await page.locator('#animal').evaluate(element => ({ style: getComputedStyle(element).outlineStyle, width: getComputedStyle(element).outlineWidth }));
  assert(focusStyle.style !== 'none' && Number.parseFloat(focusStyle.width) > 0, 'Keyboard focus on the artwork must be visible.');
  await page.locator('#animal').press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'pause', 'Tab must leave the canvas for the next playback control.');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'next-act', 'Playback controls must be reachable in the expected Tab order.');
  await page.locator('#animal').focus();
  await page.locator('#animal').press('Space');
  await poll(async () => (await page.locator('#pause').textContent()).trim() === 'Pause', 'Space on the canvas must resume normal playback.');
  await page.locator('#animal').press('Space');
  await expectPaused(page);
  await page.mouse.move(0, 0);
  await stableCanvas(page, 'Space must pause actual rendered pixels.');
  await page.locator('#count').focus();
  priorAct = (await page.locator('#current-act').textContent()).trim();
  await page.locator('#count').press('n');
  await page.locator('#count').press('Space');
  assert.equal((await page.locator('#current-act').textContent()).trim(), priorAct, 'Scene keyboard shortcuts must not intercept form controls.');
  await expectPaused(page);
  const oldCount = Number(await page.locator('#count').inputValue());
  await page.locator('#count').press('ArrowLeft');
  assert.equal(Number(await page.locator('#count').inputValue()), oldCount - 1, 'Native range arrow-key behavior must remain available.');
  assert.equal((await page.locator('#current-act').textContent()).trim(), priorAct, 'Range interaction must not advance the scene.');
  await page.locator('#reset').click();
  await expectPaused(page);
  await stableCanvas(page, 'Restart must preserve user pause.');
  await page.locator('#capture').click();
  assert.equal(await page.locator('#capture-region').isVisible(), true, 'Plain-text capture must be available.');
  const captured = await page.locator('#text-frame').textContent();
  const lines = captured.split('\n');
  assert.equal(lines.length, 68, 'Desktop capture must preserve its declared row count.');
  assert(lines.every(line => line.length === 144), 'Desktop capture must preserve equal declared column widths.');
  assert(/^[\x20-\x7e\n]+$/.test(captured), 'Logical capture must contain printable ASCII and newlines only.');
  await page.locator('#close-capture').click();
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'capture', 'Closing a capture must return focus to its trigger.');
  await finishStage(page, 'desktop-paused-keyboard.png', { scopedShortcuts: ['arrows', 'Enter', 'B', 'N', 'Space', 'Escape'], tabLeavesCanvas: true, nativeRangeKeys: true, restartPreservesPause: true, asciiGrid: { columns: 144, rows: 68 } });

  await beginStage('reduced-motion');
  // Verify a live preference change as well as a fresh reduced-motion context.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await poll(async () => await page.locator('#pause').isDisabled(), 'Changing system motion preference must disable animated playback.');
  await stableCanvas(page, 'Live reduced-motion preference must keep the canvas static.');
  await context.close();
  context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  page = await context.newPage();
  observePage(page, 'reduced-motion', origin);
  await ready(page, origin);
  assert.equal(await page.locator('#pause').isDisabled(), true, 'Reduced motion must start with playback disabled.');
  assert.equal((await page.locator('#status').textContent()).trim(), 'STILL STUDY');
  await stableCanvas(page, 'Initial reduced-motion poster must not animate.');
  for (const id of ['next-act', 'gather', 'send-breeze', 'rest']) {
    const before = await canvasHash(page);
    await page.locator(`#${id}`).click();
    assert.notEqual(await canvasHash(page), before, `${id} must offer a meaningful reduced-motion still alternative.`);
    assert.equal(await page.locator('#pause').isDisabled(), true, 'A deliberate action must never override reduced motion.');
    await stableCanvas(page, `${id} must remain static with reduced motion.`);
  }
  await page.locator('#animal').focus();
  await page.locator('#animal').press('Space');
  assert.equal(await page.locator('#pause').isDisabled(), true, 'Canvas Space must not override the system motion preference.');
  await stableCanvas(page, 'A reduced-motion playback request must leave the image still.');
  await page.locator('[data-scene="breeze"]').click();
  await page.locator('#reset').click();
  assert.equal(await page.locator('#pause').isDisabled(), true, 'Scene changes and reset must preserve reduced motion.');
  await stableCanvas(page, 'Reset under reduced motion must not start animation.');
  await finishStage(page, 'reduced-motion.png', { freshContext: true, livePreferenceChange: true, stillActions: ['next-act', 'gather', 'breeze', 'rest'], spaceCannotResume: true });
  await context.close();

  await beginStage('mobile-touch');
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  page = await context.newPage();
  observePage(page, 'mobile-touch', origin);
  await ready(page, origin);
  await assertNoOverflow(page);
  assert.equal(await page.locator('#animal').evaluate(element => getComputedStyle(element).touchAction), 'pan-y', 'The artwork must preserve vertical touch scrolling.');
  await page.locator('#pause').tap();
  await expectPaused(page);
  const mobileTouches = [];
  for (const [mode, cueName] of [['attract', 'gather'], ['breeze', 'breeze']]) {
    await page.locator('#pointer-mode').selectOption(mode);
    await page.locator('#animal').scrollIntoViewIfNeeded();
    const bounds = await page.locator('#animal').boundingBox();
    assert(bounds && bounds.width > 0 && bounds.height > 0, 'Touch target must have a real screen rectangle.');
    const before = await canvasHash(page);
    // touchscreen.tap sends a complete real browser touchstart/touchend sequence.
    await page.touchscreen.tap(bounds.x + bounds.width * .58, bounds.y + bounds.height * .42);
    await expectCue(page, cueName);
    await delay(350); // Wait beyond the status interval and after touchend.
    await expectCue(page, cueName);
    assert.notEqual(await canvasHash(page), before, `${mode} tap must change the deliberate static pose.`);
    await stableCanvas(page, 'A completed mobile tap must not resume the paused garden.');
    await expectPaused(page);
    mobileTouches.push({ mode, cue: cueName, retainedAfterTouchend: true });
  }
  await page.locator('#count').focus();
  await page.locator('#count').press('End');
  assert.equal(await page.locator('#roles .role-card').count(), 6, 'All six role controls must be available on mobile.');
  await page.locator('#roles select').last().selectOption('scout');
  assert.equal(await page.locator('#roles select').last().inputValue(), 'scout');
  await page.locator('#animal').focus();
  await page.locator('#animal').press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'pause', 'Mobile layout must preserve keyboard exit and control order.');
  const overflow = await assertNoOverflow(page);
  await page.locator('#animal').scrollIntoViewIfNeeded();
  await finishStage(page, 'mobile-touch.png', { emulation: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, touches: mobileTouches, overflow, sixRoleControls: true, touchAction: 'pan-y', physicalDeviceTest: false });
  assertNoErrors();
  summary.status = 'passed';
} catch (error) {
  summary.status = executionPhase === 'checks' ? 'failed' : 'blocked';
  summary.failure = { phase: executionPhase, message: String(error?.message ?? error).slice(0, 6000) };
  if (activeStage) { activeStage.status = 'failed'; activeStage.error = summary.failure.message; }
  process.exitCode = summary.status === 'blocked' ? 2 : 1;
} finally {
  try { await context?.close(); } catch { /* Browser may have exited during a failure. */ }
  try { await browser?.close(); } catch { /* Preserve the first failure. */ }
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  summary.finishedAt = new Date().toISOString();
  summary.pageErrors = pageErrors;
  summary.networkErrors = networkErrors;
  if (summary.screenshots.length) {
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(path.join(evidenceDirectory, 'browser-validation.json'), `${JSON.stringify(summary, null, 2)}\n`);
  }
  console.log(JSON.stringify(summary, null, 2));
}
