#!/usr/bin/env node
/** Optional REAL browser gate. No security overrides or automatic downloads.
 * An environment launch denial is a failed/blocked gate, never a mock pass.
 */
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/' : import.meta.url);
const {chromium}=require('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
let browser,server;
try {
  // Launch first: a denied browser does not leave a preview server running.
  browser=await chromium.launch({headless:true,executablePath:process.env.FOX_CHROMIUM_PATH??'/usr/bin/chromium'});
  server=createServer(async(req,res)=>{
    try{
      const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const path=resolve(root,'.'+route);
      if(!path.startsWith(root.endsWith(sep)?root:root+sep)) {res.writeHead(403);res.end();return;}
      const file=await readFile(path.endsWith(sep)?path+'index.html':path);
      res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[extname(path)]??'text/plain');
      res.end(file);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise((ready,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',ready);});
  const address=server.address();
  const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/demo/index.html`);
  await page.locator('#pause').click();assert.equal(await page.locator('#pause').textContent(),'Resume');
  await page.locator('#reset').click();assert.equal(await page.locator('#pause').textContent(),'Resume');
  await page.locator('#pounce').focus();await page.keyboard.press('Enter');
  assert.match(await page.locator('#phase').textContent(),/Still.*crouch/);
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#guide').selectOption('right');
  assert.match(await page.locator('#motion-note').textContent(),/Reduced motion/);
  await page.locator('.text-export summary').click();await page.locator('#capture').click();
  assert.match(await page.locator('#text-frame').textContent(),/[#+%]/);
  await mkdir(resolve(root,'evidence/browser'),{recursive:true});
  await page.screenshot({path:resolve(root,'evidence/browser/desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(root,'evidence/browser/narrow.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'passed',browser:await browser.version(),scope:'Real browser keyboard/pause/reset/reduced-motion smoke and screenshots; not physical touch or device performance'}));
}catch(error){console.error('BROWSER GATE BLOCKED OR FAILED\n'+error.message.trimEnd());process.exitCode=1;}
finally{if(server)await new Promise(resolve=>server.close(resolve));if(browser)await browser.close();}
