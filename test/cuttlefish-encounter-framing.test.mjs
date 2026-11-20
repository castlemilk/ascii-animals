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

test('the small foreground encounter gains coverage at the lens while keeping size order', () => {
  for (const [w, h] of [[960, 540], [390, 600], [560, 360]]) {
    for (const count of [1, 4]) {
      let previous = [0, 0];
      for (const size of [.35, .55, .7, 1]) {
        const small = fixture(w, h, {count, size});
        const normal = fixture(w, h, {count, size: 1});
        const approach = outline(small, 3);
        const fullApproach = outline(normal, 3);
        assert(approach[0] <= fullApproach[0]);
        const held = outline(small, 11), fullHeld = outline(normal, 11);
        for (const axis of [0, 1]) {
          assert(held[axis] >= fullHeld[axis] * .60, JSON.stringify({w,h,count,size,held,fullHeld}));
          assert(held[axis] >= previous[axis] - .02, 'larger sizes do not get a smaller close-up');
        }
        previous = held;
        assert.equal(small.fish[0].size, size);
        small.destroy(); normal.destroy();
      }
    }
  }
});

test('framing remains scoped to lead cuttlefish with motion, and clear of the near plane', () => {
  const cases = [
    [{size:.35}, .74],
    [{size:.35, depthStrength:0}, .74],
    [{size:.35, depthStrength:2}, .74],
    [{size:.35, count:4}, .74],
    [{size:.35, motion:0}, .35],
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
      if (art.perspectiveStrength && fish.id === 0 && expected === .74) {
        assert(1 - art._world(1.53, 0, 0)[2] * art.perspectiveStrength >= .28);
      }
    }
    art.destroy();
  }
});

test('the lens cue eases into the hold and preserves warning framing before receding', () => {
  const art = fixture(960, 540, {size: .35});
  let last = .35;
  for (let t = 4; t <= 10; t += .1) {
    art.fish[0].sceneTime = t;
    art._activateFish(art.fish[0]); art._camera(t);
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
  assert(held > .35);
  assert(art._startle('test', 0));
  assert.equal(currentScale(), held);
  art.fish[0].reaction.age = 1.2;
  assert(currentScale() < held && currentScale() > .35);
  art.fish[0].reaction.age = 1.6;
  assert.equal(currentScale(), .35);
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
      assert(coverage[0] > .55 && coverage[1] > .49, JSON.stringify({w,h,t,coverage}));
      assert.equal(art.fish[0].size, .35);
    }
  }
  art.destroy();
});

test('70% solo hold keeps rasterized arms clear of the original desktop frame', () => {
  const art = fixture(884, 682, {size: .7});
  for (let t = 9.5; t < 15; t += .15) {
    art.time = t;
    outline(art, t);
    const occupied = art.owners;
    for (let row = 0; row < art.rows; row++) for (let col = 0; col < art.cols; col++) {
      if (Math.min(row, col, art.rows - 1 - row, art.cols - 1 - col) >= 2) continue;
      assert.equal(occupied[row * art.cols + col], -1, `edge contact at t=${t.toFixed(2)}`);
    }
  }
  art.destroy();
});
