// Offline review artifact only; this does not deploy or modify the generated site.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const output=path.resolve(process.argv[2]||path.join(root,'artifacts/butterfly-garden-preview.html'));
const read=name=>readFile(path.join(root,name),'utf8');
const data=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
let main=await read('lib/public/butterfly.js');
for(const [specifier,file] of [
 ['../core/scheduler.js','lib/core/scheduler.js'],
 ['./butterfly/director.js','lib/public/butterfly/director.js'],
 ['./butterfly/render-garden.js','lib/public/butterfly/render-garden.js']
]){
 if(!main.includes(`'${specifier}'`))throw new Error(`Missing expected butterfly import ${specifier}`);
 main=main.replace(`'${specifier}'`,JSON.stringify(data(await read(file))));
}
const demo=(await read('species/butterfly/demo/demo.js')).replace("'./runtime/public/butterfly.js'",JSON.stringify(data(main)));
const css=await read('species/butterfly/demo/styles.css');
let html=await read('species/butterfly/demo/index.html');
html=html.replace('<link rel="stylesheet" href="styles.css">',`<style>${css}</style>`)
 .replace('<script type="module" src="demo.js"></script>',`<script type="module">${demo.replace(/<\/script/gi,'<\\/script')}</script>`)
 .replace('href="../index.html"','href="https://castlemilk.github.io/ascii-animals/"');
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,html);
console.log(JSON.stringify({output,bytes:Buffer.byteLength(html),kind:'self-contained review HTML; browser execution still requires acceptance'}));
