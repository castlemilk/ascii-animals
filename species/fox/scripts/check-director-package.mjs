/** Offline consumer of a pre-existing local pack; never builds or publishes. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const foxRoot = fileURLToPath(new URL('../', import.meta.url));
const root = path.resolve(foxRoot, '../..');
const reportPath = path.join(foxRoot, 'evidence/director/fox-package-consumer.json');
const fixturePath = path.join(foxRoot, 'tests/types/director-package.ts');
const compiler = path.join(root, 'node_modules/typescript/bin/tsc');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const report = {
  checkedAt: new Date().toISOString(), node: process.version,
  scope: 'Installed local tarball: strict ./fox consumer declarations and stub-free Node SSR runtime import. No build, registry access, publication, browser or performance claim.',
  checks: {},
  unrun: ['Browser playback, touch and accessibility', 'Browser or device rendering performance', 'Deployed package use'],
};
let temporary;

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 45_000, maxBuffer: 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status})\n${result.stdout}\n${result.stderr}`.slice(0, 12_000));
  return result.stdout.trim();
}

const runtime = `
import assert from 'node:assert/strict';
for (const name of ['window', 'document', 'navigator', 'requestAnimationFrame']) {
  Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error('SSR access to ' + name); } });
}
const fox = await import('ascii-animals-review/fox');
const root = await import('ascii-animals-review');
assert.equal(root.createFoxArtwork, fox.createFoxArtwork);
assert.equal(typeof root.createArtwork, 'function');
assert.equal(typeof root.createScheduler, 'function');
assert.equal(Object.hasOwn(root, 'createFoxDirector'), false);
for (const name of ['createFox', 'createFoxArtwork', 'createFoxDirector', 'resolveFoxDirectorOptions']) assert.equal(typeof fox[name], 'function');
assert.equal(fox.FOX_DIRECTOR_DEFAULTS.scene, 'dusk-hunt');
assert.equal(fox.FOX_DIRECTOR_LIMITS.maxActors, 3);
const director = fox.createFoxDirector({ seed: 17, count: 3, scene: 'moon-play' });
const initial = director.getState();
assert.equal(initial.actors.length, 3);
const batch = [
  { type: 'guide', tick: 1, seq: 0, x: .2, y: .4 },
  { type: 'cue', tick: 1, seq: 1, cue: 'rustle', id: 1, x: .2, y: .4 },
];
const advanced = director.step(1, batch);
assert.equal(advanced.kind, 'advanced');
assert.equal(advanced.state.selectedId, 1);
assert.equal(advanced.state.tick, 1);
assert.equal(advanced.eventsAccepted, 2);
assert.equal(advanced.cue, 'accepted');
assert.equal(director.getFrame('rest').tableau, 'rest');
assert.equal(director.getFrame('rest').state.tick, 1);
assert.throws(() => director.configure({ count: 4 }), RangeError);
assert.equal(director.getOptions().count, 3);
director.reset(17);
assert.deepEqual(director.step(1, batch), advanced);
director.setPaused(true);
assert.equal(director.step(2).kind, 'paused');
assert.equal(director.getState().tick, 1);
director.dispose(); director.dispose();
assert.throws(() => director.getState(), /disposed/);
const legacy = fox.createFox({ seed: 17 });
assert.equal(legacy.getState().species, 'fox');
legacy.dispose();
console.log(JSON.stringify({
  status: 'passed', domGlobals: 'throw-on-access; imports and headless director completed',
  runtime: ['root/subpath Fox factory identity', 'root director export absent', 'director exports and defaults', 'ordered step and accepted cue', 'static frame without tick', 'invalid config atomicity', 'exact reset replay', 'pause and disposal', 'legacy model creation'],
}));
`;

try {
  assert.equal(process.argv.length, 3, 'Usage: node species/fox/scripts/check-director-package.mjs path/to/local.tgz');
  const tarball = path.resolve(process.cwd(), process.argv[2]);
  assert.equal(path.extname(tarball), '.tgz', 'Pass a local npm pack tarball');
  const packedBytes = await readFile(tarball);
  const fixture = await readFile(fixturePath, 'utf8');
  let consumerFixture = fixture;
  for (const [local, installed] of [
    ['../../../../lib/index.js', 'ascii-animals-review'],
    ['../../../../lib/public/fox.js', 'ascii-animals-review/fox'],
  ]) {
    assert.equal(fixture.split(`'${local}'`).length, 2, 'Each built-entry import must occur exactly once');
    consumerFixture = consumerFixture.replace(`'${local}'`, `'${installed}'`);
  }
  report.tarball = { path: path.relative(root, tarball), bytes: packedBytes.length, sha256: sha256(packedBytes) };
  report.fixture = { path: path.relative(root, fixturePath), sha256: sha256(fixture), consumerSha256: sha256(consumerFixture), negativeAssertions: (fixture.match(/@ts-expect-error/g) ?? []).length, imports: ['ascii-animals-review', 'ascii-animals-review/fox'] };
  report.typescript = run(process.execPath, [compiler, '--version']);
  temporary = await mkdtemp(path.join(tmpdir(), 'ascii-fox-director-consumer-'));
  await writeFile(path.join(temporary, 'package.json'), JSON.stringify({ name: 'fox-director-offline-consumer', version: '0.0.0', private: true, type: 'module' }));
  run(npm, ['install', tarball, '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', '--no-progress'], temporary);
  const installed = JSON.parse(await readFile(path.join(temporary, 'node_modules/ascii-animals-review/package.json'), 'utf8'));
  assert.equal(Object.keys(installed.dependencies ?? {}).length, 0, 'This consumer installs only the local candidate');
  report.package = `${installed.name}@${installed.version}`;
  report.checks.install = 'passed: one local tarball, offline, lifecycle scripts disabled';
  await writeFile(path.join(temporary, 'types.ts'), consumerFixture);
  await writeFile(path.join(temporary, 'runtime.mjs'), runtime);
  for (const [name, module, resolution] of [['NodeNext', 'NodeNext', 'NodeNext'], ['Bundler', 'ESNext', 'Bundler']]) {
    run(process.execPath, [compiler, '--noEmit', '--strict', '--exactOptionalPropertyTypes', '--noUncheckedIndexedAccess', '--skipLibCheck', 'false', '--target', 'ES2022', '--module', module, '--moduleResolution', resolution, '--lib', 'ES2022,DOM', 'types.ts'], temporary);
    report.checks[`types${name}`] = 'passed: positive usage and @ts-expect-error negative assertions';
  }
  report.checks.ssr = JSON.parse(run(process.execPath, ['runtime.mjs'], temporary));
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack ?? String(error); process.exitCode = 1;
} finally {
  if (temporary) await rm(temporary, { recursive: true, force: true });
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
