import test from 'node:test';
import assert from 'node:assert/strict';
import { createDragonfly } from '../lib/index.js';
import { rasterizeDragonfly, gridToText, paintDragonfly, DRAGONFLY_GLYPHS } from '../lib/preview.js';

test('minimum and maximum grids export equal-length strictly declared ASCII rows', () => {
  const model=createDragonfly();
  for(const [cols,rows] of [[72,44],[120,64],[160,88]]) for(const view of ['dorsal','oblique']) {
    const grid=rasterizeDragonfly(model.sample(),{cols,rows,view,neutral:false});
    const text=gridToText(grid), lines=text.split('\n');
    assert.equal(lines.length,rows); assert(lines.every(row=>row.length===cols));
    assert(!/[^\x20-\x7e\n]/.test(text));
    assert([...text.replaceAll('\n','')].every(char=>DRAGONFLY_GLYPHS.includes(char)));
    assert.equal(grid.clippedSamples,0); assert(grid.occupied>100);
  }
});

test('supported small-grid views contain the entire animal across maximum motion configuration', () => {
  const model=createDragonfly({hoverRadius:.08,trackingReach:.4,trackingSpeed:.8,trackingAcceleration:4,
    dartDistance:.65,wingHz:6,wingAmplitude:.4,cooldownTicks:30,recoveryTicks:18});
  let seq=0;
  for(let tick=1;tick<=600;tick++) {
    const events=[];
    if(tick%120===1) events.push({type:'pointer',tick,seq:seq++,x:tick%240===1?1:-1,y:tick%360===1?-1:1});
    if(tick%120===60) events.push({type:'dart',tick,seq:seq++});
    model.step(tick,events);
    if(tick%10===0) for(const view of ['dorsal','oblique']) {
      const grid=rasterizeDragonfly(model.sample(),{cols:72,rows:44,view,neutral:true});
      assert.equal(grid.clippedSamples,0,`${view} clips at tick${tick}`);
      assert(grid.chars.some(char=>char!==32));
    }
  }
});

test('invalid samples, glyphs, materials and oversized forged grids fail explicitly', () => {
  const geometry=createDragonfly().sample(), options={cols:72,rows:44,view:'dorsal',neutral:false};
  for(const patch of [{cols:0},{rows:89},{cols:NaN},{view:'front'},{neutral:1}])
    assert.throws(()=>rasterizeDragonfly(geometry,{...options,...patch}));
  for(const patch of [{x:Infinity},{tone:1.1},{material:'ink'},{stableIndex:6144}])
    assert.throws(()=>rasterizeDragonfly({...geometry,samples:[{...geometry.samples[0],...patch}]},options));
  assert.throws(()=>rasterizeDragonfly({...geometry,samples:Array(6145).fill(geometry.samples[0])},options));
  const grid=rasterizeDragonfly(geometry,options);
  const noDrawing={setTransform(){throw new Error('Should validate before drawing');}};
  grid.chars[0]=27; assert.throws(()=>gridToText(grid),/undeclared/);
  assert.throws(()=>paintDragonfly(noDrawing,grid,{width:360,height:286,dpr:1}),/undeclared/);
  grid.chars[0]=32;grid.materials[0]=255;assert.throws(()=>gridToText(grid),/undeclared/);
  assert.throws(()=>paintDragonfly(noDrawing,{...grid,cols:100000},{width:360,height:286,dpr:1}),/oversized/);
});

test('painter preserves glyph-cell aspect with centered letterboxing (numeric stub)', () => {
  const grid=rasterizeDragonfly(createDragonfly().sample(),{cols:72,rows:44,view:'dorsal',neutral:false});
  const points=[];
  const context={setTransform(){},fillRect(){},measureText(){return {width:3};},fillText(char,x,y){points.push({char,x,y});}};
  paintDragonfly(context,grid,{width:360,height:286,dpr:1});
  assert(points.length===grid.occupied);
  assert(points.every(p=>p.x>=0&&p.x<=360&&p.y>=0&&p.y<=286));
  const spacing=286/44*.68, offset=(360-72*spacing)/2;
  assert(offset>0);
  for(const point of points) assert(Math.abs((point.x-offset)/spacing-.5-Math.round((point.x-offset)/spacing-.5))<1e-8);
});
