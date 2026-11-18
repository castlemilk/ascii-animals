import assert from 'node:assert/strict';

assert.equal(typeof globalThis.window, 'undefined');
assert.equal(typeof globalThis.document, 'undefined');
const root = await import('ascii-animals-review');
const animal = await import('ascii-animals-review/cuttlefish');
const core = await import('ascii-animals-review/core');
const fox = await import('ascii-animals-review/fox');
const dragonfly = await import('ascii-animals-review/dragonfly');
assert.equal(root.createDragonflyArtwork, dragonfly.createDragonflyArtwork);
const dragonflyModel = dragonfly.createDragonfly({ seed: 17 });
assert.equal(dragonflyModel.step(1, []).state.tick, 1); dragonflyModel.dispose();
const seahorse = await import('ascii-animals-review/seahorse');
assert.equal(root.createSeahorseArtwork,seahorse.createSeahorseArtwork);
const horse=seahorse.createSeahorseModel({seed:19});horse.greet();horse.advanceTicks(60);assert.equal(horse.getPhase(),'curl');
assert.throws(()=>horse.configure({seed:NaN}));
assert.equal(root.createFoxArtwork, fox.createFoxArtwork);
const foxModel = fox.createFox({ seed: 17 });
assert.equal(foxModel.step(1).state.tick, 1);
foxModel.dispose();
assert.equal(typeof root.CuttlefishArtwork, 'function');
assert.equal(typeof root.createArtwork, 'function');
assert.equal(root.normalizeOptions({ count: 2 }).count, 2);
assert(Object.isFrozen(root.DEFAULT_OPTIONS));
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
const geckoModule = await import('ascii-animals-review/gecko');
assert.equal(root.createGeckoArtwork, geckoModule.createGeckoArtwork);
const geckoModel = geckoModule.createGecko({seed: 7});
assert.equal(geckoModel.step([]).state.tick, 1); geckoModel.dispose();
const pufferfish = await import('ascii-animals-review/pufferfish');
assert.equal(root.createPufferfishArtwork,pufferfish.createPufferfishArtwork);
const pufferState=pufferfish.createPufferfish({seed:17});
assert.equal(pufferfish.stepPufferfish(pufferState,{tick:1,events:[]}).state.tick,1);

const frog = await import('ascii-animals-review/frog');
assert.equal(root.createFrogArtwork, frog.createFrogArtwork);
assert.equal(frog.stepFrog(frog.createFrog(), 1).state.tick, 1);

const owl=await import('ascii-animals-review/owl');
assert.equal(root.createOwlArtwork,owl.createOwlArtwork);
const om=owl.createOwl({seed:7});assert.equal(om.advance(1).state.tick,1);om.dispose();

const crab = await import('ascii-animals-review/crab');
assert.equal(typeof crab.createCrabArtwork,'function');
assert.equal(crab.createCrabModel().frame().columns,120);
assert.throws(()=>crab.createCrabModel({speed:NaN}));
