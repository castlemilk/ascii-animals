/** Reproduce the bounded review gates from the repository root. No install or network writes. */
import {spawnSync} from 'node:child_process';
import {mkdirSync,readdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const out=path.join(root,'species/owl/evidence/director');mkdirSync(out,{recursive:true});
const tests=dir=>readdirSync(path.join(root,dir)).filter(f=>f.endsWith('.test.mjs')).sort().map(f=>`${dir}/${f}`);
const checks=[
 ['build',process.execPath,['scripts/build.mjs']],
 ['root-types',process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.json','--noEmit']],
 ['owl-types',process.execPath,['node_modules/typescript/bin/tsc','-p','species/owl/tsconfig.types.json']],
 ['owl-tests',process.execPath,['--test','--test-reporter=tap',...tests('species/owl/tests')]],
 ['repository-tests',process.execPath,['--test','--test-reporter=tap',...tests('test')]],
 ['cuttlefish-regression',process.execPath,['scripts/check-engine.cjs']],
 ['catalogue',process.env.PYTHON??'python3',['scripts/check-catalogue.py']],
 ['generated-demo-syntax',process.execPath,['--check','dist/owl/demo.mjs']],
];
const manifest={schemaVersion:1,node:process.version,startedAt:new Date().toISOString(),
 evidenceKinds:{core:'real generated JavaScript and original geometry/sampler',host:'simulated DOM, frames, observers and events with real Owl runtime',demoControls:'bubbling DOM stub; not native browser',visual:'executed ASCII rasterized with Pillow',nativeBrowser:'live baseline inspected; revised localhost refused connection',performance:'unmeasured'},checks:[]};
for(const [name,command,args]of checks){
 const start=Date.now(),result=spawnSync(command,args,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
 const output=(result.stdout??'')+(result.stderr??'')+(result.error?String(result.error):'');
 writeFileSync(path.join(out,`${name}.log`),output);
 const entry={name,command:[path.basename(command),...args],exitCode:result.status,durationMs:Date.now()-start,log:`${name}.log`};
 manifest.checks.push(entry);writeFileSync(path.join(out,'validation-run.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(`${name}: ${result.status===0?'PASS':'FAIL'} (${entry.durationMs}ms; ${entry.log})`);
 if(result.status!==0)process.exit(result.status??1);
}
manifest.finishedAt=new Date().toISOString();
writeFileSync(path.join(out,'validation-run.json'),JSON.stringify(manifest,null,2)+'\n');
