#!/usr/bin/env node
/** Exact legacy-model/cell compatibility with the integrated release Git objects. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createFox } from '../lib/model.js';
import { buildFoxGrid } from '../lib/preview.js';

const base = process.argv[2] ?? 'c06114404900884814bef879a02f1a49a3e7d590';
if (!/^[a-f0-9]{40}$/.test(base)) throw Error('Supply an exact 40-character release commit');
const root = fileURLToPath(new URL('../../../', import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), 'fox-director-legacy-'));
let steps = 0, poses = 0;
try {
  await writeFile(join(scratch, 'package.json'), '{"type":"module"}');
  for (const name of ['model', 'config', 'geometry', 'preview', 'types']) {
    await writeFile(join(scratch, name + '.js'), execFileSync('git', ['show', `${base}:species/fox/lib/${name}.js`], { cwd: root }));
  }
  const legacy = await import(pathToFileURL(join(scratch, 'model.js')).href);
  const raster = await import(pathToFileURL(join(scratch, 'preview.js')).href);
  for (const options of [{ seed: 17 }, { seed: 0, facing: 'left' }, { seed: 4294967295, tailSway: 0, breathing: 0 }]) {
    const current = createFox(options), previous = legacy.createFox(options);
    let seq = 0;
    for (let tick = 1; tick <= 1200; tick++) {
      const inputs = tick % 100 === 1 ? [{ type: 'guide', tick, seq: seq++, x: Math.sin(tick / 137), y: .2 }] :
        tick % 241 === 0 ? [{ type: 'pounce', tick, seq: seq++ }] :
        tick % 179 === 0 ? [{ type: 'leave', tick, seq: seq++ }] : [];
      assert.deepEqual(current.step(tick, inputs), previous.step(tick, inputs), `state seed${options.seed} tick${tick}`);
      steps++;
      if (tick % 5 === 0) {
        assert.deepEqual(current.getPose(), previous.getPose(), `pose seed${options.seed} tick${tick}`);
        assert.equal(buildFoxGrid(current.getPose()).text, raster.buildFoxGrid(previous.getPose()).text);
        poses++;
      }
    }
    current.dispose(); previous.dispose();
  }
  console.log(JSON.stringify({ status: 'passed', base, stateComparisons: steps, exactPoseAndCellComparisons: poses,
    scope: 'Legacy no-director numerical model/geometry/text compatibility. No browser/pixel/performance assertion.' }, null, 2));
} finally { await rm(scratch, { recursive: true, force: true }); }
