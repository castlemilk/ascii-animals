import { buildDemo } from './build-demo.mjs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Copy-only ESM build. No transpiler, minifier, bundler, or runtime dependency.
// Declaration paths mirror src; authored declarations are checked by consumers.
const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'lib');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
let modules = 0, declarations = 0;

async function copyTree(from, to, suffix) {
  for (const entry of (await readdir(from, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const source = path.join(from, entry.name), destination = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await mkdir(destination, { recursive: true });
      await copyTree(source, destination, suffix);
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      await writeFile(destination, await readFile(source));
      if (suffix === '.js') modules++; else declarations++;
    }
  }
}

await copyTree(path.join(root, 'src'), output, '.js');
await copyTree(path.join(root, 'types'), output, '.d.ts');
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
for (const [subpath, conditions] of Object.entries(metadata.exports)) {
  for (const target of new Set(Object.values(conditions))) {
    await readFile(path.join(root, target));
  }
  if (Object.keys(conditions)[0] !== 'types') throw new Error(`Types condition must come first: ${subpath}`);
}
const demo = await buildDemo();
console.log(JSON.stringify({ demo, output: 'lib', modules, declarations, tool: 'copy-only', runtimeDependencies: 0 }));
