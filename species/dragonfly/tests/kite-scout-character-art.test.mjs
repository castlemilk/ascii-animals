import test from 'node:test';
import assert from 'node:assert/strict';
import { createDragonfly, DRAGONFLY_DEFAULTS } from '../lib/variants/kite-scout/model.js';
import { buildDragonflyGeometry } from '../lib/variants/kite-scout/geometry.js';
import { DRAGONFLY_GLYPHS, createDragonflyProjector, gridToText, rasterizeDragonfly } from '../lib/variants/kite-scout/preview.js';
import { rasterizeDragonflyPond } from '../lib/variants/kite-scout/pond-preview.js';

// Geometry/cell invariants for the graphic character. These assertions do not
// establish facial expression, recognition or real-browser visual quality.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const views=['dorsal','oblique'];
const wingIds=['left-fore','right-fore','left-hind','right-hind'];
const options={cols:72,rows:44,view:'dorsal',neutral:false};
const seedState=()=>createDragonfly({seed:17,hoverRadius:0}).getState();
function onePoint(patch={}) {
  const original=buildDragonflyGeometry(seedState(),DRAGONFLY_DEFAULTS);
  return {...original,samples:[{
    x:0,y:.35,z:0,tone:.8,material:'body',part:'thorax',stableIndex:0,...patch,
  }]};
}
function nonempty(grid) { return [...grid.chars].filter(code=>code!==32); }

test('single declared ASCII stroke hints render explicitly and tone-only callers remain supported',()=>{
  for(const glyph of ['@','#','=','/','\\','|','-','(',')']) {
    const geometry=onePoint({glyph});
    const grid=rasterizeDragonfly(geometry,options);
    assert.deepEqual(nonempty(grid),[glyph.charCodeAt(0)],`Explicit ${glyph} remains one logical character`);
    assert.deepEqual(nonempty(rasterizeDragonfly(geometry,{...options,neutral:true})),[35],
      'Neutral silhouettes ignore decorative stroke hints');
  }
  const tonal=rasterizeDragonfly(onePoint(),options);
  assert.equal(tonal.occupied,1);assert.equal(nonempty(tonal)[0],'O'.charCodeAt(0),
    'Omitting the optional hint retains the accepted tone ramp');
  const blank=rasterizeDragonfly(onePoint({glyph:' '}),options);
  assert.equal(blank.occupied,0);
  assert([...blank.depth].some(Number.isFinite),'An opaque negative-space sample keeps its depth mask');
  assert.deepEqual(nonempty(rasterizeDragonfly(onePoint({glyph:' '}),{...options,neutral:true})),[35]);
});

test('invalid or multi-character stroke hints reject without changing caller-owned geometry',()=>{
  for(const glyph of ['', '##', '\n', '\r', '\t', '\x1b', 'é', '🪰', '\u202e', '<img>', 35, null]) {
    const geometry=onePoint({glyph}),before=JSON.stringify(geometry);
    assert.throws(()=>rasterizeDragonfly(geometry,options),/printable ASCII glyph/);
    assert.equal(JSON.stringify(geometry),before);
  }
});

test('eye cutout depth occludes a rear animal regardless of member order or visible-cell ownership',()=>{
  const foreground=onePoint({glyph:' ',z:2,material:'eye',part:'left-eye'});
  const background=onePoint({glyph:'#',z:1});
  const member=(id,geometry)=>({id,geometry,label:String(id),role:'patroller',selected:false,
    position:{x:0,y:0,z:0},perch:{x:-1,y:1,z:.06},phase:{kind:'hover',elapsed:0,duration:0}});
  const front=member(0,foreground),back=member(1,background);
  const pixel=createDragonflyProjector(options)(foreground.samples[0]),index=pixel.row*options.cols+pixel.col;
  for(const members of [[front,back],[back,front]]) {
    const grid=rasterizeDragonflyPond(members,options);
    assert.equal(grid.chars[index],32,'A rear specimen cannot fill the foreground eye interior');
    assert.equal(grid.depth[index],2,'Negative space remains a reserved foreground surface for habitat');
    assert.equal(grid.owners[index],-1,'An invisible cutout does not become a visible anatomy hit target');
  }
});

test('the graphic silhouette has exactly four attached lateral blades and no extra petal-like appendage',()=>{
  const base=seedState();
  for(const wingPhase of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
    const geometry=buildDragonflyGeometry({...base,wingPhase},DRAGONFLY_DEFAULTS);
    assert.deepEqual(geometry.wings.map(wing=>wing.id).sort(),[...wingIds].sort());
    assert(geometry.samples.length<=6144);
    for(const sample of geometry.samples) {
      assert([sample.x,sample.y,sample.z,sample.tone].every(Number.isFinite));
      assert(sample.glyph===undefined||DRAGONFLY_GLYPHS.includes(sample.glyph));
      if(Math.abs(sample.x)>.5)assert(wingIds.includes(sample.part),
        'Every lateral extension beyond the head and tucked feet belongs to one of the four actual blades');
    }
    for(const wing of geometry.wings)
      assert(geometry.samples.some(sample=>sample.part===wing.id&&distance(sample,wing.root)<1e-12),
        `${wing.id} must retain an explicit sample on its thorax attachment`);
    for(const view of views) {
      const grid=rasterizeDragonfly(geometry,{...options,view,neutral:true});
      assert.equal(grid.clippedSamples,0);
      assert.match(gridToText(grid),/^[ #\n]+$/);
      const project=createDragonflyProjector({...options,view});
      const footprints=new Map(geometry.wings.map(wing=>[wing.id,new Set()]));
      for(const sample of geometry.samples) {
        const cells=footprints.get(sample.part);if(!cells)continue;
        const wing=geometry.wings.find(value=>value.id===sample.part);
        if(distance(sample,wing.root)<distance(wing.root,wing.tip)*.6)continue;
        const cell=project(sample);cells.add(cell.row*options.cols+cell.col);
      }
      for(const [id,cells] of footprints) {
        const distinct=[...cells].filter(cell=>[...footprints].every(([other,occupied])=>other===id||!occupied.has(cell)));
        assert(distinct.length>=3,`${view}/${id} loses its independent distal silhouette`);
      }
    }
  }
});

test('paired pupils look in the input direction deterministically without moving the eye or wing attachment anchors',()=>{
  const base=seedState();
  const left=buildDragonflyGeometry({...base,target:{x:-1,y:-.5}},DRAGONFLY_DEFAULTS);
  const right=buildDragonflyGeometry({...base,target:{x:1,y:-.5}},DRAGONFLY_DEFAULTS);
  assert.deepEqual(left.eyes,right.eyes);assert.deepEqual(left.wings,right.wings);
  assert(Math.abs(distance(left.eyes[0],left.eyes[1])-.5)<1e-12,
    'The authored larger face retains its exact shared eye/perch scale landmark');
  assert.deepEqual(left,buildDragonflyGeometry({...base,target:{x:-1,y:-.5}},DRAGONFLY_DEFAULTS));
  for(const part of ['left-eye','right-eye']) {
    const pupils=geometry=>geometry.samples.filter(sample=>sample.part===part&&sample.glyph==='@');
    const meanX=points=>points.reduce((sum,point)=>sum+point.x,0)/points.length;
    const l=pupils(left),r=pupils(right);
    assert(l.length>0&&r.length>0,`${part} needs a deliberate pupil rather than a shaded eye block`);
    assert(meanX(r)-meanX(l)>.09,`${part} must move toward the changed guide`);
  }
  assert.notEqual(gridToText(rasterizeDragonfly(left,options)),gridToText(rasterizeDragonfly(right,options)),
    'The smallest logical grid must retain an actual gaze change');
  for(const geometry of [left,right])for(const view of views) {
    const settings={...options,view},grid=rasterizeDragonfly(geometry,settings),project=createDragonflyProjector(settings);
    const visible=['left-eye','right-eye'].map(part=>new Set(geometry.samples
      .filter(sample=>sample.part===part&&sample.glyph==='@')
      .map(sample=>{const pixel=project(sample);return pixel.row*grid.cols+pixel.col;})
      .filter(index=>grid.chars[index]===64)));
    assert(visible.every(cells=>cells.size>0),`${view} must show a pupil in both eyes at 72 columns`);
    assert([...visible[0]].every(cell=>!visible[1].has(cell)),`${view} must not merge the two pupils`);
  }
});

test('load and release preserve continuous wing articulation across the preparation boundary',()=>{
  const base=seedState(),epsilon=1e-6;
  const at=progress=>buildDragonflyGeometry({...base,wingPhase:1.2,behavior:{
    kind:'dart',elapsed:progress*20,duration:20,from:{x:0,y:0},to:{x:.48,y:0},initialVelocity:{x:0,y:0},
  }},DRAGONFLY_DEFAULTS);
  for(const boundary of [.3,.5]) {
    const before=at(boundary-epsilon),after=at(boundary+epsilon);
    for(const wing of before.wings) {
      const next=after.wings.find(value=>value.id===wing.id);
      assert(Math.abs(wing.angle-next.angle)<1e-7,`${wing.id} angle jumps at dart progress ${boundary}`);
      assert(distance(wing.tip,next.tip)<1e-7,`${wing.id} tip pops at the preparation/release seam`);
      assert(distance(wing.root,next.root)<1e-12);
    }
  }
});
