/** Numerical acceptance for the shared feeding endpoint, not browser/pixel evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrogPond, stepFrogPond, pondPointToWorld, posePondFrog } from '../generated/pond.mjs';
import { frogMouthPoint } from '../generated/geometry.mjs';
import { insectHover, tongueMotion, tonguePoint, tongueTarget } from '../generated/choreography.mjs';
import { createLegacyFrogPreview } from '../generated/legacy-preview.mjs';
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('the bounded visible feeding endpoint stays continuous at contact for every actor/count/view', t => {
  let contacts = 0, cappedContacts = 0, maximumNormalizedContactTravel = 0;
  for (const seed of [23, 0xffffffff]) for (const size of [.75, 1.15]) for (const count of [1, 2, 3]) {
    for (let frogId = 0; frogId < count; frogId++) {
      let state = createFrogPond({ seed, config: { size }, director: { count, autonomy: false } });
      state = stepFrogPond(state, 1, [{ type: 'hunt', frogId, x: .7, y: -.5, tick: 1, seq: 0 }]).state;
      const previous = new Map(), returnDistance = new Map();
      let caughtAt = null, reachedContact = false;
      for (let tick = 2; tick <= 260; tick++) {
        state = stepFrogPond(state, tick).state;
        const actor = state.actors[frogId], motive = actor.motive;
        if (motive.kind !== 'strike' || !state.firefly) continue;
        const newlyCaught = state.firefly.phase === 'caught' && caughtAt === null;
        if (newlyCaught) { caughtAt = tick; reachedContact = true; }
        const envelope = tongueMotion(motive.age, motive.duration), pose = posePondFrog(state, actor);
        const ground = pondPointToWorld(state.firefly.point);
        // Latch the actual observed contact tick, independently of the envelope's
        // fractional timing implementation. Before contact the insect is free.
        const hover = insectHover({ ...ground, y: ground.y + .62 * pose.scale }, pose.scale,
          caughtAt ?? tick, actor.id === 2 ? -1 : 1, true);
        for (const view of ['front', 'left', 'right', 'profile']) {
          const context = `seed ${seed}, size ${size}, count ${count}, actor ${frogId}, ${view}, tick ${tick}`;
          const mouth = frogMouthPoint(pose, view), target = tongueTarget(mouth, hover, pose.scale);
          assert(distance(mouth, target) <= 1.65 * pose.scale + 1e-12, `${context}: bounded tongue reach`);
          const visiblePrey = caughtAt === null ? target : tonguePoint(mouth, target, envelope.reach, 1, pose.scale);
          if (newlyCaught) {
            const before = previous.get(view); assert(before, `${context}: contact has a visible anticipation frame`);
            assert.equal(envelope.reach, 1, `${context}: catch occurs at full contact`);
            const travel = distance(before, visiblePrey) / pose.scale;
            // 5% of body scale is a small hover/pose movement, not the formerly
            // uncapped-hover → clipped-tongue jump in side/profile views.
            assert(travel < .05, `${context}: prey jumps ${travel} body scales at contact`);
            maximumNormalizedContactTravel = Math.max(maximumNormalizedContactTravel, travel);
            contacts++;
            if (distance(mouth, hover) > 1.65 * pose.scale) cappedContacts++;
          }
          if (caughtAt !== null && envelope.phase === 'return') {
            const length = distance(mouth, visiblePrey), prior = returnDistance.get(view);
            if (prior !== undefined) assert(length < prior, `${context}: attached prey must return toward the mouth`);
            returnDistance.set(view, length);
          }
          previous.set(view, visiblePrey);
        }
      }
      assert(reachedContact, `seed ${seed}, size ${size}, count ${count}, actor ${frogId}: hunt must contact`);
      assert.equal(state.firefly, null, 'caught prey must finish its return and leave the bounded effect slot');
    }
  }
  assert.equal(contacts, 96, 'all two-seed/two-size/actor-count/view combinations reach the contact gate');
  assert(cappedContacts > 0, 'the regression must exercise the reach cap, not only easy front views');
  t.diagnostic(JSON.stringify({ contacts, cappedContacts, maximumNormalizedContactTravel }));
});

test('simultaneous call/strike/ripples keep the actual numerical raster pass within the original sample budget', t => {
  const host = fakeBrowser(), preview = createLegacyFrogPreview(host.canvas(720, 440), {
    cols: 180, rows: 100, labels: false,
  });
  preview.resize(720, 440, 1);
  const water = [{ x: -.7, y: .2 }, { x: .5, y: -.2 }, { x: 0, y: .5 },
    { x: .2, y: -.6 }, { x: .4, y: .1 }, { x: -.2, y: -.1 }].map(point => ({ type: 'ripple', ...point }));
  let maximum = { samples: 0 }, busyScenes = 0;
  try {
    for (const scene of ['stillwater', 'firefly-supper', 'moonlit-chorus']) {
      let state = createFrogPond({ director: { scene, autonomy: false } }), injected = false, sawBusyFrame = false;
      for (let tick = 1; tick <= 270; tick++) {
        let actions = [];
        if (tick === 1) actions = [{ type: 'call', frogId: 0 }, { type: 'call', frogId: 2 },
          { type: 'hunt', frogId: 1, x: .7, y: -.5 }, ...water.slice(0, 5)];
        if (!injected && state.actors[1].motive.kind === 'strike' && state.actors[1].motive.age >= 3) {
          injected = true; actions = [{ type: 'call', frogId: 0 }, { type: 'call', frogId: 2 }, ...water];
        }
        state = stepFrogPond(state, tick, actions.map((action, i) => ({
          ...action, tick, seq: state.lastSeq + i + 1,
        }))).state;
        if (tick % 3 !== 0 && actions.length === 0) continue;
        const frame = preview.drawPond(state);
        assert(frame.samples <= 60000); assert(frame.environmentSamples <= 6246);
        assert.equal(frame.samples, 3 * 17918 + frame.environmentSamples);
        assert(frame.actorGlyphs.every(count => count > 120), 'all three owners remain in the cell field');
        if (frame.samples > maximum.samples) maximum = { scene, tick,
          samples: frame.samples, environmentSamples: frame.environmentSamples };
        if (state.actors[0].motive.kind === 'call' && state.actors[1].motive.kind === 'strike'
          && state.actors[2].motive.kind === 'call' && state.ripples.length === 6) sawBusyFrame = true;
      }
      assert(sawBusyFrame, `${scene}: pressure case must actually overlap calls, feeding and six ripples`);
      busyScenes++;
    }
  } finally { preview.dispose(); }
  assert.equal(busyScenes, 3);
  t.diagnostic(JSON.stringify({ evidence: 'numerical raster with Canvas method doubles; not pixels', maximum }));
});
