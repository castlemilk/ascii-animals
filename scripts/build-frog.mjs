import {execFileSync} from 'node:child_process';
import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
export async function buildFrogPackage(){
 execFileSync(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'-p',path.join(root,'species/frog/tsconfig.json')],{stdio:'inherit'});
 const out=path.join(root,'lib/species/frog');await mkdir(out,{recursive:true});
 for(const n of await readdir(path.join(root,'species/frog/generated'))){if(/\.(?:mjs|d\.mts)$/.test(n)&&!n.startsWith('demo.'))await writeFile(path.join(out,n),await readFile(path.join(root,'species/frog/generated',n)));}
}
export async function buildFrogDemo({check=false}={}){
 const files=new Map();
 let html=await readFile(path.join(root,'species/frog/demo/index.html'),'utf8');
 html=html.replace('  <script src="../../../dist/artwork.js"></script>','').replace('../generated/demo.mjs','demo.mjs').replace('../evidence/frog-poster.png','frog-poster.png').replace('href="#study"','href="../index.html"');
 files.set('index.html',html);files.set('styles.css',await readFile(path.join(root,'species/frog/demo/styles.css')));files.set('frog-poster.png',await readFile(path.join(root,'species/frog/evidence/frog-poster.png')));
 let demo=await readFile(path.join(root,'species/frog/generated/demo.mjs'),'utf8');demo=demo.replace("import { mountFrog } from './controller.mjs';","import { createFrogArtwork as mountFrog } from './runtime/public/frog.js';");files.set('demo.mjs',demo);
 for(const folder of ['species/frog','core','public'])for(const n of await readdir(path.join(root,'lib',folder))){if(!/\.(?:js|mjs)$/.test(n)||(folder==='public'&&n!=='frog.js'))continue;files.set(`runtime/${folder}/${n}`,await readFile(path.join(root,'lib',folder,n)));}
 for(const [name,data] of files){const dest=path.join(root,'dist/frog',name);if(check){if(!Buffer.from(await readFile(dest)).equals(Buffer.from(data)))throw new Error(`Stale ${dest}`);}else{await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,data);}}
 return {entry:'dist/frog/index.html',files:files.size};
}
