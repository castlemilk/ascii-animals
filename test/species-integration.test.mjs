import test from 'node:test';
import assert from 'node:assert/strict';
import {CuttlefishArtwork} from '../src/animals/cuttlefish.js';
import {createArtwork, normalizeOptions} from '../lib/index.js';
import {fakeBrowser} from './helpers/fake-browser.mjs';
const options=species=>({species,count:1,scene:'reactive',behaviors:['hover'],size:1.1,sizeVariation:0,autoStart:false,followPointer:true,seed:17});

test('species use the canonical bounded renderer and dispose safely',()=>{
 for(const species of ['manta','octopus']) for(const density of [.6,1.2,1.5]) {
  const h=fakeBrowser(), a=new CuttlefishArtwork(h.canvas(),{...options(species),density});
  for(const t of [0,1.4,6.2]) {a.time=t;a.fish[0].sceneTime=t;a.render(); assert(a.glyphCount>20);assert(a.sampleCount<36000);assert(a.getStats().cells<=65536);for(const z of a.depth)assert(z===-Infinity||Number.isFinite(z));}
  assert.equal(a.getStats().species,species);assert.equal(a.getStats().fish[0].species,species);
  a.destroy();a.destroy();assert.equal(a.samples.length,0);assert.equal(h.pending,0);
 }
});
test('manta reacts without ink; octopus cups then escapes with ink',()=>{
 for(const species of ['manta','octopus']) {
  const h=fakeBrowser(),a=new CuttlefishArtwork(h.canvas(),options(species));a.advance(0);a.pulse();
  for(let i=0;i<40;i++)a.advance(1/60);
  assert.equal(a.getStats().reactionStage,'spray');
  if(species==='manta')assert.equal(a.ink.length,0);else {assert(a.ink.length>0);assert.equal(a.fish[0].speciesState.arms.length,8);assert.equal(a.fish[0].speciesState.diagnostics.mode,'cup');}
  for(let i=0;i<45;i++)a.advance(1/60);
  assert.equal(a.getStats().reactionStage,'escape');a.destroy();
 }
});
test('mixed species preserve finite formations and atomic typed configuration',()=>{
 const h=fakeBrowser(),a=createArtwork(h.canvas(),{...options('manta'),count:3,speciesByAnimal:['manta','octopus','cuttlefish']});
 for(const formation of ['independent','horizontal','vertical','diagonal','random']) {a.update({formation});a.advance(.05);assert.equal(a.getStats().count,3);assert(a.getStats().glyphs>0);}
 const before=a.getOptions();assert.throws(()=>a.update({species:'invalid'}));assert.deepEqual(a.getOptions(),before);
 assert(Object.isFrozen(a.getOptions().speciesByAnimal));a.update({species:'octopus',speciesByAnimal:[]});assert.equal(a.species,'octopus');assert(a.getStats().fish.every(f=>f.species==='octopus'));
 a.pause();a.update({species:'manta'});assert(a.getOptions().paused);a.pulse();assert.equal(a.getStats().reactionStage,'idle');a.dispose();
 assert.throws(()=>normalizeOptions({speciesByAnimal:new Array(2)}));assert.throws(()=>normalizeOptions({seed:1.5}));
});
test('species replay is deterministic for fixed inputs and instance state is isolated',()=>{
 for(const species of ['manta','octopus']) {
  const h1=fakeBrowser(),h2=fakeBrowser();
  const a=new CuttlefishArtwork(h1.canvas(),options(species));
  const b=new CuttlefishArtwork(h2.canvas(),options(species));
  assert.notEqual(a.fish[0].speciesState,b.fish[0].speciesState);
  for(let i=0;i<20;i++){a.advance(1/60);b.advance(1/60);}
  assert.deepEqual(a.samples,b.samples);assert.deepEqual(a.depth,b.depth);
  const untouched=b.time;a.advance(.05);assert.equal(b.time,untouched);
  a.destroy();assert.equal(b.destroyed,false);b.destroy();
 }
});
