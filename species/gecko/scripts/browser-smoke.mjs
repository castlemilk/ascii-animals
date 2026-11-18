/** Optional real-browser checks. A failed launch is recorded as blocked, never a pass. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('..',import.meta.url)),out=join(root,'evidence');
const moduleRef=process.env.GECKO_PLAYWRIGHT_MODULE||(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ?pathToFileURL(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.mjs')).href:'playwright');
const report={kind:'real-browser-attempt',status:'blocked',browser:null,checks:[],error:null};
let browser;
try {
  const {chromium}=await import(moduleRef);
  browser=await chromium.launch({headless:true,executablePath:process.env.GECKO_CHROMIUM_PATH||'/usr/bin/chromium'});
  report.browser=browser.version();
  const context=await browser.newContext({viewport:{width:1280,height:1080},reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(join(root,'gecko.html')).href);
  await page.locator('#phase').filter({hasText:'Still portrait'}).waitFor();
  const first=await page.locator('#gecko').evaluate(c=>c.toDataURL());
  await page.locator('#startle').click();
  const curled=await page.locator('#gecko').evaluate(c=>c.toDataURL());
  assert.notEqual(curled,first);
  await page.locator('[data-guide="1,0"]').click();
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#gecko').evaluate(c=>c.toDataURL()),curled);
  report.checks.push('live reduced-motion poster and deliberate static curl; guidance does not animate');
  await page.screenshot({path:join(out,'browser-desktop.png'),fullPage:true});
  await page.locator('#pause').click();
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('#reset').click();
  assert.equal(await page.locator('#pause').getAttribute('aria-pressed'),'true');
  await page.locator('#pause').click();
  await page.locator('[data-guide="0,-1"]').click();
  await page.waitForTimeout(300);
  const moving=await page.locator('#gecko').evaluate(c=>c.toDataURL());
  await page.waitForTimeout(300);
  assert.notEqual(await page.locator('#gecko').evaluate(c=>c.toDataURL()),moving);
  await page.locator('#gecko').focus();await page.keyboard.press('Space');
  assert.equal(await page.locator('#pause').getAttribute('aria-pressed'),'true');
  report.checks.push('guide produces changing actual frames; stage-local Space pauses; reset preserved pause');
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=390));
  await page.screenshot({path:join(out,'browser-mobile-layout.png'),fullPage:true});
  report.checks.push('390px layout has no horizontal document overflow');
  assert.deepEqual(errors,[]);report.status='pass';
} catch(error) {
  report.status=browser?'fail':'blocked';
  report.error=String(error?.stack||error).replaceAll(root,'[species-root]');
  process.exitCode=1;
} finally {
  await browser?.close();await mkdir(out,{recursive:true});
  await writeFile(join(out,'browser-smoke.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,browser:report.browser,checks:report.checks,error:report.error?.split('\n').slice(0,2).join('\n')},null,2));
}
