#!/usr/bin/env python3
"""Label/composite actual native captures. No invented browser chrome or UI.
Requires Pillow; movie encoding additionally requires ffmpeg. Originals stay intact.
"""
import argparse
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

p = argparse.ArgumentParser()
p.add_argument('--input', type=Path, required=True)
p.add_argument('--out', type=Path, required=True)
p.add_argument('--movies', action='store_true')
args = p.parse_args()
args.out.mkdir(parents=True, exist_ok=True)
bg, ink, muted = '#0a1417', '#e2e8da', '#91aaa3'
font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def font(size):
    return ImageFont.truetype(font_path, size)
def label(draw, xy, text, size=16, colour=ink):
    draw.text(xy, text, font=font(size), fill=colour)
def load(name):
    return Image.open(args.input / name).convert('RGB')

for size in ['desktop', 'phone']:
    before, after = [load(f'{size}-geometry-{v}-native.png') for v in ['before','after']]
    w, h = before.size
    panel = Image.new('RGB', (w*2+60, h+154), bg)
    d = ImageDraw.Draw(panel)
    label(d,(20,17),'MANTA / MATCHED GEOMETRY',24)
    label(d,(20,52),f'Native Canvas | {w} × {h} each | seed 17 | 240 ticks at 60 Hz | same settings',14,muted)
    label(d,(20,91),'BEFORE · main b8f222d',16)
    label(d,(w+40,91),'AFTER · reef manta geometry',16)
    panel.paste(before,(20,120)); panel.paste(after,(w+40,120))
    label(d,(20,h+127),'Actual renderer output. No browser layout or device claim.',12,muted)
    panel.save(args.out / f'manta-{size}-before-after.png')

states = [('glide','CURRENT GLIDE'),('anticipation','WING LOADING'),('bank','BANK RIGHT'),('bank-left','BANK LEFT'),('recover','SLOW RECOVERY')]
for size, target_width in [('desktop',660),('phone',390)]:
    originals = [(load(f'{size}-reef-{state}-native.png'),title) for state,title in states]
    width,height = originals[0][0].size
    target_height = round(height*target_width/width)
    columns, rows = (2,3) if size == 'desktop' else (3,2)
    panel = Image.new('RGB',(columns*(target_width+20)+20, rows*(target_height+50)+100),bg)
    d = ImageDraw.Draw(panel)
    label(d,(20,16),'REEF SHADOWS / REPRESENTATIVE STATES',24)
    label(d,(20,53),f'Native Canvas · {width} × {height} originals · actual study adapter · seed 17',14,muted)
    for index,(img,title) in enumerate(originals):
        x=20+(index%columns)*(target_width+20)
        y=100+(index//columns)*(target_height+50)
        label(d,(x,y-23),title,14)
        panel.paste(img.resize((target_width,target_height),Image.Resampling.LANCZOS),(x,y))
    panel.save(args.out/f'manta-{size}-states.png')

if args.movies:
    meta=json.loads((args.input/'capture-manifest.json').read_text())
    for movie in meta['motion']:
        name=movie['name']
        framedir=args.input/f'captioned-{name}'; framedir.mkdir(exist_ok=True)
        for state in movie['states']:
            i=state['frame']; raw=load(f'frames-{name}/{i:04}.png')
            frame=Image.new('RGB',(720,552),bg); frame.paste(raw,(0,0)); d=ImageDraw.Draw(frame)
            label(d,(20,493),state['phase'],17)
            label(d,(20,524),f"NATIVE CANVAS  |  seed 17  |  t={state['time']:05.2f}s  |  real-time playback",12,muted)
            frame.save(framedir/f'{i:04}.png')
        mp4=args.out/f'manta-{name}-native.mp4'
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate',str(movie['fps']),
            '-i',str(framedir/'%04d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(mp4)],check=True)
        if name=='bank':
            palette=args.input/'bank-palette.png'
            subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(mp4),
                '-vf','palettegen=stats_mode=diff','-frames:v','1',str(palette)],check=True)
            subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(mp4),'-i',str(palette),
                '-lavfi','paletteuse=dither=sierra2_4a','-loop','0',str(args.out/'manta-bank-native.gif')],check=True)
print(json.dumps({'output':str(args.out),'comparisons':2,'state_sheets':2,'movies':args.movies}))
