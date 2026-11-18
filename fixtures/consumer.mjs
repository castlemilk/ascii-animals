import assert from 'node:assert/strict';

assert.equal(typeof globalThis.window, 'undefined');
assert.equal(typeof globalThis.document, 'undefined');
const root = await import('ascii-animals-review');
const animal = await import('ascii-animals-review/cuttlefish');
const core = await import('ascii-animals-review/core');
assert.equal(typeof root.CuttlefishArtwork, 'function');
assert.equal(typeof root.createCuttlefish, 'function');
assert.equal(typeof core.createScheduler, 'function');
assert.equal(root.CuttlefishArtwork, animal.CuttlefishArtwork);
assert.equal(root.createCuttlefish, animal.createCuttlefish);
assert.equal(root.createScheduler, core.createScheduler);
for (const method of ['setOptions', 'setPaused', 'getStats', 'restart', 'pulse', 'advance', 'resize', 'render', 'destroy']) {
  assert.equal(typeof animal.CuttlefishArtwork.prototype[method], 'function', `Declared public method missing at runtime: ${method}`);
}
assert.equal(typeof globalThis.window, 'undefined');
assert.equal(typeof globalThis.document, 'undefined');
for (const specifier of ['ascii-animals-review/package.json', 'ascii-animals-review/lib/animals/cuttlefish.js']) {
  await assert.rejects(import(specifier), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
}
console.log(JSON.stringify({ ssrImport: 'passed', identity: 'passed', declaredMethods: 'present', privateSubpaths: 'blocked', exports: Object.keys(root).sort() }));
