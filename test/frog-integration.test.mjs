import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrogArtwork,createFrog} from '../lib/public/frog.js';
import {createLegacyFrogPreview} from '../lib/species/frog/legacy-preview.mjs';
import {makeHost} from '../species/frog/tests/fake-host.mjs';
import {fakeBrowser} from './helpers/fake-browser.mjs';

test('frog factory shares one scheduler and unsubscribes paused/disposed controllers independently',()=>{
 const h=makeHost(), a=createFrogArtwork(h.canvas(),{previewFactory:h.previewFactory}),b=createFrogArtwork(h.canvas(),{previewFactory:h.previewFactory});
 assert.equal(h.frames.size,1);h.flush(100);h.flush(134);assert.equal(a.getState().tick,2);assert.equal(b.getState().tick,2);
 a.pause();assert.equal(h.frames.size,1);const state=a.getState();a.pulse();h.flush(168);assert.equal(a.getState(),state);assert(b.getState().tick>2);
 b.pause();assert.equal(h.frames.size,0);a.restart();assert.equal(a.getStatus().paused,true);
 assert.throws(()=>a.update({jumpHeight:NaN}));assert.equal(a.getState().config.jumpHeight,.85);
 a.play();assert.equal(h.frames.size,1);a.dispose();a.dispose();b.dispose();assert.equal(h.frames.size,0);assert.equal(h.listenerCount,0);assert.throws(()=>a.getState());assert(a.disposed);
});
test('frog self-contained glyph rasterizer renders finite bounded cells without Cuttlefish globals',()=>{
 const h=fakeBrowser();assert.equal(h.view.CuttlefishArtwork,undefined);
 const c=h.canvas(720,540),p=createLegacyFrogPreview(c,{cols:144,rows:80});p.resize(720,540,1);
 const frame=p.draw(createFrog());assert(frame.glyphs>50);assert(frame.samples>10000&&frame.samples<=32000);assert(frame.cols<=180&&frame.rows<=100);
 const text=p.toText();assert(text.replace(/\s/g,'').length>50);assert.match(text,/^[.,:;!i1l+txzvcofnae0&%8B@ \n]+$/);p.dispose();assert.equal(c.width,1);assert.throws(()=>p.toText());
});
test('frog reduced-motion controller never starts travel on play or pulse',()=>{
 const h=makeHost({reduced:true}),a=createFrogArtwork(h.canvas(),{previewFactory:h.previewFactory});
 // Set through the host API too, independent of fixture default option names.
 h.reduced(true);a.play();a.pulse();assert.equal(h.frames.size,0);assert.equal(a.getState().tick,0);assert.equal(a.getStatus().staticPose,'crouch');a.dispose();
});
