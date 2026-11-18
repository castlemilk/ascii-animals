/** Compile against emitted declarations; this file is typechecked, never executed. */
import {
  createPufferfish, configurePufferfish, stepPufferfish, resetPufferfish,
  resolvePufferfishOptions, PUFFERFISH_DEFAULTS,
} from '../build/model.js';
import type {
  PufferfishOptions, PufferfishConfig, PufferfishInput, PufferfishEvent,
  PufferfishPhase, PufferfishState, PufferfishStepResult, PufferfishDefinition,
  PufferfishSampleSink,
} from '../build/types.js';
import { mountPufferfish, normalizePufferfishPointer } from '../build/controller.js';
import type { PufferfishController, PufferfishStatus, PufferfishActionResult } from '../build/controller.js';
import type { PufferfishLegacyDependency } from '../build/legacy-painter.js';

const options = { seed: 23, dwellTicks: 30, wobble: 0.5 } satisfies PufferfishOptions;
const config: PufferfishConfig = resolvePufferfishOptions(options);
const state: PufferfishState = createPufferfish(config);
const input: PufferfishInput = { type: 'pointer', x: 0.1, y: 0, aspect: 1.5 };
const event: PufferfishEvent = { ...input, tick: 1, seq: 0 };
const result: PufferfishStepResult = stepPufferfish(state, { tick: 1, events: [event] });
const reset: PufferfishState = resetPufferfish(result.state, 99);
const configured: PufferfishState = configurePufferfish(reset, { cooldownTicks: 120 });
const sink: PufferfishSampleSink = sample => {
  const material: 0 | 1 | 2 = sample.material;
  const coordinate: number = sample.x;
  void material; void coordinate;
};
declare const definition: PufferfishDefinition;
definition.sample(configured, sink, { quality: 'small', staticPose: true });
const description: string = definition.describe(configured);
void description;

function exhaustivePhase(phase: PufferfishPhase): number {
  switch (phase.kind) {
    case 'idle': return 0;
    case 'approach': return phase.age;
    case 'inflating': return phase.stage === 'belly' ? phase.age : phase.age + 1;
    case 'holding': return phase.age;
    case 'recovering': return phase.from + phase.age;
    case 'cooldown': return phase.remaining + Number(phase.retreated);
    default: { const unreachable: never = phase; return unreachable; }
  }
}
exhaustivePhase(result.state.phase);

// @ts-expect-error Unknown config keys are rejected by the local API.
createPufferfish({ surprise: true });
// @ts-expect-error Seed must be numeric; runtime additionally rejects nonfinite/fractional values.
createPufferfish({ seed: '23' });
// @ts-expect-error exactOptionalPropertyTypes forbids explicit undefined config fields.
createPufferfish({ dwellTicks: undefined });
// @ts-expect-error Phase discriminants must belong to this species.
const wrongPhase: PufferfishPhase = { kind: 'spray' };
// @ts-expect-error Recovering requires its captured inflation amount.
const missingRecoveryData: PufferfishPhase = { kind: 'recovering', age: 2 };
// @ts-expect-error Inflation must identify its belly or spine stage.
const missingStage: PufferfishPhase = { kind: 'inflating', age: 2 };
// @ts-expect-error Idle has no stage-specific age field.
const invalidIdle: PufferfishPhase = { kind: 'idle', age: 1 };
// @ts-expect-error Pointer inputs require normalized x/y/aspect.
const missingCoordinates: PufferfishInput = { type: 'pointer' };
// @ts-expect-error Tick is numeric, not a timestamp string.
stepPufferfish(state, { tick: '1' });
// @ts-expect-error Unknown event types are not accepted.
stepPufferfish(state, { tick: 1, events: [{ tick: 1, seq: 0, type: 'startle' }] });
// @ts-expect-error An explicit null event batch is malformed.
stepPufferfish(state, { tick: 1, events: null });
// @ts-expect-error Snapshots are read-only.
state.tick = 3;
// @ts-expect-error Nested config is read-only.
state.config.seed = 3;
// @ts-expect-error Nested pointer is read-only.
state.pointer.x = 0;
// @ts-expect-error Default config is read-only.
PUFFERFISH_DEFAULTS.wobble = 0;
// @ts-expect-error A numeric update result is not a PufferfishState.
resetPufferfish(42);
// @ts-expect-error Rendering choices are explicit, not arbitrary quality strings.
definition.sample(state, sink, { quality: 'ultra' });
void wrongPhase; void missingRecoveryData; void missingStage; void invalidIdle; void missingCoordinates;

declare const canvas: HTMLCanvasElement;
declare const legacy: PufferfishLegacyDependency;
const controller: PufferfishController = mountPufferfish(canvas, legacy, {
  species: { seed: 23, inflationScale: 1.5 },
  render: { quality: 'small', view: 'front', maxDpr: 1 },
  paused: true,
  onChange(status) { const description: string = status.description; void description; },
  onError(error) { if (error instanceof Error) { const message: string = error.message; void message; } },
});
controller.configure({ wobble: 0 });
controller.configureRender({ view: 'left' });
controller.setPaused(false);
controller.reset(45);
const status: PufferfishStatus = controller.getStatus();
const action: PufferfishActionResult = controller.approach();
const actionKind: 'queued' | 'static-poster' | 'suspended' = action.kind;
const normalized: PufferfishInput | null = normalizePufferfishPointer(200, 100,
  { left: 0, top: 0, width: 400, height: 200 });
controller.destroy();
void status; void actionKind; void normalized;
// @ts-expect-error Mount requires an actual Canvas element interface.
mountPufferfish({}, legacy);
// @ts-expect-error Pause does not accept truthy string coercion.
controller.setPaused('true');
// @ts-expect-error Renderer enum values are explicit.
controller.configureRender({ view: 'rear' });
// @ts-expect-error Renderer configuration patch is not nullable.
controller.configureRender(null);
// @ts-expect-error Renderer settings do not belong to species configuration.
controller.configure({ quality: 'small' });
// @ts-expect-error Private legacy writer is not exposed on the public species controller.
controller._put(0, 0, 0, 1, 0, 1);
// @ts-expect-error Status snapshots are immutable.
status.running = true;
// @ts-expect-error Controller snapshots remain readonly through the public boundary.
controller.getSnapshot().tick = 0;
// @ts-expect-error Configuration requires a boolean flag.
mountPufferfish(canvas, legacy, { paused: 'yes' });
// @ts-expect-error A callback receives typed status, not the internal mutable state.
mountPufferfish(canvas, legacy, { onChange: (state: PufferfishState) => void state });
