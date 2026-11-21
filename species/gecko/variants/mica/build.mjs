/** Explicit private build: node species/gecko/variants/mica/build.mjs
 * Run the repository's unchanged `npm run build` first for the Original.
 * This command emits only ignored files under this variation's compiled/.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { copyFileSync } from 'node:fs';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../../..');
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(directory, 'tsconfig.json')], { stdio: 'inherit' });
for (const filename of ['shared-scheduler.js', 'shared-scheduler.d.ts']) {
  copyFileSync(path.join(directory, 'src', filename), path.join(directory, 'compiled', filename));
}
console.log('Built private Gecko/Mica only; Original outputs and package exports are unchanged.');
