import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
export async function buildPufferfishPackage() {
  execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(root, 'species/pufferfish/tsconfig.json')], { stdio: 'inherit' });
  const output = path.join(root, 'lib/species/pufferfish');
  await mkdir(output, { recursive: true });
  for (const file of await readdir(path.join(root, 'species/pufferfish/build'))) {
    if (/\.(?:js|d\.ts)$/.test(file) && !file.startsWith('demo.')) await writeFile(path.join(output, file), await readFile(path.join(root, 'species/pufferfish/build', file)));
  }
}
export async function buildPufferfishDemo({ check = false } = {}) {
  const outputs = new Map();
  let html = await readFile(path.join(root, 'species/pufferfish/index.html'), 'utf8');
  html = html.replace('  <script src="../../dist/artwork.js" defer></script>\n', '').replace('./build/demo.js', './demo.js').replace('../../dist/index.html', '../index.html').replace('./README.md', 'https://github.com/castlemilk/ascii-animals/blob/main/docs/PUFFERFISH-API.md');
  outputs.set('dist/pufferfish/index.html', html);
  outputs.set('dist/pufferfish/style.css', await readFile(path.join(root, 'species/pufferfish/style.css'), 'utf8'));
  let demo = await readFile(path.join(root, 'species/pufferfish/build/demo.js'), 'utf8');
  demo = demo.replace("import { mountPufferfish } from './controller.js';", "import { createPufferfishArtwork as mountPufferfish } from './runtime/public/pufferfish.js';")
    .replace(/        const legacy = window.CuttlefishArtwork;\n        if \(!legacy\)\n            throw new Error\([^\n]+\);\n/, '')
    .replace('mountPufferfish(canvas, legacy,', 'mountPufferfish(canvas,');
  if (/window.CuttlefishArtwork|canvas, legacy/.test(demo)) throw new Error('Pufferfish demo still depends on global renderer');
  outputs.set('dist/pufferfish/demo.js', demo);
  for (const folder of ['species/pufferfish', 'core', 'animals', 'public']) {
    for (const file of await readdir(path.join(root, 'lib', folder))) {
      if (!file.endsWith('.js') || (folder === 'public' && file !== 'pufferfish.js')) continue;
      outputs.set(`dist/pufferfish/runtime/${folder}/${file}`, await readFile(path.join(root, 'lib', folder, file), 'utf8'));
    }
  }
  for (const [name, content] of outputs) {
    const target = path.join(root, name);
    if (check) { if (await readFile(target, 'utf8') !== content) throw new Error(`${name} is stale; run npm run build`); }
    else { await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, content); }
  }
  return { entry: 'dist/pufferfish/index.html', files: outputs.size };
}
