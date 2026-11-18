import test from 'node:test';
import assert from 'node:assert/strict';
import { createDragonfly } from '../lib/model.js';
import { createDragonflyDirector } from '../lib/director.js';
import { createDragonflyProjector, DRAGONFLY_CELL_ASPECT, DRAGONFLY_GLYPHS, gridToText, rasterizeDragonfly } from '../lib/preview.js';
import { layoutDragonflyPondLabels, rasterizeDragonflyPond } from '../lib/pond-preview.js';

// Numeric compositor/layout regressions against built runtime. Deterministic
// text widths below are test fixtures, not browser/native font or visual claims.
const small = { cols:72, rows:44, view:'dorsal', neutral:true };
const names = ['Azure','Reed','Ember','Moss'];
const point = (patch={}) => ({x:0,y:.35,z:.1,tone:.8,material:'body',part:'thorax',stableIndex:0,...patch});
const geometry = samples => ({samples,wings:[],eyes:[{x:0,y:0,z:0},{x:0,y:0,z:0}],abdomenTip:{x:0,y:1,z:0}});
const member = (id,samples,patch={}) => ({id,label:names[id],role:'patroller',selected:false,
  phase:{kind:'hover',elapsed:0,duration:1},position:{x:0,y:.35,z:.1},
  perch:{x:-.9+id*.6,y:1,z:.06},geometry:geometry(samples),...patch});
const cell = (grid,p) => p.row*grid.cols+p.col;
function step(director,inputs=[]) {
  const state=director.getState();
  director.step(state.tick+1,inputs.map((input,index)=>({tick:state.tick+1,seq:state.lastSeq+index+1,...input})));
}
function overlaps(a,b) { return a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top; }
function rect(label) { return {left:label.x-label.width/2,right:label.x+label.width/2,
  top:label.y-label.height/2,bottom:label.y+label.height/2}; }

test('merged depth ownership is stable by ID on exact ties and independent of member order', () => {
  const lower=member(1,[point({material:'eye',tone:1})]);
  const higher=member(3,[point({material:'wing',tone:.2})]);
  const source=[higher,lower], before=structuredClone(source);
  const a=rasterizeDragonflyPond(source,small), b=rasterizeDragonflyPond([...source].reverse(),small);
  assert.deepEqual(a,b); assert.deepEqual(source,before,'Composition does not mutate supplied geometry or order');
  const index=cell(a,createDragonflyProjector(small)(lower.geometry.samples[0]));
  assert.equal(a.owners[index],1); assert.equal(a.materials[index],4); assert.equal(a.depth[index],.1);
  assert.equal(a.animalCells,1); assert.deepEqual(a.labels.map(label=>label.id),[1]);
  const front=member(3,[point({z:.3,material:'wing',tone:.2})]);
  const c=rasterizeDragonflyPond([lower,front],small);
  assert.equal(c.owners[index],3,'Frontmost depth wins even when the front member has the larger ID');
  assert.equal(c.depth[index],.3); assert.equal(c.materials[index],2);
  assert.equal(c.clippedSamples,0);
});

test('one neutral pond member preserves the existing solo rasterizer exactly', () => {
  const model=createDragonfly({seed:17});
  for(let tick=1;tick<=127;tick++)model.step(tick,[]);
  const shape=model.sample();
  for(const [cols,rows] of [[72,44],[160,88]]) for(const view of ['dorsal','oblique']) {
    const options={cols,rows,view,neutral:true};
    const solo=rasterizeDragonfly(shape,options);
    const pond=rasterizeDragonflyPond([member(2,shape.samples,{geometry:shape})],options);
    for(const key of ['cols','rows','chars','depth','materials','occupied','clippedSamples'])
      assert.deepEqual(pond[key],solo[key],`${key} changed in ${cols}x${rows} ${view}`);
    assert.equal(pond.animalCells,solo.occupied);
    assert(pond.owners.every((owner,index)=>owner===(solo.chars[index]===32?-1:2)));
    assert.equal(gridToText(pond),gridToText(solo));
  }
  model.dispose();
});

test('sample/grid limits reject over-budget input and clipping sums exactly on the smallest grid', () => {
  const a=member(0,[point(),point({x:100,stableIndex:1}),point({y:-100,stableIndex:2})]);
  const b=member(1,[point({x:.5}),point({x:-100,stableIndex:1})]);
  const grid=rasterizeDragonflyPond([a,b],small);
  assert.equal(grid.clippedSamples,3); assert.equal(grid.animalCells,2);
  for(const key of ['chars','depth','materials','owners'])assert.equal(grid[key].length,72*44);
  assert(grid.owners.every(owner=>owner===-1||owner===0||owner===1));
  assert.equal(gridToText(grid).split('\n').length,44);
  assert(gridToText(grid).split('\n').every(row=>row.length===72));
  const atBudget=Array.from({length:6144},(_,stableIndex)=>point({stableIndex}));
  const full=rasterizeDragonflyPond([0,1,2,3].map(id=>member(id,atBudget)),small);
  assert.equal(full.animalCells,1); assert.equal(full.clippedSamples,0);
  assert.throws(()=>rasterizeDragonflyPond([member(0,[...atBudget,point()])],small),/6,144/);
  for(const patch of [{cols:71},{cols:161},{rows:43},{rows:89},{cols:Infinity}])
    assert.throws(()=>rasterizeDragonflyPond([a],{...small,...patch}),/grid/);
  for(const members of [[],[a,a],[member(4,[])],[0,1,2,3,4].map(id=>member(id,[]))])
    assert.throws(()=>rasterizeDragonflyPond(members,small));
});

test('four full-size authored animals stay in bounded small-grid output across each scene', () => {
  for(const scene of ['patrol','attention','relay']) {
    const director=createDragonflyDirector({scene,count:4,scale:.48,spread:1.1},{seed:17});
    for(let tick=0;tick<=360;tick++) {
      if(tick)step(director);
      if(![0,180,360].includes(tick))continue;
      const members=director.sample();
      assert.equal(members.length,4);
      assert(members.reduce((count,item)=>count+item.geometry.samples.length,0)<=24576);
      for(const view of ['dorsal','oblique']) {
        const grid=rasterizeDragonflyPond(members,{...small,view,neutral:false});
        assert.equal(grid.clippedSamples,0,`${scene} ${view} clips at tick ${tick}`);
        assert(grid.animalCells>0); assert(grid.occupied<=72*44);
        assert(grid.owners.every(owner=>owner>=-1&&owner<=3));
        assert([...grid.chars].every(code=>DRAGONFLY_GLYPHS.includes(String.fromCharCode(code))));
      }
    }
    director.dispose();
  }
});

test('minimum-grid static pose zero retains substantial separate silhouettes for all four members', () => {
  const director=createDragonflyDirector({count:4},{motion:'static'});
  director.setStaticPose(0);
  const members=director.sample();
  for(const view of ['dorsal','oblique']) {
    const options={...small,view}, pond=rasterizeDragonflyPond(members,options);
    assert.equal(pond.clippedSamples,0,`${view} still pose clips`);
    assert.equal(pond.labels.length,4,'Every still-scene individual retains visible geometry');
    for(const member of members) {
      const standalone=rasterizeDragonfly(member.geometry,options);
      const visible=pond.owners.reduce((count,owner)=>count+Number(owner===member.id),0);
      assert(visible>=24,`${view} member ${member.id} retains only ${visible} cells`);
      assert(visible>=standalone.occupied*.75,
        `${view} member ${member.id} loses more than a quarter of its standalone silhouette (${visible}/${standalone.occupied})`);
    }
  }
  director.dispose();
});

test('deterministic label layout protects every visible anatomy cell and every other label', () => {
  // Deliberately crowd four members into neighbouring columns so labels must
  // choose different rows. The selected member receives first placement.
  const cast=[-.33,-.11,.11,.33].map((x,id)=>member(id,
    [point({x,y:.3}),point({x,y:.42,stableIndex:1})],{selected:id===2}));
  for(const view of ['dorsal','oblique']) for(const [width,height] of [[360,286],[900,600]]) {
    const grid=rasterizeDragonflyPond(cast,{...small,view});
    const measure=text=>text.length*6;
    const placed=layoutDragonflyPondLabels(grid,width,height,measure);
    assert.equal(placed.length,4,'All four crowded fixture members must receive a label');
    assert.equal(placed[0].id,2); assert.deepEqual(placed,layoutDragonflyPondLabels(grid,width,height,measure));
    const cellH=Math.min(height/grid.rows,width/(grid.cols*DRAGONFLY_CELL_ASPECT));
    const cellW=cellH*DRAGONFLY_CELL_ASPECT;
    const left=(width-grid.cols*cellW)/2, top=(height-grid.rows*cellH)/2;
    for(let index=0;index<placed.length;index++) {
      const box=rect(placed[index]);
      assert(box.left>=0&&box.right<=width&&box.top>=8&&box.bottom<=height-8);
      for(const other of placed.slice(index+1))assert(!overlaps(box,rect(other)),'Labels overlap each other');
      for(let occupied=0;occupied<grid.owners.length;occupied++) {
        if(grid.owners[occupied]<0)continue;
        const x=left+(occupied%grid.cols)*cellW,y=top+Math.floor(occupied/grid.cols)*cellH;
        assert(!overlaps(box,{left:x,right:x+cellW,top:y,bottom:y+cellH}),'A label covers a visible anatomy cell');
      }
    }
    assert.throws(()=>layoutDragonflyPondLabels(grid,width,height,()=>NaN),/finite/);
    assert.throws(()=>layoutDragonflyPondLabels(grid,width,height,()=>-1),/nonnegative/);
  }
});

test('held landing uses the same final world perch projection as the body and actual reed tip', () => {
  const director=createDragonflyDirector({count:3,scene:'patrol'},{seed:17});
  step(director,[{type:'cue',cue:'perch'}]);
  for(let tick=0;tick<900;tick++) {
    if(director.getState().members[0].phase.kind==='perched')break;
    step(director);
  }
  assert.equal(director.getState().members[0].phase.kind,'perched');
  step(director,[{type:'pointer',x:1,y:-1}]);
  for(let tick=0;tick<120;tick++)step(director);
  const state=director.getState(), samples=director.sample();
  assert.equal(state.members[0].phase.kind,'perched','Pointer movement cannot release a deliberate held perch');
  for(const [cols,rows] of [[72,44],[120,64]]) for(const view of ['dorsal','oblique']) {
    const options={cols,rows,view,neutral:false}, project=createDragonflyProjector(options);
    const pond=rasterizeDragonflyPond(samples,options);
    for(const shape of samples) {
      const snapshot=state.members.find(item=>item.id===shape.id);
      assert.deepEqual(shape.perch,snapshot.perch);
      const rendered=pond.perches.find(item=>item.id===shape.id);
      assert.deepEqual({col:rendered.col,row:rendered.row,depth:rendered.depth},project(snapshot.perch));
    }
    const selected=samples.find(item=>item.id===state.selected);
    const contact=project(selected.perch), body=project(selected.position);
    assert.equal(body.col,contact.col); assert.equal(body.row,contact.row);
    const withoutAnatomy=rasterizeDragonflyPond([{...selected,geometry:{...selected.geometry,samples:[]}}],options);
    assert.equal(withoutAnatomy.chars[cell(withoutAnatomy,contact)],'o'.charCodeAt(0),
      'The actual reed tip must occupy the projected landing point');
    assert.equal(withoutAnatomy.owners[cell(withoutAnatomy,contact)],-1);
    assert(pond.chars.some((char,index)=>char===';'.charCodeAt(0)&&pond.owners[index]===-1));
    const anatomy=rasterizeDragonfly(selected.geometry,options);
    for(let index=0;index<anatomy.chars.length;index++)if(anatomy.chars[index]!==32&&pond.owners[index]===selected.id)
      assert.equal(pond.chars[index],anatomy.chars[index],'Reed context must not overwrite visible body samples');
  }
  director.dispose();
});

test('initial and alternate still ensembles retain distinct silhouettes at the smallest grid', () => {
  for (const count of [3, 4]) for (const view of ['dorsal', 'oblique']) for (const pose of [null, 0, 1]) {
    const director = createDragonflyDirector({ count }, { seed: 17 });
    if (pose !== null) director.setStaticPose(pose);
    const members = director.sample();
    const options = { cols: 72, rows: 44, view, neutral: true };
    const combined = rasterizeDragonflyPond(members, options);
    assert.equal(combined.labels.length, count);
    for (const member of members) {
      const solo = rasterizeDragonfly(member.geometry, options);
      const occupied = [...solo.chars].filter(char => char !== 32).length;
      const retained = [...combined.owners].filter(id => id === member.id).length;
      assert.ok(retained / occupied >= .95, `${count}/${view}/${pose}: member ${member.id} retains ${retained}/${occupied} cells`);
    }
    for (let i = 0; i < combined.labels.length; i++) for (let j = i + 1; j < combined.labels.length; j++) {
      const a = combined.labels[i], b = combined.labels[j];
      assert.ok(a.maxCol < b.minCol || b.maxCol < a.minCol || a.maxRow < b.minRow || b.maxRow < a.minRow,
        `${count}/${view}/${pose}: members ${a.id}/${b.id} bounding silhouettes overlap`);
    }
    director.dispose();
  }
});
