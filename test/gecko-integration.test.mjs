import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeckoArtwork, createGeckoDirector, resolveGeckoOptions, DEFAULT_GECKO_OPTIONS } from '../lib/public/gecko.js';
import { createFoxArtwork } from '../lib/public/fox.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';
import { buildGeckoDemo } from '../scripts/build-gecko.mjs';
test('Gecko shares scheduler but keeps lifecycle and fixed tick semantics independent', () => {
 const host=fakeBrowser(), canvas=host.canvas(), peerCanvas=host.canvas();
 const gecko=createGeckoArtwork(canvas), fox=createFoxArtwork(peerCanvas); host.intersect(peerCanvas,true);
 assert.equal(host.pending,1); host.frame();host.frame();assert(gecko.getSnapshot().tick>0);
 gecko.guide(.5,.3); gecko.pulse();host.frame();assert.equal(gecko.getStatus().phase,'startle');
 gecko.pause();gecko.restart();assert.equal(gecko.getStatus().paused,true);
 const before=gecko.getSnapshot().tick;host.frame();assert.equal(gecko.getSnapshot().tick,before);
 gecko.play();host.frame();host.frame();gecko.dispose();gecko.dispose();assert.equal(gecko.disposed,true);
 assert.equal(host.pending,1);assert.throws(()=>gecko.pulse(),/disposed/);fox.dispose();assert.equal(host.pending,0);
});
test('Gecko static curl respects reduced motion, options/base validation is atomic', () => {
 const host=fakeBrowser({reducedMotion:true}), gecko=createGeckoArtwork(host.canvas());
 gecko.play();assert.equal(gecko.pulse().outcome,'static');assert.equal(gecko.getStatus().poster,'curled');
 assert.equal(gecko.getSnapshot().tick,0);assert.equal(host.pending,0);
 const before=gecko.getSnapshot().options;assert.throws(()=>gecko.update({creepSpeed:NaN}));
 assert.deepEqual(gecko.getSnapshot().options,before);
 assert.throws(()=>resolveGeckoOptions({}, {...DEFAULT_GECKO_OPTIONS,creepSpeed:NaN}));
 assert.throws(()=>resolveGeckoOptions({}, {...DEFAULT_GECKO_OPTIONS,unknown:3}));gecko.dispose();
});
test('Gecko generated real-adapter demo is reproducible',async()=>assert.equal((await buildGeckoDemo({check:true})).entry,'dist/gecko/index.html'));

test('three directed geckos and a Fox borrow one shared scheduler and release only their own subscription',()=>{
 const host=fakeBrowser(), gecko=createGeckoArtwork(host.canvas(),{director:{scene:'lantern-hunt'}}), foxCanvas=host.canvas();
 const fox=createFoxArtwork(foxCanvas);host.intersect(foxCanvas,true);
 assert.equal(host.pending,1);host.frame();host.frame();
 const state=gecko.getDirectorSnapshot();assert(state.tick>0);assert.deepEqual(state.individuals.map(a=>a.body.tick),[state.tick,state.tick,state.tick]);
 gecko.pause();const frozen=gecko.getDirectorSnapshot();gecko.direct({type:'shadow'});host.frame();
 assert.deepEqual(gecko.getDirectorSnapshot(),frozen);assert.equal(host.pending,1);
 gecko.configureDirector({population:2,scene:'passing-shadow'});gecko.restart();assert.equal(gecko.getStatus().paused,true);
 gecko.play();host.frame();host.frame();assert.equal(host.pending,1);
 gecko.dispose();assert.equal(host.pending,1);assert.throws(()=>gecko.direct({type:'moth'}),/disposed/);
 fox.dispose();assert.equal(host.pending,0);
});

test('headless director subpath export constructs and replays without DOM or an owned timer',()=>{
 assert.equal(typeof globalThis.window,'undefined');assert.equal(typeof globalThis.document,'undefined');
 const director=createGeckoDirector({seed:37,options:{population:2,autonomy:false}});
 assert.equal(director.getSnapshot().tick,0);
 director.step([{type:'inspect',tick:1,seq:1,id:'pip'}]);
 const recipe=director.exportRecipe();assert.equal(recipe.kind,'gecko-scene-recipe');assert.equal(recipe.startsAtTick,0);
 assert.equal(director.getSnapshot().lastAction.id,'pip');director.dispose();
});
