import { createFoxDirector, FOX_DIRECTOR_DEFAULTS, resolveFoxDirectorOptions } from '../../src/director.js';
import { buildFoxSceneGrid } from '../../src/director-render.js';
import type { FoxActorIntent, FoxDirector, FoxDirectorCreateOptions, FoxDirectorFrame,
  FoxDirectorInput, FoxDirectorOptions, FoxDirectorState, FoxDirectorStepResult, FoxSceneGrid } from '../../src/director-types.js';

const options = { scene: 'dusk-hunt', count: 3, seed: 17, pace: .75,
  roles: ['hunter', 'lookout', 'dreamer'], fox: { paused: true } } satisfies FoxDirectorCreateOptions;
const director: FoxDirector = createFoxDirector(options);
const defaults: FoxDirectorOptions = FOX_DIRECTOR_DEFAULTS;
const normalized: FoxDirectorOptions = resolveFoxDirectorOptions({ wind: -.5, showLabels: false });
const inputs = [
  { type: 'select', tick: 1, seq: 0, id: 1 },
  { type: 'cue', tick: 1, seq: 1, cue: 'rustle', id: 1, x: .5, y: .25 },
] as const satisfies readonly FoxDirectorInput[];
const result: FoxDirectorStepResult = director.step(1, inputs);
const state: FoxDirectorState = result.state;
const frame: FoxDirectorFrame = director.getFrame('listen');
const grid: FoxSceneGrid = buildFoxSceneGrid(frame, { cols: 112, rows: 64 });
director.configure({ count: 1, scene: 'den-watch', roles: ['dreamer', 'lookout', 'playmate'] });
director.configureFox({ pounceHeight: .25 });
director.select(0);
director.setPaused(false);
director.reset();
director.dispose();

function inspectIntent(intent: FoxActorIntent): number {
  switch (intent.kind) {
    case 'autonomous': return 0;
    case 'rest': return intent.age;
    case 'investigate': return intent.age + intent.target.x;
    default: { const exhaustive: never = intent; return exhaustive; }
  }
}

// @ts-expect-error The cast is a bounded literal count, not an arbitrary population.
createFoxDirector({ count: 4 });
// @ts-expect-error Count is integral at the type boundary too.
createFoxDirector({ count: 1.5 });
// @ts-expect-error Scene names are a closed Fox-specific vocabulary.
createFoxDirector({ scene: 'school' });
// @ts-expect-error Marine roles do not belong to this director.
createFoxDirector({ roles: ['orbit'] });
// @ts-expect-error Seed is construction/reset identity, not an options patch.
director.configure({ seed: 3 });
// @ts-expect-error Playback policy is controlled explicitly.
director.configure({ paused: true });
// @ts-expect-error An arbitrary renderer API is not implied by a scene.
director.configure({ formation: 'diagonal' });
// @ts-expect-error Numeric options do not accept strings.
director.configure({ curiosity: '0.5' });
// @ts-expect-error Cue names are Fox-specific.
director.step(1, [{ type: 'cue', tick: 1, seq: 0, cue: 'ink' }]);
// @ts-expect-error Guide requires both normalized axes.
director.step(1, [{ type: 'guide', tick: 1, seq: 0, x: .5 }]);
// @ts-expect-error All replay events carry an explicit sequence.
director.step(1, [{ type: 'select', tick: 1, id: 0 }]);
// @ts-expect-error The fixed-tick director does not expose seconds-based advance.
director.advance(.1);
// @ts-expect-error Deliberate tableaux are a closed vocabulary.
director.getFrame('orbit');
// @ts-expect-error Frozen state is read-only.
state.tick = 3;
// @ts-expect-error The actor collection is read-only.
state.actors.push(state.actors[0]!);
// @ts-expect-error Options and role assignments are read-only.
normalized.roles[0] = 'dreamer';
if (state.actors[0]?.intent.kind === 'autonomous') {
  // @ts-expect-error Autonomous intent does not expose a captured target.
  state.actors[0].intent.target;
}

void defaults; void grid; void inspectIntent;
