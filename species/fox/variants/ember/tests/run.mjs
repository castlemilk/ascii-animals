#!/usr/bin/env node
/** Private opt-in Ember build/test gate. Run `npm ci && npm run build` first.
 * This never writes canonical source, package output, exports, or demo files.
 * A temporary sibling keeps private runtime imports pointed at the same built
 * Original model and scheduler; all temporary output is removed on completion.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { access, copyFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.argv.length > 2) throw new TypeError('Ember test gate takes no arguments');
const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const variant = fileURLToPath(new URL('../', import.meta.url));
const source = join(variant, 'src');
const tests = join(variant, 'tests');
const compiler = join(root, 'node_modules/typescript/bin/tsc');
for (const file of [compiler, join(root, 'lib/public/fox.js'), join(root, 'lib/core/scheduler.js'),
  join(root, 'species/fox/lib/model.js')]) {
  try { await access(file); }
  catch { throw new Error('Run npm ci && npm run build before the private Ember gate'); }
}

const output = await mkdtemp(join(variant, '.build-'));
try {
  const names = (await readdir(source)).sort();
  const entries = names.filter(name => name.endsWith('.ts')).map(name => join(source, name));
  execFileSync(process.execPath, [compiler,
    '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext',
    '--lib', 'ES2022,DOM', '--strict', '--exactOptionalPropertyTypes',
    '--noUncheckedIndexedAccess', '--noFallthroughCasesInSwitch',
    '--forceConsistentCasingInFileNames', '--skipLibCheck', 'false',
    '--declaration', '--noEmitOnError', '--rootDir', source, '--outDir', output,
    ...entries], { cwd: root, stdio: 'inherit' });
  for (const name of names.filter(name => name.endsWith('.js') || name.endsWith('.d.ts'))) {
    await copyFile(join(source, name), join(output, name));
  }
  console.log('Ember strict TypeScript compile: passed');
  const testFiles = (await readdir(tests)).filter(name => name.endsWith('.test.mjs'))
    .sort().map(name => join(tests, name));
  if (!testFiles.length) throw new Error('No Ember tests found');
  const result = spawnSync(process.execPath, ['--test', ...testFiles], {
    cwd: root, stdio: 'inherit',
    env: { ...process.env, FOX_EMBER_BUILD_ROOT: output, FOX_EMBER_REPO_ROOT: root },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(output, { recursive: true, force: true });
}
