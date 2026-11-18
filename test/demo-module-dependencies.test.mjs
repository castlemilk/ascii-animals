import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
function files(dir){return readdirSync(dir).flatMap(name=>{const p=path.join(dir,name);return statSync(p).isDirectory()?files(p):[p];});}
test('every generated demo relative static module dependency is shipped',()=>{
 let checked=0;
 for(const file of files(root).filter(p=>p.endsWith('.js'))){
  const source=readFileSync(file,'utf8');
  for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*)['"]([^'"]+)['"]/g)){
   const specifier=match[1];if(!specifier.startsWith('.'))continue;
   const dependency=path.resolve(path.dirname(file),specifier);
   assert(dependency.startsWith(root+path.sep)||dependency===root,`outside demo: ${file}: ${specifier}`);
   assert(existsSync(dependency),`missing demo module: ${file}: ${specifier}`);checked++;
  }
 }
 assert(checked>0,'must inspect actual module dependencies');
});
