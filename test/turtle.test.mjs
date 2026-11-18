import test from 'node:test';
import assert from 'node:assert/strict';
import { createTurtleModel,createTurtleArtwork,normalizeTurtleOptions,TURTLE_DEFAULTS } from '../lib/public/turtle.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';
import {buildTurtleDemo} from '../scripts/build-turtle.mjs';

test('turtle options reject unknown/nonfinite/invalid values without partial mutations',()=>{
 const m=createTurtleModel(),before=m.getOptions();
 for(const patch of [{seed:1.5},{rows:200},{columns:10},{speed:NaN},{scale:Infinity},{speed:Symbol()},{behavior:'run'},{paused:'yes'},{species:'turtle'},null,[]]){assert.throws(()=>m.configure(patch));assert.deepEqual(m.getOptions(),before);}
 m.configure({scale:1.2,speed:undefined});assert.equal(m.getOptions().scale,1.2);assert.equal(m.getOptions().speed,1);
 assert(Object.isFrozen(TURTLE_DEFAULTS));assert(Object.isFrozen(normalizeTurtleOptions()));
});
test('integer tick/event replay produces equal logical frames and restart clears inputs',()=>{
 const replay=()=>{const m=createTurtleModel({seed:19,behavior:'curious'});m.advanceTicks(31);m.guide(.8,-.3);m.greet();m.advanceTicks(70);return m;};
 const a=replay(),b=replay();assert.deepEqual(a.getState(),b.getState());assert.equal(a.frame().text,b.frame().text);
 a.reset();assert.deepEqual(a.getState(),createTurtleModel().getState());assert.equal(a.getPhase(),'idle');
 for(const n of [-1,1.5,601,NaN,Infinity])assert.throws(()=>a.advanceTicks(n));assert.throws(()=>a.guide(NaN,0));
});
test('response orders notice, defend, settle, idle and does not restart while active',()=>{
 const m=createTurtleModel();m.greet();assert.equal(m.getPhase(),'inspect');m.advanceTicks(45);assert.equal(m.getPhase(),'streamline');m.greet();assert.equal(m.getState().responseTick,0);m.advanceTicks(65);assert.equal(m.getPhase(),'settle');m.advanceTicks(70);assert.equal(m.getPhase(),'idle');
});
test('all boundary grids produce bounded printable ASCII with distinct anchored poses',()=>{
 for(const [columns,rows] of [[80,32],[120,50],[180,90]])for(const behavior of ['glide','curious','rest'])for(const facing of ['left','right']){
  const m=createTurtleModel({columns,rows,behavior,facing,scale:1.3});m.advanceTicks(120);const f=m.frame();assert.equal(f.cells.length,columns*rows);assert.equal(f.text.split('\n').length,rows);assert(f.text.split('\n').every(r=>r.length===columns));assert(/^[\x20-\x7e\n]+$/.test(f.text));assert(f.cells.filter(c=>c.glyph!==' ').length>80);assert(f.cells.every(c=>Number.isFinite(c.tone)&&c.tone>=0&&c.tone<=9));
 }
 const m=createTurtleModel();const idle=m.frame().text;m.greet(true);assert.notEqual(m.frame().text,idle);m.configure({facing:'right'});assert.notEqual(m.frame().text,idle);
});
test('browser pause and all visibility causes stop shared subscriptions; resume does not catch up',()=>{
 const h=fakeBrowser(),c=h.canvas(),a=createTurtleArtwork(c);
 assert.equal(h.pending,0);h.intersect(c,true);assert.equal(h.pending,1);h.frame();h.frame(20);assert(a.getStatus().tick>0);
 a.pause();const tick=a.getStatus().tick;assert.equal(h.pending,0);a.pulse();assert(a.getStatus().paused);assert.equal(a.getStatus().phase,'streamline');a.restart();assert(a.getStatus().paused);assert.equal(a.getStatus().tick,0);
 a.play();h.hide(true);assert.equal(h.pending,0);h.hide(false);assert.equal(h.pending,1);h.frame(60000);assert.equal(a.getStatus().tick,0);h.frame(1000);assert(a.getStatus().tick<=6);assert(a.getStatus().droppedSeconds>.8);
 h.intersect(c,false);assert.equal(h.pending,0);h.intersect(c,true);a.pause();h.intersect(c,false);h.intersect(c,true);assert.equal(h.pending,0);a.dispose();assert.equal(h.pending,0);
});
test('system reduced motion is authoritative across playback, pointer, reset and options',()=>{
 const h=fakeBrowser({reducedMotion:true}),c=h.canvas(),a=createTurtleArtwork(c);h.intersect(c,true);
 a.play();a.pulse();a.guide(1,1);a.restart();a.update({palette:'rose',paused:false});assert(a.getStatus().paused);assert.equal(h.pending,0);
 h.setReduced(false);assert.equal(h.pending,1);h.setReduced(true);assert.equal(h.pending,0);a.dispose();
});
test('disposal removes owned resources, is idempotent and does not affect other instances',()=>{
 const h=fakeBrowser(),c1=h.canvas(),c2=h.canvas(),a=createTurtleArtwork(c1),b=createTurtleArtwork(c2);h.intersect(c1,true);h.intersect(c2,true);assert.equal(h.pending,1);
 a.dispose();a.dispose();assert.equal(h.pending,1);assert.equal(c1.listenerCount,0);a.play();a.update({palette:'rose'});a.restart();assert.equal(c1.listenerCount,0);assert(a.disposed);b.dispose();assert.equal(h.pending,0);assert.equal(h.motion.listenerCount,0);assert.equal(h.document.listenerCount,0);assert.equal(h.resizes.size,0);assert.equal(h.intersections.size,0);
});
test('zero-sized containers allocate no backing pixels and resize is bounded',()=>{
 const h=fakeBrowser({dpr:10}),c=h.canvas(0,0),a=createTurtleArtwork(c);h.intersect(c,true);assert.equal(c.width,0);assert.equal(c.height,0);assert.equal(h.pending,0);
 c.rect.width=100000;c.rect.height=100000;a.resize();assert(c.width<=4096&&c.height<=4096);a.dispose();
});
test('construction failure rolls back observers and listeners',()=>{
 const h=fakeBrowser(),c=h.canvas();h.view.IntersectionObserver=class{constructor(){throw Error('IO failed')}};
 assert.throws(()=>createTurtleArtwork(c),/IO failed/);assert.equal(c.listenerCount,0);assert.equal(h.pending,0);assert.equal(h.resizes.size,0);assert.equal(h.document.listenerCount,0);assert.equal(h.motion.listenerCount,0);
});
test('turtle demo is generated from actual compiled module',async()=>{await buildTurtleDemo({check:true});});
