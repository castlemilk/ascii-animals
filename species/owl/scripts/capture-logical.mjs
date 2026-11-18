/** Capture actual versioned species output, not a mock or painted concept. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { createOwl, makeOwlPoster } from '../build/owl.js';
import { renderOwlGrid } from '../build/preview.js';
const out = new URL('../evidence/', import.meta.url);
await mkdir(out, { recursive: true });
const fixture = JSON.parse(await readFile(new URL('../fixtures/replay.json', import.meta.url), 'utf8'));
const log = new Map(fixture.events.map(e => [e.tick, [e]]));
const selectedTicks = new Set([0, 60, 98, 125, 184, 226, 280, 420]);
const owl = createOwl({ seed: fixture.seed, ...fixture.options });
const animation = [], selected = [], metrics = [];
for (let tick = 0; tick <= fixture.finalTick; tick++) {
  const start = performance.now();
  if (tick > 0) owl.advance(tick, log.get(tick) || []);
  const state = owl.getState();
  const grid = renderOwlGrid(state);
  metrics.push(performance.now() - start);
  const frame = { tick, phase: state.behavior.kind === 'response' ? state.behavior.phase : state.behavior.kind,
    headYawDeg: state.headYawDeg, headPitchDeg: state.headPitchDeg, blink: state.blink,
    leftWing: state.leftWing, rightWing: state.rightWing, ruffle: state.ruffle,
    cols: grid.cols, rows: grid.rows, text: grid.text,
    sha256: createHash('sha256').update(grid.text).digest('hex') };
  if (tick % 5 === 0) animation.push(frame);
  if (selectedTicks.has(tick)) { selected.push(frame); await writeFile(new URL(`frame-${String(tick).padStart(3, '0')}.txt`, out), grid.text + '\n'); }
}
const neutral = createOwl().getState();
const smallest = [
  { title: 'Neutral / 64 x 36', state: neutral },
  { title: 'Left attention / 64 x 36', state: makeOwlPoster(neutral, { kind: 'attention', x: -1, y: -.3 }) },
  { title: 'Right attention / 64 x 36', state: makeOwlPoster(neutral, { kind: 'attention', x: 1, y: .3 }) },
  { title: 'Deliberate static stretch', state: makeOwlPoster(neutral, { kind: 'react' }) },
  { title: 'Neutral silhouette / one tone', state: neutral, silhouette: true },
  { title: 'Stretch silhouette / one tone', state: makeOwlPoster(neutral, { kind: 'react' }), silhouette: true },
].map(item => ({ title: item.title, cols: 64, rows: 36, text: renderOwlGrid(item.state, { cols: 64, rows: 36, silhouette: item.silhouette ?? false }).text }));
const data = { evidenceKind: 'Executed TypeScript build -> ASCII grid; NOT browser/Canvas screenshot', node: process.version,
  seed: fixture.seed, tickRate: 60, animationFrameRate: 12, selected, smallest, animation };
await writeFile(new URL('logical-frames.json', out), JSON.stringify(data));
const sorted = metrics.slice(120).sort((a,b) => a-b);
const quantile = q => sorted[Math.floor((sorted.length - 1) * q)];
await writeFile(new URL('node-sampling.json', out), JSON.stringify({ evidenceKind: 'Node simulation + geometry + logical-grid timing only; not browser frame/paint/FPS',
  runtime: process.version, host: { platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0]?.model },
  cells: 96 * 54, calls: metrics.length, discardedWarmupCalls: 120, p50Ms: quantile(.5), p95Ms: quantile(.95), p99Ms: quantile(.99),
  browserTargetMeasured: false, browserLaunch: 'Blocked before page launch: socket() failed Operation not permitted; no flags/security settings changed.' }, null, 2) + '\n');
console.log(JSON.stringify({ selectedFrames: selected.length, animationFrames: animation.length, smallestFrames: smallest.length, output: out.pathname }));
