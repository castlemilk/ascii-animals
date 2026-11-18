/** Real native Canvas pixels/cells, no browser or timing claims. Isolated native caches per case. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createFrogPond, stepFrogPond, pondPointToWorld, posePondFrog } from '../generated/pond.mjs';
const { nativePreview } = process.env.FROG_NATIVE_DIRECTOR_CASE ? await import('../scripts/native-host.mjs') : {};
const copy = value => JSON.parse(JSON.stringify(value));
if (!process.env.FROG_NATIVE_DIRECTOR_CASE) {
  for (const pattern of ['bounded native pond', 'native pond replay', 'native pond inverse']) {
    test(`native Canvas / ${pattern}`, () => {
      const { NODE_TEST_CONTEXT: inherited, ...environment } = process.env;
      const child = spawnSync(process.execPath, ['--expose-gc', '--test', '--test-reporter=tap', `--test-name-pattern=^${pattern}`, import.meta.filename], {
        env: { ...environment, FROG_NATIVE_DIRECTOR_CASE: '1' }, encoding: 'utf8', maxBuffer: 1024 * 1024,
      });
      assert.equal(child.status, 0, child.stdout + child.stderr + String(child.error ?? child.signal ?? ''));
      assert.match(child.stdout, /# pass 1\b/);
    });
  }
} else {
  test('bounded native pond keeps all actor owners, original ASCII cells and enforced sample/backing limits', () => {
    const { canvas, preview } = nativePreview(720,440,{cols:180,rows:100});
    for (const count of [1,2,3]) for (const layout of ['arc','stepping-stones','shelter']) {
      const state = createFrogPond({ director:{count,layout,autonomy:false} });
      const result=preview.drawPond(state);
      assert(result.samples<=60000);assert(result.environmentSamples<=6246);assert(result.cols*result.rows<=18000);
      assert.equal(result.samples,count*17918+result.environmentSamples);
      for(let id=0;id<3;id++)assert(id<count?result.actorGlyphs[id]>120:result.actorGlyphs[id]===0);
      assert.match(preview.toText(),/^[\x20-\x7e\n]+$/);assert(canvas.toBuffer('image/png').length>2000);globalThis.gc();
    }
    let state=createFrogPond({director:{autonomy:false}});
    const events=[{type:'call',frogId:0},{type:'hunt',frogId:1,x:.7,y:-.5},{type:'call',frogId:2},...Array.from({length:5},(_,i)=>({type:'ripple',x:(i-2)/4,y:.1}))].map((e,seq)=>({...e,tick:1,seq}));
    state=stepFrogPond(state,1,events).state;
    const busy=preview.drawPond(state);assert.equal(state.ripples.length,6);assert(state.firefly);assert(busy.samples<=60000);assert(busy.environmentSamples<=6246);
    preview.resize(390,520,1);const narrow=preview.drawPond(state);assert(narrow.actorGlyphs.every(n=>n>80),'all three remain present; this is not an anatomy-recognition assertion');
    globalThis.gc();preview.resize(9000,5000,4);assert(canvas.width<=2400&&canvas.height<=1400);
    const before=preview.toText();assert.throws(()=>preview.update({renderFps:60}));assert.throws(()=>preview.update({labels:undefined}));assert.equal(preview.toText(),before);
    preview.dispose();preview.dispose();assert.equal(canvas.width,1);assert.throws(()=>preview.drawPond(state),/disposed/);assert.throws(()=>preview.pickPondFrog({x:0,y:0}),/disposed/);
  });

  test('native pond replay cells and immutable state agree across 1/2/5 presentation groups', () => {
    const { canvas, preview }=nativePreview(390,300,{cols:100,rows:70,labels:false});
    const events=[{type:'call',frogId:0,tick:1,seq:0},{type:'ripple',x:.5,y:.3,tick:45,seq:1}];
    function run(group){let state=createFrogPond({director:{autonomy:false}});const cells=[];
      for(let tick=1;tick<=90;tick++){state=stepFrogPond(state,tick,events.filter(e=>e.tick===tick)).state;if(tick%group===0){preview.drawPond(state);canvas.toBuffer('image/png');globalThis.gc();}if(tick%30===0)cells.push(preview.toText());}
      return{state,cells};}
    const every=run(1);assert.deepEqual(run(2),every);assert.deepEqual(run(5),every);
    const still=copy(every.state);preview.drawPond(every.state,{motion:false,staticPose:'rest',pondStill:'call'});const fixed=preview.toText();
    preview.drawPond(every.state,{motion:false,staticPose:'rest',pondStill:'call'});assert.equal(preview.toText(),fixed);assert.deepEqual(every.state,still);preview.dispose();
  });

  test('native pond inverse projection and owner picking match the actual rendered field', () => {
    const width=720,height=440,{preview}=nativePreview(width,height,{cols:180,rows:100});const state=createFrogPond();const result=preview.drawPond(state);
    assert(pondPointToWorld({x:0,y:.45}).z > pondPointToWorld({x:0,y:-.55}).z,
      'foreground pad must be nearer in the larger-z-wins glyph depth convention');
    const scale=Math.min(width/6.7,height/4.7),bodyScale=posePondFrog(state,state.actors[0]).scale;
    for(const pad of state.pads){const world=pondPointToWorld(pad.point),p={x:((width*.5+world.x*scale)/width)*2-1,y:((height*.53+(world.y+.62*bodyScale)*scale)/height)*2-1};const inverted=preview.pondTargetAt(p);
      assert(Math.hypot(inverted.x-pad.point.x,inverted.y-pad.point.y)<1e-10);}
    const ids=new Set();for(let row=0;row<result.rows;row++)for(let col=0;col<result.cols;col++){const id=preview.pickPondFrog({x:(col+.5)/result.cols*2-1,y:(row+.5)/result.rows*2-1});if(id!==null)ids.add(id);}
    assert.deepEqual([...ids].sort(),[0,1,2]);assert.equal(preview.pickPondFrog({x:2,y:0}),null);assert.throws(()=>preview.pondTargetAt({x:NaN,y:0}));
    preview.dispose();
  });
}
