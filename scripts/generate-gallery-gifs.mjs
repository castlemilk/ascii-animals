/** Capture actual canonical study renderers in isolated Chromium, not mocked artwork.
 * Build demo first; uses its installed Playwright and ffmpeg from PATH.
 * node scripts/generate-gallery-gifs.mjs [http://127.0.0.1:4188]
 */
import { chromium } from '../demo/node_modules/playwright-core/index.mjs';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const origin = process.argv[2] || 'http://127.0.0.1:4188';
const names = ['cuttlefish','manta','octopus','seahorse','crab','turtle','pufferfish','frog','butterfly','dragonfly','gecko','owl','fox'];
const output = path.resolve('docs/media/animals');
const framesRoot = process.env.FRAMES_DIR || '/tmp/ascii-gif-frames';
const browser = await chromium.launch({headless:true});
const manifest={sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),capture:'Actual Chromium canonical Next.js study, normal motion, fixed browser clock; canvas/DOM pixels, not mock or illustrative artwork.',hostWidthCss:560,hostHeightCss:360,fps:10,frames:40,animals:[]};
try {
 for (const id of names) {
  const frames=path.join(framesRoot,id); await mkdir(frames,{recursive:true});
  const page=await browser.newPage({viewport:{width:1100,height:1000},deviceScaleFactor:1,reducedMotion:'no-preference'});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-11-20T00:00:00Z')});
  const route=`/ascii-animals/animals/${id}/`;
  const response=await page.goto(origin+route); if(response.status()!==200) throw new Error(`${id} HTTP ${response.status()}`);
  const host=page.getByTestId('renderer-host'); await host.waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-testid="renderer-host"]')?.dataset.status==='ready');
  // Capture only artwork at a shared readable size; never change renderer code.
  await page.addStyleTag({content:'.renderer-host {width:560px!important;height:360px!important;min-height:360px!important;max-height:360px!important;flex:none!important;}'});
  await host.scrollIntoViewIfNeeded(); await page.clock.runFor(1600);
  const hashes=[];
  for(let i=0;i<40;i++) {
    await page.clock.runFor(100);
    const bytes=await host.screenshot({path:path.join(frames,`frame-${String(i).padStart(3,'0')}.png`),animations:'allow'});
    hashes.push(createHash('sha256').update(bytes).digest('hex'));
  }
  if(errors.length) throw new Error(`${id} browser errors: ${errors.join('; ')}`);
  if(new Set(hashes).size<10) throw new Error(`${id}: insufficient actual motion`);
  const file=path.join(output,`${id}.gif`);
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','10','-i',path.join(frames,'frame-%03d.png'),'-filter_complex','[0:v]split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle','-loop','0',file]);
  const decoded=execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',file,'-f','framemd5','-'],{encoding:'utf8'}).split('\n').filter(s=>s&&!s.startsWith('#'));
  const uniqueDecoded=new Set(decoded.map(s=>s.split(',').at(-1).trim())).size;
  if(decoded.length!==40||uniqueDecoded<10) throw new Error(`${id}: encoded animation invalid`);
  const dimensions=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',file],{encoding:'utf8'})).streams[0];
  manifest.animals.push({id,route,...dimensions,bytes:(await stat(file)).size,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),uniqueSourceFrames:new Set(hashes).size,decodedFrames:decoded.length,uniqueDecodedFrames:uniqueDecoded});
  console.log(`${id}: ${(await stat(file)).size} bytes, ${uniqueDecoded} unique frames`); await page.close();
 }
 if(new Set(manifest.animals.map(a=>a.sha256)).size!==13) throw new Error('Duplicate GIFs');
 await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
} finally {await browser.close();}
