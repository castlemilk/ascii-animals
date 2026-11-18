import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { buildDemo } from '../scripts/build-demo.mjs';
import { CuttlefishArtwork } from '../src/animals/cuttlefish.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';

test('global and standalone artifacts are generated from the canonical modules', async () => {
  const built = await buildDemo({ check: true });
  const global = await readFile(new URL('../dist/artwork.js', import.meta.url), 'utf8');
  const standalone = await readFile(new URL('../dist/cuttlefish.html', import.meta.url), 'utf8');
  assert(global.includes(`source-sha256: ${built.sourceSha256}`));
  assert(standalone.includes(global.replaceAll('</script', '<\\/script')));
  assert(!standalone.includes('<script src="artwork.js"'));
  assert(!standalone.includes('<script src="app.js"'));
  assert(standalone.includes('<style>\n:root{'));
  assert(!standalone.includes('fonts.googleapis.com'));
  const animals = await readFile(new URL('../dist/animals-standalone.html', import.meta.url), 'utf8');
  assert(animals.includes(global.replaceAll('</script', '<\\/script')));
  assert(!animals.includes('<script src='));
  assert(!animals.includes('<link rel="stylesheet"'));
  assert(standalone.includes('body{margin:0;background:var(--bg)'));
  const source = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
  assert(source.includes("fetch('artwork.js')"));
  assert(source.includes("script[data-artwork-source]"));
  assert((await readFile(new URL('../dist/record.html', import.meta.url), 'utf8')).includes('<script src="artwork.js" defer>'));
});

test('classic global build preserves module simulation and lifecycle', async () => {
  const source = await readFile(new URL('../dist/artwork.js', import.meta.url), 'utf8');
  const globalHost = fakeBrowser(), moduleHost = fakeBrowser();
  const scope = vm.createContext({window:globalHost.view, console});
  vm.runInContext(source, scope);
  const options = { count:4, scene:'reactive', formation:'diagonal', autoStart:false };
  const classic = new globalHost.view.CuttlefishArtwork(globalHost.canvas(),options);
  const module = new CuttlefishArtwork(moduleHost.canvas(),options);
  for(let i=0;i<30;i++) {
    if(i===10) {classic.pulse(); module.pulse();}
    classic.advance(1/60); module.advance(1/60);
  }
  const state = a => JSON.parse(JSON.stringify({fish:a.fish,ink:a.ink,time:a.time,elapsed:a.elapsed}));
  assert.deepEqual(state(classic),state(module));
  classic.setPaused(true); const time=classic.time; classic.pulse(); assert.equal(classic.time,time);
  classic.destroy(); module.destroy(); assert.equal(classic.samples.length,0);
});
