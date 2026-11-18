import { createGecko, DEFAULT_GECKO_OPTIONS, normalizeGuide } from '../src/gecko.js';
import { sampleGecko, getGeckoAnatomy } from '../src/geometry.js';
import { renderGeckoGrid } from '../src/preview.js';
import { mountGecko } from '../src/browser.js';
import type { GeckoController, GeckoControllerStatus, GeckoActionResult, GeckoViewOptions } from '../src/browser.js';
import { createProposedGeckoDefinition } from '../src/proposed-adapter.js';
import type { ProposedGeckoDefinition, ProposedGeometryWriter, ProposedGeckoState } from '../src/proposed-adapter.js';
import type {
  GeckoConfig, GeckoOptions, GeckoOptionsPatch, GeckoEvent, GeckoInput,
  GeckoState, GeckoBehavior, GeckoFoot, GeckoStepResult, GeckoInputResult,
  GeckoSample, GeckoGeometryResult, GeckoGrid, GeckoModel,
} from '../src/types.js';

const config: GeckoConfig = { seed: 37, heading: -.24, options: { creepSpeed: .12, stepTicks: 18 } };
const model: GeckoModel = createGecko(config);
const defaults: Readonly<GeckoOptions> = DEFAULT_GECKO_OPTIONS;
const patch: GeckoOptionsPatch = { tailLength: .9, curlStrength: .7 };
const resolved: Readonly<GeckoOptions> = model.update(patch);
const events: GeckoInput = [
  { type: 'guide', tick: 1, seq: 1, x: .9, y: -.9 },
  { type: 'startle', tick: 1, seq: 2 },
];
const result: GeckoStepResult = model.step(events);
const snapshot: GeckoState = model.getSnapshot();
const geometry: GeckoGeometryResult = sampleGecko(snapshot, (point: GeckoSample) => {
  const coordinates: readonly number[] = [point.x, point.y, point.z, point.stableId];
  void coordinates;
});
const grid: GeckoGrid = renderGeckoGrid(snapshot, { cols: 112, rows: 50, neutral: true });
const anatomy = getGeckoAnatomy(snapshot);
void [defaults, resolved, result, geometry, grid, anatomy, normalizeGuide];

function behaviorDescription(behavior: GeckoBehavior): string {
  switch (behavior.kind) {
    case 'idle': return `Resting since ${behavior.since}`;
    case 'approach': return `Curious since ${behavior.since}`;
    case 'startle': return `Curl at heading ${behavior.heading}`;
    case 'retreat': return `Retreated ${behavior.traveled} at ${behavior.heading}`;
    case 'recover': return `Recovering since ${behavior.since}`;
    case 'cooldown': return `Resting after response since ${behavior.since}`;
    default: {
      const exhaustive: never = behavior;
      return exhaustive;
    }
  }
}

function inputDescription(input: GeckoInputResult): string {
  if (input.outcome === 'ignored') {
    const type: 'startle' = input.type;
    const reason: 'busy' = input.reason;
    return `${type}: ${reason}`;
  }
  // @ts-expect-error An applied result has no ignored reason.
  void input.reason;
  return input.type;
}

function footDescription(foot: GeckoFoot): number {
  if (foot.phase === 'swing') {
    const values: number[] = [foot.since, foot.duration, foot.lift, foot.fromAngle, foot.toAngle];
    return values.length;
  }
  const plantedAt: number = foot.plantedAt;
  // @ts-expect-error A planted foot does not have a swing destination.
  void foot.to;
  return plantedAt;
}
void [behaviorDescription, inputDescription, footDescription];

// @ts-expect-error Species does not accept cuttlefish-only options.
createGecko({ options: { formation: 'horizontal' } });
// @ts-expect-error Input event discriminants are closed.
const unknownEvent: GeckoEvent = { type: 'teleport', tick: 1, seq: 1 };
// @ts-expect-error Guidance requires both normalized coordinates.
const missingCoordinate: GeckoEvent = { type: 'guide', tick: 1, seq: 1, x: .2 };
// @ts-expect-error A leave event cannot smuggle guidance coordinates.
const extraCoordinate: GeckoEvent = { type: 'leave', tick: 1, seq: 1, x: 0, y: 0 };
// @ts-expect-error Startle heading is mandatory in this behavior variant.
const badBehavior: GeckoBehavior = { kind: 'startle', since: 1 };
// @ts-expect-error Idle does not carry retreat-only fields.
const badIdle: GeckoBehavior = { kind: 'idle', since: 1, traveled: .1 };
// @ts-expect-error Seed changes are reset-only, not live option patches.
model.update({ seed: 42 });
// @ts-expect-error Reset is not an option replacement operation.
model.reset({ creepSpeed: .1 });
// @ts-expect-error Arbitrary serialized-state restoration is not supported.
model.restore(snapshot);
// @ts-expect-error Snapshot root coordinates are read-only.
snapshot.position.x = 0;
// @ts-expect-error Snapshot foot arrays are read-only.
snapshot.feet.push(snapshot.feet[0]!);
// @ts-expect-error Resolved configuration is read-only.
resolved.tailLength = 1;
// @ts-expect-error Public sample positions are read-only.
sampleGecko(snapshot, point => { point.x = 0; });
// @ts-expect-error The representation is a closed local options schema.
renderGeckoGrid(snapshot, { mode: 'braille' });
// @ts-expect-error Disposed is a read-only observable property.
model.disposed = false;
// @ts-expect-error Invalid input receipts are excluded from the result union.
const invalidReceipt: GeckoInputResult = { seq: 1, type: 'guide', outcome: 'ignored', reason: 'busy' };
// @ts-expect-error Exact optional properties disallow an explicit undefined seed.
const undefinedConfig: GeckoConfig = { seed: undefined };
void [unknownEvent, missingCoordinate, extraCoordinate, badBehavior, badIdle, invalidReceipt, undefinedConfig];

model.reset({ seed: 0, heading: Math.PI });
model.dispose();
// Disposal is a runtime terminal state; this interface does not claim typestate.
const isDisposed: boolean = model.disposed;
void isDisposed;

// Browser host types use the actual local contract, not an invented package API.
declare const canvas: HTMLCanvasElement;
const controller: GeckoController = mountGecko(canvas, {
  config, paused: true, view: { grid: { cols: 112, rows: 50 }, maxDpr: 1 },
  onStatus(status: GeckoControllerStatus) { const isRunning: boolean = status.running; void isRunning; },
});
const view: Readonly<GeckoViewOptions> = controller.setView({ neutral: true, grid: 'auto' });
const action: GeckoActionResult = controller.guide(.2, -.3);
if (action.outcome === 'ignored') {
  const reason: 'resting' = action.reason;
  void reason;
} else {
  // @ts-expect-error Queued and static action results do not carry a rejection reason.
  void action.reason;
}
controller.startle();
controller.setPaused(false);
controller.update({ toeSpread: 1.1 });
controller.reset({ seed: 38 });
const exportText: string = controller.exportText();
controller.dispose();
const finalStatus: GeckoControllerStatus = controller.getStatus();
void [view, exportText, finalStatus];
// @ts-expect-error The host requires a Canvas, not any HTMLElement.
mountGecko(document.createElement('div'));
// @ts-expect-error View configuration is separate from species options.
controller.update({ maxDpr: 2 });
// @ts-expect-error Seed is nested in config at mount.
mountGecko(canvas, { seed: 37 });
// @ts-expect-error Partial explicit grids cannot omit their row count.
controller.setView({ grid: { cols: 112 } });
// @ts-expect-error A typed native pause control requires a boolean.
controller.setPaused('paused');

// Adapter remains an explicitly named proposal against PR #2's documentation.
const proposed: ProposedGeckoDefinition = createProposedGeckoDefinition({ skin: 0, pad: 1, eye: 2, pupil: 3 });
const proposedState: ProposedGeckoState = proposed.create({ creepSpeed: .1 }, 37);
proposed.update(proposedState, [{ type: 'startle', tick: 1, seq: 1 }], 1 / 60);
declare const writer: ProposedGeometryWriter;
proposed.sample(proposedState, writer);
const description: string = proposed.describe(proposedState);
proposedState.model.dispose();
void description;
// @ts-expect-error The host must supply every explicit material mapping.
createProposedGeckoDefinition({ skin: 0, pad: 1, eye: 2 });
// @ts-expect-error Material IDs are numeric; named cuttlefish palette rows are not accepted.
createProposedGeckoDefinition({ skin: 'lagoon', pad: 1, eye: 2, pupil: 3 });
// @ts-expect-error The proposed state holds a model; a raw snapshot is not that state.
proposed.sample(snapshot, writer);
