/** Export a local, self-contained review file. This does not publish or deploy anything. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const out=path.resolve(process.argv[2]??'artifacts/seahorse-director-preview.html');
const read=p=>readFile(path.join(root,p),'utf8');
const [html,css,demo,runtime,scheduler]=await Promise.all([
 read('species/seahorse/demo/index.html'),read('species/seahorse/demo/styles.css'),read('species/seahorse/demo/demo.js'),
 read('lib/public/seahorse.js'),read('src/core/scheduler.js')
]);
const local=runtime.replace(/^import .*scheduler\.js['"];\r?\n/m,'').replace(/^export /gm,'').replace(/^\/\/# sourceMappingURL=.*$/gm,'');
const code=`const {createSeahorseArtwork}=(()=>{\n${scheduler.replace(/^export /gm,'')}\n${local}\nreturn {createSeahorseArtwork};\n})();\n${demo.replace(/^import .*;\r?\n/m,'')}`;
new vm.Script(code,{filename:'seahorse-inline-review.js'}); // Syntax only: no DOM execution claim.
if(/^\s*import\s/m.test(code))throw new Error('Review preview contains an unresolved import');
const result=html.replace('<link rel="stylesheet" href="styles.css">',`<style>${css}</style>`)
 .replace('<script type="module" src="demo.js"></script>',`<script type="module">${code.replaceAll('</script','<\\/script')}</script>`)
 .replaceAll('href="../index.html"','href="https://castlemilk.github.io/ascii-animals/"');
await mkdir(path.dirname(out),{recursive:true});await writeFile(out,result);
console.log(JSON.stringify({output:out,bytes:Buffer.byteLength(result),syntax:'passed',browser:'not executed by exporter'}));
