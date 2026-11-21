"""New R2 editable vector studies informed by the retained raster references.

These are newly authored SVG shapes, not recovered old source or traced rasters.
"""
from pathlib import Path
from html import escape
import re

HERE = Path(__file__).parent
INK = '#06231f'
CREAM = '#fff0ce'
LIME = '#bee533'
TEAL = '#246d60'
CORAL = '#ff815f'

def text(x, y, value, size=19, fill=CREAM, weight=400):
    return f'<text x="{x}" y="{y}" fill="{fill}" font-family="Arial, sans-serif" font-size="{size}" font-weight="{weight}">{escape(value)}</text>'

def frog_a(name, x, y, scale=1, expression='calm', sx=1, sy=1, angle=0, tongue=False):
    p = [f'<g id="{name}" transform="translate({x} {y}) scale({scale}) rotate({angle})"><g transform="translate(0 62) scale({sx} {sy}) translate(0 -62)" stroke="{INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">']
    for side in [-1, 1]:
        p.append(f'<ellipse id="{name}-haunch-{side}" cx="{side*63}" cy="24" rx="26" ry="46" transform="rotate({side*34} {side*63} 24)" fill="{LIME}"/>')
        p.append(f'<path d="M {side*70} 12 Q {side*38} 32 {side*40} 54" fill="none"/>')
        p.append(f'<ellipse cx="{side*64}" cy="65" rx="27" ry="8" fill="{LIME}"/>')
    p.append(f'<ellipse id="{name}-body" cx="0" cy="20" rx="64" ry="48" fill="{LIME}"/>')
    p.append(f'<ellipse cx="0" cy="28" rx="43" ry="29" fill="{CREAM}" stroke="none"/>')
    for side in [-1, 1]:
        p.append(f'<path d="M {side*25} 43 L {side*28} 63" fill="none"/>')
        p.append(f'<path d="M {side*28-10} 66 Q {side*28-11} 55 {side*28} 59 Q {side*28+11} 55 {side*28+11} 66 M {side*28} 61 V 69" fill="{LIME}"/>')
        p.append(f'<ellipse id="{name}-eye-{side}" cx="{side*29}" cy="-26" rx="25" ry="29" fill="{CREAM}"/>')
        if expression == 'squint':
            p.append(f'<path d="M {side*29-21} -31 L {side*29+21} -26" fill="none" stroke-width="5"/>')
            p.append(f'<path d="M {side*29-20} -32 Q {side*29} -62 {side*29+20} -28 Z" fill="{LIME}" stroke="none"/>')
            p.append(f'<ellipse cx="{side*29+8}" cy="-22" rx="6" ry="9" fill="{INK}" stroke="none"/>')
        elif expression == 'contact':
            p.append(f'<path d="M {side*29-10} -35 L {side*29+5} -26 L {side*29-10} -18" fill="none" stroke-width="5"/>')
        else:
            p.append(f'<ellipse cx="{side*29+(3 if expression=="startled" else 8)}" cy="-25" rx="{5 if expression=="startled" else 9}" ry="{8 if expression=="startled" else 15}" fill="{INK}" stroke="none"/>')
    if expression == 'startled':
        p.append(f'<ellipse id="{name}-mouth" cx="0" cy="14" rx="8" ry="12" fill="{CORAL}"/>')
    else:
        p.append(f'<path id="{name}-smile" d="M -47 2 Q 0 26 47 2" fill="none" stroke-width="5"/>')
        p.append(f'<path d="M -13 14 Q 0 38 13 14" fill="{CORAL}"/>')
    if tongue:
        p.append(f'<path id="{name}-tongue" d="M 0 14 Q 80 -8 190 -25" fill="none" stroke="{CORAL}" stroke-width="8"/>')
        p.append(f'<ellipse cx="0" cy="14" rx="9" ry="6" fill="{CORAL}"/>')
        p.append(f'<g id="{name}-fly" transform="translate(190 -25)"><ellipse cx="-4" cy="-9" rx="5" ry="9" fill="{CREAM}"/><ellipse cx="6" cy="-7" rx="5" ry="8" fill="{CREAM}"/><ellipse rx="10" ry="6" fill="#f3c544"/></g>')
    p.append('</g></g>')
    return ''.join(p)

def frog_b(name, x, y, scale=1, expression='wary', sx=1, sy=1, angle=0, tongue=False):
    p=[f'<g id="{name}" transform="translate({x} {y}) scale({scale}) rotate({angle})"><g transform="translate(0 65) scale({sx} {sy}) translate(0 -65)" stroke="{INK}" stroke-width="3" stroke-linejoin="miter">']
    for side in [-1,1]:
        p.append(f'<path id="{name}-leg-{side}" d="M {side*40} 25 L {side*88} -4 L {side*101} 20 L {side*65} 61 L {side*100} 65 L {side*62} 69 L {side*58} 53 L {side*81} 17 L {side*48} 38 Z" fill="{TEAL}"/>')
    p.append(f'<path id="{name}-body" d="M -69 -5 L -23 -26 L 24 -28 L 72 -8 L 38 22 L 9 39 L -31 45 Z" fill="{TEAL}"/>')
    for side in [-1,1]:
        p.append(f'<path d="M {side*22} 28 L {side*37} 65 L {side*23} 65 L {side*36} 56" fill="{TEAL}"/>')
        cx=side*28
        p.append(f'<path id="{name}-eye-{side}" d="M {cx-23} -24 L {cx-16} -61 L {cx+16} -58 L {cx+24} -23 Z" fill="{TEAL}"/>')
        p.append(f'<path d="M {cx-15} -48 L {cx+15} -47 L {cx+11} -30 L {cx-12} -32 Z" fill="{CREAM}" stroke="none"/>')
        if expression=='startled':
            p.append(f'<circle cx="{cx}" cy="-40" r="4" fill="{INK}" stroke="none"/>')
        elif expression=='satisfied':
            p.append(f'<path d="M {cx-9} -36 L {cx} -43 L {cx+9} -36" fill="none"/>')
        else:
            p.append(f'<path d="M {cx-16} -48 L {cx+16} -47" stroke-width="7"/><path d="M {cx+8} -47 V -38" stroke-width="7"/>')
    p.append(f'<path id="{name}-mouth" d="M -48 -7 L 45 -7" fill="none" stroke-width="4"/>')
    if tongue:
        p.append(f'<path id="{name}-tongue" d="M 0 -7 L 174 -47" fill="none" stroke="{CORAL}" stroke-width="6"/><g transform="translate(174 -47)" id="{name}-fly"><ellipse rx="8" ry="5" fill="#d69315"/><path d="M -2 -3 L -10 -15 M 2 -3 L 9 -15" stroke-width="6"/></g>')
    p.append('</g></g>')
    return ''.join(p)

def board(direction):
    a=direction=='a'; bg=INK if a else CREAM; fg=CREAM if a else INK; accent=LIME if a else TEAL
    name='SPRING PEA' if a else 'REED RASCAL'; draw=frog_a if a else frog_b
    out=[f'<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1040" viewBox="0 0 1440 1040" role="img" aria-labelledby="title description"><title id="title">{name} — newly authored editable R2 concept</title><desc id="description">Reconstruction reference, not recovered old source or browser evidence. Separate silhouette, expressions, mouth attachment and five motion keys.</desc><rect width="1440" height="1040" fill="{bg}"/>']
    out += [text(42,56,f'{direction.upper()} / {name}',40,accent,700),text(42,86,'NEW R2 EDITABLE RECONSTRUCTION · NOT RECOVERED SOURCE · NOT BROWSER EVIDENCE',14,fg)]
    out.append(f'<path d="M 42 112 H 1398 M 42 682 H 1398 M 690 135 V 655" stroke="{accent}" opacity=".45"/>')
    out += [text(42,151,'CHARACTER / SHAPE LANGUAGE',18,fg,700)]
    silhouette=draw('silhouette',580,214,.55)
    silhouette=re.sub(r'fill="[^"]+"',f'fill="{fg}"',silhouette)
    silhouette=re.sub(r'stroke="[^"]+"',f'stroke="{fg}"',silhouette)
    out += [silhouette,text(527,269,'SILHOUETTE',12,fg,700)]
    out.append(f'<ellipse cx="330" cy="551" rx="226" ry="45" fill="{TEAL if a else "#d6c19a"}"/>')
    out.append(draw('hero',330,390,2.25,expression='calm' if a else 'wary'))
    out += [text(58,621,'Round haunches. Giant eyes. Four planted contacts.' if a else 'Kite body. Eye towers. Bracket legs. Dry precision.',17,fg),text(58,648,'Lime / cream / coral / muted teal' if a else 'Petrol / warm cream / amber / coral',15,accent)]
    out += [text(724,151,'FACE / THREE EXPRESSIONS',18,fg,700)]
    for x,expression,label in [(812,'calm' if a else 'wary','CALM' if a else 'WARY'),(1046,'startled','STARTLED'),(1280,'squint' if a else 'satisfied','SMUG' if a else 'SATISFIED')]:
        out.append(draw('face-'+expression,x,252,.84,expression=expression))
        out.append(text(x-50,336,label,15,fg,700))
    out += [text(724,394,'MOUTH ROOT / TONGUE ATTACHMENT',18,fg,700)]
    out.append(draw('tongue-study',858,504,1.08,tongue=True))
    out += [text(1060,563,'Root stays on the mouth.',16,fg),text(1060,587,'Aim changes the endpoint.',16,fg)]
    out += [text(42,728,'FIVE DISTINCT MOTION KEYS',21,fg,700),text(42,757,'Pose studies; these drawings do not demonstrate running animation.',14,fg)]
    poses=[(160,'PRELOAD',1.18,.6,0,'squint' if a else 'wary'),(435,'LAUNCH',.8,1.25,-25,'startled'),(714,'GATHER',.78,.83,0,'calm' if a else 'satisfied'),(995,'CONTACT',1.32,.45,0,'contact' if a else 'startled'),(1280,'RECOVER',1,1,0,'squint' if a else 'wary')]
    for i,(x,label,sx,sy,angle,expr) in enumerate(poses):
        out.append(draw('pose-'+label.lower(),x,866,.84,expression=expr,sx=sx,sy=sy,angle=angle))
        out.append(text(x-63,987,f'{i+1}. {label}',17,fg,700))
    out.append('</svg>')
    return ''.join(out)

for direction,filename in [('a','spring-pea-r2-editable.svg'),('b','reed-rascal-r2-editable.svg')]:
    (HERE/filename).write_text(board(direction))
