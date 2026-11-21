/** Private review/test compiler; leaves package exports and the root build unchanged. */
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const entry = 'species/turtle/variants/lagoon-scout.ts';
let loaded;

/** Compile once per process, import the SSR-safe factories, then remove all build files. */
export function loadLagoonScout() {
  return loaded ??= compile();
}

async function compile() {
  const output = await mkdtemp(path.join(tmpdir(), 'ascii-turtle-lagoon-'));
  try {
    execFileSync(process.execPath, [
      path.join(root, 'node_modules/typescript/bin/tsc'), path.join(root, entry),
      '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext',
      '--strict', '--exactOptionalPropertyTypes', '--noUncheckedIndexedAccess',
      '--lib', 'ES2022,DOM', '--noEmitOnError', '--rootDir', root, '--outDir', output
    ], { cwd: root, stdio: 'pipe', encoding: 'utf8' });
    // TypeScript resolves scheduler.d.ts; its unchanged JavaScript is a runtime input.
    await mkdir(path.join(output, 'src/core'), { recursive: true });
    await copyFile(path.join(root, 'src/core/scheduler.js'), path.join(output, 'src/core/scheduler.js'));
    await writeFile(path.join(output, 'package.json'), '{"type":"module"}\n');
    return await import(pathToFileURL(path.join(output, entry.replace(/\.ts$/, '.js'))).href);
  } finally {
    // Imports are fully evaluated before cleanup; no dynamic file loading occurs later.
    await rm(output, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const variant = await loadLagoonScout();
  console.log(JSON.stringify({
    entry, private: true, exports: Object.keys(variant),
    sourceSha256: createHash('sha256').update(await readFile(path.join(root, entry))).digest('hex'),
    output: 'Temporary build removed after import; no package or gallery registration'
  }));
}
