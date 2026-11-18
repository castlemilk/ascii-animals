import test from 'node:test';
import assert from 'node:assert/strict';
import {createFox,staticFoxPose} from '../lib/model.js';
import {buildFoxGrid,paintFoxGrid,FOX_GLYPHS} from '../lib/preview.js';

test('small visible landmarks stay single cells across supported profiles and response phases',()=>{
  for(const facing of ['left','right']){
    const fox=createFox({facing});
    for(let tick=0;tick<220;tick++){
      if(tick)fox.step(tick,tick===40?[{type:'pounce',tick,seq:0}]:[]);
      if(tick%7!==0)continue;
      for(const [cols,rows] of [[80,32],[112,44],[160,64]]){
        const grid=buildFoxGrid(fox.getPose(),{cols,rows});
        assert.equal([...grid.glyphs].filter(g=>FOX_GLYPHS[g]==='o').length,1,'one side-profile eye');
        assert.equal([...grid.glyphs].filter(g=>FOX_GLYPHS[g]==='@').length,1,'one nose');
        const neutral=buildFoxGrid(fox.getPose(),{cols,rows,monochrome:true});
        assert.equal(grid.occupied,neutral.occupied,'tone changes preserve the silhouette footprint');
      }
    }
  }
});

test('arbitrary Canvas rectangles fit a 1:2 cell grid without stretching or clipping',()=>{
  const grid=buildFoxGrid(staticFoxPose());
  const indexes=[];grid.glyphs.forEach((g,i)=>{if(g)indexes.push(i);});
  for(const [width,height] of [[900,600],[390,300],[1280,768],[200,700]]){
    const draws=[];const context={fillRect(){},fillText(glyph,x,y){draws.push({glyph,x,y});}};
    paintFoxGrid(context,grid,width,height);
    assert.equal(draws.length,indexes.length);
    const ch=Math.min(height/grid.rows,width/(grid.cols*.5)),cw=ch*.5;
    for(let i=0;i<draws.length;i++){
      const index=indexes[i],draw=draws[i];
      const expectedX=(width-grid.cols*cw)/2+(index%grid.cols+.5)*cw;
      const expectedY=(height-grid.rows*ch)/2+(Math.floor(index/grid.cols)+.5)*ch;
      assert.ok(Math.abs(draw.x-expectedX)<1e-9);
      assert.ok(Math.abs(draw.y-expectedY)<1e-9);
      assert.ok(draw.x>0&&draw.x<width&&draw.y>0&&draw.y<height);
    }
  }
});

test('raster bounds reject invalid geometry before allocating output',()=>{
  const valid=staticFoxPose();
  const changed=structuredClone(valid);changed.polygons[0].points[0].x=Infinity;
  assert.throws(()=>buildFoxGrid(changed),/finite/);
  changed.polygons[0].points[0].x=1.1;
  assert.throws(()=>buildFoxGrid(changed),/bounds/);
  assert.throws(()=>buildFoxGrid({...valid,polygons:Array(49).fill(valid.polygons[0])}),/bounded/);
});
