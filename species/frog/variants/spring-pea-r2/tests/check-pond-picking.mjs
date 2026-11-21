/** Supplemental numerical API check; separate from the frozen 20-test matrix. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fakeBrowser } from '../../../../../test/helpers/fake-browser.mjs';
import { createFrogPond, pondPointToWorld } from '../../../generated/pond.mjs';
import { createSpringPeaPreview, springPeaCamera } from '../preview.mjs';

const seed = 23;
const previewOptions = { cols: 180, rows: 100, labels: false, view: 'front' };
const viewports = [{ name: 'desktop', width: 720, height: 440 }, { name: 'phone', width: 390, height: 520 }];
const sourceFiles = ['../index.mjs', '../pose.mjs', '../geometry.mjs', '../preview.mjs',
  '../../../generated/pond.mjs', '../../../generated/frog.mjs', '../../../generated/choreography.mjs'];
async function fingerprints() {
  return Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path,
    createHash('sha256').update(await readFile(new URL(path, import.meta.url))).digest('hex')])));
}
const before = await fingerprints(), cases = [];
for (const { name, width, height } of viewports) for (const count of [1, 2, 3]) {
  const host = fakeBrowser();
  const preview = createSpringPeaPreview(host.canvas(width, height), previewOptions);
  preview.resize(width, height, 1);
  try {
    const state = createFrogPond({ seed, director: { count, autonomy: false } });
    const frame = preview.drawPond(state), ids = new Set(), ownerPixelHits = [0, 0, 0];
    // Scan the complete CSS scene at one-pixel centers, using only public picking.
    for (let y = .5; y < height; y++) for (let x = .5; x < width; x++) {
      const id = preview.pickPondFrog({ x: 2 * x / width - 1, y: 2 * y / height - 1 });
      if (id !== null) { ids.add(id); ownerPixelHits[id]++; }
    }
    for (let id = 0; id < count; id++) assert(ids.has(id), `${name}/${count}: missing owner ${id}`);
    const camera = springPeaCamera(width, height, state.bodyConfig, true);
    const factor = count === 3 ? .68 : count === 2 ? .76 : .90;
    let maxInverseError = 0;
    for (const pad of state.pads) {
      const world = pondPointToWorld(pad.point);
      const actual = preview.pondTargetAt({
        x: 2 * (camera.cx + world.x * camera.scale) / width - 1,
        y: 2 * (camera.cy + (world.y + .62 * state.bodyConfig.size * factor) * camera.scale) / height - 1,
      });
      maxInverseError = Math.max(maxInverseError,
        Math.abs(actual.x - pad.point.x), Math.abs(actual.y - pad.point.y));
    }
    assert(maxInverseError < 1e-12, `${name}/${count}: inverse projection error`);
    assert(frame.samples <= 60000, 'bounded scene sample count');
    assert(frame.actorGlyphs.slice(0, count).every(value => value > 0), 'every owner has visible cells');
    const outsideHit = preview.pickPondFrog({ x: 1.01, y: 0 });
    assert.equal(outsideHit, null); assert.equal(host.pending, 0);
    cases.push({ viewport: name, width, height, count,
      scene: state.config.scene, layout: state.config.layout, autonomy: state.config.autonomy,
      cols: frame.cols, rows: frame.rows, samples: frame.samples, glyphs: frame.glyphs,
      actorGlyphs: frame.actorGlyphs, visibleOwnerIds: [...ids].sort(), ownerPixelHits,
      outsideProbe: { x: 1.01, y: 0 }, outsideHit, scheduledHostFrames: host.pending,
      padPointsChecked: state.pads.length, maxInverseError });
  } finally { preview.dispose(); }
}
const after = await fingerprints();
assert.deepEqual(after, before, 'source files stay unchanged during this read-only check');
const result = {
  evidence: 'Numerical fake Canvas host; not browser, pixel or device-performance evidence',
  base: JSON.parse(await readFile(new URL('../BASE.json', import.meta.url), 'utf8')).base,
  revision: 'Spring Pea R2 reconstruction',
  command: 'node species/frog/variants/spring-pea-r2/tests/check-pond-picking.mjs',
  sourceSha256: before, sourceUnchangedDuringCheck: true,
  seed, previewOptions, viewports, scan: { spacingCssPixels: 1, offsetCssPixels: .5 },
  requiredInverseTolerance: 1e-12, cases,
  result: { passed: true, caseCount: cases.length,
    maximumInverseError: Math.max(...cases.map(item => item.maxInverseError)) },
};
await writeFile(new URL('./pond-picking-validation.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result.result));
