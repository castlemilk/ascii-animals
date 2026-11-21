#!/usr/bin/env node
/**
 * Verify the documentation against one supplied, already-built package tarball.
 * Usage: node docs/verify-examples.mjs /absolute/package.tgz [report.json]
 * Prerequisite: npm ci --ignore-scripts at the repository root (TypeScript only).
 * No package build, publication, browser launch, source alias, or source symlink.
 * Browser snippets are typechecked; real-browser interaction is a separate check.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const documentationRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.dirname(documentationRoot);
const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) {
  console.log('Usage: node docs/verify-examples.mjs /absolute/package.tgz [report.json]');
  process.exit(args.includes('--help') ? 0 : 2);
}
if (args.length > 2) throw new Error('Expected a tarball path and optional report path.');
const tarball = path.resolve(args[0]);
const reportPath = args[1] ? path.resolve(args[1]) : null;
const compilerPath = path.join(repositoryRoot, 'node_modules/typescript/bin/tsc');
if (!existsSync(compilerPath)) throw new Error('Run npm ci --ignore-scripts at the repository root first.');
const require = createRequire(import.meta.url);
const ts = require(path.join(repositoryRoot, 'node_modules/typescript/lib/typescript.js'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = [
  'FOX-API.md', 'DRAGONFLY-API.md', 'GECKO-API.md', 'PUFFERFISH-API.md',
  'FROG-API.md', 'OWL-API.md', 'SEAHORSE-API.md', 'CRAB-API.md',
  'TURTLE-API.md', 'BUTTERFLY-API.md', 'BROWSER-INTEGRATION.md',
  'PACKAGE.md', 'TYPESCRIPT-API.md', 'MARINE-DIRECTOR.md',
];
// These blocks discuss the artwork/imports created in block 1 of the same guide.
// Prepend the real code rather than supplying a made-up artwork declaration.
const prerequisites = new Map([
  ['SEAHORSE-API.md:2', [1]], ['SEAHORSE-API.md:4', [1]],
  ['MARINE-DIRECTOR.md:2', [1]],
]);
const domHosts = { canvas: 'HTMLCanvasElement', rustleButton: 'HTMLButtonElement', restButton: 'HTMLButtonElement' };
const runStandalone = new Map([
  ['FOX-API.md:2', 'Pure Fox director example'],
  ['OWL-API.md:3', 'Pure Owl director and grid example'],
  ['TURTLE-API.md:2', 'Pure Turtle model example'],
  ['PACKAGE.md:1', 'DOM-free import example'],
  ['TYPESCRIPT-API.md:1', 'DOM-free option normalization example'],
]);
// Compare the two explanatory type excerpts to the installed declaration contract.
const typeExcerpts = new Map([
  ['SEAHORSE-API.md:3', { name: 'SeahorseDirectorAction', subpath: '/seahorse' }],
  ['CRAB-API.md:2', { name: 'CrabActivity', subpath: '/crab' }],
]);
const report = {
  schema: 'ascii-animals-documentation-validation-v1',
  startedAt: new Date().toISOString(),
  invocation: [process.execPath, fileURLToPath(import.meta.url), tarball, ...(reportPath ? [reportPath] : [])],
  nodeVersion: process.version,
  npmVersion: null,
  tarball: { path: tarball, sha256: null },
  documentationGitHead: null,
  typescriptVersion: ts.version,
  package: null,
  install: null,
  documents: [],
  fixtures: [],
  browserJavaScript: [],
  compilation: [],
  ssrImports: [],
  blockedSubpaths: [],
  standaloneExamples: [],
  caveats: [
    'TypeScript fences with browser construction are typechecked, not executed in a browser.',
    'Continuation fixtures prepend the actual earlier fenced example; they are type-only and do not assert sequential runtime behavior after its disposal.',
    'MARINE-DIRECTOR.md block 2 intentionally contains invalid runtime inputs and @ts-expect-error cases; it is typechecked only.',
    'Fresh Node imports verify ESM import without DOM globals; they do not verify browser rendering, touch, accessibility, or performance.',
    'The supplied tarball hash identifies package bytes. Its build provenance must be checked separately against the source revision.',
  ],
  success: false,
};
let consumer;
let fixtureSources = [];

function command(executable, commandArgs, cwd, timeout = 60_000) {
  const result = spawnSync(executable, commandArgs, {
    cwd, encoding: 'utf8', timeout, maxBuffer: 4 * 1024 * 1024,
  });
  return {
    exitCode: result.status,
    signal: result.signal,
    error: result.error?.message ?? null,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}
function assertCommand(result, label) {
  if (result.exitCode !== 0 || result.error) {
    throw new Error(`${label} failed: ${result.error || result.stderr || result.stdout || `exit ${result.exitCode}`}`);
  }
}
function fenceBlocks(markdown) {
  return [...markdown.matchAll(/^```(ts|typescript|tsx)[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm)].map((match, index) => ({
    number: index + 1,
    language: match[1],
    line: markdown.slice(0, match.index).split('\n').length,
    code: match[2],
  }));
}
function hostDeclarations(code) {
  return Object.entries(domHosts).filter(([name]) =>
    new RegExp(`\\b${name}\\b`).test(code) &&
    !new RegExp(`\\b(?:const|let|var)\\s+${name}\\b`).test(code) &&
    // A function parameter is a local binding, not a missing ambient host.
    !new RegExp(`\\b${name}\\s*:\\s*HTMLCanvasElement\\b`).test(code),
  ).map(([name, type]) => `declare const ${name}: ${type};`);
}

try {
  const npmVersion = command(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version'], repositoryRoot);
  assertCommand(npmVersion, 'npm version lookup');
  report.npmVersion = npmVersion.stdout.trim();
  const tarballBytes = await readFile(tarball);
  report.tarball.sha256 = hash(tarballBytes);
  report.tarball.bytes = tarballBytes.byteLength;
  try { report.documentationGitHead = execFileSync('git', ['-C', repositoryRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); }
  catch { /* A standalone downloaded docs tree need not contain Git metadata. */ }

  consumer = await mkdtemp(path.join(tmpdir(), 'ascii-animals-docs-'));
  await writeFile(path.join(consumer, 'package.json'), JSON.stringify({
    name: 'ascii-animals-documentation-consumer', version: '0.0.0', private: true, type: 'module',
  }, null, 2));
  const npmArgs = ['install', '--ignore-scripts', '--offline', '--no-audit', '--no-fund', '--package-lock=false', '--cache', path.join(consumer, 'npm-cache'), tarball];
  report.install = { command: ['npm', ...npmArgs], ...command(process.platform === 'win32' ? 'npm.cmd' : 'npm', npmArgs, consumer, 120_000) };
  assertCommand(report.install, 'Offline tarball installation');

  const expectedName = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')).name;
  const installedDirectory = path.join(consumer, 'node_modules', expectedName);
  assert.equal((await lstat(installedDirectory)).isSymbolicLink(), false, 'Installed package must not be a source symlink');
  assert.equal(await realpath(installedDirectory), path.join(await realpath(consumer), 'node_modules', expectedName), 'Installed package must be an ordinary unpacked directory');
  const manifest = JSON.parse(await readFile(path.join(installedDirectory, 'package.json'), 'utf8'));
  assert.equal(manifest.name, expectedName, 'Supplied tarball name differs from the documented package');
  assert.equal(manifest.type, 'module', 'Documented package must be ESM');
  report.package = { name: manifest.name, version: manifest.version, private: manifest.private, license: manifest.license, exports: manifest.exports, installedFromTarball: true, sourceSymlink: false };

  const fixtureDirectory = path.join(consumer, 'fixtures');
  await mkdir(fixtureDirectory);
  for (const file of files) {
    const markdown = await readFile(path.join(documentationRoot, file), 'utf8');
    const blocks = fenceBlocks(markdown);
    assert.ok(blocks.length > 0, `${file} must contain at least one TypeScript fence`);
    report.documents.push({ file: `docs/${file}`, sha256: hash(markdown), typeScriptFences: blocks.length });
    for (const block of blocks) {
      const id = `${file}:${block.number}`;
      const setupNumbers = prerequisites.get(id) ?? [];
      const setup = setupNumbers.map(number => {
        const dependency = blocks.find(item => item.number === number);
        assert.ok(dependency, `Missing prerequisite ${file}:${number}`);
        return `// Actual setup from ${file} block ${number}.\n${dependency.code}`;
      }).join('\n');
      let source = setup + '\n' + block.code;
      const ambient = hostDeclarations(source);
      source = `${ambient.join('\n')}\n${source}`;
      const excerpt = typeExcerpts.get(id);
      if (excerpt) {
        source += `\ntype __Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;\n` +
          `type __Assert<T extends true> = T;\ntype __Contract = __Assert<__Equal<${excerpt.name}, import('${manifest.name}${excerpt.subpath}').${excerpt.name}>>;\n`;
      }
      // A type-only excerpt still gets its own module scope.
      source += '\nexport {};\n';
      const fixtureName = `${file.replace(/\.md$/, '').toLowerCase()}-${block.number}.${block.language === 'tsx' ? 'tsx' : 'mts'}`;
      await writeFile(path.join(fixtureDirectory, fixtureName), source);
      const record = {
        id, sourceFile: `docs/${file}`, sourceLine: block.line, originalCodeSha256: hash(block.code),
        fixture: `fixtures/${fixtureName}`, prerequisiteBlocks: setupNumbers,
        ambientDomDeclarations: ambient,
        expectedStaticErrors: (block.code.match(/@ts-expect-error\b/g) ?? []).length,
        installedTypeComparison: excerpt ? `${manifest.name}${excerpt.subpath}#${excerpt.name}` : null,
        execution: runStandalone.has(id) ? 'standalone-after-typecheck' : 'typecheck-only',
        reason: id === 'MARINE-DIRECTOR.md:2' ? 'Deliberate invalid runtime inputs and negative type cases' :
          setupNumbers.length ? 'Continuation using the actual earlier example setup' :
          excerpt ? 'Type definition excerpt, compared with the installed declaration' :
          runStandalone.has(id) ? runStandalone.get(id) : 'Browser host or lifecycle example; browser behavior verified separately',
      };
      report.fixtures.push(record);
      fixtureSources.push({ record, source, fixtureName });
    }
  }

  const browserDirectory = path.join(consumer, 'browser');
  await mkdir(browserDirectory);
  for (const name of ['basic.js', 'director.js']) {
    const relative = `examples/browser/${name}`;
    const bytes = await readFile(path.join(documentationRoot, relative));
    await writeFile(path.join(browserDirectory, name), bytes);
    report.browserJavaScript.push({ sourceFile: `docs/${relative}`, sha256: hash(bytes), checkJs: true, runtimeExecution: 'separate-browser-verification' });
  }

  const strictOptions = {
    target: 'ES2022', strict: true, exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true, skipLibCheck: false, noEmit: true,
    lib: ['ES2022', 'DOM'], allowJs: true, checkJs: true,
  };
  for (const [label, module, moduleResolution] of [['NodeNext', 'NodeNext', 'NodeNext'], ['Bundler', 'ESNext', 'Bundler']]) {
    const configName = `tsconfig.${label.toLowerCase()}.json`;
    await writeFile(path.join(consumer, configName), JSON.stringify({
      compilerOptions: { ...strictOptions, module, moduleResolution },
      include: ['fixtures/**/*', 'browser/*.js'],
    }, null, 2));
    const result = command(process.execPath, [compilerPath, '-p', configName], consumer);
    report.compilation.push({ mode: label, strict: true, checkJs: true, fixtureCount: report.fixtures.length, browserJavaScriptFiles: report.browserJavaScript.length, ...result });
    assertCommand(result, `${label} documentation compilation`);
  }

  const importProbe = `
    import assert from 'node:assert/strict';
    const specifier = process.argv[1];
    const domGlobals = ['window', 'document', 'HTMLCanvasElement', 'HTMLElement', 'CanvasRenderingContext2D'];
    assert.deepEqual(domGlobals.filter(name => name in globalThis), []);
    const module = await import(specifier);
    assert.deepEqual(domGlobals.filter(name => name in globalThis), []);
    console.log(JSON.stringify({ specifier, exportedNames: Object.keys(module).sort(), domGlobalsPresent: [] }));
  `;
  const publicSubpaths = Object.keys(manifest.exports);
  for (const subpath of publicSubpaths) {
    const specifier = manifest.name + (subpath === '.' ? '' : subpath.slice(1));
    const result = command(process.execPath, ['--input-type=module', '--eval', importProbe, specifier], consumer);
    const record = { subpath, freshNode: true, ...result };
    report.ssrImports.push(record);
    assertCommand(result, `SSR import ${specifier}`);
    record.result = JSON.parse(result.stdout.trim());
    delete record.stdout;
  }
  const blockedProbe = `
    import assert from 'node:assert/strict';
    const specifier = process.argv[1];
    let caught;
    try { await import(specifier); } catch (error) { caught = error; }
    assert.equal(caught?.code, 'ERR_PACKAGE_PATH_NOT_EXPORTED', specifier);
    console.log(JSON.stringify({ specifier, errorCode: caught.code }));
  `;
  for (const subpath of ['/lib/index.js', '/manta', '/octopus']) {
    const specifier = manifest.name + subpath;
    const result = command(process.execPath, ['--input-type=module', '--eval', blockedProbe, specifier], consumer);
    report.blockedSubpaths.push({ subpath, expectedError: 'ERR_PACKAGE_PATH_NOT_EXPORTED', ...result });
    assertCommand(result, `Blocked subpath ${specifier}`);
  }

  const runtimeDirectory = path.join(consumer, 'runtime');
  await mkdir(runtimeDirectory);
  for (const fixture of fixtureSources.filter(item => runStandalone.has(item.record.id))) {
    const emitted = ts.transpileModule(fixture.source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    const outputPath = path.join(runtimeDirectory, fixture.fixtureName.replace(/\.(mts|tsx)$/, '.mjs'));
    await writeFile(outputPath, emitted);
    const result = command(process.execPath, [outputPath], consumer);
    report.standaloneExamples.push({
      id: fixture.record.id, description: runStandalone.get(fixture.record.id),
      exitCode: result.exitCode, signal: result.signal, error: result.error,
      stdoutBytes: Buffer.byteLength(result.stdout), stdoutSha256: hash(result.stdout), stderr: result.stderr,
    });
    assertCommand(result, `Standalone example ${fixture.record.id}`);
  }
  report.success = true;
} catch (error) {
  report.failure = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  if (consumer) await rm(consumer, { recursive: true, force: true });
  report.consumerCleaned = Boolean(consumer);
  report.finishedAt = new Date().toISOString();
  report.counts = {
    documents: report.documents.length,
    uniqueTypeScriptFences: report.fixtures.length,
    compilationModes: report.compilation.length,
    fixtureCompilationChecks: report.fixtures.length * report.compilation.filter(item => item.exitCode === 0).length,
    continuationFixtures: report.fixtures.filter(item => item.prerequisiteBlocks.length > 0).length,
    declarationComparisons: report.fixtures.filter(item => item.installedTypeComparison).length,
    expectedStaticErrors: report.fixtures.reduce((sum, item) => sum + item.expectedStaticErrors, 0),
    browserJavaScriptFiles: report.browserJavaScript.length,
    ssrImports: report.ssrImports.length,
    blockedSubpaths: report.blockedSubpaths.length,
    standaloneExamples: report.standaloneExamples.length,
    standalonePasses: report.standaloneExamples.filter(item => item.exitCode === 0).length,
  };
  if (reportPath) {
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ success: report.success, report: reportPath, counts: report.counts, failure: report.failure ?? null }, null, 2));
  } else console.log(JSON.stringify(report, null, 2));
}
