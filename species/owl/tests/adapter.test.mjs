import test from 'node:test';
import assert from 'node:assert/strict';
import { writeOwlSamplesToProposal } from '../build/adapter-proposal.js';
import { createOwl } from '../build/owl.js';
import { renderOwlGrid } from '../build/preview.js';
const mapping = { unitsPerLocalUnit: 2, yAxis: 'up', materials: { feather: 10, disk: 11, eye: 12, pupil: 13, highlight: 14, beak: 15, foot: 16, wood: 17 } };
const samples = () => renderOwlGrid(createOwl().getState(), { cols: 64, rows: 36 }).samples.filter(p => p && p.part !== 'perch');
test('proposal bridge requires explicit host mapping and preserves finite sample positions/tone', () => {
  const output = [], input = samples();
  const writer = { capacity: 5000, get count() { return output.length; }, write(...values) { output.push(values); return true; } };
  assert.equal(writeOwlSamplesToProposal(input, writer, mapping), input.length);
  assert.equal(output[0][0], input[0].x * 2); assert.equal(output[0][1], -input[0].y * 2);
  assert.equal(output[0][4], mapping.materials[input[0].material]); assert.equal(output.at(-1)[5], input.length - 1);
});
test('capacity, malformed sample tail and absent material mapping reject before any write', () => {
  let calls = 0; const writer = { capacity: 5000, count: 0, write() { calls++; return true; } };
  const input = samples();
  assert.throws(() => writeOwlSamplesToProposal(input, { ...writer, capacity: 0 }, mapping));
  assert.throws(() => writeOwlSamplesToProposal([...input, { ...input[0], x: NaN }], writer, mapping));
  assert.throws(() => writeOwlSamplesToProposal(input, writer, { ...mapping, materials: {} }));
  assert.equal(calls, 0);
});
test('unexpected destination refusal is explicit; no silent truncation or rollback claim', () => {
  let calls = 0;
  assert.throws(() => writeOwlSamplesToProposal(samples(), { capacity: 5000, count: 0, write() { return ++calls < 4; } }, mapping), /sample 3; discard/);
  assert.equal(calls, 4);
});
