#!/usr/bin/env node
/** Reproducible real-Chromium evidence from freshly built package modules.
 * Usage: node species/pufferfish/scripts/review-uplift.mjs --root=/absolute/repo --out=/absolute/output [--quick]
 * The normal demo uses a held requestAnimationFrame clock for matched tick-zero
 * entry captures. Specimen captures use the public pure model and the actual
 * canonical painter in Chromium at explicit 60 Hz simulation ticks. They are
 * browser Canvas screenshots, not native Canvas output or real-time profiling.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ownRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  if (arg === '--quick') return ['quick', true];
  const match = /^--(root|out|tag)=(.+)$/.exec(arg);
  if (!match) throw new Error(`Unknown argument ${arg}`);
  return [match[1], match[2]];
}));
const root = path.resolve(args.root ?? ownRoot);
const output = path.resolve(args.out ?? path.join(ownRoot, 'species/pufferfish/evidence/uplift', args.tag ?? 'candidate'));
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch {
  const dependencyRoot = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if (!dependencyRoot) throw new Error('Install Playwright or set CODEX_PRIMARY_RUNTIME_NODE_MODULES.');
  playwright = require(path.join(dependencyRoot, 'playwright'));
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(output, { recursive: true });
const sourcePaths = (await readdir(path.join(root, 'species/pufferfish/src')))
  .filter(name => name.endsWith('.ts')).map(name => `species/pufferfish/src/${name}`);
sourcePaths.push('src/animals/cuttlefish.js', 'src/public/pufferfish.ts',
  'lib/animals/cuttlefish.js', 'lib/public/pufferfish.js', 'species/pufferfish/index.html', 'species/pufferfish/style.css');
for(const name of (await readdir(path.join(root,'lib/species/pufferfish'))).filter(name=>name.endsWith('.js')))
  sourcePaths.push(`lib/species/pufferfish/${name}`);
const sourceHashes = Object.fromEntries(await Promise.all(sourcePaths.map(async file => [file, hash(await readFile(path.join(root, file)))])));
assert.equal(sourceHashes['src/animals/cuttlefish.js'], sourceHashes['lib/animals/cuttlefish.js'], 'Built canonical renderer must match source');
for(const name of (await readdir(path.join(root,'lib/species/pufferfish'))).filter(name=>name.endsWith('.js')))
  assert.equal(hash(await readFile(path.join(root,'species/pufferfish/build',name))),sourceHashes[`lib/species/pufferfish/${name}`],`Species compiler output must equal package module ${name}`);

const fixture = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Pufferfish package review</title>
<style>html,body{margin:0;background:#080d0f;width:100%;height:100%;overflow:hidden}canvas{display:block;width:100vw;height:100vh;touch-action:pan-y}canvas:focus-visible{outline:2px solid #e5d68d;outline-offset:-3px}</style>
<canvas id="specimen" tabindex="0" role="img" aria-label="Interactive pufferfish review"></canvas>
<script type="module">
import { createPufferfishArtwork } from '/lib/public/pufferfish.js';
import { createPufferfishDirector, stepPufferfishDirector } from '/lib/species/pufferfish/director.js';
import { createPufferfishPainter } from '/lib/species/pufferfish/legacy-painter.js';
import { CuttlefishArtwork } from '/lib/animals/cuttlefish.js';
const canvas=document.getElementById('specimen');
let painter=null,scene=null,controller=null,clock=0;
const subscribers=new Set();
const frameSource={subscribe(callback){subscribers.add(callback);return()=>subscribers.delete(callback)}};
window.review={
  initialize(options={}){
    controller?.dispose();controller=null;painter?.dispose();painter=null;
    scene=createPufferfishDirector({scene:'current',count:1,roles:['drifter'],labels:false,...options.director},{seed:23,...options.species});
    painter=createPufferfishPainter(canvas,CuttlefishArtwork,{quality:'fine',view:'right',...options.render});
    const r=canvas.getBoundingClientRect();painter.resize(r.width,r.height,devicePixelRatio);
    return this.draw();
  },
  stepTo(tick,events=[]){while(scene.tick<tick){const next=scene.tick+1;scene=stepPufferfishDirector(scene,{tick:next,events:events.filter(event=>event.tick===next)}).state}return this.draw()},
  draw(){const frame=painter.drawScene(scene,false);return {scene,frame}},
  mount(options={}){
    painter?.dispose();painter=null;controller?.dispose();subscribers.clear();clock=0;
    controller=createPufferfishArtwork(canvas,{species:{seed:23},director:{scene:'reef',count:2,labels:false},render:{quality:'fine'},frameSource,...options});
    return this.status();
  },
  advance(count=1){for(let i=0;i<count;i++){clock+=1000/60;for(const callback of [...subscribers])callback(clock)}return this.status()},
  status(){return {status:controller?.getStatus(),snapshot:controller?.getDirectorSnapshot(),subscriptions:subscribers.size,text:controller?.exportText()}},
  call(method,...args){const result=controller[method](...args);return {result,...this.status()}},
  pickPoint(id){
    const probe=document.createElement('canvas');const p=createPufferfishPainter(probe,CuttlefishArtwork,{quality:'fine'});
    const box=canvas.getBoundingClientRect();p.resize(box.width,box.height,devicePixelRatio);
    const frame=p.drawScene(controller.getDirectorSnapshot(),true);
    try{for(let row=0;row<frame.rows;row++)for(let col=0;col<frame.cols;col++){
      const x=(col+.5)/frame.cols*2-1,y=(row+.5)/frame.rows*2-1;
      if(p.hitActor(x,y)===id)return{x:box.left+(x+1)*box.width/2,y:box.top+(y+1)*box.height/2};
    }}finally{p.dispose()}throw new Error('No visible owner cell for actor '+id);
  },
  dispose(){controller?.dispose();return this.status()},
};
window.reviewReady=true;
</script></html>`;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/__pufferfish_review') { response.setHeader('content-type', 'text/html'); response.end(fixture); return; }
    let file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(`${root}${path.sep}`) && file !== root) { response.writeHead(403).end(); return; }
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    response.setHeader('content-type', mime[path.extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(response);
  } catch { response.writeHead(404).end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const executablePath = process.env.PUFFERFISH_CHROMIUM ?? '/usr/bin/chromium';
const browser = await playwright.chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
const browserErrors = [], captures = [], checks = [];
const environment = { browser: await browser.version(), executablePath, node: process.version, deviceScaleFactor: 1,
  rendering: 'Real headless Chromium Canvas2D; no native Canvas library',
  timing: 'Explicit deterministic 60 Hz model ticks; entry pages hold requestAnimationFrame at initial state. No real-time FPS claim.' };
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
function monitor(page) { page.on('pageerror', error => browserErrors.push(error.message)); }
async function record(page, file, details) {
  const png = await page.screenshot({ path: path.join(output, file), fullPage: details.entry ?? false });
  captures.push({ file, ...details, pngSha256: hash(png) });
}
try {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 1100 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: name === 'phone', isMobile: name === 'phone' });
    const page = await context.newPage(); monitor(page);
    await page.addInitScript(() => { let id=0;const callbacks=new Map();window.requestAnimationFrame=callback=>{callbacks.set(++id,callback);return id};window.cancelAnimationFrame=key=>callbacks.delete(key); });
    await page.goto(`${base}/dist/pufferfish/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('#pufferfish')?.width > 1 && document.querySelector('#fallback')?.hidden === true, null, { polling: 50 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} entry must not overflow horizontally`);
    await record(page, `entry-${name}.png`, { entry: true, viewport, name, tick: 0, scene: 'reef' });
    await page.locator('#pufferfish').screenshot({ path: path.join(output, `entry-${name}-canvas.png`) });
    await context.close();
  }
  const events = [{ tick: 121, seq: 0, type: 'approach' }, { tick: 271, seq: 1, type: 'retreat' }];
  for (const [name, viewport] of [['desktop', { width: 1200, height: 675 }], ['phone', { width: 390, height: 520 }]]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage(); monitor(page);
    await page.goto(`${base}/__pufferfish_review`); await page.waitForFunction(() => window.reviewReady);
    await page.evaluate(() => window.review.initialize());
    for (const tick of [0,120,138,174,240,288,330,385,440,640]) {
      const sampled = await page.evaluate(({tick,events}) => window.review.stepTo(tick,events), {tick,events});
      const { scene, frame } = sampled;
      assert(frame.samples <= 16000 && frame.cols <= 160 && frame.rows <= 90);
      assert.match(frame.text, /^[\x20-\x7e\n]+$/);
      await record(page, `encounter-${name}-${String(tick).padStart(4,'0')}.png`, { viewport, tick,
        scene: scene.config.scene, beat: scene.beat.kind, events, stateSha256: hash(JSON.stringify(scene)),
        cellsSha256: hash(frame.text), samples: frame.samples, glyphs: frame.glyphs,
        actors: scene.actors.map(actor => ({ id: actor.id, phase: actor.state.phase, inflation: actor.state.inflation,
          x: actor.x, y: actor.y, yaw: actor.yaw, finEffort: actor.finEffort, motive: actor.motive })) });
    }
    if (!args.quick && name === 'desktop') {
      const frameDir = path.join(output, 'motion-frames'); await mkdir(frameDir, { recursive: true });
      await page.evaluate(() => window.review.initialize());
      for (let tick=0,index=0;tick<=720;tick+=4,index++) {
        await page.evaluate(({tick,events})=>window.review.stepTo(tick,events),{tick,events});
        await page.screenshot({path:path.join(frameDir,`${String(index).padStart(4,'0')}.png`)});
      }
    }
    await context.close();
  }
  {
    const context=await browser.newContext({viewport:{width:960,height:640},deviceScaleFactor:1,hasTouch:true});
    const page=await context.newPage();monitor(page);
    await page.goto(`${base}/__pufferfish_review`);await page.waitForFunction(()=>window.reviewReady);
    const initial=await page.evaluate(()=>window.review.mount());
    assert.equal(initial.status.running,true);assert.equal(initial.subscriptions,1);
    await page.locator('canvas').focus();await page.keyboard.press('2');
    assert.equal((await page.evaluate(()=>window.review.status())).snapshot.selected,1);
    await page.keyboard.press('i');await page.evaluate(()=>window.review.advance(3));
    assert.equal((await page.evaluate(()=>window.review.status())).snapshot.invitation.id,1);
    await page.keyboard.press('Escape');await page.evaluate(()=>window.review.advance(2));
    assert.equal((await page.evaluate(()=>window.review.status())).snapshot.invitation,null);
    await page.keyboard.press('a');await page.evaluate(()=>window.review.advance(45));
    const response=await page.evaluate(()=>window.review.status());
    assert.equal(response.snapshot.actors[1].state.reactions,1);
    assert.equal(response.snapshot.actors[0].state.reactions,0);
    checks.push('Real Chromium keyboard selection/invitation/retreat/selected-only approach');
    await page.keyboard.press('Space');
    const paused=await page.evaluate(()=>window.review.status());
    assert.equal(paused.status.userPaused,true);assert.equal(paused.subscriptions,0);
    await page.keyboard.press('a');await page.evaluate(()=>window.review.advance(60));
    const poster=await page.evaluate(()=>window.review.status());
    assert.equal(poster.status.phase,'holding');assert.equal(poster.snapshot.tick,paused.snapshot.tick);
    await page.keyboard.press('r');
    assert.equal((await page.evaluate(()=>window.review.status())).status.userPaused,true);
    assert.equal((await page.evaluate(()=>window.review.status())).snapshot.tick,0);
    checks.push('Paused static inflation, no hidden ticks, reset preserves pause');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>window.review.status().status.reducedMotion);
    await page.keyboard.press('Space');await page.keyboard.press('a');
    await page.evaluate(()=>window.review.advance(60));
    const reduced=await page.evaluate(()=>window.review.status());
    assert.equal(reduced.status.userPaused,false);assert.equal(reduced.status.running,false);
    assert.equal(reduced.status.phase,'holding');assert.equal(reduced.snapshot.tick,0);assert.equal(reduced.subscriptions,0);
    checks.push('Live reduced-motion preference is authoritative after play and deliberate action');
    await page.keyboard.press('Escape');
    await page.evaluate(()=>window.review.call('selectActor',0));
    const hit=await page.evaluate(()=>window.review.pickPoint(1));
    await page.touchscreen.tap(hit.x,hit.y);
    assert.equal((await page.evaluate(()=>window.review.status())).snapshot.selected,1);
    await page.touchscreen.tap(8,8);
    assert.equal((await page.evaluate(()=>window.review.status())).status.director.actors[1].motive,'invited');
    assert.equal((await page.evaluate(()=>window.review.status())).snapshot.tick,0);
    checks.push('Chromium emulated touch selects an actual visible owner cell; empty water invites without advancing reduced-motion time');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.setViewportSize({width:340,height:520});
    await page.waitForFunction(()=>window.review.status().status.compact);
    assert.equal((await page.evaluate(()=>window.review.call('approach'))).result.kind,'static-poster');
    assert.equal((await page.evaluate(()=>window.review.status())).subscriptions,0);
    await page.setViewportSize({width:390,height:520});
    await page.waitForFunction(()=>!window.review.status().status.compact);
    assert.equal((await page.evaluate(()=>window.review.status())).subscriptions,1);
    await page.locator('canvas').evaluate(canvas=>canvas.style.width='0px');
    await page.waitForFunction(()=>window.review.status().status.zeroSized);
    assert.equal((await page.evaluate(()=>window.review.status())).subscriptions,0);
    await page.locator('canvas').evaluate(canvas=>canvas.style.width='100vw');
    await page.waitForFunction(()=>!window.review.status().status.zeroSized);
    assert.equal((await page.evaluate(()=>window.review.status())).subscriptions,1);
    checks.push('ResizeObserver compact, zero-size and restored-size subscription lifecycle');
    const disposed=await page.evaluate(()=>window.review.dispose());
    assert.equal(disposed.status.destroyed,true);assert.equal(disposed.subscriptions,0);
    await page.evaluate(()=>window.review.advance(60));
    assert.equal((await page.evaluate(()=>window.review.status())).snapshot.tick,disposed.snapshot.tick);
    checks.push('Public factory disposal releases borrowed subscription and stale frame ticks do not restart work');
    await context.close();
  }
  assert.deepEqual(browserErrors, [], 'No browser page errors during capture');
} finally { await browser.close(); server.close(); }
for(const [file,expected]of Object.entries(sourceHashes))
  assert.equal(hash(await readFile(path.join(root,file))),expected,`${file} changed during the evidence run`);
const manifest = { schema: 'pufferfish-browser-review-v1', sourceCommit, sourceHashes, environment, captures, checks, browserErrors };
await writeFile(path.join(output, 'browser-capture.json'), JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({ output, sourceCommit, captures: captures.length, environment, checks, browserErrors },null,2));
