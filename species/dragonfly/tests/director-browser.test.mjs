import test from 'node:test';
import assert from 'node:assert/strict';
import { mountDragonfly } from '../lib/browser.js';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';

// Instrumented subscriptions and numerical Canvas stubs only. These tests do not
// launch a browser, certify appearance/accessibility, or measure native performance.
function fixture({ reduced = false, unsupported = false, setupFailure = false } = {}) {
  const browser = fakeBrowser({ reducedMotion: reduced });
  const canvases = [], subscriptions = new Set(), callbacks = [];
  let time = 1000, subscribeCalls = 0, releaseCalls = 0, maximumSubscriptions = 0, sourceDisposals = 0;
  let drawCalls = 0;
  browser.document.fonts = new browser.document.constructor();
  if (setupFailure) {
    const ParentObserver = browser.view.ResizeObserver;
    browser.view.ResizeObserver = class extends ParentObserver {
      observe(target) { super.observe(target); throw new Error('Injected director observer failure'); }
    };
  }
  const source = {
    subscribe(callback) {
      subscribeCalls++;
      const entry = { callback }; subscriptions.add(entry); callbacks.push(callback);
      maximumSubscriptions = Math.max(maximumSubscriptions, subscriptions.size);
      let active = true;
      return () => { if (active) { active = false; releaseCalls++; subscriptions.delete(entry); } };
    },
    // This deliberately exceeds the borrowed interface to detect improper ownership.
    dispose() { sourceDisposals++; subscriptions.clear(); },
  };
  function canvas(width = 900, height = 600) {
    const element = browser.canvas(width, height), context = element.getContext('2d');
    context.measureText = () => ({ width: 5 });
    context.fillText = () => { drawCalls++; };
    if (unsupported) element.getContext = () => null;
    canvases.push(element); return element;
  }
  const surface = canvas();
  return {
    browser, canvas: surface, makeCanvas: canvas, source, callbacks,
    get active() { return subscriptions.size; },
    get maximum() { return maximumSubscriptions; },
    get subscribeCalls() { return subscribeCalls; },
    get releaseCalls() { return releaseCalls; },
    get sourceDisposals() { return sourceDisposals; },
    get draws() { return drawCalls; },
    get listeners() {
      return canvases.reduce((count, element) => count + element.listenerCount, 0) +
        browser.view.listenerCount + browser.document.listenerCount + browser.motion.listenerCount + browser.document.fonts.listenerCount;
    },
    emitTime(timestamp) {
      for (const entry of [...subscriptions]) if (subscriptions.has(entry)) entry.callback(timestamp);
    },
    frame(delta = 1000 / 60) { time += delta; this.emitTime(time); },
    resize(width, height, element = surface) {
      element.rect = { ...element.rect, width, height };
      for (const observer of browser.resizes) if (observer.target === element) observer.callback([]);
    },
    pointer(type, fields = {}) {
      const event = { type, clientX: 650, clientY: 250, button: 0, pointerType: 'mouse', ...fields };
      surface.emit(type, event); return event;
    },
    key(key, fields = {}) {
      const event = { type: 'keydown', key, preventDefault() { this.defaultPrevented = true; }, ...fields };
      surface.emit('keydown', event); return event;
    },
  };
}
function mount(f, patch = {}) { return mountDragonfly(f.canvas, { frameSource: f.source, director: {}, ...patch }); }
function advance(f, frames = 3, delta = 1000 / 60) { for (let i = 0; i < frames; i++) f.frame(delta); }
function member(host, id = host.getDirectorState().selected) { return host.getDirectorState().members.find(value => value.id === id); }

test('one borrowed subscription drives one or four members and does not own its peer/source', () => {
  const f = fixture(); let peerFrames = 0;
  const stopPeer = f.source.subscribe(() => peerFrames++);
  const before = f.subscribeCalls, host = mount(f, { director: { count: 4 } });
  assert.equal(f.subscribeCalls-before, 1, 'Four members must not create four scene subscriptions');
  assert.equal(f.active, 2); assert.equal(f.browser.pending, 0, 'Injected source replaces private RAF scheduling');
  assert.equal(host.getStatus().queuedFrames, 1); assert.equal(host.getDirectorState().members.length, 4);
  advance(f);
  assert(host.getDirectorState().tick > 0); assert(host.getDirectorState().members.every(value => value.modelTick > 0));
  assert(host.getStatus().samples > 6144 && host.getStatus().samples <= 4*6144, 'The merged surface samples the group');
  for (const count of [1,4,2,3]) {
    const tick = host.getDirectorState().tick;
    host.configureDirector({ count });
    assert.equal(host.getDirectorState().tick, tick); assert.equal(host.getDirectorState().members.length, count);
    assert.equal(f.active, 2); assert.equal(host.getStatus().queuedFrames, 1); assert.equal(f.browser.pending, 0);
    advance(f, 2);
  }
  assert.equal(f.maximum, 2, 'A population update never overlaps old/new scene subscriptions');
  host.dispose(); host.dispose();
  assert.equal(f.active, 1); assert.equal(f.sourceDisposals, 0); assert.equal(f.listeners, 0);
  const priorPeerFrames = peerFrames; f.frame(); assert.equal(peerFrames, priorPeerFrames+1);
  stopPeer(); assert.equal(f.active, 0);
});

test('director remains opt-in and preserves existing single-model host methods', () => {
  const f = fixture(), solo = mountDragonfly(f.canvas, { frameSource: f.source });
  assert.equal(solo.getDirectorState(), null); assert.equal(solo.getDirectorOptions(), null); assert.equal(solo.getStatus().director, null);
  assert.equal(solo.getState().species, 'dragonfly-v1'); assert.equal(solo.getOptions().seed, 17);
  for (const action of [() => solo.configureDirector({ count: 2 }), () => solo.selectIndividual(0),
    () => solo.cue('perch'), () => solo.cue('return')]) assert.throws(action, /director|enabled/i);
  advance(f, 2); solo.cue('dart'); f.frame();
  assert.equal(solo.getState().behavior.kind, 'dart');
  solo.setPaused(true); solo.reset();
  assert.equal(solo.getStatus().paused, true); assert.equal(f.active, 0);
  solo.dispose(); assert.equal(f.listeners, 0);
});

test('selection, pointer and deliberate cue coalesce into three ordered next-tick inputs', () => {
  const f = fixture(), host = mount(f, { director: { count: 4, scene: 'patrol' } });
  advance(f, 2);
  const id = host.getDirectorState().members.at(-1).id, seq = host.getDirectorState().lastSeq;
  for (let i=0;i<5000;i++) f.pointer('pointermove', { clientX: 200+i%600, clientY: 180 });
  for (let i=0;i<500;i++) { host.selectIndividual(id); host.cue('dart'); }
  host.setTarget(.9,-.4);
  assert.equal(host.getStatus().pendingInputs, 3);
  f.frame();
  const scene = host.getDirectorState();
  assert.equal(scene.lastSeq, seq+3); assert.equal(scene.selected, id);
  assert.deepEqual(scene.target, { x: .9, y: -.4 });
  assert.equal(member(host,id).phase.kind, 'launch');
  assert.equal(scene.members.filter(value => value.phase.kind === 'launch').length, 1);
  assert.equal(host.getStatus().pendingInputs, 0); assert.equal(f.active, 1);
  host.dispose();
});

test('population changes drop stale queued selection without resetting retained member clocks', () => {
  const f = fixture(), host = mount(f, { director: { count: 4 } });
  advance(f, 3); host.selectIndividual(3); host.cue('perch'); host.setTarget(1,1);
  const before = host.getDirectorState(), retained = before.members.slice(0,2);
  host.configureDirector({ count: 2 });
  const after = host.getDirectorState();
  assert.equal(after.tick,before.tick); assert.deepEqual(after.members.map(value => value.id), retained.map(value => value.id));
  assert.deepEqual(after.members.map(value => value.modelTick), retained.map(value => value.modelTick));
  assert(after.members.some(value => value.id === after.selected)); assert.equal(host.getStatus().pendingInputs,0);
  advance(f,2); assert.equal(host.getDirectorState().members.length,2); assert.equal(f.active,1);
  host.dispose();
});

test('touch guides the selected individual; the existing dart method remains deliberate and selected', () => {
  const f=fixture(),host=mount(f,{director:{count:3}}); advance(f,2);
  host.selectIndividual(2);
  f.pointer('pointerdown',{pointerType:'touch',clientX:675,clientY:150});
  assert.equal(host.getStatus().pendingInputs,2); f.frame();
  assert.equal(host.getDirectorState().selected,2);
  assert.deepEqual(host.getDirectorState().target,{x:.5,y:-.5});
  assert.equal(member(host,2).phase.kind,'attention','A touch guides without an implicit dart');
  assert(host.getDirectorState().members.every(value=>value.phase.kind!=='launch'&&value.phase.kind!=='dart'));
  f.pointer('pointerdown',{pointerType:'mouse',button:2});
  assert.equal(host.getStatus().pendingInputs,0,'A secondary mouse button does not guide');
  host.dart(); assert.equal(host.getStatus().pendingInputs,1); f.frame();
  assert.equal(member(host,2).phase.kind,'launch'); assert.notEqual(member(host,0).phase.kind,'launch');
  f.pointer('pointercancel',{pointerType:'touch'});
  assert.equal(host.getDirectorState().target,null); assert.equal(f.active,1);
  host.dispose();
});

test('paused reset, model/director configuration and preferences preserve the independent user pause', () => {
  const f = fixture(), host = mount(f, { director: { count: 3, scene: 'relay' } });
  advance(f,5); host.setPaused(true);
  assert.equal(f.active,0); const tick = host.getDirectorState().tick; assert(tick>0);
  host.configureDirector({ count: 4, route: 'orbit', tempo: .8 });
  host.configure({ wingHz:2, motion:'slow' }); host.reset(42);
  f.browser.hide(true); f.browser.hide(false); f.browser.setReduced(true); f.browser.setReduced(false);
  assert.equal(host.getStatus().paused,true); assert.equal(host.getDirectorState().tick,0); assert.equal(f.active,0);
  assert.equal(host.getDirectorState().members.length,4); assert.equal(host.getDirectorOptions().route,'orbit');
  assert.equal(host.getOptions().seed,42); assert.equal(host.getOptions().wingHz,2); assert.equal(host.getOptions().motion,'slow');
  const initial = host.exportText(); host.cue('dart');
  assert.notEqual(host.exportText(),initial); assert.equal(host.getDirectorState().tick,0); assert.equal(f.active,0);
  host.setPaused(false); assert.equal(f.active,1); advance(f,2); assert.equal(host.getDirectorState().tick,1);
  host.dispose();
});

test('reduced motion stills all members; pointer/play cannot resume and explicit pose/selection remain usable', () => {
  const f = fixture({reduced:true}), host = mount(f,{director:{count:4},model:{motion:'slow'}});
  assert.equal(host.getStatus().motion,'static'); assert.equal(host.getStatus().requestedMotion,'slow');
  assert.equal(f.active,0); assert(f.draws>0); assert(host.getDirectorState().members.every(value => value.modelTick===0));
  const before = host.getDirectorState(), poster = host.exportText();
  for(let i=0;i<1000;i++) f.pointer('pointermove',{clientX:100+i%700});
  host.setPaused(false); assert.equal(f.active,0); assert.equal(host.getStatus().pendingInputs,0);
  assert.deepEqual(host.getDirectorState(),before); assert.equal(host.exportText(),poster);
  host.selectIndividual(3); assert.equal(host.getDirectorState().selected,3); assert.equal(host.getDirectorState().tick,0);
  const selectedPoster=host.exportText(); host.cue('perch');
  assert.notEqual(host.exportText(),selectedPoster); assert.equal(host.getDirectorState().tick,0); assert.equal(f.active,0);
  host.configure({motion:'full'}); assert.equal(host.getOptions().motion,'static');
  host.setPaused(true); f.browser.setReduced(false); assert.equal(host.getOptions().motion,'full'); assert.equal(f.active,0);
  host.setPaused(false); assert.equal(f.active,1); advance(f,2); assert.equal(host.getDirectorState().tick,1);
  host.dispose();
});

test('hidden/offscreen/zero-size causes compose, discard queued commands and do not replay suspended time', () => {
  const f=fixture(); const stopPeer=f.source.subscribe(()=>{});
  const host=mount(f,{director:{count:4}}); advance(f,4);
  const tick=host.getDirectorState().tick;
  function assertSuspendedCommandsDiscarded() {
    const before=host.getDirectorState(),draws=f.draws;
    host.selectIndividual(3); host.setTarget(.8,-.3); host.cue('perch'); host.dart();
    assert.deepEqual(host.getDirectorState(),before); assert.equal(host.getStatus().pendingInputs,0);
    assert.equal(f.draws,draws,'Suspended input must not redraw a hidden surface');
  }
  host.selectIndividual(3); host.setTarget(.8,.3); host.cue('dart');
  f.browser.hide(true); assert.equal(f.active,1); assert.equal(host.getStatus().pendingInputs,0); assert.equal(host.getDirectorState().target,null);
  assertSuspendedCommandsDiscarded();
  f.browser.intersect(f.canvas,false); f.browser.hide(false); assert.equal(f.active,1); assertSuspendedCommandsDiscarded();
  f.resize(0,0); f.browser.intersect(f.canvas,true); assert.equal(f.active,1); assert.equal(f.canvas.width,0); assert.equal(f.canvas.height,0);
  assertSuspendedCommandsDiscarded();
  host.setPaused(true); f.resize(900,600); assert.equal(f.active,1);
  advance(f,2,60_000); assert.equal(host.getDirectorState().tick,tick);
  host.setPaused(false); assert.equal(f.active,2);
  f.frame(60_000); assert.equal(host.getDirectorState().tick,tick,'First resumed callback only establishes the clock origin');
  f.frame(); assert.equal(host.getDirectorState().tick,tick+1); assert.equal(host.getStatus().pendingInputs,0);
  assert.equal(host.getDirectorState().selected,0,'Discarded hidden selection must not reappear');
  host.dispose(); stopPeer(); assert.equal(f.active,0); assert.equal(f.sourceDisposals,0);
});

test('catch-up is five scene ticks regardless of population; pointer cancellation clears the shared target', () => {
  const f=fixture(),host=mount(f,{director:{count:4}});
  f.frame(); host.setTarget(.8,-.5); f.frame(5000);
  assert.equal(host.getDirectorState().tick,5); assert(host.getDirectorState().members.every(value => value.modelTick===5));
  assert(host.getStatus().droppedMilliseconds>4900); assert.equal(f.active,1);
  for(const type of ['pointerleave','pointercancel','lostpointercapture']) {
    host.setTarget(.7,0); f.frame(); assert.notEqual(host.getDirectorState().target,null);
    f.pointer(type); assert.equal(host.getDirectorState().target,null); assert.equal(host.getStatus().pendingInputs,0);
  }
  host.dispose();
});

test('a deliberately perched member ignores pointer motion until a deliberate return cue', () => {
  const f=fixture(),host=mount(f,{director:{count:1,scene:'patrol',tempo:1.6}});
  advance(f,2); host.cue('perch'); f.frame();
  let frames=0;
  while(member(host).phase.kind!=='perched' && frames++<200) f.frame(5*1000/60);
  assert.equal(member(host).phase.kind,'perched','Perch cue must finish landing within a bounded interval');
  const pose=member(host).position;
  for(let i=0;i<50;i++) {
    f.pointer('pointermove',{clientX:i%2?20:880,clientY:i%2?30:580}); f.frame(5*1000/60);
    assert.equal(member(host).phase.kind,'perched'); assert.deepEqual(member(host).position,pose);
  }
  // Releasing a held perch now includes a visible wing spool-up and lift before
  // the route return. The public cue remains 'return'.
  host.cue('return'); f.frame(); assert.equal(member(host).phase.kind,'launch');
  host.dispose();
});

test('keyboard selection remains canvas-scoped; invalid director mutations reject atomically', () => {
  const f=fixture(),host=mount(f,{director:{count:4}}); advance(f,2);
  const key=f.key('4'); assert.equal(key.defaultPrevented,true); f.frame(); assert.equal(host.getDirectorState().selected,3);
  const tab=f.key('Tab'); assert.equal(tab.defaultPrevented,undefined);
  assert.equal(f.browser.document.listeners.get('keydown'),undefined); assert.equal(f.browser.view.listeners.get('keydown'),undefined);
  const snapshot=host.getDirectorState(),options=host.getDirectorOptions(),pending=host.getStatus().pendingInputs;
  for(const mutation of [()=>host.configureDirector({count:5}),()=>host.configureDirector({scene:'relay',tempo:NaN}),
    ()=>host.configureDirector({roles:['patroller']}),()=>host.selectIndividual(4),()=>host.selectIndividual(.5),()=>host.cue('zoom')]) assert.throws(mutation);
  assert.deepEqual(host.getDirectorState(),snapshot); assert.deepEqual(host.getDirectorOptions(),options);
  assert.equal(host.getStatus().pendingInputs,pending); assert.equal(f.active,1);
  assert(Object.isFrozen(snapshot)); assert(Object.isFrozen(snapshot.members)); assert(Object.isFrozen(snapshot.members[0].position));
  assert.throws(()=>{snapshot.members[0].position.x=100;},TypeError);
  const space=f.key(' ',{code:'Space'}); assert.equal(space.defaultPrevented,true); assert.equal(f.active,0);
  host.dispose();
});

test('director canvas budgets survive huge DPR resize without multiplying per-member backing stores', () => {
  const f=fixture(),host=mount(f,{director:{count:4}});
  f.browser.view.devicePixelRatio=3; f.resize(30_000,12_000);
  const status=host.getStatus();
  assert.equal(status.dpr,2); assert.equal(f.canvas.width,2400); assert.equal(f.canvas.height,1400);
  assert(status.cols<=160&&status.rows<=88); assert(status.samples<=4*6144); assert.equal(f.active,1); assert.equal(f.browser.pending,0);
  f.resize(360,286); assert.equal(host.getStatus().cols,72); assert.equal(host.getStatus().rows,44);
  assert.equal(host.getDirectorState().members.length,4,'A small viewport cannot silently drop selected population');
  host.dispose();
});

test('two ensemble hosts share an injected source but dispose independently', () => {
  const f=fixture(),otherCanvas=f.makeCanvas();
  const first=mount(f,{director:{count:4}}),second=mountDragonfly(otherCanvas,{frameSource:f.source,director:{count:2},model:{seed:42}});
  assert.equal(f.active,2); advance(f,3);
  const before=second.getDirectorState().tick;
  first.dispose(); assert.equal(f.active,1); advance(f,2); assert(second.getDirectorState().tick>before);
  assert.equal(second.getDirectorState().members.length,2); assert.equal(second.getOptions().seed,42);
  second.dispose(); assert.equal(f.active,0); assert.equal(f.listeners,0); assert.equal(f.sourceDisposals,0);
});

test('idempotent director disposal releases ownership and ignores saved late callbacks', () => {
  const f=fixture(); let peerFrames=0; const stopPeer=f.source.subscribe(()=>peerFrames++);
  const host=mount(f,{director:{count:4}}); advance(f,3);
  const savedFrame=f.callbacks.at(-1),savedResize=[...f.browser.resizes][0].callback,savedIntersection=[...f.browser.intersections][0].callback;
  const savedKey=[...f.canvas.listeners.get('keydown')][0],snapshot=host.getDirectorState();
  host.dispose(); host.dispose(); const draws=f.draws;
  assert.equal(f.active,1); assert.equal(f.listeners,0); assert.equal(f.browser.resizes.size,0); assert.equal(f.browser.intersections.size,0);
  assert.equal(f.canvas.width,0); assert.equal(f.canvas.height,0);
  savedFrame(100_000); savedResize([]); savedIntersection([{target:f.canvas,isIntersecting:true}]);
  savedKey({key:'4',preventDefault(){throw new Error('Disposed key handler must not act');}});
  assert.equal(f.draws,draws); assert.equal(f.active,1); assert.deepEqual(host.getDirectorState(),snapshot);
  for(const mutation of [()=>host.configureDirector({count:1}),()=>host.selectIndividual(0),()=>host.cue('perch'),
    ()=>host.dart(),()=>host.reset(),()=>host.setPaused(false),()=>host.render()]) assert.throws(mutation,/disposed/);
  const peerBefore=peerFrames; f.frame(); assert.equal(peerFrames,peerBefore+1); stopPeer();
  assert.equal(f.sourceDisposals,0);
});

test('failed setup, rejected subscription and consumer callback failures leave no owned scene resources', () => {
  for(const settings of [{setupFailure:true},{unsupported:true}]) {
    const f=fixture(settings); assert.throws(()=>mount(f));
    assert.equal(f.listeners,0); assert.equal(f.active,0); assert.equal(f.browser.resizes.size,0); assert.equal(f.browser.intersections.size,0);
  }
  const rejected=fixture(); const stopPeer=rejected.source.subscribe(()=>{});
  assert.throws(()=>mount(rejected,{frameSource:{subscribe(){throw new Error('Injected subscription failure');}}}),/subscription failure/);
  assert.equal(rejected.listeners,0); assert.equal(rejected.active,1); assert.equal(rejected.browser.resizes.size,0); stopPeer();
  const callback=fixture(); const releasePeer=callback.source.subscribe(()=>{});
  assert.throws(()=>mount(callback,{onStatus(){throw new Error('Injected consumer failure');}}),/consumer failure/);
  assert.equal(callback.listeners,0); assert.equal(callback.active,1); assert.equal(callback.browser.resizes.size,0);
  assert.equal(callback.browser.intersections.size,0); assert.equal(callback.sourceDisposals,0); releasePeer();
  const later=fixture(); const releaseLaterPeer=later.source.subscribe(()=>{}); let fail=false;
  const host=mount(later,{onStatus(){if(fail) throw new Error('Injected runtime status failure');}});
  later.frame(); fail=true; host.cue('dart');
  assert.throws(()=>later.frame(),/runtime status failure/);
  assert.equal(host.getStatus().disposed,true); assert.equal(later.active,1); assert.equal(later.listeners,0);
  assert.equal(later.browser.resizes.size,0); assert.equal(later.browser.intersections.size,0); releaseLaterPeer();
});

test('a malformed borrowed frame timestamp disposes only the failing ensemble', () => {
  const f=fixture(); const stopPeer=f.source.subscribe(()=>{}); const host=mount(f,{director:{count:4}});
  assert.throws(()=>f.emitTime(NaN),/finite/);
  assert.equal(host.getStatus().disposed,true); assert.equal(f.active,1); assert.equal(f.listeners,0);
  assert.equal(f.sourceDisposals,0); stopPeer();
});
