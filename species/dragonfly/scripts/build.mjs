import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let compiler;
try { compiler = process.env.DRAGONFLY_TSC || require.resolve('typescript/lib/tsc.js'); }
catch { console.error('TypeScript 5.9.3 is required to build. Install the species dev dependency or set DRAGONFLY_TSC to an existing tsc.js. Committed lib/ files run without it.'); process.exit(1); }
const project = process.argv.includes('--check') ? 'tsconfig.types.json' : 'tsconfig.json';
const result = spawnSync(process.execPath, [compiler, '--project', resolve(root,project)], { cwd:root, stdio:'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
