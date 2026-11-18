/** Optional real-browser acceptance. No install, paid service or deployment. */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const output=fileURLToPath(new URL('../evidence/browser-attempt.json',import.meta.url));
const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const modulePath=process.env.FROG_PLAYWRIGHT_MODULE || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright` : 'playwright');
let browser,server;
const report={runtime:process.version,kind:'browser acceptance',status:'not-run',stage:'launch',checks:[]};
try {
  const {chromium}=require(modulePath);
  browser=await chromium.launch({headless:true,executablePath:process.env.FROG_CHROMIUM || '/usr/bin/chromium'});
  report.browser=browser.version();report.stage='serve';
  server=createServer(async(req,res)=>{try{
    const route=decodeURIComponent((req.url||'/').split('?')[0]);
    const path=resolve(root,`.${route.endsWith('/')?route+'index.html':route}`);
    if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const content=await readFile(path);const types={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.png':'image/png'};
    res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream'});res.end(content);
  }catch{res.writeHead(404);res.end('Not found');}});
  await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
  const port=server.address().port,base=`http://127.0.0.1:${port}`;
  const context=await browser.newContext({viewport:{width:1100,height:1100},reducedMotion:'no-preference'});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  report.stage='page';await page.goto(base+'/species/frog/demo/');await page.waitForFunction(()=>Boolean(window.__frogDemo));
  await page.locator('#pause').click();let status=await page.evaluate(()=>window.__frogDemo.controller.getStatus());assert(status.paused&&!status.scheduled);
  await page.locator('#reset').click();status=await page.evaluate(()=>window.__frogDemo.controller.getStatus());assert.equal(status.tick,0);assert(status.paused);report.checks.push('pause/reset');
  await page.locator('#pose').selectOption('airborne');await page.locator('summary').click();await page.locator('#view').selectOption('left');
  status=await page.evaluate(()=>window.__frogDemo.controller.getStatus());assert.equal(status.staticPose,'airborne');assert(!status.scheduled);report.checks.push('static pose / view');
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#leap').click();status=await page.evaluate(()=>window.__frogDemo.controller.getStatus());assert(status.reducedMotion&&!status.scheduled);report.checks.push('live reduced motion');
  await page.locator('#frog').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');status=await page.evaluate(()=>window.__frogDemo.controller.getStatus());assert(!status.scheduled);report.checks.push('focused keyboard static action');
  await mkdir(new URL('../evidence/browser',import.meta.url),{recursive:true});await page.screenshot({path:fileURLToPath(new URL('../evidence/browser/desktop.png',import.meta.url)),fullPage:true});
  await page.evaluate(()=>{const c=window.__frogDemo.controller;c.dispose();c.dispose();});assert.equal(await page.evaluate(()=>window.__frogDemo.controller.getStatus().scheduled),false);report.checks.push('disposal');
  const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce',deviceScaleFactor:2});
  const touch=await mobile.newPage();await touch.goto(base+'/species/frog/demo/');await touch.waitForFunction(()=>Boolean(window.__frogDemo));await touch.locator('#leap').tap();
  assert.equal(await touch.evaluate(()=>window.__frogDemo.controller.getStatus().staticPose),'crouch');report.checks.push('touch emulation');
  await touch.screenshot({path:fileURLToPath(new URL('../evidence/browser/mobile.png',import.meta.url)),fullPage:true});
  assert.deepEqual(errors,[]);report.status='pass';report.stage='complete';report.unrun=['real touch hardware','screen-reader','normal-speed human motion review','30-second browser profiling','heap/long-session profiling'];
}catch(error){report.status='blocked-or-failed';report.error=String(error).slice(0,6000);process.exitCode=1;}
finally{await browser?.close();if(server)await new Promise(done=>server.close(done));await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,stage:report.stage,checks:report.checks,output},null,2));}
