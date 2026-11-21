// Numerical glyph/painter fixtures from the authored review, not browser evidence.
// Run after the unchanged root build and `node species/gecko/variants/mica/build.mjs`.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createGecko, GECKO_LIMITS } from '../../../compiled/gecko.js';
import { createGeckoDirector } from '../../../compiled/director.js';
import { renderGeckoGrid as renderOriginal } from '../../../compiled/preview.js';
import { renderGeckoGrid, drawGeckoGrid } from '../compiled/preview.js';
import { renderGeckoDirectorGrid } from '../compiled/director-preview.js';

const fixtureUrl = name => new URL(`./fixtures/${name}`, import.meta.url);
const { fixtures } = JSON.parse(readFileSync(fixtureUrl('authored-fixtures.json'), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function floatBytes(values) {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => bytes.writeFloatLE(value, index * 4));
  return bytes;
}

for (const fixture of fixtures) test(`Mica matches recovered authored cells and paint: ${fixture.name}`, () => {
  const model = fixture.kind === 'director' ? createGeckoDirector(fixture.config) : createGecko(fixture.config);
  try {
    for (let tick = 1; tick <= fixture.tick; tick++) model.step(fixture.events.filter(event => event.tick === tick));
    const state = model.getSnapshot();
    const before = structuredClone(state);
    const grid = fixture.kind === 'director' ? renderGeckoDirectorGrid(state, fixture.view) : renderGeckoGrid(state, fixture.view);
    // Expectations come from the recovered authored review, never the current renderer.
    const lines = readFileSync(fixtureUrl(`${fixture.name}.txt`), 'utf8').split('\n');
    assert.equal(lines.pop(), '', 'text fixture ends with one newline');
    assert(lines.length <= fixture.view.rows);
    while (lines.length < fixture.view.rows) lines.push('');
    assert.equal(grid.text, lines.map(line => line.padEnd(fixture.view.cols, ' ')).join('\n'));
    assert.equal(digest(grid.glyphs), fixture.expected.glyphsSha256);
    assert.equal(digest(grid.materials), fixture.expected.materialsSha256);
    assert.equal(digest(floatBytes(grid.tones)), fixture.expected.tonesFloat32LESha256);
    assert.equal(grid.occupied, fixture.expected.occupied);
    assert.equal(grid.samples, fixture.expected.samples);
    assert(grid.samples <= GECKO_LIMITS.samples, 'one focused animal keeps the existing sample cap');
    assert.deepEqual(grid.viewport, fixture.expected.viewport);
    assert.equal(grid.theme, fixture.expected.theme);
    assert.match(grid.text, /^[\x20-\x7e\n]+$/);
    assert.deepEqual(state, before, 'painting must not mutate contacts, pose state, or scene');

    const commands = [];
    let background;
    let backgroundRect;
    const context = {
      fillRect(x, y, width, height) { background = this.fillStyle; backgroundRect = { x, y, width, height }; },
      fillText(glyph, x, y) { commands.push({ glyph, x, y, color: this.fillStyle }); }
    };
    drawGeckoGrid(context, grid, fixture.paint.width, fixture.paint.height);
    assert.equal(background, fixture.paint.background);
    assert.deepEqual(backgroundRect, fixture.paint.backgroundRect);
    assert.equal(context.font, fixture.paint.fontCss);
    assert.equal(digest(JSON.stringify(commands)), fixture.paint.commandsSha256);
  } finally { model.dispose(); }
});

test('Mica phone grids are private; Original grid policy and glyphs remain independently available', () => {
  const model = createGecko({ seed: 37 });
  try {
    const state = model.getSnapshot();
    assert.equal(GECKO_LIMITS.minCols, 112);
    assert.equal(GECKO_LIMITS.minRows, 50);
    assert.throws(() => renderOriginal(state, { cols: 64, rows: 40 }), RangeError);
    assert.equal(renderGeckoGrid(state, { cols: 64, rows: 40 }).text.split('\n').length, 40);
    const view = { cols: 112, rows: 60 };
    assert.notEqual(renderOriginal(state, view).text, renderGeckoGrid(state, view).text);
    assert.equal(renderOriginal(state).cols, 176);
    assert.equal(renderOriginal(state).rows, 78);
  } finally { model.dispose(); }
});
