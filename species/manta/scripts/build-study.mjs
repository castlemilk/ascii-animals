// A species-owned, bounded local bundle of the actual built package and study.
// No package exports, shared generated entry, workflow, or deployment is edited.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');
const modules = new Map(), hashes = {};
const slash = value => value.split(path.sep).join('/');
async function visit(id) {
  if (modules.has(id)) return;
  if (id.startsWith('../') || !/\.(?:mjs|js)$/.test(id)) throw new Error(`Unsupported bundle input: ${id}`);
  const source = await readFile(path.join(root, id), 'utf8');
  hashes[id] = createHash('sha256').update(source).digest('hex');
  const dependencies = {};
  modules.set(id, null);
  for (const imported of ts.preProcessFile(source, true, true).importedFiles) {
    if (!imported.fileName.startsWith('.')) throw new Error(`The study must be self-contained: ${imported.fileName}`);
    const resolved = slash(path.normalize(path.join(path.dirname(id), imported.fileName)));
    dependencies[imported.fileName] = resolved;
    await visit(resolved);
  }
  const output = ts.transpileModule(source.replace(/^\/\/# sourceMappingURL=.*$/gm, ''), {
    // .mjs forces TypeScript to preserve ESM even with CommonJS requested.
    // Only the compiler's virtual filename changes; logical module IDs stay exact.
    fileName: id.replace(/\.mjs$/, '.cjs'), reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, allowJs: true, sourceMap: false }
  });
  const errors = (output.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error);
  if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, { getCurrentDirectory:()=>root, getCanonicalFileName:x=>x, getNewLine:()=> '\n' }));
  modules.set(id, { dependencies, code: output.outputText });
}
await visit('species/manta/study.mjs');
const wrappers = [...modules].map(([id, entry]) => `${JSON.stringify(id)}:[function(require,module,exports){\n${entry.code}\n},${JSON.stringify(entry.dependencies)}]`).join(',\n');
const bundle = `(function(){'use strict';const modules={${wrappers}};const cache={};function load(id){if(cache[id])return cache[id].exports;const item=modules[id];if(!item)throw new Error('Missing bundled module: '+id);const m={exports:{}};cache[id]=m;item[0](name=>load(item[1][name]),m,m.exports);return m.exports;}load('species/manta/study.mjs');})();`;
// Fail before emitting HTML if any module syntax survives the classic wrapper.
new Script(bundle, { filename: 'manta-reef.generated.js' });
const css = await readFile(path.join(root, 'species/manta/study.css'), 'utf8');
let html = await readFile(path.join(root, 'species/manta/index.html'), 'utf8');
for (const [id, source] of [['species/manta/study.css',css],['species/manta/index.html',html]]) hashes[id]=createHash('sha256').update(source).digest('hex');
const sourceSha256 = createHash('sha256').update(JSON.stringify(hashes)).digest('hex');
html = html.replace('<link rel="stylesheet" href="study.css">',()=>`<style>\n${css}\n</style>`)
  .replace('href="../../dist/animals.html?species=manta"',process.argv.includes('--public-preview') ? 'href="animals.html?species=manta"' : 'href="https://github.com/castlemilk/ascii-animals"')
  .replace('<script type="module" src="study.mjs"></script>',()=>`<!-- Generated manta study; source-sha256: ${sourceSha256} -->\n<script data-manta-bundle>\n${bundle.replaceAll('</script','<\\/script')}\n</script>`);
const argument = process.argv.find(arg=>arg.startsWith('--out='));
const output = path.resolve(root, argument ? argument.slice(6) : 'artifacts/manta-reef.html');
if (process.argv.includes('--check')) {
  if (await readFile(output,'utf8') !== html) throw new Error('The manta study bundle is stale.');
} else { await mkdir(path.dirname(output),{recursive:true}); await writeFile(output,html); }
console.log(JSON.stringify({output,sourceSha256,modules:modules.size,bytes:Buffer.byteLength(html),inputs:hashes},null,2));
