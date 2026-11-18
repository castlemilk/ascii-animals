/** Compile-only positive/negative consumers of the emitted frog-local contract. */
import {
  configureFrog, createFrog, frogSpecies, landingTarget, normalizeFrogPointer,
  poseFrog, resetFrog, sampleFrog, stepFrog,
} from '../generated/index.mjs';
import { mountFrog } from '../generated/controller.mjs';
import type {
  FrogAction, FrogBehavior, FrogConfigPatch, FrogController, FrogGeometryResult,
  FrogInput, FrogOptions, FrogReplay, FrogSample, FrogSpecies, FrogState,
  FrogStepResult, GeometryOptions,
} from '../generated/index.mjs';

type Assert<T extends true> = T;
type NotAny<T> = 0 extends (1 & T) ? false : true;
export type CreationIsTyped = Assert<NotAny<ReturnType<typeof createFrog>>>;
export type UpdateIsTyped = Assert<NotAny<ReturnType<typeof stepFrog>>>;
export type GeometryIsTyped = Assert<NotAny<ReturnType<typeof sampleFrog>>>;
export type ControllerIsTyped = Assert<NotAny<ReturnType<typeof mountFrog>>>;
export type NestedStateIsTyped = Assert<NotAny<FrogStepResult['state']>>;
export type SampleIsTyped = Assert<NotAny<Parameters<Parameters<typeof sampleFrog>[1]>[0]>>;

const options: FrogOptions = { seed: 23, config: { size: .9, flightTicks: 42 } };
const patch: FrogConfigPatch = { jumpHeight: .7, throatAmplitude: .03 };
const state: FrogState = createFrog(options);
const inputs: readonly FrogInput[] = [
  { type: 'target', x: .65, y: .05, tick: 1, seq: 0 },
  { type: 'leap', tick: 1, seq: 1 },
];
const result: FrogStepResult = stepFrog(state, 1, inputs);
const seed: number = result.state.seed;
const started: boolean = result.startedLeap;
const busy: number = result.ignoredLeaps;
const species: FrogSpecies = frogSpecies;
const id: 'frog' = species.id;
const version: 1 = species.version;
const bound: 32000 = species.maxSamples;
const geometryOptions: GeometryOptions = { view: 'left', staticPose: 'crouch', motion: false, silhouette: true };
const geometry: FrogGeometryResult = sampleFrog(result.state, point => {
  const typed: FrogSample = point;
  const material: 0 | 1 | 2 = typed.material;
  const coordinate: number = typed.x;
  void material; void coordinate;
}, geometryOptions);
const replay: FrogReplay = {
  schemaVersion: 1, speciesVersion: 1, tickRate: 60,
  seed, config: configureFrog(patch), events: inputs,
};
const reset: FrogState = resetFrog(result.state, { config: patch, seed: 0 });
const projected = normalizeFrogPointer(25, 30, { left: 0, top: 0, width: 100, height: 100 });
if (projected) landingTarget(reset, projected);
poseFrog(state, geometryOptions);

export function exhaustBehavior(behavior: FrogBehavior): number {
  switch (behavior.kind) {
    case 'idle':
    case 'interest': return 0;
    case 'crouch':
    case 'flight': return behavior.age + behavior.plan.to.x;
    case 'landing':
    case 'recovery':
    case 'cooldown': return behavior.age;
    default: {
      const exhaustive: never = behavior;
      return exhaustive;
    }
  }
}

export function exhaustAction(action: FrogAction): number {
  switch (action.type) {
    case 'target': return action.x + action.y;
    case 'leave': return 0;
    case 'leap': return 1;
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

declare const canvas: HTMLCanvasElement;
const controller: FrogController = mountFrog(canvas, { ...options, paused: true, preview: { cols: 72, rows: 40, view: 'front' } });
controller.target({ x: .2, y: .1 }); controller.leap(); controller.clearTarget();
controller.setPaused(true); controller.updateConfig(patch); controller.updatePreview({ view: 'right' });
controller.setStaticPose('landed'); controller.reset({ seed: 8 });
const nextState: FrogState = controller.getState();
const isDisposed: boolean = controller.getStatus().disposed;
const text: string = controller.exportText();
controller.dispose();

// Every expect-error below must be used. A permissive any fallback fails this fixture.
// @ts-expect-error Unsupported legacy species option.
createFrog({ count: 4 });
// @ts-expect-error Seed is numeric, never a coercible string.
createFrog({ seed: '23' });
// @ts-expect-error Explicit null is not an optional seed.
resetFrog(state, { seed: null });
// @ts-expect-error Numeric config cannot use string coercion.
configureFrog({ flightTicks: '42' });
// @ts-expect-error No arbitrary config extensions.
configureFrog({ duration: 1 });
// @ts-expect-error A tick is a number, not a clock label.
stepFrog(state, '1', []);
// @ts-expect-error Timestamp and sequence are required in normalized replay input.
stepFrog(state, 1, [{ type: 'leap' }]);
// @ts-expect-error Leap events do not carry target coordinates.
stepFrog(state, 1, [{ type: 'leap', x: 0, tick: 1, seq: 0 }]);
// @ts-expect-error Target events need both coordinates.
stepFrog(state, 1, [{ type: 'target', x: 0, tick: 1, seq: 0 }]);
// @ts-expect-error Unknown event discriminants are excluded.
stepFrog(state, 1, [{ type: 'hover', tick: 1, seq: 0 }]);
// @ts-expect-error Invalid phase cannot enter typed state.
const badPhase: FrogBehavior = { kind: 'swimming' };
// @ts-expect-error A flight phase requires its latched plan.
const missingPlan: FrogBehavior = { kind: 'flight', age: 1 };
// @ts-expect-error A recovery phase cannot invent a leap plan.
const extraPlan: FrogBehavior = { kind: 'recovery', age: 1, plan: { from: state.position, to: state.position } };
if (result.state.behavior.kind === 'idle') {
  // @ts-expect-error Idle is narrowed; it has no phase age.
  result.state.behavior.age;
}
// @ts-expect-error Species state is immutable to consumers.
result.state.tick = 4;
// @ts-expect-error Nested landing points are immutable too.
result.state.position.x = 0;
// @ts-expect-error Defaults are immutable.
species.defaults.size = 1;
// @ts-expect-error A different species cannot satisfy the frog state contract.
const wrongSpecies: FrogState = { ...state, species: 'ray' };
// @ts-expect-error No unreviewed geometry views.
sampleFrog(state, () => {}, { view: 'dorsal' });
// @ts-expect-error Static poses use the declared discriminants.
poseFrog(state, { staticPose: 'jump' });
// @ts-expect-error A sink must receive FrogSample, not a string.
sampleFrog(state, (point: string) => point);
// @ts-expect-error Replay version is fixed, not an unconstrained number.
const badReplay: FrogReplay = { ...replay, schemaVersion: 2 };
// @ts-expect-error Frog-local species objects do not expose a renderer registry.
species.register('frog');
// @ts-expect-error Controller setters reject the wrong option type.
controller.setPaused('yes');
// @ts-expect-error Invalid preview state cannot be requested.
controller.setStaticPose('swim');
// @ts-expect-error Controller config changes cannot reseed without reset.
controller.updateConfig({ seed: 7 });
// @ts-expect-error Explicit undefined is not a supplied option under exactOptionalPropertyTypes.
const badOptions: FrogOptions = { seed: undefined };

void [started, busy, id, version, bound, geometry, replay, nextState, isDisposed, text];
void [badPhase, missingPlan, extraPlan, wrongSpecies, badReplay, badOptions];
