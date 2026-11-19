import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Deterministic opt-in study preview. Build the repository first; embed exact modules.
// --public-preview supplies local catalogue links, not a deployment action.
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const outAt = process.argv.indexOf('--out');
if (outAt < 0 || !process.argv[outAt + 1]) throw new Error('Usage: node scripts/build-cuttlefish-study-preview.mjs --out /absolute/path/preview.html');
const output = path.resolve(process.argv[outAt + 1]);
const modules = new Map();
const sources = [];
const sha = text => createHash('sha256').update(text).digest('hex');
async function embed(filename) {
  if (modules.has(filename)) return modules.get(filename);
  if (!filename.startsWith(root + path.sep)) throw new Error('Preview dependencies must remain inside this checkout.');
  const original = await readFile(filename, 'utf8');
  let source = original;
  const imports = [...original.matchAll(/\bfrom\s+(['"])(\.[^'"]+)\1/g)];
  for (const match of imports) {
    const dependency = path.resolve(path.dirname(filename), match[2]);
    const url = await embed(dependency);
    source = source.replace(match[0], `from '${url}'`);
  }
  sources.push({ path: path.relative(root, filename), sha256: sha(original), bytes: Buffer.byteLength(original) });
  const url = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
  modules.set(filename, url);
  return url;
}

const demo = path.join(root, 'examples/cuttlefish-study');
const html = await readFile(path.join(demo, 'index.html'), 'utf8');
const css = await readFile(path.join(demo, 'study.css'), 'utf8');
const entry = await embed(path.join(demo, 'study.mjs'));
const result = html
  .replace('<link rel="stylesheet" href="study.css">', `<style>${css}</style>`)
  .replace('<script type="module" src="study.mjs"></script>', `<script type="module" src="${entry}"></script>`)
  .replaceAll('../../dist/index.html', process.argv.includes('--public-preview') ? 'index.html' : 'https://castlemilk.github.io/ascii-animals/')
  .replaceAll('../../dist/cuttlefish-demo.html', process.argv.includes('--public-preview') ? 'cuttlefish-demo.html' : 'https://castlemilk.github.io/ascii-animals/cuttlefish-demo.html');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, result);
const receipt = { output: path.relative(root, output), sha256: sha(result), bytes: Buffer.byteLength(result),
  type: 'self-contained local HTML preview', browserVerified: false,
  sources: sources.sort((a, b) => a.path.localeCompare(b.path)) };
await writeFile(output + '.manifest.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
