import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
test('optional authored marine studies remain discoverable without replacing stable studies',async()=>{
 const catalogue=await readFile(path.join(root,'dist/index.html'),'utf8');
 for(const href of ['cuttlefish-demo.html','animals.html?species=manta','octopus-den.html','manta-reef.html','cuttlefish-study.html']) assert(catalogue.includes(`href="${href}"`));
 const manta=await readFile(path.join(root,'dist/manta-reef.html'),'utf8');
 const cuttlefish=await readFile(path.join(root,'dist/cuttlefish-study.html'),'utf8');
 assert(manta.includes('href="animals.html?species=manta"'));
 assert(cuttlefish.includes('href="index.html"'));
 assert(cuttlefish.includes('href="cuttlefish-demo.html"'));
 for(const html of [manta,cuttlefish]){
  assert(!/\/Users\/|\/home\/oai|libfile_|chatgpt\.com\/library/.test(html));
  assert(/<button\b/.test(html)); assert(/<label\b/.test(html));
 }
});
test('both published optional previews reproduce exactly from their owned source and built renderer',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'marine-preview-'));
 try{
  for(const species of ['manta','cuttlefish']){
   const output=path.join(dir,`${species}.html`);
   const args=species==='manta' ? ['species/manta/scripts/build-study.mjs',`--out=${output}`,'--public-preview'] : ['scripts/build-cuttlefish-study-preview.mjs','--out',output,'--public-preview'];
   execFileSync(process.execPath,args,{cwd:root,stdio:'pipe'});
   const target=species==='manta'?'manta-reef.html':'cuttlefish-study.html';
   assert.equal(await readFile(output,'utf8'),await readFile(path.join(root,'dist',target),'utf8'));
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});
