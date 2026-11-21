#!/usr/bin/env node
// Run against a clean consumer that installed the exact locally packed candidate.
// Usage: node docs/verify-browser.mjs --consumer /absolute/consumer --output /absolute/evidence --tarball /absolute/package.tgz
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { values } = parseArgs({ options: {
  consumer: { type: 'string' }, output: { type: 'string' }, tarball: { type: 'string' }, executable: { type: 'string' },
} });
if (!values.consumer || !values.output || !values.tarball) {
  throw new Error('Supply --consumer, --output, and --tarball absolute paths. Install Playwright and its Chromium browser first.');
}
const consumer = path.resolve(values.consumer), output = path.resolve(values.output);
await mkdir(output, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const tarball = await readFile(values.tarball);
const packageRoot = path.join(consumer, 'node_modules/ascii-animals-review');
const metadata = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
assert.equal(metadata.name, 'ascii-animals-review');
assert.equal(metadata.version, '0.0.0-review.0');
const engine = await readFile(path.join(packageRoot, 'lib/animals/cuttlefish.js'));
const packedEngine = execFileSync('tar', ['-xOf', values.tarball, 'package/lib/animals/cuttlefish.js']);
assert.equal(hash(engine), hash(packedEngine), 'Installed marine renderer must equal the requested tarball');

const record = {
  checkedAt: new Date().toISOString(), package: `${metadata.name}@${metadata.version}`,
  tarballSha256: hash(tarball), marineRendererSha256: hash(engine),
  browser: null, tests: [], screenshots: [], pageErrors: [], status: 'running',
  boundaries: [
    'Chromium desktop and mobile emulation; not physical-device, screen-reader or other-engine acceptance.',
    'BFCache checks require actual persisted pageshow events; synthetic lifecycle events are not used.',
    'Controller observations use the installed package public APIs; no renderer, Canvas, observer or timer mocks.',
  ],
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    if (pathname === '/away.html') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><title>Lifecycle navigation target</title><p>Navigate back to the example.</p>');
      return;
    }
    const resolved = path.resolve(consumer, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!resolved.startsWith(`${consumer}${path.sep}`) || !(await stat(resolved)).isFile()) {
      response.writeHead(404); response.end('Not found'); return;
    }
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
    response.writeHead(200, { 'content-type': `${mime[path.extname(resolved)] ?? 'application/octet-stream'}; charset=utf-8` });
    response.end(await readFile(resolved));
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;

async function check(name, run) {
  try {
    const detail = await run();
    record.tests.push({ name, status: 'passed', ...(detail === undefined ? {} : { detail }) });
  } catch (error) {
    record.tests.push({ name, status: 'failed', error: String(error.stack ?? error) });
    throw error;
  }
}

async function observe(page, kind) {
  return page.evaluate(async type => {
    const module = await import(type === 'basic' ? './basic.js' : './director.js');
    const artwork = module.mount();
    window.__docsArtwork = artwork;
    return { stats: artwork.getStats(), director: type === 'director' ? artwork.getDirector() : null };
  }, kind);
}

async function pixels(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set();
    for (let i = 0; i < data.length; i += 16) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`);
    return { width: canvas.width, height: canvas.height, colors: colors.size };
  });
}

async function screenshot(page, filename) {
  await page.screenshot({ path: path.join(output, filename), fullPage: true });
  record.screenshots.push(filename);
}

async function restoreFromCache(page, changeMotion) {
  const returnUrl = page.url();
  await page.goto(`${origin}/away.html`);
  if (changeMotion) await page.emulateMedia({ reducedMotion: changeMotion });
  // A restored document resumes at pageshow, without a new load event.
  await page.evaluate(() => history.back());
  await page.waitForURL(returnUrl, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__lastPageShowPersisted === true, undefined, { timeout: 10000 });
  assert.equal(await page.evaluate(() => window.__lastPageShowPersisted), true,
    'Must observe actual BFCache restoration, not a reload or synthetic event');
}

try {
  const executablePath = values.executable ?? process.env.ASCII_CHROMIUM;
  browser = await chromium.launch({ headless: true, chromiumSandbox: true,
    ...(executablePath ? { executablePath } : { channel: 'chromium' }),
    ignoreDefaultArgs: ['--disable-back-forward-cache'] });
  record.browser = browser.version();
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' });
  await desktop.addInitScript(() => {
    window.addEventListener('pageshow', event => { window.__lastPageShowPersisted = event.persisted; });
  });
  const page = await desktop.newPage();
  page.on('pageerror', error => record.pageErrors.push(String(error)));
  page.setDefaultTimeout(10000);
  await page.goto(origin);
  await page.locator('#status').filter({ hasText: 'Mounted' }).waitFor();
  await observe(page, 'basic');
  await check('Basic: native Canvas render and automatic time', async () => {
    await page.waitForFunction(() => window.__docsArtwork.getStats().time > 0.1);
    const image = await pixels(page);
    assert.ok(image.width > 0 && image.height > 0 && image.colors > 10, JSON.stringify(image));
    return image;
  });
  await check('Basic: native keyboard Pause, Startle while paused, and Play', async () => {
    await page.locator('#play').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'pause');
    await page.keyboard.press('Enter');
    const before = await observe(page, 'basic');
    assert.equal(before.stats.paused, true);
    await page.locator('#action').focus();
    await page.keyboard.press('Enter');
    assert.equal((await observe(page, 'basic')).stats.time, before.stats.time);
    await screenshot(page, 'basic-desktop.png');
    await page.locator('#play').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(time => window.__docsArtwork.getStats().time > time, before.stats.time);
  });
  await check('Basic: OS motion changes pause, update status and do not auto-resume', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => window.__docsArtwork.getStats().paused);
    assert.match(await page.locator('#status').innerText(), /paused/);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    assert.equal((await observe(page, 'basic')).stats.paused, true);
  });
  await check('Basic: viewport resize and actual zero-size recovery', async () => {
    await page.setViewportSize({ width: 720, height: 800 });
    await page.waitForFunction(() => window.__docsArtwork.getStats().width === document.querySelector('canvas').getBoundingClientRect().width);
    await page.locator('canvas').evaluate(canvas => { canvas.style.display = 'none'; });
    await page.waitForFunction(() => window.__docsArtwork.getStats().width === 0 && !window.__docsArtwork.getStats().running);
    await page.locator('canvas').evaluate(canvas => { canvas.style.display = ''; });
    await page.waitForFunction(() => window.__docsArtwork.getStats().width > 0);
    assert.ok((await pixels(page)).colors > 10);
    await page.setViewportSize({ width: 1280, height: 900 });
  });
  await check('Basic: disposal and fresh remount', async () => {
    await page.locator('#dispose').click();
    assert.equal(await page.evaluate(() => window.__docsArtwork.disposed), true);
    assert.equal(await page.evaluate(() => window.__docsArtwork.getStats().running), false);
    assert.equal(await page.locator('#play').isDisabled(), true);
    await page.evaluate(() => { window.__previousArtwork = window.__docsArtwork; });
    await page.locator('#mount').click();
    await observe(page, 'basic');
    assert.equal(await page.evaluate(() => window.__previousArtwork !== window.__docsArtwork), true);
  });
  await check('Basic: actual BFCache preserves Pause', async () => {
    await page.locator('#pause').click();
    await restoreFromCache(page);
    assert.equal((await observe(page, 'basic')).stats.paused, true);
    return { persisted: true };
  });
  await check('Basic: actual BFCache preserves explicit disposal', async () => {
    await page.locator('#dispose').click();
    await restoreFromCache(page);
    assert.equal(await page.locator('#mount').isEnabled(), true);
    assert.match(await page.locator('#status').innerText(), /^Disposed/);
    return { persisted: true };
  });
  await check('Basic: actual BFCache does not override newly active reduced motion', async () => {
    await page.locator('#mount').click();
    await page.locator('#play').click();
    await restoreFromCache(page, 'reduce');
    assert.equal((await observe(page, 'basic')).stats.paused, true);
    return { persisted: true };
  });

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${origin}/director.html`);
  await page.locator('#status').filter({ hasText: 'Explore still' }).waitFor();
  await observe(page, 'director');
  await check('Director: paused initial render and native keyboard invitations keep octopus identity', async () => {
    const before = await observe(page, 'director');
    assert.equal(before.stats.paused, true);
    assert.ok((await pixels(page)).colors > 10);
    await page.evaluate(() => window.__docsArtwork.setDirector({ focus: 1 }));
    await page.locator('#invite-left').focus();
    await page.keyboard.press('Enter');
    const left = await observe(page, 'director');
    assert.equal(left.director.focused, 2); assert.equal(left.director.cue.x, -0.3);
    assert.equal(left.director.members.find(member => member.id === 2).species, 'octopus');
    assert.equal(left.stats.paused, true); assert.equal(left.stats.time, before.stats.time);
    await page.evaluate(() => window.__docsArtwork.setDirector({ focus: 3 }));
    await page.locator('#invite-right').focus();
    await page.keyboard.press('Enter');
    const right = await observe(page, 'director');
    assert.equal(right.director.focused, 2); assert.equal(right.director.cue.x, 0.3);
    assert.equal(right.stats.time, before.stats.time);
    await screenshot(page, 'director-desktop.png');
    await page.locator('#release').click();
    const released = await observe(page, 'director');
    assert.equal(released.director.cue.active, false); assert.equal(released.director.cue.interest, 0);
    return { left: left.director.cue, right: right.director.cue, focused: 2, species: 'octopus' };
  });
  await check('Director: paused disturbance does not play; explicit Play enables octopus reaction', async () => {
    await page.locator('#disturb').click();
    assert.equal((await observe(page, 'director')).stats.paused, true);
    await page.locator('#play').click();
    await page.locator('#disturb').click();
    assert.notEqual((await observe(page, 'director')).stats.fish.find(fish => fish.id === 2).reactionStage, 'idle');
  });
  await check('Director: actual BFCache preserves playing state', async () => {
    await restoreFromCache(page);
    assert.equal((await observe(page, 'director')).stats.paused, false);
    return { persisted: true };
  });
  await check('Director: actual BFCache preserves Pause and explicit disposal', async () => {
    await page.locator('#pause').click();
    await restoreFromCache(page);
    assert.equal((await observe(page, 'director')).stats.paused, true);
    await page.locator('#dispose').click();
    await restoreFromCache(page);
    assert.equal(await page.locator('#mount').isEnabled(), true);
    assert.match(await page.locator('#status').innerText(), /^Disposed/);
    return { persisted: true };
  });
  await check('Director: actual BFCache respects newly active reduced motion', async () => {
    await page.locator('#mount').click(); await page.locator('#play').click();
    await restoreFromCache(page, 'reduce');
    assert.equal((await observe(page, 'director')).stats.paused, true);
    return { persisted: true };
  });
  await desktop.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const mobile = await phone.newPage();
  mobile.on('pageerror', error => record.pageErrors.push(String(error)));
  mobile.setDefaultTimeout(10000);
  await mobile.goto(origin);
  await mobile.locator('#status').filter({ hasText: 'Mounted' }).waitFor();
  await check('Phone basic: initial reduced motion, native touch buttons and canvas pointer delivery', async () => {
    assert.equal((await observe(mobile, 'basic')).stats.paused, true);
    await mobile.locator('#action').tap();
    assert.equal((await observe(mobile, 'basic')).stats.paused, true);
    await mobile.locator('#play').tap();
    await mobile.waitForFunction(() => window.__docsArtwork.getStats().time > 0.1);
    await mobile.locator('canvas').evaluate(canvas => {
      canvas.addEventListener('pointerdown', event => { window.__touchPointerType = event.pointerType; }, { once: true });
    });
    await mobile.locator('canvas').tap();
    assert.equal(await mobile.evaluate(() => window.__touchPointerType), 'touch');
    await mobile.locator('#pause').tap();
    assert.equal((await observe(mobile, 'basic')).stats.paused, true);
    assert.ok((await pixels(mobile)).colors > 10);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await screenshot(mobile, 'basic-phone.png');
  });
  await mobile.goto(`${origin}/director.html`);
  await mobile.locator('#status').filter({ hasText: 'Explore still' }).waitFor();
  await check('Phone director: native touch invitation and release while paused', async () => {
    const initial = await observe(mobile, 'director');
    await mobile.locator('#invite-left').tap();
    const left = await observe(mobile, 'director');
    assert.equal(left.director.cue.x, -0.3); assert.equal(left.director.focused, 2);
    assert.equal(left.stats.paused, true); assert.equal(left.stats.time, initial.stats.time);
    await mobile.locator('#invite-right').tap();
    assert.equal((await observe(mobile, 'director')).director.cue.x, 0.3);
    assert.ok((await pixels(mobile)).colors > 10);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await screenshot(mobile, 'director-phone.png');
    await mobile.locator('#release').tap();
    assert.equal((await observe(mobile, 'director')).director.cue.active, false);
    await mobile.locator('#dispose').tap();
    assert.equal(await mobile.evaluate(() => window.__docsArtwork.destroyed), true);
    await mobile.locator('#mount').tap();
    assert.equal((await observe(mobile, 'director')).stats.paused, true);
  });
  await phone.close();
  await check('All native browser sessions: no uncaught page exceptions', async () => assert.deepEqual(record.pageErrors, []));
  record.status = 'passed';
} catch (error) {
  record.status = 'failed'; record.error = String(error.stack ?? error); process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(output, 'browser-validation.json'), `${JSON.stringify(record, null, 2)}\n`);
  console.log(JSON.stringify({ status: record.status, browser: record.browser,
    passed: record.tests.filter(test => test.status === 'passed').length,
    failed: record.tests.filter(test => test.status === 'failed').map(test => test.name),
    output, error: record.error }));
}
