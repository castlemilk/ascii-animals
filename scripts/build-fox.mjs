import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
export async function buildFoxPackage() {
  execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(root, 'species/fox/tsconfig.json')], { stdio: 'inherit' });
  const output = path.join(root, 'lib/species/fox');
  await mkdir(output, { recursive: true });
  for (const file of await readdir(path.join(root, 'species/fox/lib'))) {
    if (/\.(?:js|d\.ts)$/.test(file)) await writeFile(path.join(output, file), await readFile(path.join(root, 'species/fox/lib', file)));
  }
}
export async function buildFoxDemo({ check = false } = {}) {
  const outputs = new Map();
  for (const file of ['index.html', 'styles.css', 'demo.js']) {
    let text = await readFile(path.join(root, 'species/fox/demo', file), 'utf8');
    if (file === 'index.html') text = text.replace('../../../README.md', '../index.html')
      .replace('Local preview · Central library integration pending', 'Typed Fox adapter · Independent fixed-tick behavior')
      .replace('../README.md', 'https://github.com/castlemilk/ascii-animals/blob/main/docs/FOX-API.md');
    if (file === 'demo.js') text = text.replace("import { mountFox } from '../lib/browser.js';", "import { createFoxArtwork as mountFox } from './runtime/public/fox.js';")
      .replaceAll("'../lib/", "'./runtime/species/fox/");
    outputs.set(`dist/fox/${file}`, text);
  }
  for (const folder of ['species/fox', 'core', 'public']) {
    for (const file of await readdir(path.join(root, 'lib', folder))) {
      if (!file.endsWith('.js') || (folder === 'public' && file !== 'fox.js')) continue;
      outputs.set(`dist/fox/runtime/${folder}/${file}`, await readFile(path.join(root, 'lib', folder, file), 'utf8'));
    }
  }
  for (const [name, content] of outputs) {
    const target = path.join(root, name);
    if (check) {
      if (await readFile(target, 'utf8') !== content) throw new Error(`${name} is stale; run npm run build`);
    } else {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content);
    }
  }
  return { entry: 'dist/fox/index.html', files: outputs.size };
}
