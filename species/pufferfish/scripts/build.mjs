#!/usr/bin/env node
/** Species-local build. Uses an existing TypeScript compiler; installs nothing. */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let compiler = process.env.PUFFERFISH_TSC;
if (!compiler) {
  try { compiler = require.resolve('typescript/lib/tsc.js'); }
  catch { console.error('TypeScript is required to rebuild. Set PUFFERFISH_TSC to an existing typescript/lib/tsc.js, or run tsc -p species/pufferfish/tsconfig.json. The checked-in build runs without a compiler.'); process.exit(1); }
}
const result = spawnSync(process.execPath, [compiler, '-p', fileURLToPath(new URL('../tsconfig.json', import.meta.url))], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
