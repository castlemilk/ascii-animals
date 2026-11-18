#!/usr/bin/env node
/** Species-local compiler invocation; no install, package/root edit, or network. */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
let compiler=process.env.FROG_TSC;
if(!compiler){try{compiler=require.resolve('typescript/lib/tsc.js');}catch{throw new Error('Use installed TypeScript 5.9.3. Set FROG_TSC=/absolute/path/to/typescript/lib/tsc.js, or install TypeScript in your development environment. No dependency is downloaded by this script.');}}
for(const config of ['../tsconfig.json','../tests/tsconfig.json']){
  const result=spawnSync(process.execPath,[compiler,'--project',fileURLToPath(new URL(config,import.meta.url))],{stdio:'inherit'});
  if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1);
}
console.log('Frog TypeScript source and emitted-declaration consumers passed.');
