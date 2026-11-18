import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

// Runs only local package creation/installation, never registry publication.
// External toolchains are optional and must already exist. No tool is installed.
const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const reportIndex = process.argv.indexOf('--report');
const reportPath = path.resolve(root, reportIndex >= 0 ? process.argv[reportIndex + 1] : 'artifacts/package-check.json');
const candidate = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const temporary = await mkdtemp(path.join(tmpdir(), 'ascii-animals-consumer-'));
const report = {
  checkedAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  architecture: process.arch,
  package: `${candidate.name}@${candidate.version}`,
  checks: {},
  toolchains: {},
  releaseReady: false,
  releaseHold: 'Unpublished private review candidate; licensing, final name, browser acceptance, and coordinator approval remain open.',
  scope: 'Local tarball and stub-free server import/build checks. No browser raster performance or visual assertion.',
};

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 120_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status})\n${result.stdout}\n${result.stderr}`);
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function digest(buffer) { return createHash('sha256').update(buffer).digest('hex'); }
function resolveOptional(envName, specifier) {
  if (process.env[envName]) return path.resolve(process.env[envName]);
  try { return require.resolve(specifier); } catch { return null; }
}

try {
  assert.equal(candidate.private, true, 'Review candidate must remain private');
  assert.equal(candidate.license, 'UNLICENSED', 'Do not assign licensing without an owner decision');
  assert.equal(Object.keys(candidate.dependencies ?? {}).length, 0, 'Runtime dependencies must remain zero');
  assert.equal(candidate.sideEffects, false);
  assert.deepEqual(Object.keys(candidate.exports), ['.', './cuttlefish', './core', './fox', './seahorse', './crab']);
  report.npm = run(npm, ['--version']).stdout;
  report.checks.build = JSON.parse(run(process.execPath, ['scripts/build.mjs']).stdout);

  const dryRun = JSON.parse(run(npm, ['pack', '--dry-run', '--json', '--ignore-scripts']).stdout)[0];
  const packed = JSON.parse(run(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', temporary]).stdout)[0];
  const packedPaths = packed.files.map(file => file.path).sort();
  assert.deepEqual(dryRun.files.map(file => file.path).sort(), packedPaths, 'Dry-run and actual pack differ');
  for (const required of ['README.md', 'NOTICE.md', 'package.json']) {
    assert(packedPaths.includes(required), `Missing required package documentation: ${required}`);
  }
  for (const entry of packedPaths) {
    assert(/^(?:lib\/|docs\/[^/]+\.md$|README\.md$|NOTICE\.md$|package\.json$)/.test(entry), `Unexpected packed file: ${entry}`);
    assert(!/(?:^|\/)(?:node_modules|\.git|\.openai|fixtures|evidence)(?:\/|$)/.test(entry));
    assert(!/\.(?:gif|jpg|png|webm|tgz)$/.test(entry), `Demo media must not be shipped: ${entry}`);
  }
  for (const conditions of Object.values(candidate.exports)) {
    assert.equal(Object.keys(conditions)[0], 'types', 'Types condition must be first');
    for (const target of Object.values(conditions)) assert(packedPaths.includes(target.replace(/^\.\//, '')), `Missing exported target ${target}`);
  }
  const tarballPath = path.join(temporary, packed.filename);
  const originalTarball = await readFile(tarballPath);
  const sha256 = digest(originalTarball);
  run(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', temporary]);
  assert.equal(digest(await readFile(tarballPath)), sha256, 'Repeated pack must produce identical bytes');
  report.checks.pack = {
    dryRun: 'passed', actualPack: 'passed', repeatableSha256: sha256,
    bytes: originalTarball.length, unpackedBytes: packed.unpackedSize,
    integrity: packed.integrity, fileCount: packedPaths.length, files: packedPaths,
  };

  const consumer = path.join(temporary, 'consumer');
  await mkdir(consumer);
  await writeFile(path.join(consumer, 'package.json'), JSON.stringify({ name: 'ascii-animals-local-consumer', version: '0.0.0', private: true, type: 'module' }, null, 2));
  await cp(path.join(root, 'fixtures'), consumer, { recursive: true });
  run(npm, ['install', tarballPath, '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'], consumer);
  report.checks.consumer = JSON.parse(run(process.execPath, ['consumer.mjs'], consumer).stdout);

  const compiler = resolveOptional('ASCII_TSC', 'typescript/lib/tsc.js');
  if (compiler) {
    report.toolchains.typescript = run(process.execPath, [compiler, '--version']).stdout;
    for (const [name, module, resolution] of [['NodeNext', 'NodeNext', 'NodeNext'], ['Bundler', 'ESNext', 'Bundler']]) {
      run(process.execPath, [compiler, '--noEmit', '--strict', '--exactOptionalPropertyTypes', '--target', 'ES2022', '--module', module, '--moduleResolution', resolution, '--lib', 'ES2022,DOM', 'types.ts'], consumer);
      report.checks[`types${name}`] = 'passed (positive usage and @ts-expect-error negative cases)';
    }
    run(process.execPath, [compiler, '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--lib', 'ES2022', 'types-core-server.ts'], consumer);
    report.checks.typesCoreServer = 'passed with ES2022 only, no DOM or Node ambient declarations';
  } else {
    report.checks.types = 'NOT RUN: provide ASCII_TSC pointing to an existing typescript/lib/tsc.js';
  }

  const esbuildPath = resolveOptional('ASCII_ESBUILD_MODULE', 'esbuild');
  if (esbuildPath) {
    const loaded = await import(pathToFileURL(esbuildPath).href);
    const esbuild = loaded.default ?? loaded;
    report.toolchains.esbuild = esbuild.version;
    const bundles = {};
    for (const variant of ['core', 'root-core', 'animal', 'unused']) {
      const built = await esbuild.build({
        absWorkingDir: consumer,
        entryPoints: [`bundle-${variant}.js`],
        bundle: true, write: false, metafile: true, minify: true,
        platform: 'browser', format: 'esm', target: ['es2022'], logLevel: 'silent',
      });
      const output = built.outputFiles[0].contents;
      const included = Object.values(built.metafile.outputs).flatMap(value => Object.entries(value.inputs).filter(([, contribution]) => contribution.bytesInOutput > 0).map(([name]) => name));
      const includesAnimal = included.some(name => name.includes('/animals/cuttlefish.js'));
      if (variant === 'animal') assert(includesAnimal, 'Animal bundle must include the engine');
      else assert(!includesAnimal, `${variant} unexpectedly includes the animal renderer`);
      if (variant === 'unused') assert(!included.some(name => name.includes('node_modules/ascii-animals-review/')), 'Unused module must be removed');
      bundles[variant] = { minifiedBytes: output.length, gzipBytes: gzipSync(output, { level: 9 }).length, included, sha256: digest(output) };
    }
    report.checks.esbuild = bundles;
  } else {
    report.checks.esbuild = 'NOT RUN: provide ASCII_ESBUILD_MODULE pointing to an existing esbuild module';
  }
  report.checks.rollup = 'NOT RUN: installed Rollup lacks its Node package resolver; no compatibility claim';
  report.checks.webpack = 'NOT RUN: toolchain unavailable; no compatibility claim';
  report.checks.browser = 'NOT RUN by this harness: no visual, hydration, GPU, touch, or accessibility assertions';
  const artifact = path.join(path.dirname(reportPath), packed.filename);
  await mkdir(path.dirname(artifact), { recursive: true });
  await writeFile(artifact, originalTarball);
  report.checks.pack.artifact = path.relative(root, artifact);
  report.status = compiler && esbuildPath ? 'passed' : 'passed-with-unrun-optional-checks';
} catch (error) {
  report.status = 'failed';
  report.error = error.stack ?? String(error);
  process.exitCode = 1;
} finally {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  await rm(temporary, { recursive: true, force: true });
  console.log(JSON.stringify(report, null, 2));
}
