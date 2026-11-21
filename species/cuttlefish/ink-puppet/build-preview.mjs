/** Build a local, self-contained review file. No installation or publication. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../../..');
const at=process.argv.indexOf('--out');
if(at<0||!process.argv[at+1])throw new Error('Usage: node species/cuttlefish/ink-puppet/build-preview.mjs --out /absolute/path/ink-puppet.html');
const output=path.resolve(process.argv[at+1]),modules=new Map(),sources=[];
const sha=text=>createHash('sha256').update(text).digest('hex');
async function embed(filename){
  if(modules.has(filename))return modules.get(filename);
  if(!filename.startsWith(root+path.sep))throw new Error('Preview dependencies must remain in checkout');
  const original=await readFile(filename,'utf8');let source=original;
  for(const match of original.matchAll(/\bfrom\s+(['"])(\.[^'"]+)\1/g)){
    const url=await embed(path.resolve(path.dirname(filename),match[2]));source=source.replace(match[0],`from '${url}'`);
  }
  const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
  modules.set(filename,url);sources.push({path:path.relative(root,filename),sha256:sha(original)});return url;
}
const html=await readFile(path.join(here,'index.html'),'utf8'),css=await readFile(path.join(here,'style.css'),'utf8');
const entry=await embed(path.join(here,'page.mjs'));
let result=html.replace('<link rel="stylesheet" href="./style.css">',`<style>${css}</style>`)
  .replace('<script type="module" src="./page.mjs"></script>',`<script type="module" src="${entry}"></script>`);
for(const filename of ['CONCEPTS.md','AUTHORING.md','REVIEW.md']){
  const original=await readFile(path.join(here,filename),'utf8');
  const url='data:text/plain;charset=utf-8;base64,'+Buffer.from(original).toString('base64');
  result=result.replaceAll(`href="./${filename}"`,`href="${url}" download="${filename}"`);
  sources.push({path:path.relative(root,path.join(here,filename)),sha256:sha(original)});
}
sources.push({path:path.relative(root,path.join(here,'index.html')),sha256:sha(html)},
  {path:path.relative(root,path.join(here,'style.css')),sha256:sha(css)});
await mkdir(path.dirname(output),{recursive:true});await writeFile(output,result);
const receipt={output,sha256:sha(result),bytes:Buffer.byteLength(result),kind:'self-contained HTML; exact source modules',sources};
await writeFile(output+'.manifest.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
