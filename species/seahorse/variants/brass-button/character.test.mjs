import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildBrassButton } from './build.mjs';
import { fakeBrowser } from '../../../../test/helpers/fake-browser.mjs';

// Exercise the private opt-in runtime from a disposable build. Original's
// canonical public build and declarations remain independent of this module.
const originalDeclarationURL = new URL('../../../../lib/public/seahorse.d.ts', import.meta.url);
const originalDeclarationHash = createHash('sha256').update(readFileSync(originalDeclarationURL)).digest('hex');
const outputDir = await mkdtemp(join(tmpdir(), 'seahorse-brass-button-test-'));
after(() => rm(outputDir, { recursive: true, force: true }));
let privateRuntime;
try {
  const { runtime } = await buildBrassButton(outputDir);
  privateRuntime = await import(pathToFileURL(runtime).href);
} catch (error) {
  await rm(outputDir, { recursive: true, force: true });
  throw error;
}
const { createBrassButtonArtwork, createBrassButtonModel } = privateRuntime;

// Character/lifecycle contracts, not raster snapshots or a visual acceptance
// oracle. Brass Button keeps its own unconfigured single-animal study.
const garden = {
  scene: 'kelp-garden', count: 1, choreography: 'hold', columns: 100, rows: 76,
  seed: 19, individuals: [{ role: 'sentinel' }],
};
const member = model => model.getDirectorState().members[0];

function advance(model, ticks, batch = 600) {
  while (ticks > 0) {
    const step = Math.min(ticks, batch);
    model.advanceTicks(step);
    ticks -= step;
  }
}

function assertContact(animal, context) {
  assert.notEqual(animal.anchorId, null, `${context}: grip remains complete`);
  assert(animal.anchor, `${context}: completed grip has an anchor`);
  assert(Math.hypot(animal.tailTip.x - animal.anchor.x, animal.tailTip.y - animal.anchor.y) < 1e-9,
    `${context}: the actual tail endpoint stays on its moving hold`);
}

function observeRaster(canvas) {
  const context = canvas.getContext('2d');
  let calls = 0;
  for (const name of ['fillRect', 'clearRect', 'fillText', 'strokeText', 'drawImage', 'putImageData']) {
    const original = context[name];
    context[name] = (...args) => { calls++; return original.apply(context, args); };
  }
  return () => calls;
}

function fittedPicture(art, canvas) {
  const { columns, rows } = art.getOptions(), r = canvas.rect;
  const aspect = columns * .56 / rows;
  const width = Math.min(r.width, r.height * aspect), height = width / aspect;
  return { x: r.left + (r.width - width) / 2, y: r.top + (r.height - height) / 2, width, height };
}

function pointerAt(art, canvas, x, y, extra = {}) {
  const picture = fittedPicture(art, canvas);
  return {
    clientX: picture.x + (x + 1) * picture.width / 2,
    clientY: picture.y + (y + 1) * picture.height / 2,
    pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, ...extra,
  };
}

function tap(canvas, event) {
  canvas.emit('pointerdown', { ...event, buttons: 1 });
  canvas.emit('pointerup', { ...event, buttons: 0 });
}

test('Brass Button default study renders distinct brace and release posters and recovers after explicit stepping', () => {
  const baseline = createBrassButtonModel();
  const initial = baseline.frame().text;
  const posters = new Set();
  for (const type of ['startle', 'release']) {
    const model = createBrassButtonModel();
    model.direct({ type }, true);
    assert.equal(model.getState().tick, 0, `${type}: poster does not advance time`);
    assert.notEqual(model.frame().text, initial, `${type}: visible in the opt-in variant default study`);
    posters.add(model.frame().text);
    model.advanceTicks(240);
    const recovered = createBrassButtonModel();
    recovered.advanceTicks(240);
    assert.deepEqual(model.getDirectorState(), recovered.getDirectorState(), `${type}: cue leaves no director offset`);
    assert.equal(model.frame().text, recovered.frame().text, `${type}: portrait settles back to its ordinary pose`);
  }
  assert.equal(posters.size, 2, 'brace and release are different visible character actions');
});

test('opposite guide positions choose opposite release travel in still water, independent of facing', () => {
  for (const facing of ['left', 'right']) {
    const options = { ...garden, current: 0, facing };
    function released(targetX) {
      const model = createBrassButtonModel(options);
      if (targetX !== null) model.guide(targetX, -.35);
      model.direct({ type: 'release' });
      model.advanceTicks(90);
      assert.equal(member(model).anchorId, null, `${facing}/${targetX}: active release leaves its hold`);
      return model;
    }
    const left = released(-.85), center = released(null), right = released(.85);
    const a = member(left), b = member(right), origin = member(center).x;
    // Do not require movement toward the hand: a shy character may retreat.
    // Compare actual body positions, so passive eye/head attention alone cannot
    // satisfy the requirement that input changes the outcome of the release.
    assert((a.x - origin) * (b.x - origin) < 0,
      `${facing}: the two guide positions choose different sides of the neutral release`);
    assert(Math.abs(a.x - b.x) > .12 * Math.min(a.scale, b.scale),
      `${facing}: changing the guide produces readable travel, not only a pose twitch`);
    assert.notEqual(left.frame().text, right.frame().text, `${facing}: chosen travel is visible in the cells`);
  }
  const posters = [-.85, .85].map(x => {
    const model = createBrassButtonModel();
    model.guide(x, -.35);
    model.direct({ type: 'release' }, true);
    return model.frame().text;
  });
  assert.notEqual(posters[0], posters[1], 'the Brass Button default study also renders the guide-dependent release');
});

test('brace responds against signed current in either facing while keeping its eelgrass grip', () => {
  for (const facing of ['left', 'right']) {
    const mirror = facing === 'left' ? 1 : -1;
    const frames = [];
    for (const current of [-1, 1]) {
      const options = { ...garden, facing, current };
      const model = createBrassButtonModel(options), baseline = createBrassButtonModel(options);
      model.direct({ type: 'startle' });
      model.advanceTicks(80); baseline.advanceTicks(80);
      const active = member(model), ordinary = member(baseline);
      assertContact(active, `${facing}/${current}`);
      assert((active.rotation - ordinary.rotation) * current * mirror < -.04,
        `${facing}/${current}: bracing opposes the current rather than repeating one direction`);
      frames.push(model.frame().text);
    }
    assert.notEqual(frames[0], frames[1], `${facing}: opposite current has a different visible brace`);
  }
  const portraits = [-1, 1].map(current => {
    const model = createBrassButtonModel({ current });
    model.direct({ type: 'startle' }, true);
    return model.frame().text;
  });
  assert.notEqual(portraits[0], portraits[1], 'signed bracing also reaches the default study painter');
});

test('character cues and guide changes replay identically across tick grouping in study and garden', () => {
  for (const scene of ['study', 'kelp-garden']) {
    function replay(batch) {
      const model = createBrassButtonModel({ ...garden, scene, seed: 73, current: .4, facing: 'right' });
      const checkpoints = [];
      const events = [
        [17, () => model.guide(-.8, -.4)],
        [29, () => model.direct({ type: 'release' })],
        [71, () => model.guide(.7, .2)],
        [137, () => model.clearGuide()],
        [270, () => model.configure({ current: -.8 })],
        [285, () => model.direct({ type: 'startle' })],
        [317, () => model.direct({ type: 'release' })], // active cue ignores retrigger
        [430, () => model.guide(.5, -.6)],
        [526, () => model.clearGuide()],
        [570, () => model.greet()],
        [751, () => {}],
      ];
      let tick = 0;
      for (const [next, action] of events) {
        advance(model, next - tick, batch); tick = next; action();
        checkpoints.push({ state: model.getState(), director: model.getDirectorState(), frame: model.frame() });
      }
      return checkpoints;
    }
    const expected = replay(1);
    for (const batch of [2, 5, 17]) assert.deepEqual(replay(batch), expected, `${scene}: ${batch}-tick grouping`);
  }
});

test('hidden and off-screen artworks accept input without raster work or catch-up on return', () => {
  for (const scene of ['study', 'kelp-garden']) for (const blocker of ['hidden', 'off-screen']) {
    const h = fakeBrowser(), canvas = h.canvas(390, 660), rasterCalls = observeRaster(canvas);
    const art = createBrassButtonArtwork(canvas, { ...garden, scene });
    try {
      assert.equal(rasterCalls(), 0, `${scene}: mounting before the first intersection does not paint off-screen`);
      h.intersect(canvas, true);
      assert(rasterCalls() > 0, `${scene}: first visible intersection paints the artwork`);
      h.frame(); h.frame(34);
      const tick = art.getStatus().tick, beforeBlock = rasterCalls();
      if (blocker === 'hidden') h.hide(true); else h.intersect(canvas, false);
      assert.equal(rasterCalls(), beforeBlock, `${scene}/${blocker}: blocking does not repaint an invisible canvas`);
      assert.equal(h.pending, 0, `${scene}/${blocker}: scheduler subscription is released`);
      art.guide(.75, -.3);
      art.direct({ type: 'release' });
      art.direct({ type: 'startle' });
      art.update({ palette: 'rose', current: -.7 });
      art.clearGuide();
      art.resize();
      h.frame(60000);
      assert.equal(rasterCalls(), beforeBlock, `${scene}/${blocker}: guide, cues, updates and resize do not paint`);
      assert.equal(art.getStatus().tick, tick, `${scene}/${blocker}: input does not advance simulation`);
      assert.equal(h.pending, 0, `${scene}/${blocker}: input does not resume scheduling`);
      if (blocker === 'hidden') h.hide(false); else h.intersect(canvas, true);
      assert(rasterCalls() > beforeBlock, `${scene}/${blocker}: returning paints the latest chosen pose`);
      assert.equal(art.getStatus().tick, tick, `${scene}/${blocker}: return itself does not advance simulation`);
      h.frame(60000);
      assert.equal(art.getStatus().tick, tick, `${scene}/${blocker}: resume establishes a fresh clock baseline`);
    } finally { art.dispose(); }
    assert.equal(h.pending, 0);
  }
});

test('visible paused and reduced-motion users can replace character posters without starting playback', () => {
  for (const scene of ['study', 'kelp-garden']) for (const reducedMotion of [false, true]) {
    const h = fakeBrowser({ reducedMotion }), canvas = h.canvas(390, 660), rasterCalls = observeRaster(canvas);
    const options = { ...garden, scene, paused: !reducedMotion };
    const art = createBrassButtonArtwork(canvas, options);
    try {
      h.intersect(canvas, true);
      const chosen = [];
      for (const type of ['release', 'startle', 'release']) {
        const before = rasterCalls();
        art.direct({ type });
        assert(rasterCalls() > before, `${scene}/${reducedMotion}/${type}: deliberate visible poster is painted`);
        const expected = createBrassButtonModel(options);
        expected.direct({ type }, true);
        chosen.push(art.getFrame().text);
        assert.equal(chosen.at(-1), expected.frame().text, `${scene}/${type}: previous poster is replaced`);
        assert.equal(art.getStatus().tick, 0);
        assert.equal(art.getStatus().paused, true);
        assert.equal(h.pending, 0);
      }
      assert.notEqual(chosen[0], chosen[1], `${scene}: both static actions remain distinct`);
      assert.equal(chosen[0], chosen[2], `${scene}: returning to a poster is deterministic`);
      if (reducedMotion) art.play();
      art.resize(); h.frame(1000);
      assert.equal(art.getStatus().tick, 0);
      assert.equal(h.pending, 0, 'neither a resize nor play under reduced motion wakes animation');
    } finally { art.dispose(); }
    assert.equal(canvas.listenerCount, 0);
    assert.equal(h.pending, 0);
  }
});

test('completed taps use the letterboxed study silhouette, while gutters and cancelled pans stay inert', () => {
  for (const [width, height] of [[947, 707], [390, 660]]) for (const pointerType of ['mouse', 'touch']) {
    const h = fakeBrowser(), canvas = h.canvas(width, height);
    canvas.rect.left = 37; canvas.rect.top = 23;
    const art = createBrassButtonArtwork(canvas, { paused: true });
    const context = `${width}x${height}/${pointerType}`;
    const reset = () => { art.restart(); art.update({ current: .3 }); };
    try {
      h.intersect(canvas, true);
      const frame = art.getFrame(), scene = art.getDirectorState(), animal = scene.members[0];
      const owned = frame.cells.map((cell, index) => ({ ...cell, index,
        col: index % frame.columns, row: Math.floor(index / frame.columns) }))
        .filter(cell => cell.layer === 'animal' && cell.owner === 0);
      const visible = owned.filter(cell => cell.glyph !== ' ');
      assert(visible.length > 0);
      const bodyCol = (animal.x / scene.worldWidth + .5) * frame.columns;
      const bodyRow = (animal.y / scene.worldHeight + .5) * frame.rows;
      const bodyDistance = cell => (cell.col - bodyCol) ** 2 + (cell.row - bodyRow) ** 2;
      // Select landmarks from the actual output, not hardcoded anatomy/glyphs.
      // Owned quiet interiors remain part of the body's touch surface.
      const landmarks = [
        owned.reduce((a, b) => bodyDistance(a) < bodyDistance(b) ? a : b),
        visible.reduce((a, b) => a.row < b.row ? a : b),
        visible.reduce((a, b) => a.col < b.col ? a : b),
        visible.reduce((a, b) => a.col > b.col ? a : b),
      ];
      for (const cell of landmarks) {
        reset();
        tap(canvas, pointerAt(art, canvas, (cell.col + .5) / frame.columns * 2 - 1,
          (cell.row + .5) / frame.rows * 2 - 1, { pointerType }));
        assert.equal(member(art).anchorId, null, `${context}: body/head/snout/fin tap chooses release`);
        assert.equal(member(art).motive.kind, 'drifting');
        assert.equal(art.getOptions().current, .3, `${context}: tapping the animal does not inject current`);
      }
      for (const side of [-1, 1]) {
        reset();
        tap(canvas, pointerAt(art, canvas, side * .92, -.88, { pointerType }));
        assert(art.getOptions().current * side < -.8, `${context}: open-water side sets signed current`);
        assert.equal(member(art).motive.kind, 'startled', `${context}: open-water tap chooses brace`);
        assertContact(member(art), context);
      }
      reset();
      const picture = fittedPicture(art, canvas), beforeGutter = art.getFrame().text;
      const gutter = picture.x - canvas.rect.left > 1
        ? { clientX: (canvas.rect.left + picture.x) / 2, clientY: canvas.rect.top + height / 2 }
        : { clientX: canvas.rect.left + width / 2, clientY: (canvas.rect.top + picture.y) / 2 };
      tap(canvas, { ...pointerAt(art, canvas, 0, 0, { pointerType }), ...gutter });
      assert.equal(art.getFrame().text, beforeGutter, `${context}: a blank letterbox gutter is not water`);
      assert.equal(art.getOptions().current, .3);
      for (const cancellation of ['pointercancel', 'pointerleave', 'lostpointercapture', 'moved', 'hidden', 'off-screen']) {
        reset();
        const before = art.getFrame().text;
        const event = pointerAt(art, canvas, -.92, -.88, { pointerType: 'touch' });
        canvas.emit('pointerdown', event);
        assert.equal(art.getFrame().text, before, `${context}: touching down alone is not a tap`);
        if (cancellation === 'moved') canvas.emit('pointermove', { ...event, clientY: event.clientY + 32 });
        else if (cancellation === 'hidden') { h.hide(true); h.hide(false); }
        else if (cancellation === 'off-screen') { h.intersect(canvas, false); h.intersect(canvas, true); }
        else canvas.emit(cancellation, event);
        canvas.emit('pointerup', event);
        assert.equal(art.getFrame().text, before, `${context}/${cancellation}: cancelled touch does not act or guide`);
        assert.equal(art.getOptions().current, .3, `${context}/${cancellation}: scrolling does not change current`);
      }
      for (const extra of [{ button: 2 }, { isPrimary: false }]) {
        reset(); const before = art.getFrame().text;
        tap(canvas, pointerAt(art, canvas, -.92, -.88, { pointerType, ...extra }));
        assert.equal(art.getFrame().text, before, `${context}: secondary button/pointer is ignored`);
        assert.equal(art.getOptions().current, .3);
      }
      assert.equal(art.getStatus().tick, 0);
      assert.equal(h.pending, 0);
    } finally { art.dispose(); }
    assert.equal(canvas.listenerCount, 0);
  }
});

test('focused B/R/arrows drive the study without intercepting global, modified or other-control keys', () => {
  const h = fakeBrowser(), canvas = h.canvas(390, 660);
  const options = { paused: true, current: .7 };
  const art = createBrassButtonArtwork(canvas, options);
  let prevented = 0;
  const event = (key, extra = {}) => ({ key, target: canvas, currentTarget: canvas,
    preventDefault() { prevented++; }, ...extra });
  const key = (value, extra) => canvas.emit('keydown', event(value, extra));
  try {
    h.intersect(canvas, true); h.document.activeElement = canvas;
    const before = art.getFrame().text;
    for (const value of ['ArrowLeft', 'ArrowRight', 'B', 'r']) {
      h.view.emit('keydown', event(value));
      h.document.emit('keydown', event(value));
      key(value, { target: {} });
      for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) key(value, { [modifier]: true });
    }
    assert.equal(art.getFrame().text, before, 'unowned shortcuts do not change the artwork');
    assert.equal(prevented, 0, 'unowned shortcuts keep their native defaults');
    const releaseFrames = [];
    for (const [arrow, direction] of [['ArrowLeft', -.7], ['ArrowRight', .7]]) {
      art.restart();
      const count = prevented;
      key(arrow); key('r');
      const expected = createBrassButtonModel(options);
      expected.guide(direction, 0); expected.direct({ type: 'release' }, true);
      releaseFrames.push(art.getFrame().text);
      assert.equal(releaseFrames.at(-1), expected.frame().text, `${arrow}: keyboard chooses the same deliberate release`);
      assert.equal(prevented - count, 2, 'handled canvas keys suppress page defaults');
    }
    assert.notEqual(releaseFrames[0], releaseFrames[1], 'keyboard users can choose both retreat directions');
    art.restart(); key('B');
    const braced = createBrassButtonModel(options); braced.direct({ type: 'startle' }, true);
    assert.equal(art.getFrame().text, braced.frame().text, 'B is the brace action, including in the default study');
    for (const [arrow, direction] of [['ArrowUp', -.7], ['ArrowDown', .7]]) {
      art.restart(); key(arrow);
      const expected = createBrassButtonModel(options); expected.guide(0, direction);
      assert.equal(art.getFrame().text, expected.frame().text, `${arrow}: vertical keyboard guidance remains available`);
    }
    assert.equal(art.getStatus().tick, 0);
    assert.equal(h.pending, 0);
  } finally { art.dispose(); }
  assert.equal(canvas.listenerCount, 0);
});

test('leaving for a control clears visible attention but preserves the last approach for its release button', () => {
  const h = fakeBrowser(), canvas = h.canvas(947, 707);
  const options = { paused: true, current: 0 };
  const art = createBrassButtonArtwork(canvas, options);
  const choices = [];
  try {
    h.intersect(canvas, true);
    const neutral = createBrassButtonModel(options).frame().text;
    for (const direction of [-.8, .8]) {
      art.restart();
      canvas.emit('pointermove', pointerAt(art, canvas, direction, -.25, { pointerType: 'mouse' }));
      canvas.emit('pointerleave', { pointerId: 1, pointerType: 'mouse' });
      assert.equal(art.getFrame().text, neutral, 'leaving removes the visible hover target');
      art.direct({ type: 'release' }); // the labeled button invokes this same API
      const expected = createBrassButtonModel(options);
      expected.guide(direction, -.25); expected.clearGuide(); expected.direct({ type: 'release' }, true);
      assert.equal(art.getFrame().text, expected.frame().text, 'the button still knows which side approached');
      const chosenX = member(art).x;
      choices.push(chosenX);
      canvas.emit('pointermove', pointerAt(art, canvas, -direction, -.25, { pointerType: 'mouse' }));
      assert(Math.abs(member(art).x - chosenX) < 1e-9, 'later pointer motion does not reverse the captured release route');
    }
    assert(choices[0] * choices[1] < 0, 'leaving for the button retains both possible retreat directions');
    art.restart(); art.direct({ type: 'release' });
    const reset = createBrassButtonModel(options); reset.direct({ type: 'release' }, true);
    assert.equal(art.getFrame().text, reset.frame().text, 'restart clears the remembered approach');
    assert.equal(art.getStatus().tick, 0);
    assert.equal(h.pending, 0);
  } finally { art.dispose(); }
});

test('private build and character use leave Original Seahorse public declarations unchanged', () => {
  const declaration = readFileSync(originalDeclarationURL);
  assert.equal(createHash('sha256').update(declaration).digest('hex'), originalDeclarationHash,
    'the opt-in variant must leave Original’s shipped typed API unchanged');
});
