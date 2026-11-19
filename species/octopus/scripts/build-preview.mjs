import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--out')) throw new Error('Usage: node species/octopus/scripts/build-preview.mjs [--out FILE]');
const output = args.length ? path.resolve(args[1]) : path.resolve(root, '../octopus-delivery/octopus-den-preview.html');
const inputPaths = ['src/core/scheduler.js', 'src/animals/manta.js', 'src/animals/octopus.js', 'src/animals/cuttlefish.js',
  'species/octopus/preview.html', 'species/octopus/preview.css', 'species/octopus/preview.js'];
const contents = await Promise.all(inputPaths.map(file => readFile(path.join(root, file), 'utf8')));
const sourceHash = createHash('sha256').update(inputPaths.map((file, i) => file + '\0' + contents[i]).join('\0')).digest('hex');

// Match the bounded classic generator's supported source shape. This emits a
// separate review file; it never regenerates shared dist or package outputs.
const scheduler = contents[0].replace(/^export (?=function )/gm, '');
const species = contents.slice(1, 3).map(source => source.replace(/^export (?=const )/gm, '')).join('\n');
let engine = contents[3];
for (const statement of ["import { getBrowserScheduler } from '../core/scheduler.js';",
  "import { mantaDefinition } from './manta.js';", "import { octopusDefinition } from './octopus.js';"]) {
  if (!engine.includes(statement)) throw new Error('Canonical marine import shape changed; review the standalone generator.');
  engine = engine.replace(statement, '');
}
engine = engine.replace(/^export (?=(?:class|function) )/gm, '');
if (/^\s*(?:import|export)\s/m.test(scheduler + species + engine)) throw new Error('Unsupported source dependency in the standalone review build.');
const previewImport = "import { CuttlefishArtwork } from '../../lib/animals/cuttlefish.js';";
if (!contents[6].startsWith(previewImport)) throw new Error('Octopus module preview import shape changed.');
const preview = contents[6].replace(previewImport, '');
if (/^\s*import\s/m.test(preview)) throw new Error('The standalone preview cannot contain external module imports.');
const script = `// Exact-source octopus review; source-sha256: ${sourceHash}\n${scheduler}\n${species}\n${engine}\n${preview}`;
let html = contents[4];
const cssTag = '<link rel="stylesheet" href="./preview.css">';
const jsTag = '<script type="module" src="./preview.js"></script>';
if (!html.includes(cssTag) || !html.includes(jsTag)) throw new Error('Octopus preview template entry points changed.');
html = html.replace(cssTag, () => '<style>\n' + contents[5] + '\n</style>')
  .replace(jsTag, () => '<script type="module" data-octopus-source>\n' + script.replace(/<\/script/gi, '<\\/script') + '\n</script>')
  .replace('</head>', `<meta name="octopus-source-sha256" content="${sourceHash}">\n</head>`);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, html);
console.log(JSON.stringify({ output, sourceSha256: sourceHash, bytes: Buffer.byteLength(html),
  inputs: inputPaths, runtimeDependencies: 0, sharedOutputsWritten: false, browserVerified: false }, null, 2));
