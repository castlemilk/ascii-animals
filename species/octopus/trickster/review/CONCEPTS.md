# Two octopus directions

These directions were shown as ImageGen reference boards before implementation.
They are concepts, not screenshots or tested interaction. All runtime curves and
cell art were authored separately in editable JavaScript.

## A — Pocket Trickster (selected)

**Silhouette:** a broad soft mantle over a short web; two upward curled arms,
two tactile side arms and four lower arms. Large negative gaps distinguish the
eight gestures. Front, oblique lean and squash are authored. This prototype is a
front-view character; a full 3D turning library is not claimed.

**Face:** two exaggerated cream eyes with horizontal pupils. Asymmetric lids,
a glance before the arm moves, wide eyes while gathering, one sly eye during the
peek. No visible human mouth. This is intentional cartoon anatomy.

**Color roles:** deep water `#09191f`; warm coral `#ed775f`; pale edge `#ffad86`;
cream eyes `#fff0ce`; quiet seafoam shelf `#558281`; blue ink `#34415d`.

**Glyph roles:** parentheses and slashes form the perimeter; `:` carries the
mantle; sparse `o` marks read as suckers; `@` makes bright eyes/pearl; `=` cuts a
horizontal pupil; `_` anchors the shelf; `~` defines ink and currents. The runtime
uses printable ASCII only, on a bounded logical grid. Color is cell metadata.

| Key | Body and gaze | Arm/effect pose | Timing after input |
|---|---|---|---|
| Notice | Eyes toward pearl, small lean | Leading arm coils | 0–0.5 s |
| Reach | Body counterbalances | One arm unfolds along a bow | 0.5–1.5 s |
| Contact | Attention holds | Exact tip/pearl contact, three small accent rays | 1.5–2.2 s |
| Recoil | Small return/overshoot | Tip peels back, quiet arms keep their roles | 2.2–3.6 s |
| Gather | Squash and wide eyes | All arms curl inward | 0–0.45 s after disturbance |
| Hide | Body concealed | Compact ink cloud occupies the stage | 0.45–1.25 s |
| Peek | One eye on the disturbance side | One curled arm catches the ink edge | 1.25–2.65 s |
| Settle | Eyes relax | Ink recedes and arms return with stagger | 2.65–4.6 s |

Input changes the target, active arm and peek side. Release interrupts a reach
from its current pose. Busy startles are ignored, not accumulated.

## B — Ink Magician (alternative)

**Silhouette:** a low, tilted kite mantle; eight broad ribbon arms with long
angular elbows and spiral tips; a diagonal root-to-leading-arm line of action.
**Face:** two narrow amber slit eyes under one lifted mantle fold.
**Habitat:** one off-center rock plane; wide black water with a lavender current.
**Palette:** near-black ultramarine, violet, amber and bone.

The movement begins in a low stalk, folds into a tight anticipation, stretches
one ribbon to a pearl, squashes on recoil, opens a broad ink curtain, then peeks
from its edge. This would suit a more theatrical collection. At a small cell grid,
the angular mantle and sharp arm turns need additional work to stay recognizably
octopus; that is why the rounder direction was selected.

## Editable sources

- `core.mjs`: original arm control points, motion timing and input consequences.
- `render.mjs`: glyph palette, color palette, mantle/eye geometry and habitat.
- Native-render `.svg` assets: editable individual text cells, exact cell layout.
- Prompts below: repeatable art direction for the two visual concept boards.

## ImageGen prompts (verbatim)

### Direction A

Use case: stylized-concept. Asset type: reference board for an expressive ASCII octopus character, concept art only not browser evidence. Title: A / POCKET TRICKSTER. Design a mischievous tactile cartoon octopus for a dark terminal-art animation. Original flat graphic illustration with visible intentionally sparse monospace ASCII glyph construction accents, NOT photoreal. Wide round coral terracotta pear/bean mantle, two unmistakable large cream eyes with horizontal slit pupils, curious asymmetric eyelids, eight thick tapering curled arms attached to a compact web, arm loops with generous negative spaces, sparse cream sucker marks. No human mouth. Navy-black water, muted seafoam single rock ledge and shell accents, 4-color coherent palette. Board landscape includes left large hero silhouette, small monochrome front/profile/turn silhouette keys along top, three face keys curious / oops / sly, and bottom 6 distinct staged motion key poses: notice pointer pearl, coil arm anticipation, reach actual tip onto pearl, recoil fingers curled, hide inside a compact indigo ink cloud, one-eye peek with curled arm holding the cloud edge. Direction arrows and very short labels permitted. Beautiful clean design with confident shape language, few strong lines, not tiny chaotic texture. Keep face and arm gestures readable as thumbnail. Avoid detailed texture, extra creatures, UI mockup, badges, photorealistic density, raster shading pretending to be executable ASCII.

### Direction B

Use case: stylized-concept. Asset type: alternative reference board for an expressive ASCII octopus character, concept art only not browser evidence. Title: B / INK MAGICIAN. Original theatrical cut-paper cartoon octopus, genuinely different from a round cute mascot: a low asymmetric angular kite-like violet mantle tilted diagonally, two narrow bright amber horizontal slit eyes under one raised mantle fold, eight long broad ribbon arms with sharp elbow curves and tapering spiral tips, a strong diagonal line of action and huge negative spaces between arms. No human mouth, no hat or costume. Palette near-black ultramarine, lavender violet, warm amber, sparse bone-white. Hero on left crouches behind a single angular graphic rock plane. Top small silhouette variants front / lateral / twist. Right facial expression trio alert / offended / sly. Bottom six separate large motion keys: low stalk, folded ribbon anticipation, long arm stretch to amber pearl with unmistakable tip contact, rapid squash/recoil, broad black ink curtain, curious sideways eye and arm peeking out. Sparse, orderly monospace ASCII slash, parentheses, underscore and @ textures suggest a possible ASCII translation without visual noise. Landscape editorial art board, limited flat colors, strong silhouettes, expressive poses, no photorealism, no dot-cloud detail, no extra creatures, no UI screenshot.
