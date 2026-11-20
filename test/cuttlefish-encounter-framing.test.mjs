import test from 'node:test';
import assert from 'node:assert/strict';
import { CuttlefishArtwork } from '../src/animals/cuttlefish.js';
import { fakeBrowser } from './helpers/fake-browser.mjs';

function fixture(w, h, options) {
  const art = new CuttlefishArtwork(fakeBrowser().canvas(w, h),
    { count: 1, autoStart: false, sizeVariation: 0, scene: 'encounter', ...options });
  return art;
}

function outline(art, time, id = 0) {
  for (const fish of art.fish) fish.sceneTime = time;
  art.render();
  const xs = [], ys = [];
  for (let i = 0; i < art.owners.length; i++) if (art.owners[i] === id) {
    xs.push(i % art.cols); ys.push(Math.floor(i / art.cols));
  }
  return [(Math.max(...xs) - Math.min(...xs) + 1) / art.cols,
    (Math.max(...ys) - Math.min(...ys) + 1) / art.rows];
}

test('the 35% Solo encounter is small on approach but exactly matches the 140% lens footprint', () => {
  for (const [w, h] of [[884, 682], [349, 440], [960, 540], [390, 600]]) {
    const small = fixture(w, h, {size: .35});
    const large = fixture(w, h, {size: 1.4});
    small.time = large.time = 4;
    const approach = outline(small, 4);
    const largeApproach = outline(large, 4);
    assert(approach[0] < largeApproach[0] * .6);
    for (const t of [10, 11.5, 14.8]) {
      small.time = large.time = t;
      const contact = outline(small, t);
      assert.deepEqual(contact, outline(large, t), `${w}×${h} at t=${t}`);
      assert.deepEqual(small.owners, large.owners, 'exact subject footprint at matching frames');
      assert.deepEqual(small.tones, large.tones, 'match the high endpoint, not just its edges');
      assert(contact.every(axis => axis > .95), JSON.stringify({w,h,t,contact}));
      assert.equal(small.fish[0].size, .35);
    }
    small.destroy(); large.destroy();
  }
});

test('framing remains scoped to lead cuttlefish with motion, and clear of the near plane', () => {
  const cases = [
    [{size:.35}, 1.4],
    [{size:.35, depthStrength:0}, 1.4],
    [{size:.35, depthStrength:2}, 1.4],
    [{size:.35, count:4}, 1.4],
    [{size:.35, motion:0}, .35],
    [{size:.35, motion:.6}, .35],
    [{size:.35, scene:'swimby', behaviors:['encounter']}, .35],
    [{size:.35, formation:'horizontal'}, .35],
    [{size:.35, species:'manta'}, .35],
    [{size:.35, species:'octopus'}, .35],
    [{size:1.4}, 1.4]
  ];
  for (const [options, expected] of cases) {
    const art = fixture(960, 540, options);
    for (const fish of art.fish) fish.sceneTime = 11;
    for (const fish of art.fish) {
      art._activateFish(fish);
      art._camera(11);
      assert(Math.abs(art.objectScale - (fish.id === 0 ? expected : fish.size)) < 1e-9, JSON.stringify(options));
      if (art.perspectiveStrength && fish.id === 0 && expected === 1.4) {
        assert(1 - art._world(1.53, 0, 0)[2] * art.perspectiveStrength >= .28);
      }
    }
    art.destroy();
  }
});

test('the lens cue eases into the hold and preserves warning framing before receding', () => {
  const art = fixture(960, 540, {size: .35});
  let last = .35;
  for (let t = 4; t <= 10; t += .02) {
    art.fish[0].sceneTime = t;
    art._activateFish(art.fish[0]); art._camera(t);
    if (t <= 7) assert.equal(art.objectScale, .35, 'keep true size on approach');
    assert(art.objectScale >= last - 1e-9);
    assert(art.objectScale - last < .025, 'no step in framing during approach');
    last = art.objectScale;
  }
  const currentScale = () => {
    art._activateFish(art.fish[0]); art._camera(art.time);
    return art.objectScale;
  };
  art.fish[0].sceneTime = 11;
  const held = currentScale();
  assert.equal(held, 1.4);
  assert(art._startle('test', 0));
  assert.equal(currentScale(), held);
  art.fish[0].reaction.age = 1.12;
  assert(currentScale() < held && currentScale() > .35);
  art.fish[0].reaction.age = 1.6;
  assert.equal(currentScale(), .35);
  art.fish[0].reaction.age = 4;
  assert.equal(currentScale(), .35, 'recovery stays at the selected size');
  art.destroy();
});

test('long lens hold survives a live resize without changing the chosen size', () => {
  const host = fakeBrowser();
  const canvas = host.canvas(960, 540);
  const art = new CuttlefishArtwork(canvas,
    {count: 1, scene: 'encounter', size: .35, sizeVariation: 0, autoStart: false});
  for (const [w, h] of [[960, 540], [390, 600], [560, 360]]) {
    canvas.rect.width = w; canvas.rect.height = h;
    for (const resize of host.resizes) resize.callback([{target: canvas}]);
    assert.equal(art.width, w); assert.equal(art.height, h);
    for (const t of [10, 11.5, 14.8]) {
      const coverage = outline(art, t);
      assert(coverage[0] > .95 && coverage[1] > .95, JSON.stringify({w,h,t,coverage}));
      assert.equal(art.fish[0].size, .35);
    }
  }
  art.destroy();
});
