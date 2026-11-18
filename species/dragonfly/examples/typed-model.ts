import { createDragonfly, writeDragonflyGeometry, type DragonflyInput, type ProposedGeometryWriter } from '../lib/index.js';

// Relative review import: no npm species subpath is published by this PR.
const dragonfly = createDragonfly({ seed:17, motion:'slow', wingAmplitude:.2 });
const events: readonly DragonflyInput[] = [
  { type:'pointer', tick:1, seq:0, x:.7, y:-.3 },
  { type:'dart', tick:1, seq:1 },
];
dragonfly.step(1, events);
for (let tick=2; tick<=120; tick++) dragonfly.step(tick);

const frame = dragonfly.sample();
const points: number[][] = [];
const writer: ProposedGeometryWriter = {
  capacity:6144,
  get count() { return points.length; },
  write(...point) { points.push(point); return true; },
};
const adapterResult = writeDragonflyGeometry(dragonfly, writer);
if (adapterResult.kind !== 'complete') throw new Error(`Writer did not accept the full specimen: ${adapterResult.kind}`);

// A paused reset remains paused and returns to tick zero with the requested seed.
dragonfly.setPaused(true);
dragonfly.configure({ trackingReach:.2 });
dragonfly.reset(17);
dragonfly.dispose();
void frame;
