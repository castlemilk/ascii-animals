"""Offline raster evidence from render-evidence.mjs JSON. Requires Pillow and DejaVu Sans Mono.
This renders the real model's cells; it does not capture a browser or measure FPS.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, sys
root = Path(sys.argv[1])
font = ImageFont.truetype('DejaVuSansMono.ttf', 9)
heading = ImageFont.truetype('DejaVuSans.ttf', 14)
small = ImageFont.truetype('DejaVuSans.ttf', 10)
background = (9, 21, 27)
cache = {}
def raster(frame, title):
    cw, ch, top = 6, 10, 48
    im = Image.new('RGB', (frame['columns']*cw+24, frame['rows']*ch+top+12), background)
    d = ImageDraw.Draw(im)
    d.text((12, 8), title, fill=(229,196,139), font=heading)
    d.text((12, 29), 'Actual model cells / offline raster / no browser or FPS claim', fill=(139,166,172), font=small)
    palette = {'brass': (232,185,105), 'lagoon': (119,218,204), 'rose': (227,154,180)}[frame['options']['palette']]
    for i, glyph in enumerate(frame['text'].replace('\n','')):
        if glyph == ' ': continue
        layer, tone = frame['layers'][i], frame['tones'][i]
        rgb = (94,155,132) if layer == 'kelp' else (65,102,112) if layer == 'water' else palette
        color = tuple(min(255,round(c*(.28+tone/12))) for c in rgb)
        key = (glyph, color)
        if key not in cache:
            tile = Image.new('RGB', (cw,ch), background)
            ImageDraw.Draw(tile).text((cw/2,ch/2),glyph,font=font,fill=color,anchor='mm')
            cache[key]=tile
        im.paste(cache[key],(12+(i%frame['columns'])*cw,top+(i//frame['columns'])*ch))
    return im
record = json.loads((root/'replay.json').read_text())
frames = [raster(frame, f"Kelp garden / {i/record['fps']:04.1f}s / {frame['director']['arc']}") for i,frame in enumerate(record['frames'])]
frames[0].save(root/'seahorse-model-replay.gif',save_all=True,append_images=frames[1:],duration=[80,90,80]*112,loop=0,optimize=False)
ids = [0,84,108,168,192,300]
thumbs=[]
for i in ids:
    img=frames[i].copy(); img.thumbnail((500,475)); thumbs.append(img)
sheet=Image.new('RGB',(1500,950),(6,16,21))
for k,img in enumerate(thumbs):sheet.paste(img,((k%3)*500,(k//3)*475))
sheet.save(root/'seahorse-replay-contact.png')
scene_names=['garden-arrival','garden-rest','garden-release','garden-return','duet-rest','solo-drift']
scene_sheet=Image.new('RGB',(1500,960),(6,16,21))
for k,name in enumerate(scene_names):
    img=Image.open(root/(name+'.png'));img.thumbnail((500,480));scene_sheet.paste(img,((k%3)*500+(500-img.width)//2,(k//3)*480))
scene_sheet.save(root/'seahorse-scenes-contact.png')
print(json.dumps({'replay_frames':len(frames),'duration_seconds':28,'gif_bytes':(root/'seahorse-model-replay.gif').stat().st_size,'claim':'offline rasterization of actual model output'}))
