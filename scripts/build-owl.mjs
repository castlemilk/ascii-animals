import {execFileSync} from 'node:child_process';
import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
export async function buildOwlPackage(){
 execFileSync(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'-p',path.join(root,'species/owl/tsconfig.json')],{stdio:'inherit'});
 const out=path.join(root,'lib/species/owl');await mkdir(out,{recursive:true});
 for(const n of await readdir(path.join(root,'species/owl/build')))if(/\.(?:js|d\.ts)$/.test(n))await writeFile(path.join(out,n),await readFile(path.join(root,'species/owl/build',n)));
}
export async function buildOwlDemo({check=false}={}){
 const files=new Map();
 for(const name of ['index.html','style.css','demo.mjs']){
  let text=await readFile(path.join(root,'species/owl/demo',name),'utf8');
  if(name==='index.html')text=text.replace('../../../README.md','../index.html');
  if(name==='demo.mjs')text=text.replace("import { mountOwl } from '../build/browser.js';","import { createOwlArtwork as mountOwl } from './runtime/public/owl.js';");
  files.set(name,text);
 }
 for(const folder of ['species/owl','core','public'])for(const name of await readdir(path.join(root,'lib',folder))){if(!name.endsWith('.js')||(folder==='public'&&name!=='owl.js'))continue;files.set(`runtime/${folder}/${name}`,await readFile(path.join(root,'lib',folder,name)));}
 for(const [name,data]of files){const target=path.join(root,'dist/owl',name);if(check){if(!Buffer.from(await readFile(target)).equals(Buffer.from(data)))throw new Error(`Stale ${target}`);}else{await mkdir(path.dirname(target),{recursive:true});await writeFile(target,data);}}
 return{entry:'dist/owl/index.html',files:files.size};
}
