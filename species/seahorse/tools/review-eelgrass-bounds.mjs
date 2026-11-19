/**
 * Bounded numerical review of the exact compiled Seahorse module.
 *
 * This imports an in-memory copy with five private helpers additionally exported
 * and the unchanged scheduler import resolved to its absolute file URL. The
 * renderer implementation itself is not rewritten. No files in lib are changed.
 * This establishes finite geometric points, world bounds and emitted depth at
 * the two blade crossings; it is not a browser, font, physical device, FPS or
 * biological-accuracy test.
 *
 * Run after the normal package build:
 * node species/seahorse/tools/review-eelgrass-bounds.mjs /absolute/result.json
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const moduleURL = new URL('../../../lib/public/seahorse.js', import.meta.url);
const sourceURL = new URL('../../../src/public/seahorse.ts', import.meta.url);
const moduleText = await readFile(moduleURL, 'utf8');
const sourceText = await readFile(sourceURL, 'utf8');
const sha256 = text => createHash('sha256').update(text).digest('hex');
const importText = "'../core/scheduler.js'";
assert(moduleText.includes(importText), 'compiled module has the expected unchanged scheduler dependency');
const instrumented = moduleText.replace(importText, JSON.stringify(new URL('../core/scheduler.js', moduleURL).href)) +
  '\nexport {paintSeahorse, rotateLocal, tailPoint, gardenSlot, eelgrassPoint};';
const { createSeahorseModel, paintSeahorse, rotateLocal, tailPoint, gardenSlot, eelgrassPoint } =
  await import('data:text/javascript;base64,' + Buffer.from(instrumented).toString('base64'));

const scenarios = Object.freeze({
  scenes: ['kelp-garden', 'tidal-duet', 'drift-passage'], counts: [1, 4],
  grids: [[64, 100], [160, 36], [160, 100]], seeds: [0, 2147483647],
  currentBySeed: { 0: -1, 2147483647: 1 }, globalScale: 1.3, individualScale: 1.2,
  facing: 'even IDs right; odd IDs left', progress: [.08, .42, .73, .93],
  poses: ['rest', 'inspect poster', 'release poster', 'startle poster']
});
let poses = 0, points = 0, nonfinite = 0, outsidePoints = 0, worst = null;
for (const scene of scenarios.scenes) for (const count of scenarios.counts)
  for (const [columns, rows] of scenarios.grids) for (const seed of scenarios.seeds) {
    const model = createSeahorseModel({
      scene, count, columns, rows, seed, scale: 1.3, current: seed === 0 ? -1 : 1,
      individuals: Array.from({ length: count }, (_, i) => ({ scale: 1.2, facing: i % 2 ? 'left' : 'right' }))
    });
    for (const progress of scenarios.progress) {
      model.direct({ type: 'seek', progress });
      for (const cue of ['rest', 'inspect', 'release', 'startle']) {
        if (cue !== 'rest') for (let id = 0; id < count; id++) model.direct({ type: cue, id }, true);
        const state = model.getDirectorState(), tick = model.getState().tick;
        const time = tick / 60 * model.getOptions().speed;
        for (const animal of state.members) {
          poses++;
          const step = Math.max(.015, 6.2 / (rows - 1) / animal.scale * .32);
          paintSeahorse(animal, step, time, tick, seed, (x, y, tone, glyph, depth) => {
            points++;
            const p = rotateLocal({ x, y }, animal.rotation, animal.facing, animal.scale);
            const wx = p.x + animal.x, wy = p.y + animal.y;
            if (![wx, wy, tone, depth].every(Number.isFinite)) nonfinite++;
            const excess = Math.max(Math.abs(wx) - state.worldWidth / 2, Math.abs(wy) - state.worldHeight / 2);
            if (excess > 0) {
              outsidePoints++;
              if (!worst || excess > worst.excess) worst = { scene, count, columns, rows, seed, progress, cue, id: animal.id, wx, wy, excess };
            }
          });
        }
      }
    }
  }

// The fixed old u=.76..86 depth window missed the upper crossing when held or
// braced. Find the actual crossings geometrically, then inspect the actual
// paintSeahorse emissions nearby rather than reproducing its depth formula.
const occlusion = [];
for (const facing of ['left', 'right']) for (const current of [-1, 0, 1])
  for (const [cue, ticks] of [['rest', 0], ['release', 18], ['startle', 80]]) {
    const model = createSeahorseModel({ scene: 'kelp-garden', choreography: 'hold', count: 1, columns: 160, rows: 76, current, facing, seed: 19 });
    if (cue !== 'rest') model.direct({ type: cue });
    model.advanceTicks(ticks);
    const options = model.getOptions(), state = model.getDirectorState(), animal = state.members[0];
    const slot = gardenSlot(options, 0, state.worldWidth), time = ticks / 60 * options.speed;
    const emittedTail = [];
    paintSeahorse(animal, Math.max(.015, 6.2 / 75 / animal.scale * .32), time, ticks, 19,
      (x, y, tone, glyph, depth) => {
        if (glyph === '*' && depth <= 4.02) emittedTail.push({ x, y, depth });
      });
    function bladeDistance(u) {
      const p = rotateLocal(tailPoint(animal.curl, u), animal.rotation, facing, animal.scale);
      const wx = p.x + animal.x, wy = p.y + animal.y;
      return wx - eelgrassPoint(options, slot, 0, time, wy).x;
    }
    const crossings = [];
    let previousU = .34, previousDistance = bladeDistance(previousU);
    for (let k = 341; k <= 940; k++) {
      const u = k / 1000, dx = bladeDistance(u);
      if (Math.sign(dx) !== Math.sign(previousDistance)) {
        let low = previousU, high = u, lowDistance = previousDistance;
        for (let iteration = 0; iteration < 16; iteration++) {
          const mid = (low + high) / 2, midDistance = bladeDistance(mid);
          if (Math.sign(midDistance) === Math.sign(lowDistance)) { low = mid; lowDistance = midDistance; }
          else high = mid;
        }
        const at = (low + high) / 2, point = tailPoint(animal.curl, at);
        let nearest = null, separation = Infinity;
        for (const candidate of emittedTail) {
          const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
          if (distance < separation) { separation = distance; nearest = candidate; }
        }
        crossings.push({ u: +at.toFixed(6), depth: nearest?.depth ?? null,
          nearestEmissionDistance: +separation.toFixed(6), relation: nearest && nearest.depth < 3 ? 'behind blade' : 'in front of blade' });
      }
      previousU = u; previousDistance = dx;
    }
    occlusion.push({ facing, current, cue, ticks, curl: +animal.curl.toFixed(6), crossings,
      passed: crossings.length === 2 && crossings[0].depth > 3 && crossings[1].depth < 3 &&
        crossings.every(crossing => crossing.nearestEmissionDistance < .04) });
  }

const result = {
  schemaVersion: 1, runtime: process.version,
  command: 'node species/seahorse/tools/review-eelgrass-bounds.mjs <result.json>',
  method: 'In-memory helper exports of exact compiled module; no renderer implementation changes or file writes to lib. Numerical point/depth evidence only.',
  source: { path: 'src/public/seahorse.ts', sha256: sha256(sourceText) },
  compiledModule: { path: 'lib/public/seahorse.js', sha256: sha256(moduleText) },
  bounds: { scenarios, poses, points, nonfinite, outsidePoints, worst, passed: nonfinite === 0 && outsidePoints === 0 },
  occlusion: { scenarios: occlusion.length, passed: occlusion.every(sample => sample.passed), samples: occlusion },
  limitations: ['No browser execution or font rasterization.', 'Finite declared samples, not an exhaustive mathematical proof.', 'Depth samples establish authored overlap, not anatomical or physical simulation accuracy.']
};
const output = path.resolve(process.argv[2] ?? path.join(root, 'artifacts/seahorse-geometry-bounds.json'));
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ output, sourceSha256: result.source.sha256, compiledSha256: result.compiledModule.sha256,
  poses, points, nonfinite, outsidePoints, occlusionScenarios: occlusion.length, occlusionPassed: result.occlusion.passed }));
if (!result.bounds.passed || !result.occlusion.passed) process.exitCode = 1;
