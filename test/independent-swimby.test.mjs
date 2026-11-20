import assert from 'node:assert/strict';
import test from 'node:test';
import { CuttlefishArtwork } from '../src/animals/cuttlefish.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';

function mount(width, height, options = {}) {
  return new CuttlefishArtwork(fakeBrowser().canvas(width, height), {
    scene: 'swimby', formation: 'independent', autoStart: false, ...options,
  });
}

function setTime(art, time) {
  art.time = time;
  for (const fish of art.fish) fish.sceneTime = time;
}

function leadPose(art, time) {
  setTime(art, time);
  art._activateFish(art.fish[0]); art._camera(time);
  return { x: art.worldX, y: art.worldY, z: art.worldZ, heading: art.r00,
    visible: art.subjectVisibility, screen: art._projectWorld(art.worldX, art.worldY, art.worldZ) };
}

test('independent cruise and Solo auto roam continuously in a fixed desktop or phone frame', () => {
  for (const [w,h] of [[884,682],[349,440]]) for (const count of [1,4]) {
    const art = mount(w,h,{count});
    const path = [], visibility = Array(count).fill(0);
    for (let time = 0; time <= 42; time += .5) {
      path.push(leadPose(art, time));
      art.render();
      for (const fish of art.fish) visibility[fish.id] += Number(fish.visible);
    }
    assert(path.every(p => p.visible === 1), 'no scripted fade or empty-water beat');
    assert(visibility.every(frames => frames / path.length >= .95));
    const span = axis => Math.max(...path.map(p => p.screen[axis])) - Math.min(...path.map(p => p.screen[axis]));
    assert(span(0) > w * .25 && span(1) > h * .07, 'keep meaningful travel on both axes');
    assert(path.every(p => p.screen[0] > 0 && p.screen[0] < w && p.screen[1] > 0 && p.screen[1] < h));
    if (count === 4) assert.deepEqual(art.fish.map(f => f.behavior), ['cruise','hover','orbit','curious']);
    art.destroy();
  }
});

test('the patrol reverses travel, returns smoothly, and retains pointer and zero-motion controls', () => {
  const art = mount(884, 682, {count:1, size:1, sizeVariation:0});
  const back = mount(884, 682, {count:1, size:1, sizeVariation:0, reverse:true});
  const first = leadPose(art, 0), reverseFirst = leadPose(back, 0);
  assert.deepEqual(first.screen, reverseFirst.screen);
  assert(first.heading > 0 && reverseFirst.heading < 0);
  assert(leadPose(art, 1).x > first.x && leadPose(back, 1).x < reverseFirst.x);
  const cycle = 2 * Math.PI / (.32 * art.fish[0].pace);
  const loop = leadPose(art, cycle);
  assert(Math.hypot(loop.x-first.x, loop.y-first.y, loop.z-first.z) < 1e-9);
  assert(Math.abs(loop.heading-first.heading) < 1e-9);
  const before = leadPose(art, 7);
  art.setOptions({followPointer:true}); art.pointer.x = .5; art.pointer.y = -.4;
  const after = leadPose(art, 7);
  assert(after.x > before.x && after.y < before.y);
  art.setOptions({motion:0, followPointer:false});
  const stationary = leadPose(art, 0);
  assert.deepEqual(stationary, leadPose(art, 13));
  assert.deepEqual([stationary.x,stationary.y,stationary.z],[-.35,0,-.7]);
  art.destroy(); back.destroy();
});
