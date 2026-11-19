/** Exact species-local solo preview. Native Canvas, not browser evidence. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const canvasModule = process.env.DRAGONFLY_CANVAS_MODULE || require.resolve('@napi-rs/canvas', { paths: [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || process.cwd(), process.cwd()] });
const { createCanvas } = await import(pathToFileURL(canvasModule));
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root=resolve(process.argv[2]), output=resolve(process.argv[3]), label=process.argv[4];
const {createDragonfly}=await import(pathToFileURL(resolve(root,'species/dragonfly/lib/model.js')));
const {rasterizeDragonfly,paintDragonfly,gridToText}=await import(pathToFileURL(resolve(root,'species/dragonfly/lib/preview.js')));
await mkdir(output,{recursive:true});
const manifest={label,kind:'native Canvas, exact solo source, no browser execution',seed:17,width:1174,height:640,cols:156,rows:68,frames:[],sourceSha256:{}};
for(const file of ['src/geometry.ts','src/preview.ts','lib/geometry.js','lib/preview.js']) manifest.sourceSha256[file]=createHash('sha256').update(await readFile(resolve(root,'species/dragonfly',file))).digest('hex');
for(const view of ['dorsal','oblique']) for(const neutral of [false,true]) {
  const model=createDragonfly({seed:17,motion:'static'});
  model.setStaticPose(0);
  const geometry=model.sample(), grid=rasterizeDragonfly(geometry,{cols:156,rows:68,view,neutral});
  const canvas=createCanvas(1174,640), ctx=canvas.getContext('2d');
  paintDragonfly(ctx,grid,{width:1174,height:640,dpr:1,neutral});
  const file=`${label}-native-solo-${view}${neutral?'-neutral':''}`;
  await writeFile(resolve(output,file+'.png'),canvas.toBuffer('image/png'));
  await writeFile(resolve(output,file+'.txt'),gridToText(grid)+'\n');
  manifest.frames.push({file:file+'.png',view,neutral,motion:'static',pose:0,tick:0,samples:geometry.samples.length,occupied:grid.occupied,clippedSamples:grid.clippedSamples});
  canvas.width=1;canvas.height=1;model.dispose();
}
await writeFile(resolve(output,`${label}-native-solo-manifest.json`),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest.frames));
