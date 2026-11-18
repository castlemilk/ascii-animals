// This consumer deliberately imports committed declarations, not only TypeScript source.
import { createDragonfly, replayDragonfly, writeDragonflyGeometry, type Dragonfly,
  type DragonflyInput, type DragonflyOptions, type DragonflyState, type ProposedGeometryWriter,
  type GeometryWriteResult } from '../../lib/index.js';

const options = { seed: 17, motion: 'slow', wingAmplitude: .2, followPointer: true } satisfies Partial<DragonflyOptions>;
const dragonfly: Dragonfly = createDragonfly(options);
const input: DragonflyInput = { type: 'pointer', tick: 1, seq: 0, x: .5, y: -.5 };
const result = dragonfly.step(1, [input]);
const state: DragonflyState = result.state;

function describeBehavior(value: DragonflyState['behavior']): string {
  switch (value.kind) {
    case 'idle': return 'Hovering';
    case 'approach': return 'Tracking';
    case 'dart': return `${value.elapsed}/${value.duration} toward ${value.to.x}`;
    case 'recover': return `${value.elapsed}/${value.duration} stabilizing`;
    case 'cooldown': return `${value.remaining} ticks until ready`;
    default: { const exhaustive: never = value; return exhaustive; }
  }
}
describeBehavior(state.behavior);
dragonfly.configure({ motion: 'static', trackingAcceleration: 2 });
dragonfly.setStaticPose(1); dragonfly.setPaused(true); dragonfly.reset(99); dragonfly.dispose();

let count = 0;
const writer: ProposedGeometryWriter = {
  capacity: 6144, get count() { return count; },
  write(x, y, z, light, material, stableSeed) {
    const finite: number[] = [x,y,z,light,material,stableSeed];
    if (!finite.every(Number.isFinite)) return false;
    count++; return true;
  },
};
const written: GeometryWriteResult = writeDragonflyGeometry(createDragonfly(), writer);
if (written.kind === 'insufficient-capacity') { const zero: 0 = written.written; void zero; }
replayDragonfly({ schemaVersion:1, speciesVersion:'dragonfly-v1', options:{ seed:0 }, ticks:1,
  events:[{ type:'dart', tick:1, seq:0, direction:{x:1,y:0} }] }, 5);

// @ts-expect-error Unrecognized motion strings must not be accepted.
createDragonfly({ motion: 'automatic' });
// @ts-expect-error Numeric configuration never accepts coercible strings.
createDragonfly({ wingHz: '3' });
// @ts-expect-error No generic engine options leak into the species contract.
createDragonfly({ fishCount: 12 });
// @ts-expect-error Seed changes use reset(seed), not configure.
dragonfly.configure({ seed: 3 });
// @ts-expect-error A pointer event requires both coordinates.
const missingCoordinate: DragonflyInput = { type:'pointer', tick:1, seq:0, x:.2 };
// @ts-expect-error The event vocabulary is explicit.
const unsupportedEvent: DragonflyInput = { type:'startle', tick:1, seq:0 };
// @ts-expect-error exactOptionalPropertyTypes distinguishes absent direction from undefined.
const undefinedDirection: DragonflyInput = { type:'dart', tick:1, seq:0, direction:undefined };
// @ts-expect-error State snapshots are readonly.
state.position.x = 4;
// @ts-expect-error Discriminated states prevent reading dart-only fields before narrowing.
state.behavior.to;
// @ts-expect-error Sample metadata is readonly to typed callers.
dragonfly.sample().samples[0]!.tone = .9;
// @ts-expect-error Boolean lifecycle controls are not coercible values.
dragonfly.setPaused(1);
// @ts-expect-error Static posters have only two declared variants.
dragonfly.setStaticPose(2);
// @ts-expect-error A proposed writer must return a boolean acceptance decision.
const invalidWriter: ProposedGeometryWriter = { capacity:10, count:0, write() {} };
// @ts-expect-error Only this replay version is supported.
replayDragonfly({ schemaVersion:2, speciesVersion:'dragonfly-v1', options:{}, ticks:0, events:[] });
void [missingCoordinate,unsupportedEvent,undefinedDirection,invalidWriter];
