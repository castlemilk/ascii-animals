import test from 'node:test';
import assert from 'node:assert/strict';
import { createFox, staticFoxPose } from '../lib/model.js';
import { createFoxDirector } from '../lib/director.js';
import { buildFoxGrid, FOX_GLYPHS, FOX_COLORS } from '../lib/preview.js';
import { buildFoxSceneGrid, routeFoxScenePointer } from '../lib/director-render.js';

test('a planted paw ahead of its resting position bears weight until the body catches up', () => {
  const model = createFox({ breathing: 0, tailSway: 0 });
  const offsets = model.getState().feet.map(foot => foot.x);
  const aheadContacts = new Set(), lifted = new Set();
  for (let tick = 1; tick <= 300; tick++) {
    const before = model.getState();
    const after = model.step(tick, tick === 1
      ? [{ type: 'guide', tick, seq: 0, x: .95, y: .7 }]
      : tick === 170 ? [{ type: 'leave', tick, seq: 1 }] : []).state;
    for (let i = 0; i < 4; i++) {
      const prior = before.feet[i], foot = after.feet[i];
      if (after.velocityX > 0 && prior.mode === 'planted' && prior.x > after.rootX + offsets[i]) {
        aheadContacts.add(foot.id);
        assert.equal(foot.mode, 'planted', 'an already-ahead contact must not lift again');
        assert.equal(foot.x, prior.x, 'weight-bearing paws do not skate');
      }
      if (prior.mode === 'planted' && foot.mode === 'swing') lifted.add(foot.id);
    }
  }
  assert.equal(aheadContacts.size, 4, 'exercise an ahead-of-body loaded contact for every paw');
  assert.equal(lifted.size, 4, 'exercise all four articulated legs');
  assert(model.getState().feet.every(foot => foot.mode === 'planted'), 'leaving settles every paw');
  model.dispose();
});

test('body weight follows an articulated swing while feet retain their model contacts', () => {
  const model = createFox({ breathing: 0, tailSway: 0 });
  const bodyHeights = new Set();
  for (let tick = 1; tick <= 150; tick++) {
    const state = model.step(tick, tick === 1 ? [{ type: 'guide', tick, seq: 0, x: .9, y: .7 }] : []).state;
    const pose = model.getPose();
    bodyHeights.add(pose.root.y.toFixed(5));
    if (state.feet.every(foot => foot.mode === 'planted')) assert.equal(pose.root.y, 0, 'no free-running weight bob after planting');
    for (const leg of pose.legs) {
      const stored = state.feet.find(foot => foot.id === leg.id);
      assert.deepEqual(leg.joints.at(-1), { x: stored.x, y: stored.y });
      assert.equal(leg.planted, stored.mode === 'planted');
    }
  }
  assert([...bodyHeights].some(height => Number(height) < 0), 'a swing transfers body weight with breathing disabled');
  model.dispose();
});

test('coat layers share a bounded attached brush through both directed responses', () => {
  for (const cue of ['rustle', 'play']) {
    const director = createFoxDirector({ count: 1, fox: { scale: .72, tailSway: .16 } });
    for (let tick = 1; tick <= 430; tick++) {
      director.step(tick, tick === 1 ? [{ type: 'cue', tick, seq: 0, cue, id: 0, x: .8, y: .7 }] : []);
      if (tick % 5) continue;
      const pose = director.getFrame().actors[0].pose;
      assert(pose.polygons.length <= 48);
      assert(pose.polygons.reduce((count, part) => count + part.points.length, 0) <= 1024);
      const tail = pose.polygons.find(part => part.id === 'tail');
      const root = { x: (tail.points[0].x + tail.points.at(-1).x) / 2,
        y: (tail.points[0].y + tail.points.at(-1).y) / 2 };
      assert(Math.hypot(root.x - pose.landmarks.tailRoot.x, root.y - pose.landmarks.tailRoot.y) < 1e-12);
      for (const id of ['tail', 'tail-tip', 'tail-tip-shade']) {
        const layer = pose.polygons.find(part => part.id === id);
        assert.deepEqual(layer.points[16], pose.landmarks.tailTip, `${id} shares the moving tip`);
        assert.deepEqual(layer.points[17], pose.landmarks.tailTip);
      }
      for (const part of pose.polygons) for (const point of part.points) {
        assert(Number.isFinite(point.x) && Number.isFinite(point.y));
        assert(Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1);
      }
    }
    director.dispose();
  }
});

test('phone coat planes, actor ownership and monochrome occupancy survive the wider lanes', () => {
  for (const count of [1, 2, 3]) {
    const director = createFoxDirector({ seed: 17, count, showLabels: false });
    const frame = director.getFrame('listen');
    const color = buildFoxSceneGrid(frame, { cols: 112, rows: 64 });
    const mono = buildFoxSceneGrid(frame, { cols: 112, rows: 64, monochrome: true });
    assert.deepEqual(mono.owners, color.owners, 'tone never changes visible ownership');
    for (let id = 0; id < count; id++) {
      const materials = new Set();
      let cells = 0;
      color.owners.forEach((owner, index) => { if (owner === id) { materials.add(color.materials[index]); cells++; } });
      assert(cells > 80, 'the phone retains a solid animal footprint');
      assert(materials.has(9) && materials.has(10) && materials.has(17), 'dorsal, flank and brush-tip planes remain visible');
    }
    for (let i = 0; i < color.glyphs.length; i++) if (color.glyphs[i]) {
      assert(color.glyphs[i] >= 32 && color.glyphs[i] <= 126);
      assert.match(FOX_COLORS[color.materials[i]], /^#[a-f0-9]{6}$/);
      if (color.owners[i] < 0) continue;
      const x=((i%color.cols)+.5)/color.cols*2-1;
      const y=(Math.floor(i/color.cols)+.5)/color.rows*2-1;
      assert.equal(routeFoxScenePointer(color,x,y).id,color.owners[i], 'visible phone pixels route to their actual fox');
    }
    director.dispose();
  }
  const solo = buildFoxGrid(staticFoxPose(), { cols: 80, rows: 32 });
  assert.equal(FOX_GLYPHS, ' .:-=+*#%@o', 'the original solo glyph contract is retained');
  assert.match(solo.text, /^[ .:\-=+*#%@o\n]+$/);
});
