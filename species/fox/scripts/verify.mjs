#!/usr/bin/env node
/** One reproducible verification entry point. Does not publish or change branches. */
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const local=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(local,'../..');
const lines=[`Fox verification / Node ${process.version}`,`Base 0e446c47b491b751d484e40db753ec725652b515`];
const run=(command,args,cwd=local)=>{
  const r=spawnSync(command,args,{cwd,encoding:'utf8',env:{...process.env,NO_COLOR:'1',FORCE_COLOR:'0'}});
  lines.push('\n$ '+[command,...args].join(' '),r.stdout??'',r.stderr??'',`exit ${r.status}`);
  if(r.status!==0)throw new Error(`Failed: ${command} ${args.join(' ')}`);
};
async function libraryHashes(){
  const files=(await readdir(join(local,'lib'))).sort();const out={};
  for(const file of files)out[file]=createHash('sha256').update(await readFile(join(local,'lib',file))).digest('hex');
  return JSON.stringify(out);
}
await mkdir(join(local,'evidence'),{recursive:true});
try{
  const before=await libraryHashes();
  run(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.json']);
  if(before!==await libraryHashes())throw new Error('Generated lib files were stale; inspect generated changes and rerun.');
  lines.push('Generated JS/declarations match source rebuild.');
  run(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.types.json']);
  run(process.execPath,['--test',...(await readdir(join(local,'tests'))).filter(f=>f.endsWith('.test.mjs')).sort().map(f=>'tests/'+f)]);
  run(process.execPath,['--check','demo/demo.js']);
  run(process.execPath,['--check','scripts/render-evidence.mjs']);
  run(process.execPath,['--check','scripts/browser-smoke.mjs']);
  run(process.execPath,['scripts/check-engine.cjs'],repo);
  run(process.execPath,['--check','dist/artwork.js'],repo);
  run(process.execPath,['--check','dist/app.js'],repo);
  run('python3',['scripts/build-standalone.py'],repo);
  run('git',['diff','--exit-code','--','dist/'],repo);
  lines.push('\nPASS: fox/core/type/mock/preview checks and applicable existing regressions. Browser gate is separate.');
  console.log('Fox verification passed; full commands/output are in evidence/verification.log');
}catch(error){lines.push('\nFAIL: '+error.message);console.error(error.message);process.exitCode=1;}
finally{await writeFile(join(local,'evidence/verification.log'),lines.join('\n')+'\n');}
