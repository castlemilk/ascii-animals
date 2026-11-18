#!/usr/bin/env node
/** Reproducible species-local verification. Never pushes, deploys or installs packages. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, mkdtemp, cp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(here, '../..');
const evidence = join(here, 'evidence');
const logs = join(evidence, 'logs');
const require = createRequire(import.meta.url);
const sha = value => createHash('sha256').update(value).digest('hex');
const checks = [];
await mkdir(logs, { recursive: true });
async function files(directory) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) result.push(...await files(path)); else result.push(path);
  }
  return result.sort();
}
async function hashes(directory) {
  const result = {};
  for (const path of await files(directory)) result[relative(here, path)] = sha(await readFile(path));
  return result;
}
async function command(id, executable, args) {
  const result = spawnSync(executable, args, { cwd: repo, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`;
  await writeFile(join(logs, `${id}.txt`), output);
  checks.push({ id, executable, args, exitCode: result.status, log: `evidence/logs/${id}.txt` });
  assert.equal(result.status, 0, `${id} failed; inspect ${relative(repo, join(logs, `${id}.txt`))}`);
  console.log(`${id}: passed`);
  return output;
}
let compiler = process.env.PUFFERFISH_TSC;
if (!compiler) { try { compiler = require.resolve('typescript/lib/tsc.js'); } catch { throw new Error('Set PUFFERFISH_TSC to an existing typescript/lib/tsc.js.'); } }
const before = await hashes(join(here, 'build'));
const tsVersion = await command('typescript-version', process.execPath, [compiler, '--version']);
await command('typescript-build', process.execPath, [compiler, '-p', 'species/pufferfish/tsconfig.json']);
assert.deepEqual(await hashes(join(here, 'build')), before, 'Checked-in generated build was stale. Review/rebuild before verification.');
checks.push({ id: 'generated-build-parity', result: 'TypeScript re-emission byte-identical for JS and declarations' });
for (const name of ['types', 'server', 'nodenext'])
  await command(`typescript-${name}`, process.execPath, [compiler, '-p', `species/pufferfish/tests/tsconfig.${name}.json`]);
const tests = (await files(join(here, 'tests'))).filter(path => path.endsWith('.test.mjs')).map(path => relative(repo, path));
await command('species-tests', process.execPath, ['--test', ...tests]);
await command('legacy-regression', process.execPath, ['scripts/check-engine.cjs']);
await command('legacy-syntax', process.execPath, ['--check', 'dist/artwork.js']);
await command('app-syntax', process.execPath, ['--check', 'dist/app.js']);
await command('ssr-import', process.execPath, ['--input-type=module', '-e',
  "import assert from 'node:assert/strict'; assert.equal(typeof document,'undefined'); const {pufferfish}=await import('./species/pufferfish/build/index.js'); await import('./species/pufferfish/build/controller.js'); await import('./species/pufferfish/build/legacy-painter.js'); assert.equal(pufferfish.create().tick,0); console.log('Pure and adapter imports succeeded without DOM; no browser construction claimed.');"]);
await command('scope-boundary', 'git', ['diff', '--exit-code', '0e446c47b491b751d484e40db753ec725652b515', '--', 'dist', 'scripts', 'README.md', '.github']);
await command('whitespace', 'git', ['diff', '--check']);
const copy = await mkdtemp(join(tmpdir(), 'pufferfish-standalone-check-'));
try {
  await mkdir(join(copy, 'scripts')); await mkdir(join(copy, 'dist'));
  await cp(join(repo, 'scripts/build-standalone.py'), join(copy, 'scripts/build-standalone.py'));
  for (const file of ['index.html', 'styles.css', 'artwork.js', 'app.js']) await cp(join(repo, 'dist', file), join(copy, 'dist', file));
  await command('legacy-standalone', 'python3', [join(copy, 'scripts/build-standalone.py')]);
  assert.equal(sha(await readFile(join(copy, 'dist/cuttlefish.html'))), sha(await readFile(join(repo, 'dist/cuttlefish.html'))));
  checks.push({ id: 'standalone-byte-parity', result: 'Original standalone rebuilt in temporary copy, byte-identical; shared checkout untouched' });
} finally { await rm(copy, { recursive: true, force: true }); }
if (process.env.PUFFERFISH_SPEC_VALIDATOR)
  await command('skill-spec-validator', process.execPath, [process.env.PUFFERFISH_SPEC_VALIDATOR, 'species/pufferfish/authoring.json']);
const capture = JSON.parse(await readFile(join(evidence, 'native-capture.json'), 'utf8'));
for (const [path, hash] of Object.entries(capture.source.speciesSha256)) assert.equal(sha(await readFile(join(here, path))), hash, `Captured source changed: ${path}`);
for (const artifact of capture.artifacts) {
  const expected = artifact.assemblyOnly ? artifact.sha256 : artifact.pngSha256;
  assert.match(expected, /^[0-9a-f]{64}$/, `Missing capture hash: ${artifact.file}`);
  assert.equal(sha(await readFile(join(evidence, artifact.file))), expected, `Capture changed: ${artifact.file}`);
}
checks.push({ id: 'capture-hash-parity', result: `${capture.artifacts.length} artifact and ${Object.keys(capture.source.speciesSha256).length} captured source hashes verified` });
await command('gif-decode', 'python3', ['-c',
  "from PIL import Image; im=Image.open('species/pufferfish/evidence/pufferfish-native.gif'); n=im.n_frames; ms=0\nfor i in range(n):\n im.seek(i); ms+=im.info.get('duration',0)\nassert n==278 and ms==18500,(n,ms)\nprint(f'GIF decoded: {n} frames, {ms}ms; intended simulation cadence, not rendering throughput')"]);
const report = {
  schemaVersion: 1, verifiedAtUtc: new Date().toISOString(), base: '0e446c47b491b751d484e40db753ec725652b515',
  runtime: { node: process.version, typescript: tsVersion.trim(), platform: process.platform, arch: process.arch },
  checks, sourceSha256: await hashes(join(here, 'src')), buildSha256: await hashes(join(here, 'build')),
  boundaries: ['Numerical/state/cell tests', 'Mocked browser resource bookkeeping', 'Actual native Skia pixels, no browser page',
    'Real Chromium launch blocked before page: socket/ptrace Operation not permitted', 'No deployed/npm/canonical-species acceptance'],
};
await writeFile(join(evidence, 'checks.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Verification recorded ${checks.length} checks. Browser/device acceptance remains open.`);
