import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as publicDragonfly from '../../../lib/public/dragonfly.js';
import { getBrowserScheduler } from '../../../lib/core/scheduler.js';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';
import { createDragonfly } from '../lib/model.js';
import { gridToText, rasterizeDragonfly } from '../lib/preview.js';
import {
  KITE_SCOUT_VARIATION, createKiteScout, mountKiteScout,
} from '../lib/variants/kite-scout/index.js';

// Instrumented controller/source checks, not rendered-browser or phone acceptance.
const phone = { cols:72, rows:44, view:'oblique', neutral:false };
const digest = value => createHash('sha256').update(typeof value==='string' ? value : JSON.stringify(value)).digest('hex');
// Freeze every sampled geometry field and its order, but not final IEEE-754
// bits from implementation-dependent trig routines. State and phone cells
// remain byte-exact. Numbers are in model space, rounded only in this oracle.
const geometryDigest = value => digest(JSON.stringify(value, (_, member) =>
  typeof member === 'number' && !Number.isInteger(member) ? Number(member.toFixed(9)) : member));
const eventLog = [
  {type:'pointer',tick:1,seq:0,x:-.8,y:-.25},
  {type:'dart',tick:45,seq:1},
  {type:'leave',tick:90,seq:2},
  {type:'pointer',tick:205,seq:3,x:.9,y:.3},
  {type:'dart',tick:205,seq:4},
];
// Captured from unchanged Original at main 3b5ffcce7bea56e1402fc16d0edc2c14c3cd5779.
// These protect its actual state, anatomy and ASCII cells, not merely its API names.
const ORIGINAL = {
  initial: {
    state:'2891818c62e05dfc9866febfb750bc17b65dbf7ffe116cbb5cc62bb8cd2851db',
    geometry:'76f8abd5e94242ed58501a78876b65e9afd7397f66b5920342d66b78df05dba2',
    cells:'83bb33dd00d16593dfdd86f28863b117504bcafb789501c97761a4f5adda080e',
  },
  guided: {
    state:'b0bda236febf9f8c94cf9e4a3dceee6b926fdaeaa7dc2c3a66214fd4ede41026',
    geometry:'2178049955b4a83393afd25109281503985aa6e9cddb1cd500c32d87c7189cd5',
    cells:'7866931943e82c5845f8b25e7576897fe9ac796ba86428af4a8582f655fb4140',
  },
};
function capture(model) {
  const geometry=model.sample();
  return {state:digest(model.getState()),geometry:geometryDigest(geometry),
    cells:digest(gridToText(rasterizeDragonfly(geometry,phone)))};
}
function canvasFor(browser,width=390,height=360) {
  const canvas=browser.canvas(width,height);
  canvas.getContext('2d').measureText=()=>({width:5});
  return canvas;
}
function frames(browser,count=2) { for(let index=0;index<count;index++)browser.frame(); }
function resize(browser,canvas,width,height) {
  canvas.rect={...canvas.rect,width,height};
  for(const observer of browser.resizes)if(observer.target===canvas)observer.callback([]);
}
function assertReleased(browser,canvas,scheduler) {
  assert.equal(scheduler.size,0,'The host releases its borrowed subscription');
  assert.equal(browser.pending,0,'No RAF remains after the last subscriber leaves');
  assert.equal(canvas.listenerCount,0);
  assert.equal(browser.document.listenerCount,0);
  assert.equal(browser.view.listenerCount,0);
  assert.equal(browser.motion.listenerCount,0);
  assert.equal(browser.resizes.size,0);
  assert.equal(browser.intersections.size,0);
}

test('Kite Scout is private opt-in and cannot silently allocate its own integration clock', () => {
  assert.deepEqual(KITE_SCOUT_VARIATION,{id:'kite-scout',version:1,species:'dragonfly'});
  assert(Object.isFrozen(KITE_SCOUT_VARIATION));
  const metadata=JSON.parse(readFileSync(new URL('../../../package.json',import.meta.url)));
  assert.deepEqual(metadata.exports['./dragonfly'],{
    types:'./lib/public/dragonfly.d.ts',import:'./lib/public/dragonfly.js',default:'./lib/public/dragonfly.js',
  });
  assert(!Object.keys(metadata.exports).some(key=>key.includes('kite-scout')));
  for(const name of ['createKiteScout','mountKiteScout','KITE_SCOUT_VARIATION'])
    assert.equal(Object.hasOwn(publicDragonfly,name),false,'Private entry does not change the public facade');
  const browser=fakeBrowser(),canvas=canvasFor(browser),scheduler=getBrowserScheduler(browser.view);
  for(const options of [undefined,{}, {frameSource:null}, {frameSource:{subscribe:7}}])
    assert.throws(()=>mountKiteScout(canvas,options),/borrowed frameSource/);
  assertReleased(browser,canvas,scheduler);
});

test('Original state, anatomy and phone ASCII remain exact while the alternative runs beside it', () => {
  const original=createDragonfly({seed:17,hoverRadius:0});
  const alternative=createKiteScout({seed:17,hoverRadius:0});
  assert.deepEqual(capture(original),ORIGINAL.initial);
  assert.equal(original.sample().samples.length,3874);
  assert.equal(alternative.sample().samples.length,2089);
  for(let tick=1;tick<=213;tick++) {
    const inputs=eventLog.filter(event=>event.tick===tick);
    original.step(tick,inputs);alternative.step(tick,inputs);
  }
  assert.deepEqual(capture(original),ORIGINAL.guided);
  assert.notEqual(digest(alternative.getState()),ORIGINAL.guided.state,'The opt-in motion actually differs');
  assert.notEqual(geometryDigest(alternative.sample()),ORIGINAL.guided.geometry);
  const exactBeforeDisposal = digest(original.sample());
  alternative.configure({wingAmplitude:.4});alternative.reset(991);alternative.dispose();
  assert.deepEqual(capture(original),ORIGINAL.guided,'Alternative configuration and disposal do not mutate Original');
  assert.equal(digest(original.sample()),exactBeforeDisposal,'Within one runtime, disposal leaves exact geometry bits untouched');
  original.dispose();
});

test('the unchanged public artwork factory keeps Original ASCII output and actions when Kite Scout is imported', () => {
  const browser=fakeBrowser(),canvas=canvasFor(browser),other=canvasFor(browser);
  const scheduler=getBrowserScheduler(browser.view);
  const original=publicDragonfly.createDragonflyArtwork(canvas,{paused:true,model:{seed:17,hoverRadius:0}});
  assert.equal(digest(original.exportText()),ORIGINAL.initial.cells);
  assert.equal(original.getStatus().samples,3874);
  const still=original.exportText(),state=original.getState();
  const alternative=mountKiteScout(other,{frameSource:scheduler,paused:true,model:{seed:17,hoverRadius:0}});
  assert.notEqual(alternative.exportText(),still);
  alternative.dart();alternative.configure({wingHz:2});
  assert.equal(original.exportText(),still);
  assert.deepEqual(original.getState(),state);
  original.pulse();
  assert.notEqual(original.exportText(),still,'Original retains its existing paused-pose action');
  assert.equal(original.getStatus().tick,0);
  assert.equal(browser.pending,0);
  alternative.dispose();original.dispose();
  assertReleased(browser,canvas,scheduler);
  assert.equal(other.listenerCount,0);
});

test('solo and directed variants borrow one subscription each without driving an Original peer', () => {
  for(const directed of [false,true]) {
    const browser=fakeBrowser(),canvas=canvasFor(browser),peerCanvas=canvasFor(browser);
    const scheduler=getBrowserScheduler(browser.view);
    const peer=publicDragonfly.createDragonflyArtwork(peerCanvas);
    const variant=mountKiteScout(canvas,{frameSource:scheduler,...(directed?{director:{count:4,scene:'attention'}}:{})});
    assert.equal(scheduler.size,2,'One Original plus one variant host, even with four directed members');
    assert.equal(browser.pending,1,'Both hosts share the existing scheduler RAF');
    frames(browser);
    assert(variant.getStatus().tick>0);
    const before=peer.getState().tick;
    variant.dispose();variant.dispose();
    assert.equal(scheduler.size,1);
    assert.equal(canvas.listenerCount,0);
    assert.equal(browser.pending,1);
    frames(browser);
    assert(peer.getState().tick>before,'Releasing the variant cannot stop its Original peer');
    peer.dispose();assertReleased(browser,canvas,scheduler);
    assert.equal(peerCanvas.listenerCount,0);
  }
});

test('dispose-then-mount switching on one canvas leaves one owner and preserves a requested pause', () => {
  const browser=fakeBrowser(),canvas=canvasFor(browser),scheduler=getBrowserScheduler(browser.view);
  let active=publicDragonfly.createDragonflyArtwork(canvas,{frameSource:scheduler});
  for(let cycle=0;cycle<3;cycle++) {
    frames(browser);
    active.setPaused(true);
    const paused=active.getStatus().paused;
    active.dispose();assertReleased(browser,canvas,scheduler);
    active=mountKiteScout(canvas,{frameSource:scheduler,paused,model:{motion:'slow'}});
    assert.equal(active.getStatus().paused,true);
    assert.equal(active.getStatus().requestedMotion,'slow');
    assert.equal(scheduler.size,0);
    active.setPaused(false);
    assert.equal(scheduler.size,1);
    assert.equal(browser.pending,1);
    assert.equal(browser.resizes.size,1);
    assert.equal(browser.intersections.size,1);
    frames(browser);
    active.dispose();assertReleased(browser,canvas,scheduler);
    active=publicDragonfly.createDragonflyArtwork(canvas,{frameSource:scheduler});
    assert.equal(active.getStatus().samples,3874);
    assert.equal(scheduler.size,1);
  }
  active.dispose();assertReleased(browser,canvas,scheduler);
});

test('Original and Kite Scout retain phone bounds and spend no ticks or draws while suspended', () => {
  for(const mount of [publicDragonfly.createDragonflyArtwork,mountKiteScout]) {
    const browser=fakeBrowser({dpr:3}),canvas=canvasFor(browser),scheduler=getBrowserScheduler(browser.view);
    const host=mount(canvas,{frameSource:scheduler});
    assert.equal(host.getStatus().cols,72);assert.equal(host.getStatus().rows,44);
    assert.equal(host.getStatus().dpr,2);assert.equal(canvas.width,780);assert.equal(canvas.height,720);
    frames(browser);
    browser.intersect(canvas,false);
    const rest=host.getStatus();
    host.setTarget(.9,-.3);host.dart();host.render();frames(browser,4);
    const after=host.getStatus();
    assert.equal(after.tick,rest.tick);assert.equal(after.renderedFrames,rest.renderedFrames);
    assert.equal(after.pendingInputs,0);assert.equal(scheduler.size,0);assert.equal(browser.pending,0);
    browser.hide(true);browser.intersect(canvas,true);
    assert.equal(scheduler.size,0,'Visibility causes compose independently');
    resize(browser,canvas,0,0);browser.hide(false);
    assert.equal(scheduler.size,0);assert.equal(canvas.width,0);assert.equal(canvas.height,0);
    resize(browser,canvas,390,360);
    assert.equal(scheduler.size,1);
    browser.frame(60_000);
    assert.equal(host.getStatus().tick,rest.tick,'Resume does not catch up the suspended interval');
    frames(browser);
    assert(host.getStatus().tick>rest.tick);
    host.dispose();assertReleased(browser,canvas,scheduler);
  }
});

test('Original and Kite Scout keep reduced motion, pause, mobile guidance and touch scrolling independent', () => {
  for(const mount of [publicDragonfly.createDragonflyArtwork,mountKiteScout]) {
    const browser=fakeBrowser({reducedMotion:true}),canvas=canvasFor(browser),scheduler=getBrowserScheduler(browser.view);
    const host=mount(canvas,{frameSource:scheduler,model:{motion:'slow'}});
    const still=host.exportText();
    host.dart();assert.notEqual(host.exportText(),still);
    host.setPaused(false);frames(browser);
    assert.equal(host.getStatus().tick,0);assert.equal(scheduler.size,0);
    host.setPaused(true);host.reset();browser.setReduced(false);
    assert.equal(host.getStatus().paused,true);assert.equal(host.getStatus().requestedMotion,'slow');
    assert.equal(scheduler.size,0);
    host.setPaused(false);frames(browser);
    const touch={type:'pointerdown',pointerType:'touch',button:0,clientX:370,clientY:80,
      preventDefault(){this.defaultPrevented=true;}};
    canvas.emit('pointerdown',touch);browser.frame();
    assert.equal(touch.defaultPrevented,undefined,'Touch guidance does not cancel page scrolling');
    assert(host.getState().target.x>0);
    const tab={key:'Tab',preventDefault(){this.defaultPrevented=true;}};
    canvas.emit('keydown',tab);assert.equal(tab.defaultPrevented,undefined);
    assert.equal(browser.document.listeners.get('keydown'),undefined);
    host.dispose();assertReleased(browser,canvas,scheduler);
  }
});

test('a failed borrowed-source subscription rolls back the private variant setup', () => {
  const browser=fakeBrowser(),canvas=canvasFor(browser),scheduler=getBrowserScheduler(browser.view);
  assert.throws(()=>mountKiteScout(canvas,{frameSource:{subscribe(){throw new Error('injected clock failure');}}}),/injected clock failure/);
  assertReleased(browser,canvas,scheduler);
});

test('the private entry imports on a server without reading DOM globals or starting a clock', () => {
  const entry=new URL('../lib/variants/kite-scout/index.js',import.meta.url).href;
  execFileSync(process.execPath,['--input-type=module','-e',
    `for(const key of ['window','document','requestAnimationFrame'])Object.defineProperty(globalThis,key,{get(){throw new Error('DOM read: '+key);}});await import(${JSON.stringify(entry)});`],
    {stdio:'pipe'});
});
