/** Real controller/scheduler and real numerical previews on controlled host doubles.
 * Establishes input/lifecycle bookkeeping, not browser pixels or device acceptance.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrogArtwork} from '../../../../../lib/public/frog.js';
import {createSpringPeaArtwork} from '../index.mjs';
import {makeHost} from '../../../tests/fake-host.mjs';
import {fakeBrowser} from '../../../../../test/helpers/fake-browser.mjs';

function drawingHost(options={}){
  const host=makeHost({width:720,height:540,...options}),numerical=fakeBrowser(),makeCanvas=host.canvas;
  host.errors=[];host.window.setTimeout=callback=>{host.errors.push(callback);return 1;};
  host.window.innerWidth=1280;host.window.innerHeight=800;
  host.document.createElement=name=>{
    assert.equal(name,'canvas');const canvas=numerical.canvas(1,1);canvas.ownerDocument=host.document;return canvas;
  };
  host.canvas=()=>{
    const canvas=makeCanvas(),context=numerical.canvas().getContext('2d');canvas.drawCalls=0;
    for(const name of['clearRect','fillRect','fillText','drawImage']){
      const original=context[name].bind(context);
      context[name]=(...args)=>{canvas.drawCalls++;return original(...args);};
    }
    canvas.getContext=()=>context;
    canvas.getBoundingClientRect=()=>({...canvas.rect,right:canvas.rect.left+canvas.rect.width,bottom:canvas.rect.top+canvas.rect.height});
    return canvas;
  };
  return host;
}
function noResources(host){
  assert.equal(host.frames.size,0);assert.equal(host.listenerCount,0);assert.equal(host.errors.length,0);
  assert(host.resizeObservers.every(observer=>observer.disconnected&&observer.targets.size===0));
  assert(host.intersectionObservers.every(observer=>observer.disconnected&&observer.targets.size===0));
}
const copy=value=>JSON.parse(JSON.stringify(value));
const factories=[['Original',createFrogArtwork],['Spring Pea R2',createSpringPeaArtwork]];

test('private wrapper mirrors facade option validation and never mutates caller options',()=>{
  const host=drawingHost(),canvas=host.canvas();
  for(const options of[null,[],42,'frog',false]){
    let originalError,variantError;
    try{createFrogArtwork(canvas,options);}catch(error){originalError=error;}
    try{createSpringPeaArtwork(canvas,options);}catch(error){variantError=error;}
    assert(originalError instanceof TypeError);assert(variantError instanceof TypeError);
    assert.equal(variantError.message,originalError.message);
  }
  const injected=()=>{throw new Error('caller factory must not replace private opt-in presentation');};
  const options=Object.freeze({seed:23,paused:true,preview:Object.freeze({cols:72,rows:40}),previewFactory:injected});
  const art=createSpringPeaArtwork(canvas,options);
  try{
    assert.equal(options.previewFactory,injected);assert.equal(options.paused,true);
    assert.deepEqual(options.preview,{cols:72,rows:40});assert.equal(art.getState().seed,23);
    assert.equal(host.frames.size,0);
  }finally{art.dispose();}
  noResources(host);
});

test('Original and R2 share the canonical browser scheduler and remain independently owned',()=>{
  const host=drawingHost(),ca=host.canvas(),cb=host.canvas();
  const original=createFrogArtwork(ca,{seed:23}),variant=createSpringPeaArtwork(cb,{seed:23});
  try{
    assert.equal(host.frames.size,1,'one requestAnimationFrame for both artwork instances');
    assert(Object.isFrozen(original)&&Object.isFrozen(variant));
    assert.deepEqual(Object.keys(variant).sort(),Object.keys(original).sort(),'same facade shape');
    assert.equal(original.species,'frog');assert.equal(variant.species,'frog');
    original.target({x:.6,y:-.2});variant.target({x:.6,y:-.2});original.pulse();variant.pulse();
    host.flush(0);host.flush(34);assert.deepEqual(variant.getState(),original.getState());
    assert.notEqual(variant.exportText(),original.exportText(),'rendering differs while state is shared in contract');
    original.pause();const frozen=original.getState();host.flush(68);
    assert.equal(original.getState(),frozen);assert(variant.getState().tick>frozen.tick);assert.equal(host.frames.size,1);
    variant.pause();assert.equal(host.frames.size,0);
    original.restart();assert(original.getStatus().paused);assert.equal(host.frames.size,0);
    variant.play();assert.equal(host.frames.size,1);original.dispose();assert.equal(host.frames.size,1);
    variant.dispose();assert.equal(host.frames.size,0);
  }finally{original.dispose();variant.dispose();}
  noResources(host);assert.equal(ca.width,1);assert.equal(cb.width,1);
});

for(const[name,factory]of factories){
  test(`${name}: offscreen/hidden/zero-size gates suspend actual drawing and preserve explicit pause`,()=>{
    const host=drawingHost(),canvas=host.canvas(),art=factory(canvas,{seed:23});
    try{
      host.flush(0);art.target({x:.6,y:-.2});art.pulse();assert.equal(art.getStatus().pendingInputs,2);
      canvas.rect.top=2000;host.intersect(canvas,false);
      const tick=art.getStatus().tick,draws=canvas.drawCalls,width=canvas.width;
      assert.equal(host.frames.size,0);assert.equal(art.getStatus().pendingInputs,0);
      for(let i=0;i<30;i++)canvas.fire('pointermove',{clientX:100+i,clientY:2010});
      canvas.rect.width=600;host.resize(canvas);host.flush(10000);
      assert.equal(art.getStatus().tick,tick);assert.equal(canvas.drawCalls,draws);assert.equal(canvas.width,width,'offscreen backing resize is deferred');
      host.hidden(true);canvas.rect.top=20;host.intersect(canvas,true);
      assert.equal(host.frames.size,0);assert.equal(canvas.drawCalls,draws,'hidden still blocks visible canvas');
      host.hidden(false);assert.equal(host.frames.size,1);assert(canvas.drawCalls>draws);assert.equal(canvas.width,600);
      host.flush(10000);assert.equal(art.getStatus().tick,tick,'resume starts a new clock without hidden catch-up');
      host.flush(20000);assert.equal(art.getStatus().tick,tick+5,'catch-up remains bounded at five ticks');
      art.pause();canvas.rect.width=0;host.resize(canvas);assert(art.getStatus().zeroSize);assert.equal(host.frames.size,0);
      canvas.rect.width=720;host.resize(canvas);assert(art.getStatus().paused);assert.equal(host.frames.size,0);
      art.restart();assert(art.getStatus().paused);assert.equal(host.frames.size,0);
    }finally{art.dispose();}
    noResources(host);
  });

  test(`${name}: live reduced motion selects meaningful stills without advancing or scheduling`,()=>{
    const host=drawingHost({reducedMotion:true}),canvas=host.canvas(),notices=[];
    const art=factory(canvas,{seed:23,director:{count:1,layout:'shelter',scene:'firefly-supper',autonomy:false},onAction:message=>notices.push(message)});
    try{
      const position=copy(art.getState().position),rest=art.exportText();
      art.play();art.pulse();const crouch=art.exportText();assert.equal(art.getStatus().staticPose,'crouch');
      art.hunt({x:.7,y:-.5});const hunt=art.exportText();
      assert.notEqual(crouch,rest);assert.notEqual(hunt,rest,'hunt has an explicit static response');
      for(let i=0;i<30;i++)canvas.fire('pointermove',{clientX:100+i,clientY:200});
      assert.equal(host.frames.size,0);assert.equal(art.getStatus().tick,0);assert.deepEqual(art.getState().position,position);
      assert(notices.length<10,'pointer traffic does not flood announcements');
      host.reduced(false);assert.equal(host.frames.size,1);host.flush(100);host.flush(134);assert.equal(art.getStatus().tick,2);
      host.reduced(true);const tick=art.getStatus().tick;host.flush(10000);
      assert.equal(host.frames.size,0);assert.equal(art.getStatus().tick,tick);
    }finally{art.dispose();}
    noResources(host);
  });

  test(`${name}: focused keyboard and deliberate touch use the canonical input pipeline`,()=>{
    const host=drawingHost(),canvas=host.canvas(),art=factory(canvas,{seed:23});
    try{
      assert.equal(canvas.fire('keydown',{key:'Enter',target:{tagName:'INPUT'}}).defaultPrevented,false);
      assert.equal(art.getStatus().pendingInputs,0);
      assert(canvas.fire('keydown',{key:'ArrowRight'}).defaultPrevented);
      assert(canvas.fire('keydown',{key:'Enter'}).defaultPrevented);
      assert.equal(art.getStatus().pendingInputs,2);host.flush(0);host.flush(34);
      assert.equal(art.getStatus().phase,'crouch');const latched=copy(art.getState().behavior.plan.to);
      for(let i=0;i<40;i++)canvas.fire('pointermove',{clientX:100+i*10,clientY:250});
      canvas.fire('keydown',{key:'Enter',repeat:true});assert(art.getStatus().pendingInputs<=2);
      host.flush(50);assert.deepEqual(art.getState().behavior.plan.to,latched,'busy aim does not move the committed landing');

      art.restart();canvas.fire('pointerdown',{pointerType:'touch',clientX:200,clientY:200});
      canvas.fire('pointermove',{pointerType:'touch',clientX:230,clientY:200});
      canvas.fire('pointerup',{pointerType:'touch',clientX:230,clientY:200});host.flush(100);host.flush(134);
      assert.equal(art.getStatus().phase,'idle','drag cancellation cannot leap');

      art.restart();canvas.fire('pointerdown',{pointerType:'touch'});canvas.fire('pointercancel',{pointerType:'touch'});
      canvas.fire('pointerup',{pointerType:'touch'});host.flush(200);host.flush(234);
      assert.equal(art.getStatus().phase,'idle','cancelled touch cannot leap');

      art.restart();canvas.fire('pointerdown',{pointerType:'touch',clientX:600,clientY:350});
      canvas.fire('pointerup',{pointerType:'touch',clientX:600,clientY:350});host.flush(300);host.flush(334);
      assert.equal(art.getStatus().phase,'crouch','a deliberate tap latches one leap');
      assert.notDeepEqual(art.getState().behavior.plan.to,art.getState().position);
    }finally{art.dispose();}
    noResources(host);
  });

  test(`${name}: disposal and failed setup release listeners, observers, frames and preview resources`,()=>{
    const host=drawingHost(),canvas=host.canvas(),art=factory(canvas,{seed:23});
    const savedFrame=[...host.frames.values()][0],savedPointer=canvas.saved.get('pointermove')[0];
    const savedMedia=host.media.saved.get('change')[0],resize=host.resizeObservers[0].callback;
    art.dispose();art.dispose();const draws=canvas.drawCalls;
    savedFrame(100000);savedPointer({pointerType:'mouse',clientX:200,clientY:200});savedMedia({matches:false});resize([{target:canvas}]);
    assert.equal(canvas.drawCalls,draws);assert.equal(canvas.width,1);assert(art.disposed);
    assert.throws(()=>art.getState(),/disposed/i);assert.throws(()=>art.pulse(),/disposed/i);noResources(host);

    const failing=drawingHost({resizeFailure:true}),failedCanvas=failing.canvas();
    assert.throws(()=>factory(failedCanvas),/resize observe failure/);assert.equal(failedCanvas.width,1);noResources(failing);
  });
}
