/** Native evidence layout and normal-speed encoding; never a browser mockup. */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createCanvas, loadImage } from './native-host.mjs';

const out = fileURLToPath(new URL('../evidence/native/', import.meta.url));
const bg = '#071c19', cream = '#f5edcc', lime = '#cbe75c';
const outputs = [];
async function save(canvas, name) {
  const buffer = canvas.toBuffer('image/png'); await writeFile(resolve(out, name), buffer);
  outputs.push({ file: name, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') });
}
function label(ctx, value, x, y, color = cream, size = 14) { ctx.fillStyle = color; ctx.font = `${size}px "Liberation Mono"`; ctx.textBaseline = 'top'; ctx.fillText(value, x, y); }
function surface(width, height) { const canvas = createCanvas(width, height), ctx = canvas.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height); return { canvas, ctx }; }

for (const viewport of ['desktop', 'phone']) {
  const manifests = await Promise.all(['original','spring-pea-r2'].map(renderer => readFile(resolve(out, `${renderer}-${viewport}-manifest.json`), 'utf8').then(JSON.parse)));
  const [width, height] = manifests[0].dimensions;
  if (JSON.stringify(manifests[0].settings) !== JSON.stringify(manifests[1].settings)) throw new Error('Unmatched scene settings');
  for (const name of ['rest', 'silhouette', 'still-hunt']) {
    const { canvas, ctx } = surface(width * 2 + 54, height + 116);
    label(ctx, `FROG / ${name.toUpperCase()} / ${viewport.toUpperCase()}-SIZED CANVAS`, 18, 16, cream, 16);
    label(ctx, 'ACTUAL NATIVE RENDERERS - NOT BROWSER EVIDENCE', 18, 43, '#a0b4a8', 12);
    label(ctx, 'ORIGINAL / MAIN 3b5ffcce / seed 23', 18, 70, cream, 12);
    label(ctx, 'SPRING PEA R2 / seed 23', width + 36, 70, lime, 12);
    for (let i = 0; i < 2; i++) {
      const renderer = i ? 'spring-pea-r2' : 'original';
      const image = await loadImage(resolve(out, `${renderer}-${viewport}-${name}.png`));
      ctx.drawImage(image, 18 + i * (width + 18), 96);
    }
    await save(canvas, `matched-${viewport}-${name}.png`);
  }
  // No pixel scaling: this is a crop of the initial character area at source size.
  const rx = 0, ry = Math.floor(height * .30), rw = Math.floor(width * .60), rh = Math.floor(height * .55);
  const crop = surface(rw * 2 + 54, rh + 88);
  label(crop.ctx, `CHARACTER CROPS / ${viewport.toUpperCase()} / SOURCE PIXELS`, 18, 14, cream, 14);
  label(crop.ctx, 'ORIGINAL', 18, 43, cream, 12); label(crop.ctx, 'SPRING PEA R2', rw + 36, 43, lime, 12);
  for (let i = 0; i < 2; i++) {
    const image = await loadImage(resolve(out, `${i ? 'spring-pea-r2' : 'original'}-${viewport}-rest.png`));
    crop.ctx.drawImage(image, rx, ry, rw, rh, 18 + i * (rw + 18), 69, rw, rh);
  }
  await save(crop.canvas, `matched-${viewport}-character-crops.png`);

  for (const moment of ['leap', 'hunt']) {
    const beforeTimeline = JSON.parse(await readFile(resolve(out, `original-${viewport}-${moment}-timeline.json`), 'utf8'));
    const afterTimeline = JSON.parse(await readFile(resolve(out, `spring-pea-r2-${viewport}-${moment}-timeline.json`), 'utf8'));
    if (JSON.stringify(beforeTimeline.eventLog) !== JSON.stringify(afterTimeline.eventLog)) throw new Error('Unmatched event logs');
    if (beforeTimeline.frames.length !== afterTimeline.frames.length) throw new Error('Unmatched frame counts');
    const pickedTicks = moment === 'leap' ? [36, 50, 70, 85, 104, 182] : [46, 86, 176, 190, 220, 248];
    const cellWidth = viewport === 'desktop' ? 450 : width, cellHeight = Math.round(height * cellWidth / width);
    const sheet = surface(cellWidth * 3 + 72, (cellHeight + 42) * 2 + 100);
    label(sheet.ctx, `SPRING PEA R2 / ${moment.toUpperCase()} / NATIVE CANVAS`, 18, 15, cream, 16);
    label(sheet.ctx, 'Sampled poses only. Normal-speed clips are separate. Not browser evidence.', 18, 43, '#a0b4a8', 12);
    for (let i = 0; i < pickedTicks.length; i++) {
      const tick = pickedTicks[i], x = 18 + (i % 3) * (cellWidth + 18), y = 76 + Math.floor(i / 3) * (cellHeight + 42);
      const image = await loadImage(resolve(out, `spring-pea-r2-${viewport}-${moment}-tick-${tick}.png`));
      sheet.ctx.drawImage(image, x, y, cellWidth, cellHeight);
      label(sheet.ctx, `tick ${tick}`, x, y + cellHeight + 10, cream, 13);
    }
    await save(sheet.canvas, `spring-pea-r2-${viewport}-${moment}-contact-sheet.png`);

    const pattern = renderer => resolve(out, `${renderer}-${viewport}-${moment}-frames/%04d.png`);
    const font = '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf';
    const pad = renderer => `pad=iw:ih+72:0:72:color=0x071c19,drawtext=fontfile=${font}:text='${renderer} / ${moment.toUpperCase()} / 1x':x=14:y=14:fontsize=14:fontcolor=0xf5edcc,drawtext=fontfile=${font}:text='NATIVE CANVAS - NOT BROWSER':x=14:y=39:fontsize=11:fontcolor=0xa0b4a8`;
    const matchedName = `matched-${viewport}-${moment}-normal-speed.mp4`;
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '30', '-i', pattern('original'), '-framerate', '30', '-i', pattern('spring-pea-r2'), '-filter_complex', `[0:v]${pad('ORIGINAL')}[left];[1:v]${pad('SPRING PEA R2')}[right];[left][right]hstack=inputs=2,pad=ceil(iw/2)*2:ceil(ih/2)*2`, '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', resolve(out, matchedName)]);
    const soloName = `spring-pea-r2-${viewport}-${moment}-normal-speed.mp4`;
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '30', '-i', pattern('spring-pea-r2'), '-vf', `${pad('SPRING PEA R2')},pad=ceil(iw/2)*2:ceil(ih/2)*2`, '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', resolve(out, soloName)]);
    for (const name of [matchedName, soloName]) {
      const buffer = await readFile(resolve(out, name));
      const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,avg_frame_rate,nb_frames,duration', '-of', 'json', resolve(out, name)], { encoding: 'utf8' }));
      const stream = probe.streams[0];
      if (stream.avg_frame_rate !== '30/1' || Number(stream.nb_frames) !== afterTimeline.frames.length) throw new Error(`Unexpected playback rate/count: ${name}`);
      outputs.push({ file: name, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex'), ...stream, eventLog: afterTimeline.eventLog });
    }
  }
}
await writeFile(resolve(out, 'composed-manifest.json'), JSON.stringify({ kind: 'Native Canvas composites and explicit-tick 30fps encoding; not browser capture', outputs }, null, 2) + '\n');
console.log(JSON.stringify({ outputs: outputs.length, out }, null, 2));
