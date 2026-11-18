"""Rasterize actual composed cells; never a browser screenshot or concept render."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib, json
root=Path(__file__).resolve().parents[1]
out=root/'evidence'/'director'
data=json.loads((out/'logical-scenes.json').read_text())
font_path=Path('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf')
font=ImageFont.truetype(str(font_path),11)
label=ImageFont.truetype(str(font_path),13)
bg=(11,18,25);ink=(219,220,190);muted=(143,169,177)
def render(frame,title):
    cw,ch=6,11
    im=Image.new('RGB',(frame['cols']*cw+40,frame['rows']*ch+72),bg)
    draw=ImageDraw.Draw(im)
    draw.text((20,12),title,font=label,fill=ink)
    draw.text((20,32),frame.get('phase','')+'  /  actual ASCII cells',font=font,fill=muted)
    for y,line in enumerate(frame['text'].splitlines()):
        for x,c in enumerate(line):
            if c!=' ':draw.text((20+x*cw,58+y*ch),c,font=font,fill=ink)
    return im
tiles=[]
for scene in data['scenes']:
    for frame in scene['selected']:
        tiles.append(render(frame,scene['name']+' / tick '+str(frame['tick'])))
    frames=[render(f,scene['name']+' / tick '+str(f['tick'])).quantize(colors=32) for f in scene['frames']]
    # GIF durations have 10ms precision; 80/80/90 averages the sampled 12Hz.
    durations=([80,80,90]*((len(frames)+2)//3))[:len(frames)]
    frames[0].save(out/(scene['options']['scene']+'.gif'),save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=False,disposal=2)
w=max(i.width for i in tiles);h=max(i.height for i in tiles)
sheet=Image.new('RGB',(w*4,h*3+50),bg);draw=ImageDraw.Draw(sheet)
draw.text((20,15),'OWL DIRECTOR / executed glyph evidence / Pillow, not browser pixels',font=label,fill=muted)
for i,im in enumerate(tiles):sheet.paste(im,((i%4)*w,(i//4)*h+50))
sheet.save(out/'director-contact-sheet.png')
small=[render(f,f['title']) for f in data['small']]
sw=max(i.width for i in small);sh=max(i.height for i in small)
sheet=Image.new('RGB',(sw*3,sh*3+50),bg)
for i,im in enumerate(small):sheet.paste(im,((i%3)*sw,(i//3)*sh+50))
ImageDraw.Draw(sheet).text((20,15),'MINIMUM SPECIMEN / both actors retained / wide and stacked',font=label,fill=muted)
sheet.save(out/'director-small-grid.png')
render(data['scenes'][1]['selected'][1],'Call and answer / a deliberate delayed reply').save(out/'director-poster.png')
(out/'raster-provenance.json').write_text(json.dumps({'evidenceKind':'Pillow rasterization of actual composed ASCII cells; not browser screenshots','font':str(font_path),'fontSha256':hashlib.sha256(font_path.read_bytes()).hexdigest(),'fontBundled':False,'simulationTickRate':60,'sampledFrameRate':12,'gifDurationPatternMs':[80,80,90],'repeat':'Each full recorded scene resets its fixture on repeat; no seamless-loop claim'},indent=2)+'\n')
print(json.dumps({'images':3,'gifs':3,'source':'logical-scenes.json'}))
