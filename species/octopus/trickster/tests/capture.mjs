#!/usr/bin/env node
/**
 * Repeatable project-browser evidence. This launches a new sandboxed Chromium;
 * it does not attach to a user's browser or claim that the proposal is deployed.
 * Raw canvas screenshots are retained. Comparison sheets are labelled composites
 * of those unmodified screenshots. Motion consists of deterministic browser PNG
 * frames encoded at 30 fps, sampling a 60 Hz simulation at normal elapsed speed.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');
const task = resolve(repo, '..');
const args = new Set(process.argv.slice(2));
const flag = name => process.argv.find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
const output = resolve(flag('--out') || join(task, 'octopus-delivery/evidence'));
const baselineOnly = args.has('--baseline-only');
const skipMotion = args.has('--skip-motion') || baselineOnly;
const skipChecks = args.has('--skip-checks') || baselineOnly;
const origin = flag('--origin') || 'http://127.0.0.1:8817';
const harness = '/ascii-animals/species/octopus/trickster/tests/capture-harness.html';
const viewportCases = [
  { name: 'desktop', width: 960, height: 600 },
  { name: 'phone', width: 390, height: 500 },
];
const surfaces = flag('--surface') ? [flag('--surface')] : ['study', 'gallery'];
const checkpoints = [
  { tick: 60, name: 'idle' },
  { tick: 108, name: 'anticipation' },
  { tick: 150, name: 'reach' },
  { tick: 210, name: 'contact' },
  { tick: 296, name: 'recoil' },
  { tick: 377, name: 'gather' },
  { tick: 414, name: 'hide' },
  { tick: 474, name: 'peek' },
  { tick: 552, name: 'settle' },
  { tick: 650, name: 'restored' },
];
const eventLog = [
  { tick: 90, type: 'invite', x: .70, y: .33 },
  { tick: 280, type: 'release' },
  { tick: 360, type: 'pulse', x: -.5, y: 0 },
];
const manifest = {
  version: 1, createdAt: new Date().toISOString(),
  sourceBase: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  evidenceType: 'Exact-source isolated headless Chromium canvas',
  notEvidenceOf: ['Live deployment', 'Physical phone performance', 'Cross-platform font pixel identity'],
  simulation: { hertz: 60, eventLog, coordinateSpace: 'Candidate world; baseline receives equivalent CSS-pixel pointer positions',
    speed: 1, baselineActionMapping: 'invite: pointermove; release: pointerleave; pulse: pointermove then native pulse()' },
  sources: {}, browser: {}, captures: [], comparisons: [], movies: [], checks: [], warnings: [],
};
for (const relative of ['src/animals/cuttlefish.js', 'src/animals/octopus.js',
  'species/octopus/trickster/core.mjs', 'species/octopus/trickster/render.mjs', 'species/octopus/trickster/browser.mjs']) {
  try { manifest.sources[relative] = createHash('sha256').update(await readFile(join(repo, relative))).digest('hex'); }
  catch { manifest.sources[relative] = null; }
}
await mkdir(output, { recursive: true });
let server, browser;
async function serveIfNeeded() {
  try { const response = await fetch(origin + harness); if (response.ok) return; } catch {}
  const url = new URL(origin), port = Number(url.port || 80);
  server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, origin).pathname);
      const path = resolve(task, '.' + pathname);
      if (!path.startsWith(task + '/')) { res.writeHead(403); res.end(); return; }
      const info = await stat(path), actual = info.isDirectory() ? join(path, 'index.html') : path;
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
        '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
      res.writeHead(200, { 'content-type': types[extname(actual)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(await readFile(actual));
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(port, url.hostname, accept); });
}
const relativePath = path => path.slice(output.length + 1);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const htmlEscape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
async function loadPage(variant, surface, size, extra = {}) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height + 118 },
    deviceScaleFactor: 1, reducedMotion: 'no-preference', hasTouch: size.name === 'phone', ...extra });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const params = new URLSearchParams({ variant, surface, width: String(size.width), height: String(size.height), seed: surface === 'study' ? '17' : '7' });
  await page.goto(origin + harness + '?' + params, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  return { context, page, errors };
}
async function saveCapture(page, surface, size, variant, checkpoint) {
  const state = await page.evaluate(tick => window.capture.advanceTo(tick), checkpoint.tick);
  const filename = `${size.name}-${surface}-${variant}-${checkpoint.name}.png`;
  const bytes = await page.locator('#animal').screenshot({ path: join(output, filename) });
  manifest.captures.push({ file: filename, sha256: digest(bytes), checkpoint: checkpoint.name,
    label: variant === 'candidate' ? checkpoint.name : 'main at same tick', tick: checkpoint.tick,
    elapsedSeconds: checkpoint.tick / 60, cssCanvas: { width: size.width, height: size.height },
    viewport: { width: size.width, height: size.height + 118 }, dpr: 1, surface, variant, state });
  if (checkpoint.name === 'idle') await page.locator('#capture').screenshot({ path: join(output, `${size.name}-${surface}-${variant}-labelled.png`) });
  return filename;
}
async function comparison(files, labels, name, columns, cellWidth, cellHeight, subtitle) {
  const context = await browser.newContext({ viewport: { width: cellWidth * columns, height: Math.min(1600, 68 + Math.ceil(files.length / columns) * (cellHeight + 35)) }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const images = await Promise.all(files.map(async (file, i) => `<figure><figcaption>${htmlEscape(labels[i])}</figcaption><img width="${cellWidth}" height="${cellHeight}" src="data:image/png;base64,${(await readFile(join(output, file))).toString('base64')}" /></figure>`));
  await page.setContent(`<html><head><style>*{box-sizing:border-box}body{margin:0;background:#0b1519;color:#eee7da;font:12px/1.4 ui-monospace,monospace}header{height:68px;padding:14px 17px}header span{display:block;color:#a8b9b9;font-size:10px;margin-top:5px}.grid{display:grid;grid-template-columns:repeat(${columns},${cellWidth}px)}figure{margin:0}figcaption{height:35px;padding:9px 15px;background:#142026}img{display:block;width:${cellWidth}px;height:${cellHeight}px}</style></head><body><header><strong>OCTOPUS · MAIN / ISOLATED PROPOSAL</strong><span>${htmlEscape(subtitle)}</span></header><div class="grid">${images.join('')}</div></body></html>`);
  await page.locator('img').last().waitFor({ state: 'visible' });
  await page.screenshot({ path: join(output, name), fullPage: true });
  manifest.comparisons.push({ file: name, evidenceType: 'Labelled composite of unmodified browser canvas screenshots', files, labels, subtitle });
  await context.close();
}
async function check(name, callback) {
  try { manifest.checks.push({ name, status: 'passed', details: await callback() }); }
  catch (error) { manifest.checks.push({ name, status: 'failed', error: error.stack || String(error) }); }
}
async function browserChecks() {
  const size = viewportCases[1], run = await loadPage('candidate', 'study', size), { page } = run;
  await check('Left and right targets select distinct arms and exact contact', async () => {
    const result = await page.evaluate(() => {
      const a = window.capture.controller;
      return [-.7, .7].map(x => {
        a.restart(); a.setPaused(false); a.invite(x, .33);
        for (let i = 0; i < 120; i++) a.advance(1 / 60);
        const pose = a.getStats().pose, tip = pose.arms[pose.contact.arm]?.tip;
        return { x, stage: pose.stage, contact: pose.contact, tip,
          error: tip ? Math.hypot(tip[0] - x, tip[1] - .33) : null };
      });
    });
    if (result.some(value => value.stage !== 'contact' || value.error !== 0)
      || result[0].contact.arm === result[1].contact.arm) throw new Error(JSON.stringify(result));
    return result;
  });
  await check('Early release changes contact into recoil immediately', async () => {
    const result = await page.evaluate(() => {
      const a = window.capture.controller; a.restart(); a.setPaused(false); a.invite(.7, .33);
      for (let i = 0; i < 100; i++) a.advance(1 / 60);
      const before = a.getStats(); a.release(); a.advance(1 / 60); const after = a.getStats();
      return { before: { tick: before.tick, stage: before.stage, contact: before.pose.contact.active },
        after: { tick: after.tick, stage: after.stage, contact: after.pose.contact.active } };
    });
    if (result.before.stage !== 'contact' || result.after.stage !== 'recoil' || result.after.contact) throw new Error(JSON.stringify(result));
    return result;
  });
  await check('Repeated browser render has identical canvas pixels and fixed tick', async () => {
    await page.evaluate(() => {
      const a = window.capture.controller; a.restart(); a.invite(.7, .33);
      for (let i = 0; i < 120; i++) a.advance(1 / 60);
    });
    const before = await page.evaluate(() => ({ tick: window.capture.controller.getStats().tick, image: window.capture.canvas.toDataURL() }));
    const after = await page.evaluate(() => { for (let i = 0; i < 5; i++) window.capture.controller.render(); return { tick: window.capture.controller.getStats().tick, image: window.capture.canvas.toDataURL() }; });
    if (before.tick !== after.tick || before.image !== after.image) throw new Error('An unchanged instant changed during render.');
    return { tick: before.tick, identical: true };
  });
  await check('Trusted keyboard input reaches canvas adapter', async () => {
    await page.evaluate(() => { window.capture.controller.restart(); window.capture.controller.setPaused(false); });
    await page.locator('#animal').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
    await page.evaluate(() => { for (let i = 0; i < 120; i++) window.capture.controller.advance(1 / 60); });
    const stats = await page.evaluate(() => window.capture.controller.getStats());
    if (stats.stage === 'idle') throw new Error('Keyboard invitation did not leave idle.');
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.capture.controller.advance(1 / 60));
    const released = await page.evaluate(() => window.capture.controller.getStats());
    return { requested: stats.stage, released: released.stage, tick: released.tick };
  });
  await check('Trusted touch input reaches canvas adapter', async () => {
    await page.evaluate(() => { window.capture.controller.restart(); window.capture.controller.setPaused(false); });
    const point = await page.evaluate(() => window.capture.screenPoint(.70, .33));
    await page.touchscreen.tap(point.x, point.y);
    await page.evaluate(() => { for (let i = 0; i < 120; i++) window.capture.controller.advance(1 / 60); });
    const stats = await page.evaluate(() => window.capture.controller.getStats());
    if (stats.stage === 'idle') throw new Error('Touch did not start an interaction.');
    return { stage: stats.stage, tick: stats.tick, point };
  });
  await check('User pause blocks action-driven animation', async () => {
    const result = await page.evaluate(() => {
      const a = window.capture.controller; a.setPaused(true); const before = a.getStats();
      a.invite(-.5, .3); a.pulse(.4, 0); a.advance(2); a.render(); const after = a.getStats();
      return { beforeTick: before.tick, afterTick: after.tick, paused: after.paused, running: after.running };
    });
    if (result.beforeTick !== result.afterTick || !result.paused || result.running) throw new Error(JSON.stringify(result));
    return result;
  });
  await check('IntersectionObserver suspends real scheduler offscreen and resumes without catch-up', async () => {
    await page.evaluate(() => {
      const a = window.capture.controller; a.restart(); a.setPaused(false); a.setOptions({ autoStart: true });
      window.capture.canvas.style.marginTop = '3000px';
    });
    await page.waitForFunction(() => window.capture.controller.getStats().pauseReasons.offscreen);
    const before = await page.evaluate(() => window.capture.controller.getStats());
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => window.capture.controller.getStats());
    if (before.tick !== after.tick || after.running) throw new Error('Offscreen simulation continued.');
    await page.evaluate(() => { window.capture.canvas.style.marginTop = '0px'; });
    await page.waitForFunction(() => window.capture.controller.getStats().running);
    const resumed = await page.evaluate(() => window.capture.controller.getStats());
    if (resumed.tick - after.tick > 5) throw new Error('Resume attempted an unbounded catch-up.');
    await page.evaluate(() => window.capture.controller.setOptions({ autoStart: false }));
    return { suspendedAtTick: after.tick, runningWhileHidden: after.running, firstResumedTick: resumed.tick };
  });
  await check('Real reduced-motion media query latches a still until explicit Play', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const before = await page.evaluate(() => {
      const a = window.capture.controller; a.restart(); a.setOptions({ reducedMotion: 'system', autoStart: true }); return a.getStats();
    });
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => {
      const a = window.capture.controller; a.invite(.7, .33); a.pulse(-.5, 0); a.advance(1); return a.getStats();
    });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const changed = await page.evaluate(() => window.capture.controller.getStats());
    if (!before.paused || before.tick !== after.tick || after.running || !changed.paused || changed.running) throw new Error('Reduced-motion hold was not preserved.');
    return { beforeTick: before.tick, afterTick: after.tick, pausedAfterPreferenceClears: changed.paused };
  });
  await check('Double disposal is safe in Chromium', async () => {
    const result = await page.evaluate(() => {
      const a = window.capture.controller; a.dispose(); a.dispose(); a.invite(.2, .2); a.advance(1); a.render(); return a.getStats();
    });
    if (result.running) throw new Error('Disposed controller remains scheduled.');
    return { running: result.running, destroyed: result.destroyed, disposed: result.disposed };
  });
  if (run.errors.length) manifest.warnings.push({ kind: 'browser-page-errors', route: 'candidate-checks', errors: run.errors });
  await run.context.close();
}
async function movie(size) {
  const variant = 'candidate', surface = 'study', run = await loadPage(variant, surface, size);
  const dir = join(output, `motion-frames-${size.name}`); await mkdir(dir, { recursive: true });
  const finalTick = 660, step = 2;
  for (let tick = 0, index = 0; tick <= finalTick; tick += step, index++) {
    await run.page.evaluate(value => window.capture.advanceTo(value), tick);
    await run.page.locator('#animal').screenshot({ path: join(dir, String(index).padStart(4, '0') + '.png') });
  }
  const name = `octopus-${size.name}-browser-replay-30fps.mp4`;
  await new Promise((accept, reject) => {
    const process = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '30', '-i', join(dir, '%04d.png'),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(output, name)], { stdio: ['ignore', 'ignore', 'pipe'] });
    let errors = ''; process.stderr.on('data', chunk => errors += chunk); process.on('error', reject);
    process.on('exit', code => code === 0 ? accept() : reject(new Error(errors || `ffmpeg exited ${code}`)));
  });
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,width,height,r_frame_rate,nb_frames', '-of', 'json', join(output, name)], { encoding: 'utf8' }));
  manifest.movies.push({ file: name, frameDirectory: relativePath(dir), evidenceType: 'Deterministic real-Chromium canvas frames; normal-speed 30 fps encoding of 60 Hz state',
    liveWallClockCapture: false, simulationHz: 60, framesPerSecond: 30, firstTick: 0, finalTick, sourceFrames: finalTick / step + 1, probe });
  await run.context.close();
}

try {
  await serveIfNeeded();
  let playwright;
  const modulePath = flag('--playwright');
  if (modulePath) playwright = await import(pathToFileURL(resolve(modulePath)).href);
  else {
    try { playwright = await import('playwright'); }
    catch (error) {
      const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
      if (!runtime) throw new Error('Install Playwright as an external review dependency, or pass --playwright=/absolute/path/to/playwright/index.mjs', { cause: error });
      playwright = await import(pathToFileURL(join(runtime, 'playwright/index.mjs')).href);
    }
  }
  const { chromium } = playwright;
  const executablePath = flag('--chromium') || process.env.CHROMIUM_EXECUTABLE ||
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true, chromiumSandbox: true });
  manifest.browser = { engine: 'Chromium', version: browser.version(), executablePath: executablePath || chromium.executablePath(), headless: true,
    chromiumSandbox: true, additionalLaunchArguments: [], isolatedProjectBrowser: true };
  for (const surface of surfaces) for (const size of viewportCases) {
    const variants = baselineOnly ? ['baseline'] : ['baseline', 'candidate'];
    const groups = {};
    for (const variant of variants) {
      const run = await loadPage(variant, surface, size); groups[variant] = [];
      for (const checkpoint of checkpoints) groups[variant].push(await saveCapture(run.page, surface, size, variant, checkpoint));
      if (run.errors.length) manifest.warnings.push({ kind: 'browser-page-errors', surface, size: size.name, variant, errors: run.errors });
      await run.context.close();
    }
    if (!baselineOnly) {
      for (const index of [0, 3, 7]) await comparison([groups.baseline[index], groups.candidate[index]],
        [`MAIN · tick ${checkpoints[index].tick}`, `PROPOSAL · ${checkpoints[index].name}`], `${size.name}-${surface}-before-after-${checkpoints[index].name}.png`, 2, size.width, size.height,
        `Matched ${size.width} × ${size.height} canvases · seed ${surface === 'study' ? 17 : 7} · tick ${checkpoints[index].tick} · source configuration, not live-gallery UI`);
      if (surface === 'study') await comparison(groups.candidate, checkpoints.map(point => `${point.name} · ${(point.tick / 60).toFixed(2)} s`),
        `${size.name}-candidate-motion-sheet.png`, 5, Math.round(size.width / (size.name === 'desktop' ? 3 : 1.5)), Math.round(size.height / (size.name === 'desktop' ? 3 : 1.5)),
        'Selected actual browser canvas states · raw full-resolution frames supplied separately');
    }
  }
  if (!skipChecks) await browserChecks();
  if (!skipMotion) for (const size of viewportCases) await movie(size);
  manifest.completed = true;
} catch (error) {
  manifest.completed = false; manifest.error = error.stack || String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(accept => server ? server.close(accept) : accept());
  await writeFile(join(output, baselineOnly ? 'baseline-browser-manifest.json' : 'browser-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ completed: manifest.completed, output, captures: manifest.captures.length, comparisons: manifest.comparisons.length,
    movies: manifest.movies.length, checks: manifest.checks.map(({ name, status }) => ({ name, status })), error: manifest.error?.split('\n')[0] }, null, 2));
}
