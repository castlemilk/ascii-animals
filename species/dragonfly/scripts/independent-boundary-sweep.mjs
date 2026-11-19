/** Independent numerical review. Replays the same 16 cases reviewed in chat.
 * Usage: node independent-boundary-sweep.mjs /absolute/path/to/ascii-animals
 * No browser, mutation, performance or collision-avoidance claims.
 */
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const repo = resolve(process.argv[2] || '.');
const load = relative => import(pathToFileURL(join(repo, relative)).href);
const { createDragonflyDirector } = await load('species/dragonfly/lib/director.js');
const { rasterizeDragonflyPond } = await load('species/dragonfly/lib/pond-preview.js');

let fail = [], maxClip = 0, cases = 0, leastRear = Infinity, maxAcc = 0;
for (const motion of ['full', 'slow']) for (const tempo of [.4, 1.6]) for (let id = 0; id < 4; id++) {
  const d = createDragonflyDirector(
    { count: 4, scene: 'attention', tempo, scale: .48, spread: 1.1 },
    { seed: 991, motion },
  );
  const pace = tempo * (motion === 'slow' ? .25 : 1);
  let seq = 0, tick = 0;
  const step = (events = []) => d.step(++tick, events.map(e => ({ ...e, tick, seq: seq++ })));
  step([{ type: 'select', id }, { type: 'pointer', x: id % 2 ? 1 : -1, y: 1 }]);
  for (let i = 0; i < Math.ceil(300 / pace); i++) step();
  const start = d.getState().members[id];
  const rear = { x: -Math.sin(start.heading), y: Math.cos(start.heading) };
  let from = null, peak = 0, prior = start;
  step([{ type: 'cue', cue: 'dart' }]);
  for (let i = 0; i < Math.ceil(500 / pace); i++) {
    const m = d.getState().members[id];
    maxAcc = Math.max(maxAcc, Math.hypot(m.velocity.x - prior.velocity.x, m.velocity.y - prior.velocity.y) * 60 / pace);
    if (m.phase.kind === 'launch') from = m.position;
    if (from && ['dart', 'settle'].includes(m.phase.kind))
      peak = Math.max(peak, (m.position.x - from.x) * rear.x + (m.position.y - from.y) * rear.y);
    if (i % Math.max(1, Math.floor(12 / pace)) === 0) for (const view of ['dorsal', 'oblique']) {
      const grid = rasterizeDragonflyPond(d.sample(), { cols: 72, rows: 44, view, neutral: false });
      maxClip = Math.max(maxClip, grid.clippedSamples);
      if (grid.clippedSamples)
        fail.push({ type: 'clip', motion, tempo, id, tick, phase: m.phase.kind, view, clipped: grid.clippedSamples });
    }
    prior = m;
    step();
  }
  leastRear = Math.min(leastRear, peak);
  if (peak < .24) fail.push({ type: 'rear', motion, tempo, id, peak });
  cases++;
  d.dispose();
}
const sourceSha256 = Object.fromEntries([
  'species/dragonfly/lib/director.js', 'species/dragonfly/lib/model.js',
  'species/dragonfly/lib/geometry.js', 'species/dragonfly/lib/preview.js',
  'species/dragonfly/lib/pond-preview.js',
].map(file => [file, createHash('sha256').update(readFileSync(join(repo, file))).digest('hex')]));
console.log(JSON.stringify({
  evidence: 'Independent read-only numerical sweep; no browser or performance claim',
  node: process.version, sourceSha256,
  cases, maxClip, maxAcc, leastRear, fail: fail.slice(0, 10), failures: fail.length,
}, null, 2));
