import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
export async function buildDemo({ check = false } = {}) {
  const inputs = ['src/core/scheduler.js', 'src/animals/cuttlefish.js'];
  const source = await Promise.all(inputs.map(file => readFile(path.join(root, file), 'utf8')));
  const hash = createHash('sha256').update(inputs.map((file, i) => file + '\0' + source[i]).join('\0')).digest('hex');
  // This bounded compatibility build accepts exactly the declared import and
  // named declarations, not arbitrary ESM. New dependency shapes must fail.
  const scheduler = source[0].replace(/^export (?=function )/gm, '');
  const animal = source[1].replace("import { getBrowserScheduler } from '../core/scheduler.js';", '').replace(/^export (?=(?:class|function) )/gm, '');
  if (/^\s*(?:import|export)\s/m.test(scheduler + animal)) throw new Error('Unsupported module shape in classic compatibility build');
  const engine = `// GENERATED from ${inputs.join(', ')}. Do not edit.\n// source-sha256: ${hash}\n(function () {\n'use strict';\n${scheduler}\n${animal}\nwindow.CuttlefishArtwork = CuttlefishArtwork;\nwindow.createCuttlefish = createCuttlefish;\n})();\n`;
  let html = await readFile(path.join(root, 'dist/index.html'), 'utf8');
  let css = await readFile(path.join(root, 'dist/styles.css'), 'utf8');
  const app = await readFile(path.join(root, 'dist/app.js'), 'utf8');
  css = css.replace(/@import\s+url\([^)]*\)\s*;\s*/, '');
  html = html.replace('<html lang="en">', '<html lang="en" data-standalone="true">')
    .replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>')
    .replace('  <script src="artwork.js" defer></script>\n', '')
    .replace('  <script src="app.js" defer></script>\n', '')
    .replace('</body>', '<script data-artwork-source>\n' + engine.replaceAll('</script', '<\\/script') + '\n</script>\n<script>\n' + app.replaceAll('</script', '<\\/script') + '\n</script>\n</body>');
  for (const [file, content] of [['dist/artwork.js', engine], ['dist/cuttlefish.html', html]]) {
    if (check) { if (await readFile(path.join(root, file), 'utf8') !== content) throw new Error(`${file} is stale; run npm run build`); }
    else await writeFile(path.join(root, file), content);
  }
  return { sourceSha256: hash, global: 'dist/artwork.js', standalone: 'dist/cuttlefish.html' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await buildDemo({ check: process.argv.includes('--check') })));
