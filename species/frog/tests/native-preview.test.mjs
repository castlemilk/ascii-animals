import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const { nativePreview } = process.env.FROG_NATIVE_CASE ? await import('../scripts/native-host.mjs') : {};
import { createFrog, stepFrog, FROG_DEFAULTS } from '../generated/frog.mjs';
import { createLegacyFrogPreview, validatePreview } from '../generated/legacy-preview.mjs';
const log=[{tick:1,seq:0,type:'target',x:.65,y:.05},{tick:12,seq:1,type:'leap'},{tick:16,seq:2,type:'leap'},{tick:24,seq:3,type:'leave'}];

// Native font/bitmap caches are outside JS heap accounting. The combined
// in-process stress run was killed by this managed runtime; run each identical
// case in a fresh process, then release the native runtime with the process.
// This is test isolation, not a browser memory/lifecycle performance claim.
if (!process.env.FROG_NATIVE_CASE) {
  for (const pattern of ['actual legacy cells','actual cell export','actual projection','private adapter']) {
    test(`native Canvas / ${pattern}`, () => {
      // A nested `node --test` must start its own reporter, rather than inherit
      // the parent's internal test-runner child protocol.
      const { NODE_TEST_CONTEXT: inheritedTestContext, ...childEnvironment } = process.env;
      const child = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-name-pattern=^${pattern}`, import.meta.filename], {
        env: { ...childEnvironment, FROG_NATIVE_CASE: '1' }, encoding: 'utf8', maxBuffer: 1024 * 1024,
      });
      assert.equal(child.status, 0, child.stdout + child.stderr + String(child.error ?? child.signal ?? ''));
      assert.match(child.stdout, /# pass 1\b/);
    });
  }
} else {

test('actual legacy cells match across 1/2/5 presentation grouping and native Canvas generates pixels',()=>{
  const {canvas,preview}=nativePreview(320,240,{cols:72,rows:40});
  const run=group=>{let state=createFrog();const cells=[];
    for(let tick=1;tick<=120;tick++){state=stepFrog(state,tick,log.filter(e=>e.tick===tick)).state;if(tick%group===0){preview.draw(state);canvas.toBuffer('image/png');}if(tick%10===0)cells.push(preview.toText());}
    const frame=preview.draw(state),png=canvas.toBuffer('image/png');assert(png.length>2000);assert.equal(frame.samples,17918);return{state,cells};};
  const everyTick=run(1);assert.deepEqual(everyTick,run(2));assert.deepEqual(everyTick,run(5));preview.dispose();
});

test('actual cell export is bounded printable ASCII; resize clamps DPR and absolute backing work',()=>{
  const {canvas,preview}=nativePreview(720,540);preview.draw(createFrog());const initial=preview.toText().split('\n');
  assert(initial.every(row=>row.length===144));assert.equal(initial.length,80);assert.match(initial.join('\n'),/^[\x20-\x7e\n]+$/);
  preview.resize(9000,5000,3);const r=preview.draw(createFrog());assert(canvas.width<=2400&&canvas.height<=1400);assert(r.cols*r.rows<=18000);assert(r.glyphs>100);
  assert.deepEqual(preview.targetAt({x:999,y:-999}),{x:1,y:-1});
  const prior=preview.toText();assert.throws(()=>preview.update({cols:100000}),/cols/);assert.equal(preview.toText(),prior);
  assert.throws(()=>preview.resize(0,10,1),/Positive/);assert.throws(()=>preview.resize(320,240,NaN),/DPR/);
  preview.dispose();preview.dispose();assert.equal(canvas.width,1);assert.throws(()=>preview.draw(createFrog()),/disposed/);
});

test('actual projection retains all extreme geometry inside viewport through the declared jump envelope',()=>{
  const {canvas,preview}=nativePreview(320,240,{cols:72,rows:40});
  for(const x of [-.9,.9])for(const y of [-.75,.75])for(const view of ['front','left','right','profile']){
    let state=createFrog({config:{...FROG_DEFAULTS,size:1.15,jumpHeight:1.1,maxDistance:1.5}});
    for(let tick=1;tick<=110;tick++){
      state=stepFrog(state,tick,tick===1?[{type:'target',x,y,tick,seq:0},{type:'leap',tick,seq:1}]:[]).state;
      if(tick%5===0){const frame=preview.draw(state,{view});canvas.toBuffer('image/png');const b=frame.geometry.bounds;const scale=Math.min(320/6.2,240/4.8),cx=160,cy=240*.56;
        assert(cx+b.min.x*scale>=0&&cx+b.max.x*scale<=320);assert(cy+b.min.y*scale>=0&&cy+b.max.y*scale<=240);}
    }
  }
  preview.dispose();
});

test('private adapter is self-contained and rejects missing Canvas and invalid configuration',()=>{
  assert.throws(()=>validatePreview({view:'dorsal'}),/view/);assert.throws(()=>validatePreview({silhouette:'yes'}),/boolean/);
  assert.throws(()=>createLegacyFrogPreview({ownerDocument:{defaultView:{}},getContext:()=>null}),/Canvas 2D/);
  const {preview}=nativePreview();assert(preview.draw(createFrog()).glyphs>50);preview.dispose();
});
}
