import { buildFrogPackage, buildFrogDemo } from './build-frog.mjs';
import { buildFoxPackage, buildFoxDemo } from './build-fox.mjs';
import { execFileSync } from 'node:child_process';
import { buildDemo } from './build-demo.mjs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Preserve the private renderer; compile the strict TypeScript public facade and declarations.
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
await buildFoxPackage();
await buildFrogPackage();
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(root, 'tsconfig.json')], { stdio: 'inherit' });
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
for (const [subpath, conditions] of Object.entries(metadata.exports)) {
  for (const target of new Set(Object.values(conditions))) {
    await readFile(path.join(root, target));
  }
  if (Object.keys(conditions)[0] !== 'types') throw new Error(`Types condition must come first: ${subpath}`);
}
const demo = await buildDemo();
const fox = await buildFoxDemo();
const frog = await buildFrogDemo();
console.log(JSON.stringify({ demo, fox, output: 'lib', modules, declarations, tool: 'tsc + private-renderer copy', runtimeDependencies: 0 }));
