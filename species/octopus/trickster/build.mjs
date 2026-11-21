import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here=path.dirname(fileURLToPath(import.meta.url));
const output=path.resolve(process.argv[2] || path.join(here,'../../../../octopus-delivery/pocket-trickster.html'));
const inputs=['../../../src/core/scheduler.js','core.mjs','render.mjs','browser.mjs','preview.mjs','style.css','index.html'];
const contents=await Promise.all(inputs.map(p=>readFile(path.resolve(here,p),'utf8')));
const sourceSha256=createHash('sha256').update(inputs.map((p,i)=>p+'\0'+contents[i]).join('\0')).digest('hex');
const scripts=contents.slice(0,5).map(source=>source.replace(/^import[^;]+;\s*/gm,'').replace(/^export (?=(?:const|let|function|class) )/gm,'').replace(/^export\s*\{[^}]*\};?\s*/gm,''));
if(scripts.some(s=>/^\s*(?:import|export)\s/m.test(s)))throw new Error('Unsupported bundle module shape; inspect imports.');
// Each module gets its own scope to preserve local helper names. Explicit public
// bindings connect the reviewed core, grid renderer and lifecycle wrapper.
const scheduler=`const {getBrowserScheduler} = (()=>{${scripts[0]}\nreturn {getBrowserScheduler};})();`;
const core=`const {TICK_RATE,SPECIES_VERSION,createOctopusState,stepOctopus,sampleOctopus,resetOctopus} = (()=>{${scripts[1]}\nreturn {TICK_RATE,SPECIES_VERSION,createOctopusState,stepOctopus,sampleOctopus,resetOctopus};})();`;
const render=`const {PALETTE,gridMetrics,rasterizeOctopus,gridToText,renderOctopus} = (()=>{${scripts[2]}\nreturn {PALETTE,gridMetrics,rasterizeOctopus,gridToText,renderOctopus};})();`;
const browser=`const {createOctopusTrickster} = (()=>{${scripts[3]}\nreturn {createOctopusTrickster};})();`;
const js=[scheduler,core,render,browser,scripts[4]].join('\n');
for(const tag of ['<link rel="stylesheet" href="./style.css">','<script type="module" src="./preview.mjs"></script>','</head>'])
 if(!contents[6].includes(tag))throw new Error(`Standalone template is missing required entry: ${tag}`);
let html=contents[6].replace('<link rel="stylesheet" href="./style.css">',()=>`<style>${contents[5]}</style>`)
 .replace('<script type="module" src="./preview.mjs"></script>',()=>`<script type="module">${js.replace(/<\/script/gi,'<\\/script')}</script>`)
 .replace('</head>',`<meta name="octopus-source-sha256" content="${sourceSha256}"></head>`);
await mkdir(path.dirname(output),{recursive:true});await writeFile(output,html);
console.log(JSON.stringify({output,bytes:Buffer.byteLength(html),sourceSha256,inputs,runtimeDependencies:0,publication:false},null,2));
