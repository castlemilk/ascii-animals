# Gecko — a foothold in the night

## Scope and base

Gecko only, based on `castlemilk/ascii-animals` main
`b8f222dab868821f27bf2a64a98434f3483fc8e6`, verified on 19 November 2026.
Read: the requested generate-reactive-ascii-animals skill and its anatomy,
portable-contract, accessibility, validation and authoring references; actual
Gecko TypeScript, shipped director, `docs/ANIMAL-APIS.md`, and `docs/GECKO-API.md`.
The starting checkout was clean. No shared engine, export map, other animal or
workflow belongs to this change. Branch/PR only; integration belongs to Bear.

## Animal brief before implementation

A Tokay-inspired, deliberately stylized wall gecko. A broad, softly triangular
head separated by a narrow neck; a substantial, spotted trunk; four bent limbs
with five separated paddle-ended toes; an attached tapering tail. Dorsal view,
continuous in-plane turns. The three-resident scene is an authored composition,
not a claim about naturally social Tokays.

The wall is a place: chipped lime plaster, recessed mortar, a small lantern,
and a quiet plant at the edge. Immutable mineral details establish scale and
contact. The animal stays brightest. No labels on the animal and no glowing
contact markers in normal view. All construction is original procedural glyph
geometry. No reference photograph, font or third-party art is bundled.

Minimum supported directed host: 320 CSS px, selected close view. Primary
controls at least 44 px tall, with 12–14 px text in portrait. Retain printable
ASCII cell export, a meaningful static poster, semantic controls and focus.
Canvas glyph rendering uses the existing system monospace stack; pixel identity
is limited to the recorded runtime and fonts.

## Directed actions

1. **Climb:** assess the next seam, peel one toe fan, transfer the raised foot,
   spread and plant, pull the body through the three supporting limbs, then
   settle. Authored order FL → RR → FR → RL. Stance palms, angles and pad spread
   remain fixed in wall coordinates; changing a toe option takes effect only
   when the foot is released. No scene-level translation of planted feet.
2. **Hunt:** notice and track a visible insect, pause to brace, make a short
   contact-supported pounce, catch only at the jaw, replant and recover with a
   still interval, then resume the wall route. One active hunt per actor,
   bounded event queues, no teleport to targets, and an unreachable target
   times out into recovery. Timings are authored for legibility, not measured
   reconstructions of wild behavior.

Pointer/touch guides the selected resident using the existing letterbox-aware
mapping; deliberate moth and climb controls share the same controller cues.
Focused-canvas arrows guide, C climbs, M offers a moth, Escape releases guidance,
Space pauses. Native buttons provide equivalent touch and keyboard actions.
Pause and reduced motion remain independent of all cues and resets.

## Reference and rights ledger

| Reference | Observation | Rights / use |
| --- | --- | --- |
| https://www.nationalzoo.si.edu/animals/tokay-gecko | Distinct head/neck, powerful limbs, cool body with warm spots, prominent slit pupils, fused transparent eyelids, nocturnal sit-and-wait insect feeding | Facts used; no copied image or text |
| https://nationalzoo.si.edu/object/nzp_NZP-2559-4JC | Broad rounded head, pale expanded toe ends, substantial bent limbs | Smithsonian public-domain photo viewed as reference; not bundled |
| https://www.annualreviews.org/content/journals/10.1146/annurev-ecolsys-120213-091839 | Video 3 description documents digital hyperextension during Tokay climbing; adhesion is not suction | Publication and video description inspected; no copied material |
| https://pmc.ncbi.nlm.nih.gov/articles/PMC7616155/ | Visually guided Tokay hunting and post-capture freezing context | Research used to inform timing contrast; no copied material |
| https://pmc.ncbi.nlm.nih.gov/articles/PMC2393739/ | House-gecko tail support during slips; secure grip need not press tail to wall | Different species explicitly noted; tail counterbalance is stylized |

## Budgets and acceptance pinned before capture

- Preserve 60 Hz integer simulation, at most 5 catch-up ticks, at most 32 input
  events/tick, 3 residents, 12,288 samples/animal and 4,096 environment marks.
- Preserve finite reach <= .44 local world units and at least three stance feet.
- Directed thrust delta <= .025 units/tick, guarded by the same limb reach gate.
- Same engine/version, seed, options and ordered input ticks reproduce state and
  cells at render groupings of 1, 2 and 5 ticks. No cross-font pixel promise.
- Matched baseline/after desktop and phone frames; normal-speed motion plus
  anticipation/contact/recovery stills. Label native Canvas and real browser
  evidence separately. An unavailable browser is not a passing browser gate.
- Typecheck exact source; run species and actual package integration checks;
  inspect silhouettes, toe separation and interaction controls. Report commands,
  runtime, source hashes, failures and untested acceptance in the review manifest.

No new CPU/FPS or real-device performance target is claimed from screenshot
generation. Keep pauses, hidden/offscreen/zero-size handling, reset and idempotent
disposal under the existing controller contract.
