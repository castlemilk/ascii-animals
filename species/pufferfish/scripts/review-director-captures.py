#!/usr/bin/env python3
"""Assemble review images only from the recorded native PNG/GIF evidence."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import json

root = Path(__file__).resolve().parent.parent / 'evidence/director'
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
sheet = Image.new('RGB', (720, 490), (8, 13, 15))
draw = ImageDraw.Draw(sheet)
for col, tag in enumerate(['before', 'final']):
    with Image.open(root / tag / 'reef-mobile-360.png') as source:
        sheet.paste(source.convert('RGB'), (col * 360, 60))
    caption = 'Before: large labels and overlap' if tag == 'before' else 'After: compact names and room'
    draw.text((col * 360 + 14, 13), caption, font=font, fill=(230, 232, 211))
    draw.text((col * 360 + 14, 36), '360×420 / 3 fish / max size + inflation', font=small, fill=(165, 190, 187))
sheet.save(root / 'mobile-before-after.png')

indices = list(range(29, 37))
strip = Image.new('RGB', (1200, 550), (8, 13, 15))
draw = ImageDraw.Draw(strip)
draw.text((15, 10), 'Actual GIF samples around local approach / 200 ms between frames', font=font, fill=(230, 232, 211))
with Image.open(root / 'final/current-native.gif') as gif:
    for pos, index in enumerate(indices):
        gif.seek(index)
        image = gif.convert('RGB').resize((300, 225), Image.Resampling.LANCZOS)
        x, y = (pos % 4) * 300, 42 + (pos // 4) * 252
        strip.paste(image, (x, y))
        draw.text((x + 12, y + 230), f'tick {index * 12} / {index * 200 / 1000:.1f}s', font=small, fill=(180, 205, 194))
strip.save(root / 'final/current-inflation-strip.png')

before = json.loads((root / 'before/capture.json').read_text())
after = json.loads((root / 'final/capture.json').read_text())
comparisons = []
for filename in ['reef-mobile-360.png', 'reef-mobile-390.png']:
    old = next(item for item in before['captures'] if item['file'] == filename)
    new = next(item for item in after['captures'] if item['file'] == filename)
    assert old['stateSha256'] == new['stateSha256'], 'Before/after comparison must use identical scene state'
    comparisons.append({'file': filename, 'identicalStateSha256': old['stateSha256'],
                        'beforePngSha256': old['pngSha256'], 'afterPngSha256': new['pngSha256']})
metadata = {
    'evidence': 'Derived only from the actual native capture PNGs and GIF; no browser or generated-image content.',
    'beforeAfter': {'file': 'mobile-before-after.png',
                    'sources': ['before/reef-mobile-360.png', 'final/reef-mobile-360.png'],
                    'comparisons': comparisons},
    'motionStrip': {'file': 'final/current-inflation-strip.png', 'source': 'final/current-native.gif',
                    'frameIndices': indices, 'frameDurationMs': 200},
}
for filename in ['mobile-before-after.png', 'final/current-inflation-strip.png']:
    metadata[filename] = {'sha256': hashlib.sha256((root / filename).read_bytes()).hexdigest()}
(root / 'review-artifacts.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(json.dumps(metadata, indent=2))
