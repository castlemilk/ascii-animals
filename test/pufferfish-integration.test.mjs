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
test('Pufferfish directors share one browser RAF with another marine species and retain factory aliases',()=>{
 const host=fakeBrowser(),marine=new CuttlefishArtwork(host.canvas(),{count:1});
 const a=createPufferfishArtwork(host.canvas(),{species:{seed:23,spineTicks:40},director:{scene:'reef',count:3},render:{quality:'small'}});
 const b=createPufferfishArtwork(host.canvas(),{director:{scene:'shadow',count:3},render:{quality:'small'}});
 try{
  assert.equal(host.pending,1);host.frame();host.frame();
  assert.equal(a.getDirectorSnapshot().actors.length,3);assert.equal(b.getDirectorSnapshot().actors.length,3);
  assert(a.getDirectorSnapshot().tick>0);assert(b.getDirectorSnapshot().tick>0);
  a.pause();a.selectActor(1);
  const baseOptions=a.getOptions();assert.equal(baseOptions.seed,23);assert.equal(baseOptions.spineTicks,40);
  assert.notEqual(a.getSnapshot().config.seed,23,'selected actor uses its own derived seed');
  a.selectActor(2);assert.equal(a.getOptions(),baseOptions);a.pulse();assert.equal(a.getStatus().phase,'holding');
  const originalSeeds=a.getDirectorSnapshot().actors.map(actor=>actor.state.config.seed);
  a.update({wobble:0.2});assert.equal(a.getOptions().seed,23);assert.equal(a.getOptions().spineTicks,40);
  assert.deepEqual(a.getDirectorSnapshot().actors.map(actor=>actor.state.config.seed),originalSeeds);
  assert(a.getDirectorSnapshot().actors.every(actor=>actor.state.config.wobble===0.2&&actor.state.config.spineTicks===40));
  a.restart();assert.equal(a.getStatus().userPaused,true);
  assert.equal(a.getDirectorSnapshot().config.scene,'reef');assert.equal(a.getDirectorSnapshot().config.count,3);
  a.dispose();assert.equal(host.pending,1);const before=b.getDirectorSnapshot().tick;host.frame();assert(b.getDirectorSnapshot().tick>before);
  b.dispose();assert.equal(host.pending,1);assert.throws(()=>b.configureDirector({scene:'current'}),/disposed/);
 }finally{a.dispose();b.dispose();marine.destroy();}
 assert.equal(host.pending,0);
});
