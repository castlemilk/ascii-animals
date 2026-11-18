import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
export async function buildSeahorseDemo({check=false}={}){
 const files=new Map();
 for(const name of ['index.html','styles.css','demo.js'])files.set(`dist/seahorse/${name}`,await readFile(path.join(root,'species/seahorse/demo',name),'utf8'));
 for(const name of ['public/seahorse.js','core/scheduler.js'])files.set(`dist/seahorse/runtime/${name}`,await readFile(path.join(root,'lib',name),'utf8'));
 for(const [name,text]of files){const file=path.join(root,name);if(check){if(await readFile(file,'utf8')!==text)throw new Error(`${name} stale`);}else{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,text);}}
 return {entry:'dist/seahorse/index.html',files:files.size};
}
