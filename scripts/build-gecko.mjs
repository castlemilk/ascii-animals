import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
export async function buildGeckoPackage() {
  execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(root, 'species/gecko/tsconfig.json')], { stdio: 'inherit' });
  await mkdir(path.join(root, 'lib/species/gecko'), { recursive: true });
  for (const file of await readdir(path.join(root, 'species/gecko/compiled'))) {
    if (/\.(?:js|d\.ts)$/.test(file)) await writeFile(path.join(root, 'lib/species/gecko', file), await readFile(path.join(root, 'species/gecko/compiled', file)));
  }
}
export async function buildGeckoDemo({ check = false } = {}) {
  const outputs = new Map();
  for (const file of ['index.html', 'styles.css']) {
    let text = await readFile(path.join(root, 'species/gecko', file), 'utf8');
    if (file === 'index.html') text = text.replace('compiled/demo.js', 'runtime/species/gecko/demo.js').replace('href="../../"', 'href="../index.html"').replace('href="README.md"', 'href="https://github.com/castlemilk/ascii-animals/blob/main/docs/GECKO-API.md"');
    outputs.set(`dist/gecko/${file}`, text);
  }
  for (const folder of ['species/gecko', 'core', 'public']) {
    for (const file of await readdir(path.join(root, 'lib', folder))) {
      if (!file.endsWith('.js') || (folder === 'public' && file !== 'gecko.js')) continue;
      let text = await readFile(path.join(root, 'lib', folder, file), 'utf8');
      if (folder === 'species/gecko' && file === 'demo.js') text = text.replace("import { mountGecko } from './browser.js';", "import { createGeckoArtwork as mountGecko } from '../../public/gecko.js';");
      outputs.set(`dist/gecko/runtime/${folder}/${file}`, text);
    }
  }
  for (const [file, text] of outputs) {
    const target = path.join(root, file);
    if (check) { if (await readFile(target, 'utf8') !== text) throw new Error(`${file} is stale`); }
    else { await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, text); }
  }
  return { entry: 'dist/gecko/index.html', files: outputs.size };
}
