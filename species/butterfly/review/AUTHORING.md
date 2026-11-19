# Butterfly — veined flight study

## Scope and base

Butterfly only in `castlemilk/ascii-animals`, isolated branch from
`b8f222dab868821f27bf2a64a98434f3483fc8e6` (verified against remote main).
No shared engines, other species, shared generated entries or workflows are owned.
Publication authority: own branch and PR only; central owner reviews/integrates.
Original source remains in the base commit. Only the current request and supplied
context were read; no unavailable conversation is treated as source.

## Brief written before implementation

A monarch-inspired dorsal/oblique butterfly drawn as a printable ASCII cell field,
rendered through Canvas. Three anchors: tapered high forewings, rounded scalloped
hindwings, a slender segmented body with two attached clubbed antennae. Replace
large generic eyespots with connected branching veins, orange scale fields and
pale marginal spots inside a dark border. Patterns remain legible as geometry in
plain text; palette adds material separation. No external art or fonts copied.

Minimum supported logical grid remains 80×32; phone review uses 104×86 at 390×844.
Neutral-tone silhouette, folded and turning poses must remain recognisable.
Six leg origins remain at the thorax; the front pair are shortened in this
stylized brush-footed study. Wing hinges stay on the thorax. Rendering constrains
rotated extents to the grid with a small gutter. Far flowers are lower contrast;
the foreground has a few broad leaves, not a dense grass wall.

## Directed sequences

1. Flower visit: search in flutter/glide bouts; bank and brake above a selected
   bloom; align and physically settle before feeding; hold body at contact while
   slowly fanning; gather wings, lift and recover into a sustained glide.
2. Passing disturbance: 24 ticks of wing-fold anticipation; powered escape through
   tick 91; held glide through 169; shelter through 229; contextual recovery through
   299. The cue captures its launch origin, not a continuously moving target.
   Existing 300-tick cue duration and same-cue cooldown remain intact.

Pointer attraction remains nearby attention; tapping an actual flower or offering
an invitation by keyboard near one selects that bloom. An open-air invitation
still gathers around the invitation. Breeze pointer mode / B / Send a breeze
share the authored escape arc. Enter offers nectar, arrows guide, N changes act,
Space pauses, Escape releases; Tab leaves. Touch completion releases hover while
preserving the cue; cancellation ends it. Repeated live cue does not reset its
clock. Still cues may retarget. No new public option, activity kind, or cue string.

## Representation and motion limits

Original vector outlines and vein paths sampled into ASCII U+0020–U+007E.
One faint wing-edge echo during fast strokes only; never body/antenna trails.
No motion-echo marks in paused/reduced-motion browser posters. Four tones of wing
material preserve connected vein cells; detail is reduced with cell size. Cell
aspect remains 0.56. Canvas uses installed ui-monospace / SFMono-Regular /
Consolas / monospace; no font files bundled. Text export is a logical grid, not
selectable Canvas text or a terminal emulator.

Pure model stays at 60 integer ticks/s, with same-version, seed, options, ordered
inputs and tick log determining state and logical cells. No ambient randomness,
DOM reads or clocks in choreography. Six catch-up ticks per browser callback and
existing dropped-wall-time metric remain. Pause, reduced motion, hidden, offscreen,
zero size and disposal stay independent. Resize does not advance simulation.

## Budgets pinned before measurement

At most 6 actors, 6 focal flowers, 16,200 cells, 22 pollen marks, 69 breeze samples;
finite per-actor local rectangle sampling and at most one wing-edge echo field.
Small fixed habitat geometry, no particle pool. Backing pixel dimensions retain
the existing 2048 CSS-pixel / DPR≤2 caps. Numerical invariants are tested separately
from native Canvas images and actual browser behavior. No phone FPS or memory-leak
claim without device evidence. Performance target for native capture work: inspect
maximum grid render timing and avoid unbounded growth, not claim browser frame rate.

## Reference and rights ledger

All observations retrieved 2026-11-19. Reference photographs/text are observation
only; no copied assets, photographs, meshes, ASCII art or font binaries.

| Source | Observation | Implemented interpretation |
| --- | --- | --- |
| https://www.floridamuseum.ufl.edu/wildflowers/butterfly/monarch/ | Dark veins, orange wing fields, pale spots inside dark margins | Original branching cells, raised forewing apex and scalloped hindwing |
| https://www.monarchwatch.org/press/ | Powered, resource-seeking, escape and gliding flights | Distinct authored flight envelopes and broad held glide |
| https://www.amnh.org/exhibitions/butterflies/anatomy | Wing scales, clubbed antennae, coiled/extended proboscis | Sparse interior texture, attached clubs and contact-gated short feeding tube |
| https://pmc.ncbi.nlm.nih.gov/articles/PMC7328400/ | Coordinated body/wing posture in reconstructed reverse flight | A small brace/lift before escape, not validated biological timing |

Detailed measurements, source hashes, commands, evidence and remaining acceptance
are recorded in the final compact review manifest. Physical timings, LOD,
perspective and colors are artistic choices, not a biological simulation.
