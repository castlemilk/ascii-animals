import test from 'node:test';
import assert from 'node:assert/strict';
import {createPufferfishArtwork} from '../lib/public/pufferfish.js';
import {CuttlefishArtwork} from '../lib/animals/cuttlefish.js';
import {fakeBrowser} from './helpers/fake-browser.mjs';
import {buildPufferfishDemo} from '../scripts/build-pufferfish.mjs';
test('Pufferfish borrows shared scheduler and preserves independent lifecycle',()=>{
 const host=fakeBrowser(),fish=new CuttlefishArtwork(host.canvas(),{count:1});
 const p=createPufferfishArtwork(host.canvas(),{species:{seed:17},render:{quality:'small'}});
 assert.equal(host.pending,1);host.frame();host.frame();assert(p.getSnapshot().tick>0);
 const previous=p.getOptions();assert.throws(()=>p.update({inflationScale:99}));assert.deepEqual(p.getOptions(),previous);assert(Object.isFrozen(previous));
 p.pause();const t=p.getSnapshot().tick;p.pulse();assert.equal(p.getStatus().userPaused,true);assert.equal(p.getSnapshot().tick,t);p.restart();assert.equal(p.getStatus().userPaused,true);
 p.play();host.frame();host.frame();assert(p.getSnapshot().tick>0);
 p.dispose();p.dispose();assert(p.disposed);assert.equal(host.pending,1);assert.throws(()=>p.play(),/disposed/);fish.destroy();assert.equal(host.pending,0);
});
test('Pufferfish reduced motion and compact view use deliberate static poses',()=>{
 const h=fakeBrowser({reducedMotion:true}),a=createPufferfishArtwork(h.canvas());a.play();a.pulse();assert.equal(h.pending,0);assert.equal(a.getStatus().phase,'holding');assert.equal(a.getSnapshot().tick,0);a.dispose();
 const h2=fakeBrowser(),b=createPufferfishArtwork(h2.canvas(320,240));b.pulse();assert(b.getStatus().compact);assert.equal(h2.pending,0);b.dispose();
});
test('Pufferfish generated ESM demo is reproducible',async()=>{assert.equal((await buildPufferfishDemo({check:true})).entry,'dist/pufferfish/index.html');});
