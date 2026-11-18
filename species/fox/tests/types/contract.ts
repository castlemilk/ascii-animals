import { createFox, staticFoxPose, normalizeFoxPointer, foxSpecies } from '../../src/model.js';
import { buildFoxGrid } from '../../src/preview.js';
import type {
  FoxBehavior, FoxCreateOptions, FoxFrameSource, FoxInput, FoxModel,
  FoxOptions, FoxPose, FoxSpecies, FoxState, FoxStepResult,
} from '../../src/types.js';

const creation = { seed: 17, paused: true, facing: 'left', pounceHeight: 0.2 } satisfies FoxCreateOptions;
const model: FoxModel = createFox(creation);
const species: FoxSpecies = foxSpecies;
const options: FoxOptions = model.configure({ scale: 0.68, tailSway: 0.12 });
const input = [
  { type: 'guide', x: 0.5, y: 0.2, tick: 1, seq: 0 },
  { type: 'pounce', tick: 1, seq: 1 },
] as const satisfies readonly FoxInput[];
const result: FoxStepResult = model.step(1, input);
const state: FoxState = result.state;
if (result.kind === 'paused') {
  const accepted: 0 = result.eventsAccepted;
  const reaction: 'none' = result.pounce;
  void accepted; void reaction;
}
function responseAge(behavior: FoxBehavior): number {
  switch (behavior.kind) {
    case 'idle': case 'stalk': case 'sniff': return 0;
    case 'crouch': case 'airborne': case 'landing': case 'recover':
      return behavior.age + behavior.plan.options.airTicks;
    case 'cooldown': return behavior.remaining;
    default: { const exhaustive: never = behavior; return exhaustive; }
  }
}
const pose: FoxPose = staticFoxPose({ seed: 17 }, 'sniff');
const grid = buildFoxGrid(pose, { cols: 80, rows: 32, monochrome: true });
const point = normalizeFoxPointer(20, 30, { left: 0, top: 0, width: 100, height: 50 });
if (point !== null) { const x: number = point.x; void x; }

// This is the exact structural portion of PR #2 Scheduler that fox accepts.
// It verifies a type shape only; it does not claim the unmerged package is used.
declare const proposedScheduler: {
  subscribe(callback: (timestampMs: number) => void): () => void;
  dispose(): void;
  readonly size: number;
};
const frameSource: FoxFrameSource = proposedScheduler;
const unsubscribe: () => void = frameSource.subscribe(timestampMs => { const stamp: number = timestampMs; void stamp; });

// @ts-expect-error Fox configuration is species-specific; no formation API.
createFox({ formation: 'school' });
// @ts-expect-error A typed numeric value cannot be replaced by a string.
createFox({ pounceDistance: '0.2' });
// @ts-expect-error Only side-profile left/right directions are supported.
createFox({ facing: 'front' });
// @ts-expect-error Reset identity is not a mutable option patch.
model.configure({ seed: 29 });
// @ts-expect-error Playback policy is controlled explicitly.
model.configure({ paused: false });
// @ts-expect-error Guide events require both normalized coordinates.
model.step(1, [{ type: 'guide', tick: 1, seq: 0, x: 0.5 }]);
// @ts-expect-error Unknown input event types are rejected.
model.step(1, [{ type: 'fly', tick: 1, seq: 0 }]);
// @ts-expect-error State snapshots are read-only.
state.tick = 42;
// @ts-expect-error Nested targets are read-only.
state.target.x = 0;
// @ts-expect-error Option snapshots are read-only.
options.scale = 0.6;
// @ts-expect-error Pose output is read-only.
pose.legs.push({});
if (state.behavior.kind === 'idle') {
  // @ts-expect-error Idle has no response plan; discriminate before reading it.
  state.behavior.plan;
}
// @ts-expect-error The fixed-tick API does not expose the candidate's variable-dt method.
model.advance(1 / 60);
// @ts-expect-error Meaningful still poses are a closed vocabulary.
staticFoxPose({}, 'airborne');
// @ts-expect-error Cell counts are numeric; runtime additionally enforces bounded integers.
buildFoxGrid(pose, { cols: '80' });
// @ts-expect-error The host scheduler's timestamp is numeric milliseconds.
frameSource.subscribe((stamp: string) => { void stamp; });

void species; void options; void grid; void unsubscribe; void responseAge;
