"""Compose exact native-Canvas captures; never presents them as browser pixels.

Usage: python3 assemble-eelgrass-review.py BEFORE AFTER MOTION OUTPUT
Requires Pillow and installed DejaVu Sans; no fonts or reference photos bundled.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

before, after, motion, output = map(Path, sys.argv[1:5])
output.mkdir(parents=True, exist_ok=True)
background = '#09151b'
cream, muted = '#ebcc9a', '#9bb5ad'
font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def font(size):
    return ImageFont.truetype(font_path, size)


for name in ['desktop', 'phone']:
    old = Image.open(before / f'{name}-rest.png').convert('RGB')
    new = Image.open(after / f'{name}-rest.png').convert('RGB')
    assert old.size == new.size
    w, h = old.size
    top, bottom, gap = (88, 40, 24) if name == 'desktop' else (78, 40, 20)
    canvas = Image.new('RGB', (w * 2 + gap, h + top + bottom), background)
    draw = ImageDraw.Draw(canvas)
    size = 25 if name == 'desktop' else 17
    for x, title, subtitle in [(0, 'BEFORE', 'main b8f222d'), (w + gap, 'AFTER', 'Eelgrass / armour / contact')]:
        draw.text((x + 18, 14), title, font=font(size), fill=cream)
        draw.text((x + 18, 46), subtitle, font=font(size - 5), fill=muted)
    canvas.paste(old, (0, top))
    canvas.paste(new, (w + gap, top))
    draw.text((18, top + h + 10), f'Native Canvas / Skia — {w} × {h} each · seed 7 · same options · not browser screenshots', font=font(16 if name == 'desktop' else 11), fill=muted)
    canvas.save(output / f'seahorse-{name}-before-after.png')

# Full-size phone samples preserve the actual glyph size, rather than magnifying
# a low-resolution model and calling it mobile evidence.
states = [('rest', 'Held / moving eelgrass'), ('brace-prepare', 'Brace / anticipation'),
          ('brace', 'Brace / response'), ('release-prepare', 'Release / still held'),
          ('uncoil', 'Release / unroll'), ('drift', 'Release / free hover'),
          ('reanchor', 'Release / contact restored'), ('approach', 'Inspect / held approach'),
          ('settle', 'Inspect / recovery')]
sheet = Image.new('RGB', (390 * 3, 582 * 3 + 58), background)
draw = ImageDraw.Draw(sheet)
draw.text((18, 16), 'DIRECTED PHRASES · Native Canvas, not a browser', font=font(21), fill=cream)
for i, (state, label) in enumerate(states):
    x, y = (i % 3) * 390, 58 + (i // 3) * 582
    draw.text((x + 14, y + 10), label, font=font(16), fill=cream)
    sheet.paste(Image.open(after / f'phone-{state}.png').convert('RGB'), (x, y + 44))
sheet.save(output / 'seahorse-directed-contact-sheet.png')


def phrase(tick):
    if tick < 30:
        return 'HOLD / the blade and tail sway together'
    if tick < 300:
        age = tick - 30
        return 'BRACE / ' + ('tighten first' if age < 24 else 'lean against the current' if age < 144 else 'release the tension' if age < 240 else 'settled')
    if tick < 570:
        age = tick - 300
        return 'RELEASE / ' + ('prepare while held' if age < 24 else 'unroll' if age < 66 else 'free hover' if age < 145 else 'tail returns to the blade' if age < 210 else 'rewrap and settle')
    age = tick - 570
    return 'INSPECT / ' + ('notice first' if age < 24 else 'snout-led approach' if age < 112 else 'recover while holding' if age < 180 else 'settled')


manifest = json.loads((motion / 'capture-manifest.json').read_text())
for variant in ['motion', 'phone-motion']:
    frames = []
    video_frames = output / f'{variant}-video-frames'
    video_frames.mkdir(exist_ok=True)
    records = [r for r in manifest['records'] if r['viewport']['name'] == variant]
    for index, record in enumerate(records):
        assert record['tick'] == record['expectedTick']
        raw = Image.open(motion / record['file']).convert('RGB')
        w, h = raw.size
        frame = Image.new('RGB', (w, h + 62), background)
        frame.paste(raw, (0, 62))
        d = ImageDraw.Draw(frame)
        d.text((14, 10), phrase(record['tick']), font=font(18 if w > 500 else 12), fill=cream)
        d.text((14, 37), f'Native Canvas · tick {record["tick"]:03d} · 60 Hz model / 12 fps sampling', font=font(13 if w > 500 else 10), fill=muted)
        frame.save(video_frames / f'{index:04d}.png')
        frames.append(frame.quantize(colors=64))
    # Alternating 80/80/90ms retains the 12fps average within GIF's 10ms clock.
    durations = [80 if i % 3 != 2 else 90 for i in range(len(frames))]
    frames[0].save(output / f'seahorse-{variant}.gif', save_all=True, append_images=frames[1:],
                   duration=durations, loop=0, disposal=2, optimize=False)

print(json.dumps({'output': str(output), 'comparison_images': 2, 'contact_sheets': 1,
                  'motion_gifs': 2, 'frames_each': 157,
                  'representation': 'Native Canvas images with annotation; not browser screenshots or real-time recording'}))
