import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
export async function buildDragonflyPackage() {
  execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(root, 'species/dragonfly/tsconfig.json')], { stdio: 'inherit' });
  await mkdir(path.join(root, 'lib/species/dragonfly'), { recursive: true });
  for (const file of await readdir(path.join(root, 'species/dragonfly/lib'))) {
    if (/\.(?:js|d\.ts)$/.test(file)) await writeFile(path.join(root, 'lib/species/dragonfly', file), await readFile(path.join(root, 'species/dragonfly/lib', file)));
  }
}
export async function buildDragonflyDemo({ check = false } = {}) {
  const outputs = new Map();
  for (const file of ['index.html', 'styles.css']) {
    let text = await readFile(path.join(root, 'species/dragonfly', file), 'utf8');
    if (file === 'index.html') text = text.replace('lib/demo.js', 'runtime/species/dragonfly/demo.js').replace('href="../../"', 'href="../index.html"').replace('href="README.md"', 'href="https://github.com/castlemilk/ascii-animals/blob/main/docs/DRAGONFLY-API.md"');
    outputs.set(`dist/dragonfly/${file}`, text);
  }
  for (const folder of ['species/dragonfly', 'core', 'public']) {
    for (const file of await readdir(path.join(root, 'lib', folder))) {
      if (!file.endsWith('.js') || (folder === 'public' && file !== 'dragonfly.js')) continue;
      let text = await readFile(path.join(root, 'lib', folder, file), 'utf8');
      if (folder === 'species/dragonfly' && file === 'demo.js') text = text.replace("import { mountDragonfly } from './browser.js';", "import { createDragonflyArtwork as mountDragonfly } from '../../public/dragonfly.js';");
      outputs.set(`dist/dragonfly/runtime/${folder}/${file}`, text);
    }
  }
  for (const [file, text] of outputs) {
    const target = path.join(root, file);
    if (check) { if (await readFile(target, 'utf8') !== text) throw new Error(`${file} is stale`); }
    else { await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, text); }
  }
  return { entry: 'dist/dragonfly/index.html', files: outputs.size };
}
