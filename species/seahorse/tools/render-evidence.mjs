/** Render actual model output to portable SVG and a bounded replay log. No browser/FPS claim. */
import {createSeahorseModel} from '../../../lib/public/seahorse.js';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
const output = path.resolve(process.argv[2] ?? 'species/seahorse/evidence/frames');
await mkdir(output, {recursive:true});
const cases = [
 ['garden-arrival', 'Kelp garden · arrival', {scene:'kelp-garden',count:3}, .08],
 ['garden-rest', 'Kelp garden · independent lives', {scene:'kelp-garden',count:3}, .42],
 ['garden-release', 'Kelp garden · letting go', {scene:'kelp-garden',count:3}, .73],
 ['garden-return', 'Kelp garden · coming home', {scene:'kelp-garden',count:3}, .93],
 ['duet-rest', 'Tidal duet · a rising phrase', {scene:'tidal-duet',count:2,palette:'rose'}, .42],
 ['solo-drift', 'Solitary passage · inspect the clearing', {scene:'drift-passage',count:1,palette:'lagoon'}, .42],
 ['duet-four', 'Four visitors · paired composition', {scene:'tidal-duet',count:4,palette:'rose'}, .42],
 ['mobile-garden', 'Compact grid · 100 × 76', {scene:'kelp-garden',count:3,columns:100}, .42],
];
function snapshot(model) {
 const frame=model.frame();
 return {options:model.getOptions(),tick:model.getState().tick,director:model.getDirectorState(),columns:frame.columns,rows:frame.rows,text:frame.text,tones:frame.cells.map(c=>c.tone),layers:frame.cells.map(c=>c.layer??'animal')};
}
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function svg(s,title) {
 const cw=7,ch=12.5,top=58,w=s.columns*cw+32,h=s.rows*ch+top+32;
 const palette=s.options.palette==='brass'?[232,185,105]:s.options.palette==='lagoon'?[119,218,204]:[227,154,180];
 const glyphs=s.text.replaceAll('\n','');
 const lines=[`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#09151b"/><text x="20" y="26" fill="#e5c48b" font-size="18" font-family="DejaVu Sans, sans-serif">${escape(title)}</text><text x="20" y="44" fill="#8ba6ac" font-size="10" font-family="DejaVu Sans, sans-serif">Actual logical frame · offline font rasterization · browser acceptance pending</text><g text-anchor="middle" dominant-baseline="central" font-family="DejaVu Sans Mono, monospace" font-size="11.5">`];
 for(let i=0;i<glyphs.length;i++)if(glyphs[i]!==' '){const rgb=s.layers[i]==='kelp'?[94,155,132]:s.layers[i]==='water'?[65,102,112]:palette;const b=.28+s.tones[i]/12;lines.push(`<text x="${16+(i%s.columns+.5)*cw}" y="${top+(Math.floor(i/s.columns)+.5)*ch}" fill="rgb(${rgb.map(c=>Math.min(255,Math.round(c*b))).join(',')})">${escape(glyphs[i])}</text>`);}
 lines.push('</g></svg>');return lines.join('');
}
const manifest=[];
for(const [id,title,options,progress] of cases){const model=createSeahorseModel({columns:160,rows:76,labels:true,behavior:'curious',...options});model.direct({type:'seek',progress});const data=snapshot(model);await writeFile(path.join(output,id+'.svg'),svg(data,title));await writeFile(path.join(output,id+'.json'),JSON.stringify(data));manifest.push({id,title,progress,options:data.options,svg:id+'.svg',json:id+'.json'});}
// One complete 28-second cycle at 12 sampled frames/second, with targeted input and recovery.
const replayModel=createSeahorseModel({scene:'kelp-garden',count:3,columns:120,rows:64,labels:true,seed:7});
const replay=[];
for(let i=0;i<336;i++){
 if(i===84){replayModel.direct({type:'select',id:1});replayModel.guide(-.3,-.3);replayModel.direct({type:'inspect'});}
 if(i===168){replayModel.clearGuide();replayModel.direct({type:'startle',id:0});}
 replay.push(snapshot(replayModel));replayModel.advanceTicks(5);
}
await writeFile(path.join(output,'replay.json'),JSON.stringify({fps:12,duration:28,description:'Model replay, not a browser recording. Inspect visitor02 at7s; shelter visitor01 at14s.',frames:replay}));
await writeFile(path.join(output,'manifest.json'),JSON.stringify({representation:'Actual logical-cell output; SVG text rasterization is environment-specific. Not a browser capture.',cases:manifest},null,2)+'\n');
console.log(JSON.stringify({output,cases:manifest.length,replayFrames:replay.length,claim:'logical render evidence only'}));
