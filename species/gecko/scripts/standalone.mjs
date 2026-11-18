/** Bundle only this species' own code into an offline review HTML file. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root=fileURLToPath(new URL('..',import.meta.url));
const {build,version}=await import(process.env.GECKO_ESBUILD_MODULE || 'esbuild');
const result=await build({entryPoints:[join(root,'compiled/demo.js')],bundle:true,write:false,
  format:'iife',platform:'browser',target:'es2022',minify:false,legalComments:'none'});
const js=result.outputFiles[0].text.replaceAll('</script','<\\/script');
const css=await readFile(join(root,'styles.css'),'utf8');
let html=await readFile(join(root,'index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="styles.css">',`<style>\n${css}\n</style>`)
  .replace(/^ *<script type="module" src="compiled\/demo.js"><\/script>\r?\n/m,'')
  .replace('</body>',`<!-- Generated from this species only; esbuild ${version}. -->\n<script>\n${js}\n</script>\n</body>`);
await writeFile(join(root,'gecko.html'),html);
console.log(`Built species/gecko/gecko.html (${Buffer.byteLength(html)} bytes), esbuild ${version}`);
