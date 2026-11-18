/** Use an existing compiler; no downloads, install hooks or shared tree changes. */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let compiler = process.env.OWL_TSC;
if (!compiler) {
  try { compiler = require.resolve('typescript/lib/tsc.js'); }
  catch { console.error('TypeScript 5.9.3 is required to rebuild. Use the committed build/ files, install the pinned local dev dependency, or set OWL_TSC to an existing tsc.js.'); process.exit(1); }
}
const result = spawnSync(process.execPath, [compiler, '-p', process.argv.includes('--types-only') ? 'tsconfig.types.json' : 'tsconfig.json'],
  { cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
