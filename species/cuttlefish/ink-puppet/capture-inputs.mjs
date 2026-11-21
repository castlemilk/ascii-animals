#!/usr/bin/env node
/** Reproduce native input-causality sheets, not browser evidence.
 * node species/cuttlefish/ink-puppet/capture-inputs.mjs --out /outside/repo/evidence
 * Uses installed @napi-rs/canvas and Liberation Mono. No source/model mutation.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPuppetState, cuePuppet, stepPuppet, samplePuppet } from './model.mjs';
import { rasterizePuppet, drawPuppetGrid, PUPPET_PALETTE } from './render.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), outputIndex = args.indexOf('--out');
if (outputIndex >= 0 && (!args[outputIndex + 1] || args[outputIndex + 1].startsWith('--'))) throw new Error('--out requires a path.');
const out = resolve(outputIndex < 0 ? join(root, '..', 'cuttlefish-review/evidence/native') : args[outputIndex + 1]);
if (out === root || out.startsWith(`${root}/`)) throw new Error('Output must be outside the repository.');
await mkdir(out, { recursive: true });
const require = createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, '__ink_puppet_inputs__.cjs') : import.meta.url);
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const paths = ['species/cuttlefish/ink-puppet/model.mjs', 'species/cuttlefish/ink-puppet/render.mjs',
  'species/cuttlefish/ink-puppet/capture-inputs.mjs'];
const sourceHashes = Object.fromEntries(await Promise.all(paths.map(async path => [path, sha(await readFile(join(root, path)))])));
const fonts = [];
for (const name of ['LiberationMono-Regular.ttf', 'LiberationMono-Bold.ttf']) {
  const path = `/usr/share/fonts/truetype/liberation/${name}`;
  GlobalFonts.registerFromPath(path, 'Liberation Mono'); GlobalFonts.registerFromPath(path, 'monospace');
  fonts.push({ path, sha256: sha(await readFile(path)) });
}
const manifest = { schemaVersion: 1, evidenceType: 'Native Canvas input comparison; not browser screenshots',
  sourceHashes, runtime: { node: process.version, canvas: `@napi-rs/canvas ${require('@napi-rs/canvas/package.json').version}`, fonts },
  options: { seed: 7, habitat: true, dpr: 1, simulationHz: 60 }, captures: [], outputs: [] };
const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function svgGrid(grid, x, y, scale) {
  let s = `<g transform="translate(${x} ${y}) scale(${scale})"><rect width="${grid.width}" height="${grid.height}" fill="${PUPPET_PALETTE[0]}"/><g font-family="Liberation Mono,monospace" font-size="${grid.cellH * .98}" font-weight="600" text-anchor="middle" dominant-baseline="central">`;
  for (let i = 0; i < grid.glyphs.length; i++) if (grid.glyphs[i]) s += `<text x="${((i % grid.cols + .5) * grid.cellW).toFixed(3)}" y="${((Math.floor(i / grid.cols) + .5) * grid.cellH).toFixed(3)}" fill="${PUPPET_PALETTE[grid.colors[i]]}">${xml(String.fromCharCode(grid.glyphs[i]))}</text>`;
  return `${s}</g></g>`;
}
function startSheet(width, height, title, subtitle) {
  const canvas = createCanvas(width, height), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#08151a'; ctx.fillRect(0, 0, width, height);
  let vector = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>${xml(title)}</title><desc>Editable ASCII text glyphs from actual source. Native Canvas evidence, not browser screenshots. Fonts not embedded.</desc><rect width="100%" height="100%" fill="#08151a"/>`;
  const label = (text, x, y, size = 13, color = '#97c9b3', bold = false) => {
    ctx.font = `${bold ? 'bold ' : ''}${size}px "Liberation Mono"`; ctx.fillStyle = color;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(text, x, y);
    vector += `<text x="${x}" y="${y}" font-family="Liberation Mono,monospace" font-size="${size}" font-weight="${bold ? '700' : '400'}" fill="${color}">${xml(text)}</text>`;
  };
  label(title, 20, 31, 20, '#f5dfaa', true); label(subtitle, 20, 57);
  return { canvas, ctx, label, append(value) { vector += value; }, svg() { return `${vector}</svg>`; } };
}
function render(entry, width, height, size) {
  const state = createPuppetState(7);
  if (entry.action) assert.equal(cuePuppet(state, { type: entry.action, ...entry.target }), true);
  const tick = Math.round(entry.seconds * 60); stepPuppet(state, tick);
  const pose = samplePuppet(state), grid = rasterizePuppet(pose, { width, height, seed: 7, habitat: true, size });
  const canvas = createCanvas(width, height); drawPuppetGrid(canvas.getContext('2d'), grid);
  let edgeCells = 0, inkCells = 0;
  for (let i = 0; i < grid.owners.length; i++) {
    if (grid.owners[i] === 8) inkCells++;
    if (grid.owners[i] < 1 || grid.owners[i] > 6) continue;
    const x = i % grid.cols, y = Math.floor(i / grid.cols);
    if (x === 0 || y === 0 || x === grid.cols - 1 || y === grid.rows - 1) edgeCells++;
  }
  manifest.captures.push({ ...entry, viewport: { width, height }, size, seed: 7, tick,
    phase: pose.phase, strength: pose.strength, facing: pose.facing,
    root: { x: pose.x, y: pose.y }, bounds: grid.bounds, animalGlyphs: grid.animalCells, edgeCells, inkCells });
  assert.equal(edgeCells, 0, `${entry.title}: animal reaches a viewing boundary`);
  return { canvas, grid, pose, inkCells };
}
async function save(bytes, filename) {
  await writeFile(join(out, filename), bytes);
  manifest.outputs.push({ file: filename, bytes: bytes.length, sha256: sha(bytes) });
}

const origin = samplePuppet(createPuppetState(7));
const entries = [
  { title: 'INVESTIGATE / target left', action: 'investigate', seconds: 2.25, target: { x: -.4, y: -.1 } },
  { title: 'INVESTIGATE / target right', action: 'investigate', seconds: 2.25, target: { x: .4, y: -.1 } },
  { title: 'SOFT JET / threat left', action: 'retreat', seconds: 2.4, target: { x: -.4, y: -.1 } },
  { title: 'SOFT JET / threat right', action: 'retreat', seconds: 2.4, target: { x: .4, y: -.1 } },
  { title: 'DISTURBANCE / near', action: 'retreat', seconds: 1.75, target: { x: origin.x + .055, y: origin.y } },
  { title: 'DISTURBANCE / far, same bearing', action: 'retreat', seconds: 1.75, target: { x: .49, y: origin.y } }
];
const sheet = startSheet(1160, 1300, 'Ink Puppet / your input changes the outcome',
  'NATIVE CANVAS / seed 7 / scale 1 / identical 1100 x 640 lens per pair / frames shown at 50%');
for (const [index, entry] of entries.entries()) {
  const x = 20 + index % 2 * 570, y = 140 + Math.floor(index / 2) * 390;
  const rendered = render(entry, 1100, 640, 1);
  sheet.label(`${entry.title} / ${entry.seconds.toFixed(2)}s`, x, y - 48, 15, '#f5dfaa', true);
  sheet.label(`target(${entry.target.x}, ${entry.target.y})`, x, y - 28, 12);
  sheet.label(`${rendered.pose.phase} / strength ${rendered.pose.strength.toFixed(3)} / ink ${rendered.inkCells} cells`, x, y - 10, 12);
  sheet.ctx.drawImage(rendered.canvas, x, y, 550, 320); sheet.append(svgGrid(rendered.grid, x, y, .5));
}
sheet.label('Targets are normalized offsets from the lens centre. Native model/renderer evidence; no browser input claim.', 20, 1270, 12);
await save(sheet.canvas.toBuffer('image/png'), 'input-outcomes.png');
await save(Buffer.from(sheet.svg()), 'input-outcomes.svg');

const phone = startSheet(840, 720, 'Ink Puppet / small-scale phone limit',
  'NATIVE CANVAS / 390 x 560 lens / seed 7 / scale .35 / actual-size scenes');
const smallCases = [
  { title: 'IDLE / silhouette', action: null, seconds: 0, target: null },
  { title: 'LEFT TURN / frontal silhouette', action: 'investigate', seconds: 1.05, target: { x: -.4, y: -.1 } }
];
for (const [index, entry] of smallCases.entries()) {
  const x = 20 + index * 410, y = 110, rendered = render(entry, 390, 560, .35);
  phone.label(entry.title, x, 86, 13, '#f5dfaa', true);
  phone.label(`${entry.seconds.toFixed(2)}s / ${rendered.grid.animalCells} animal glyphs`, x, 103, 12);
  phone.ctx.drawImage(rendered.canvas, x, y); phone.append(svgGrid(rendered.grid, x, y, 1));
}
phone.label('At 35%, read the mantle and arm silhouette; the W pupil and facial detail simplify.', 20, 699, 12);
await save(phone.canvas.toBuffer('image/png'), 'phone-small-scale.png');
await save(Buffer.from(phone.svg()), 'phone-small-scale.svg');
for (const [path, expected] of Object.entries(sourceHashes)) assert.equal(sha(await readFile(join(root, path))), expected, `Source changed during capture: ${path}`);
await writeFile(join(out, 'inputs-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ output: out, outputs: manifest.outputs, captures: manifest.captures }, null, 2));
