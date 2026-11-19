/** Reproducible real-Chromium evidence. The production page and Canvas run unchanged;
 * only requestAnimationFrame delivery is controlled to capture exact 60 Hz ticks.
 * Usage: node species/gecko/scripts/capture-anchored-wall.mjs --label before
 *   --url http://127.0.0.1:8765/ascii-animals-before/species/gecko/index.html
 *   --out species/gecko/review/anchored-wall/evidence
 * GECKO_PLAYWRIGHT_MODULE / GECKO_CHROMIUM_PATH may select installed tooling.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const arg = (key, fallback) => { const at=process.argv.indexOf(`--${key}`); return at<0?fallback:process.argv[at+1]; };
const speciesRoot=fileURLToPath(new URL('..',import.meta.url));
const label=arg('label','after'), base=arg('url','http://127.0.0.1:8765/ascii-animals/species/gecko/index.html');
const out=resolve(arg('out',join(speciesRoot,'review/anchored-wall/evidence')));
const moduleRef=process.env.GECKO_PLAYWRIGHT_MODULE??pathToFileURL(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES??'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','playwright/index.mjs')).href;
const { chromium } = await import(moduleRef);
await mkdir(out,{recursive:true});
let browser;
const manifest={kind:'real headless Chromium capture attempt; a launch failure is not browser evidence',status:'blocked',label,url:base,browser:null,node:process.version,seed:37,clock:'Production RAF callback, manually delivered at 60Hz; snapshots at exact model tick',captures:[],checks:[],errors:[]};

async function setup(viewport,phone=false,reducedMotion='no-preference') {
  const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:phone,hasTouch:phone,reducedMotion});
  const page=await context.newPage();
  page.on('pageerror',e=>manifest.errors.push(String(e)));
  await page.addInitScript(()=>{
    let next=1,now=0;
    const callbacks=new Map();
    window.requestAnimationFrame=callback=>{const id=next++;callbacks.set(id,callback);return id;};
    window.cancelAnimationFrame=id=>callbacks.delete(id);
    window.__geckoFrame=()=>{now+=1000/60;const batch=[...callbacks.entries()];callbacks.clear();for(const [,cb] of batch)cb(now);return callbacks.size;};
    window.__geckoFrames=()=>callbacks.size;
  });
  await page.goto(base,{waitUntil:'networkidle'});
  await page.evaluate(async()=>{window.__geckoDemo=(await import(new URL('compiled/demo.js',location.href).href)).geckoDemo;});
  assert(await page.evaluate(()=>!!window.__geckoDemo),'real Gecko page did not mount');
  await page.locator('#gecko').scrollIntoViewIfNeeded();
  await page.waitForTimeout(40);
  await page.evaluate(()=>{window.__geckoDemo.reset({seed:37});window.__geckoDemo.redraw();});
  return {context,page};
}
async function advance(page,tick){
  return await page.evaluate(target=>{
    const art=window.__geckoDemo;
    let frames=0;
    while(art.getStatus().tick<target && frames++<target+20)window.__geckoFrame();
    if(art.getStatus().tick!==target)throw new Error(`Could not reach ${target}: ${JSON.stringify(art.getStatus())}`);
    return art.getDirectorSnapshot();
  },tick);
}
async function capture(page,name,{fullPage=false,canvas=false}={}){
  const file=`${label}-${name}.png`,path=join(out,file);
  if(canvas)await page.locator('#gecko').screenshot({path});else await page.screenshot({path,fullPage});
  const state=await page.evaluate(()=>({status:window.__geckoDemo.getStatus(),scene:window.__geckoDemo.getDirectorSnapshot(),scroll:{x:scrollX,y:scrollY},viewport:{width:innerWidth,height:innerHeight},document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}}));
  manifest.captures.push({file,...state,sha256:createHash('sha256').update(await readFile(path)).digest('hex')});
  return state;
}
async function verifyInputsAndLifecycle(){
  const {context,page}=await setup({width:1440,height:1000});
  await page.evaluate(()=>window.__geckoDemo.configureDirector({autonomy:false}));
  const rect=await page.locator('#gecko').boundingBox();
  assert(rect);
  await page.mouse.move(rect.x+rect.width*.66,rect.y+rect.height*.34);
  await advance(page,1);
  assert(await page.evaluate(()=>window.__geckoDemo.getDirectorSnapshot().pointer!==null));
  manifest.checks.push({name:'actual mouse pointer guides the selected gecko',pass:true});
  await page.mouse.move(2,2);
  await advance(page,2);
  assert.equal(await page.evaluate(()=>window.__geckoDemo.getDirectorSnapshot().pointer),null);
  await page.locator('#gecko').focus();
  await page.keyboard.press('ArrowUp');
  await advance(page,3);
  assert(await page.evaluate(()=>window.__geckoDemo.getDirectorSnapshot().pointer?.y<0));
  await page.keyboard.press('c');await advance(page,4);
  assert.equal(await page.evaluate(()=>window.__geckoDemo.getDirectorSnapshot().lastAction?.type),'inspect');
  await page.keyboard.press('Escape');await advance(page,5);
  assert.equal(await page.evaluate(()=>window.__geckoDemo.getDirectorSnapshot().pointer),null);
  await page.keyboard.press('m');await advance(page,6);
  assert.equal(await page.evaluate(()=>window.__geckoDemo.getDirectorSnapshot().lastAction?.type),'moth');
  manifest.checks.push({name:'canvas-local C climbs, Escape clears guidance, and M offers a moth',pass:true});
  await page.keyboard.press('Space');
  assert(await page.evaluate(()=>window.__geckoDemo.getStatus().paused));
  await page.locator('#reset').click();
  assert(await page.evaluate(()=>window.__geckoDemo.getStatus().paused&&window.__geckoDemo.getStatus().tick===0));
  manifest.checks.push({name:'canvas-local ArrowUp and Space work; Reset preserves explicit pause',pass:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>window.__geckoDemo.setPaused(false));
  assert(await page.evaluate(()=>window.__geckoDemo.getStatus().reducedMotion&&!window.__geckoDemo.getStatus().running));
  await page.locator('#gecko').scrollIntoViewIfNeeded();
  await page.waitForTimeout(40);
  const staticBefore=await page.locator('#gecko').evaluate(c=>c.toDataURL());
  // Use the real semantic action button, then bring the wall back into view.
  await page.locator('#moth').click();
  await page.locator('#gecko').scrollIntoViewIfNeeded();
  await page.waitForTimeout(40);
  await page.evaluate(()=>window.__geckoDemo.redraw());
  assert.notEqual(await page.locator('#gecko').evaluate(c=>c.toDataURL()),staticBefore);
  const frozen=await page.evaluate(()=>window.__geckoDemo.getStatus().tick);
  await page.evaluate(()=>{for(let i=0;i<120;i++)window.__geckoFrame();});
  assert.equal(await page.evaluate(()=>window.__geckoDemo.getStatus().tick),frozen);
  await page.locator('#gecko').focus();await page.keyboard.press('c');
  assert.equal(await page.evaluate(()=>window.__geckoDemo.getStatus().directorPoster),'inspect');
  await page.keyboard.press('m');
  assert.equal(await page.evaluate(()=>window.__geckoDemo.getStatus().directorPoster),'moth');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>window.__geckoDemo.getStatus().tick),frozen);
  assert(await page.evaluate(()=>!window.__geckoDemo.getStatus().running));
  manifest.checks.push({name:'C, M and Escape in reduced motion do not resume the clock',pass:true});
  manifest.checks.push({name:'live reduced-motion change stops ticks; real moth button gives a deliberate still scene',pass:true});
  await capture(page,'desktop-reduced-motion',{canvas:true});
  await page.evaluate(()=>window.__geckoDemo.setPaused(true));
  await page.emulateMedia({reducedMotion:'no-preference'});
  assert(await page.evaluate(()=>window.__geckoDemo.getStatus().paused&&!window.__geckoDemo.getStatus().running));
  await page.locator('#tempo').focus();
  await page.evaluate(()=>document.querySelector('#tempo').addEventListener('keydown',event=>queueMicrotask(()=>{window.__formKey={key:event.key,defaultPrevented:event.defaultPrevented};}),{once:true}));
  await page.keyboard.press('m');
  assert.deepEqual(await page.evaluate(()=>window.__formKey),{key:'m',defaultPrevented:false});
  assert.equal(await page.evaluate(()=>window.__geckoDemo.getStatus().pendingInputs),0);
  manifest.checks.push({name:'form-control keys remain unhandled by canvas shortcuts while paused',pass:true});
  await page.setViewportSize({width:390,height:844});
  await page.locator('#gecko').scrollIntoViewIfNeeded();
  await page.waitForTimeout(40);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=390&&window.__geckoDemo.getStatus().paused));
  await page.evaluate(()=>{window.__geckoDemo.dispose();window.__geckoDemo.dispose();});
  const disposed=await page.evaluate(()=>({status:window.__geckoDemo.getStatus(),frames:window.__geckoFrames(),width:document.querySelector('#gecko').width,height:document.querySelector('#gecko').height}));
  assert(disposed.status.disposed);assert.equal(disposed.status.queuedFrames,0);assert.equal(disposed.frames,0);assert.equal(disposed.width,0);assert.equal(disposed.height,0);
  manifest.checks.push({name:'390px resize preserves pause; idempotent disposal releases owned RAF and canvas backing storage',pass:true});
  await context.close();
  const phone=await setup({width:390,height:844},true);
  await phone.page.evaluate(()=>window.__geckoDemo.configureDirector({autonomy:false}));
  const touchRect=await phone.page.locator('#gecko').boundingBox();assert(touchRect);
  await phone.page.touchscreen.tap(touchRect.x+touchRect.width*.72,touchRect.y+touchRect.height*.3);
  await advance(phone.page,1);
  assert(await phone.page.evaluate(()=>window.__geckoDemo.getDirectorSnapshot().pointer!==null));
  await phone.page.evaluate(()=>document.querySelector('#gecko').dispatchEvent(new PointerEvent('pointercancel',{pointerType:'touch',bubbles:true})));
  await advance(phone.page,2);
  assert.equal(await phone.page.evaluate(()=>window.__geckoDemo.getDirectorSnapshot().pointer),null);
  manifest.checks.push({name:'real emulated touch tap guides without hover; synthetic pointercancel clears input',pass:true});
  await phone.page.setViewportSize({width:320,height:720});
  await phone.page.locator('#gecko').scrollIntoViewIfNeeded();await phone.page.waitForTimeout(40);
  assert(await phone.page.evaluate(()=>document.documentElement.scrollWidth<=320&&!window.__geckoDemo.getStatus().tooSmall));
  await capture(phone.page,'minimum-320',{fullPage:true});
  manifest.checks.push({name:'320px minimum has no document overflow and retains active canvas',pass:true});
  await phone.context.close();
}
try {
  browser=await chromium.launch({headless:true,executablePath:process.env.GECKO_CHROMIUM_PATH??'/usr/bin/chromium'});
  manifest.browser=browser.version();
  for(const [size,viewport,phone] of [['desktop',{width:1440,height:1000},false],['phone',{width:390,height:844},true]]){
    const {context,page}=await setup(viewport,phone);
    await advance(page,360);
    await page.evaluate(()=>window.scrollTo(0,0));
    await capture(page,`${size}-full`,{fullPage:true});
    await capture(page,`${size}-viewport`);
    await page.locator('#gecko').scrollIntoViewIfNeeded();
    await capture(page,`${size}-wall`,{canvas:true});
    manifest.checks.push({name:`${size} no horizontal overflow`,pass:await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)});
    await page.locator('#scene-lantern-hunt').click();
    await page.evaluate(()=>{window.__geckoDemo.reset({seed:37});window.__geckoDemo.selectGecko('pip');});
    await page.locator('#gecko').scrollIntoViewIfNeeded();
    await page.waitForTimeout(40);
    for(const tick of [180,720,820,1060]){
      await advance(page,tick);
      await capture(page,`${size}-hunt-${tick}`,{canvas:true});
    }
    await context.close();
  }
  if(label!=='before')await verifyInputsAndLifecycle();
  assert.deepEqual(manifest.errors,[]);
  manifest.status='pass';
} catch(error) {
  manifest.status=browser?'failed':'blocked';
  manifest.errors.push(String(error?.stack??error));
  process.exitCode=1;
} finally {
  await browser?.close();
  await writeFile(join(out,`${label}-browser-capture.json`),JSON.stringify(manifest,null,2)+'\n');
}
console.log(JSON.stringify({label,status:manifest.status,browser:manifest.browser,captures:manifest.captures.map(c=>c.file),checks:manifest.checks,errors:manifest.errors.map(e=>e.split('\n').slice(0,7).join('\n'))},null,2));
