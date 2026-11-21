/** Explicit-tick native renderer evidence. These files are NOT browser captures. */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFrogPond, stepFrogPond } from '../../../../generated/pond.mjs';
import { createLegacyFrogPreview } from '../../../../generated/legacy-preview.mjs';
import { createSpringPeaPreview } from '../../preview.mjs';
import { nativeSurface, fontIdentity } from './native-host.mjs';

const review = fileURLToPath(new URL('../', import.meta.url));
const root = resolve(review, '../../../../../');
const out = resolve(review, 'evidence/native');
const stillsOnly = process.argv.includes('--stills');
const rendererArg = process.argv.find(arg => arg.startsWith('--renderer='))?.slice(11);
const viewportArg = process.argv.find(arg => arg.startsWith('--viewport='))?.slice(11);
const viewports = { desktop: [900, 520], phone: [356, 300] };
const settings = { seed: 23, director: { scene: 'stillwater', count: 1, autonomy: false, layout: 'shelter', roles: ['hunter', 'hunter', 'dreamer'] } };
const previewOptions = { cols: 96, rows: 60, labels: false, trajectories: false, view: 'front', renderFps: 30 };
const factories = { original: createLegacyFrogPreview, 'spring-pea-r2': createSpringPeaPreview };
const sources = ['species/frog/generated/frog.mjs', 'species/frog/generated/pond.mjs', 'species/frog/generated/geometry.mjs', 'species/frog/generated/choreography.mjs', 'species/frog/generated/legacy-preview.mjs', 'species/frog/variants/spring-pea-r2/preview.mjs', 'species/frog/variants/spring-pea-r2/geometry.mjs', 'species/frog/variants/spring-pea-r2/pose.mjs'];
const sourceHashes = Object.fromEntries(await Promise.all(sources.map(async name => [name, createHash('sha256').update(await readFile(resolve(root, name))).digest('hex')])));
await mkdir(out, { recursive: true });

for (const renderer of rendererArg ? [rendererArg] : Object.keys(factories)) {
  if (!factories[renderer]) throw new Error('Unknown renderer');
  for (const viewport of viewportArg ? [viewportArg] : Object.keys(viewports)) {
    const dimensions = viewports[viewport]; if (!dimensions) throw new Error('Unknown viewport');
    const { canvas, preview, atlasSnapshot } = await nativeSurface(...dimensions, factories[renderer], previewOptions);
    const records = [];
    const identity = { kind: 'Actual native Canvas renderer, not browser or mobile-device evidence', renderer, viewport, dimensions, dpr: 1, settings, previewOptions, fontIdentity, atlasSnapshot, sourceHashes };
    function pixels() {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      const background = [...data.slice(0, 3)]; let foreground = 0, bright = 0;
      for (let i = 0; i < data.length; i += 4) {
        const difference = Math.max(Math.abs(data[i] - background[0]), Math.abs(data[i + 1] - background[1]), Math.abs(data[i + 2] - background[2]));
        if (difference > 12) foreground++;
        if (difference > 12 && Math.max(data[i], data[i + 1], data[i + 2]) > 70) bright++;
      }
      if (foreground < 50 || bright < 20) throw new Error(`${renderer}/${viewport}: blank or nearly blank native Canvas pixels (${foreground} foreground, ${bright} bright)`);
      return { foreground, bright, total: canvas.width * canvas.height, background };
    }
    async function save(name, state, geometryOptions = {}) {
      const frame = preview.drawPond(state, geometryOptions), png = canvas.toBuffer('image/png');
      const pixelCounts = pixels();
      const filename = `${renderer}-${viewport}-${name}.png`;
      await writeFile(resolve(out, filename), png);
      records.push({ file: filename, tick: state.tick, glyphs: frame.glyphs, cols: frame.cols, rows: frame.rows, samples: frame.samples, phase: state.actors[0].model.behavior.kind, motive: state.actors[0].motive.kind, padId: state.actors[0].padId, position: state.actors[0].model.position, geometryOptions, pixelCounts, sha256: createHash('sha256').update(png).digest('hex') });
    }
    const start = createFrogPond(settings);
    await save('rest', start, { motion: false });
    await writeFile(resolve(out, `${renderer}-${viewport}-rest.txt`), preview.toText() + '\n');
    for (const pose of ['crouch', 'airborne', 'landed']) await save(`still-${pose}`, start, { motion: false, staticPose: pose });
    await save('silhouette', start, { motion: false, silhouette: true });
    for (const view of ['left', 'right', 'profile']) await save(`view-${view}`, start, { motion: false, view });
    await save('still-hunt', start, { motion: false, staticPose: 'rest', pondStill: 'hunt' });
    if (!stillsOnly) {
      const sequences = [
        { name: 'leap', durationTicks: 210, event: { tick: 24, seq: 0, type: 'hop', frogId: 0, padId: 4 }, picks: [0, 36, 50, 70, 85, 104, 182] },
        { name: 'hunt', durationTicks: 300, event: { tick: 24, seq: 0, type: 'hunt', frogId: 0, x: .36, y: -.4 }, picks: [0, 46, 86, 176, 182, 190, 220, 248] },
      ];
      for (const sequence of sequences) {
        const frameDirectory = resolve(out, `${renderer}-${viewport}-${sequence.name}-frames`);
        await mkdir(frameDirectory, { recursive: true });
        let state = createFrogPond(settings), frameNumber = 0;
        const timeline = [];
        for (let tick = 0; tick <= sequence.durationTicks; tick++) {
          if (tick) state = stepFrogPond(state, tick, tick === sequence.event.tick ? [sequence.event] : []).state;
          if (tick % 2 === 0) {
            const frame = preview.drawPond(state);
            pixels();
            await writeFile(resolve(frameDirectory, `${String(frameNumber).padStart(4, '0')}.png`), canvas.toBuffer('image/png'));
            const actor = state.actors[0];
            timeline.push({ frame: frameNumber++, tick, phase: actor.model.behavior.kind, motive: actor.motive.kind, padId: actor.padId, position: actor.model.position, firefly: state.firefly?.phase ?? null, glyphs: frame.glyphs });
          }
          if (sequence.picks.includes(tick)) await save(`${sequence.name}-tick-${tick}`, state);
        }
        await writeFile(resolve(out, `${renderer}-${viewport}-${sequence.name}-timeline.json`), JSON.stringify({ ...identity, simulationHz: 60, encodedFps: 30, playback: 'normal speed; one frame every two model ticks', eventLog: [sequence.event], durationTicks: sequence.durationTicks, frames: timeline }, null, 2) + '\n');
      }
    }
    await writeFile(resolve(out, `${renderer}-${viewport}-manifest.json`), JSON.stringify({ ...identity, records }, null, 2) + '\n');
    preview.dispose();
    console.log(JSON.stringify({ renderer, viewport, stillsOnly, files: records.length, kind: identity.kind }));
  }
}
