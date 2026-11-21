/** Explicit canonical outcomes for the private review controls; not browser delivery. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createFrogPond, stepFrogPond } from '../../../generated/pond.mjs';

const settings = { seed: 23, director: { scene: 'stillwater', count: 1, autonomy: false,
  layout: 'shelter', roles: ['hunter', 'hunter', 'dreamer'] } };
const initial = createFrogPond(settings), actor = initial.actors[0];
const available = initial.pads.filter(p => p.id !== actor.padId &&
  Math.hypot(p.point.x - actor.model.position.x, p.point.y - actor.model.position.y) <= actor.model.config.maxDistance);
const commands = [...available.slice(0, 2).map(p => ({ type: 'hop', frogId: 0, padId: p.id })),
  { type: 'hunt', frogId: 0, x: .36, y: -.4 }, { type: 'hunt', frogId: 0, x: -.76, y: -.7 }];
const records = commands.map(command => {
  let state = createFrogPond(settings), previous = '', caught = false;
  const event = { ...command, tick: 24, seq: 0 }, phases = [];
  for (let tick = 1; tick <= 400; tick++) {
    state = stepFrogPond(state, tick, tick === 24 ? [event] : []).state;
    const a = state.actors[0], phase = a.model.behavior.kind + '/' + a.motive.kind + '/' + (state.firefly?.phase ?? 'none');
    caught ||= state.firefly?.phase === 'caught';
    if (phase !== previous) { phases.push({ tick, phase, padId: a.padId, position: a.model.position }); previous = phase; }
  }
  assert.equal(state.actors[0].motive.kind, 'rest');
  assert.equal(state.firefly, null);
  return { event, initialPad: actor.padId, finalPad: state.actors[0].padId,
    finalPosition: state.actors[0].model.position, finalBehavior: state.actors[0].model.behavior.kind,
    finalMotive: state.actors[0].motive.kind, caught, phases };
});
assert.notEqual(records[0].finalPad, records[1].finalPad);
assert.notEqual(records[2].finalPad, records[3].finalPad);
assert(records[2].caught && records[3].caught);
const result = { kind: 'Canonical model outcome check for the exact private review seed/config; not browser event delivery',
  base: '26ee6ffc623e0adb2256e66d5b7cefc9ff36c7dd', settings, records };
writeFileSync(new URL('./input-outcomes.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: 'passed', cases: records.length,
  finalPads: records.map(record => record.finalPad), huntCatches: records.slice(2).map(record => record.caught) }));
