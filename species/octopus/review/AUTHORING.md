# Octopus / the dim den

## Scope and source

An octopus-only candidate against `castlemilk/ascii-animals` main
`b8f222dab868821f27bf2a64a98434f3483fc8e6`, verified through GitHub and local Git.
The renderer is `src/animals/octopus.js`, not `src/species/octopus`.
Read: the current reactive ASCII Animals skill, its anatomy, portable-contract,
accessibility, validation and authoring references; `docs/ANIMAL-APIS.md`;
the canonical marine engine/director and the source geometry/lifecycle tests.
The shared engine, other animals, generated entry points, workflows and package
exports are outside this patch. Publication authority: working branch + PR only.

## Animal brief

A stylized benthic octopus: a rounded, slightly pear-shaped mantle; a distinct
head with lateral raised eyes and horizontal pupils; eight stout tapered arms
connected by shallow webbing. Primary view is oblique dorsal/oral, with some arms
rolling to reveal paired suckers. This is not a precise biological species model.
The anatomy primarily follows *Octopus vulgaris*. The passing-cloud accent is
informed by *O. cyanea*, and planted contacts by *Muusoctopus robustus* research.

The intended smallest review viewport is 390 × 640 CSS pixels, with a separate
320-pixel stress case. Dense ASCII is a raster glyph atlas, not selectable text.
No font or photo assets are copied. Existing system mono fallbacks are retained.

| Part | Attachment | Design and limits |
| --- | --- | --- |
| Mantle | Continuous dorsal transition to head | Rounded volume, locally raised papillae, broad stable mottling |
| Eyes | Head, behind arm crown | Raised mounds, horizontal dark pupils; restrained highlights |
| Eight arms | Separate roots overlapped by shallow web | Forty equal links each; adjacent joint angle at most .087 rad |
| Suckers | Oral arm surface | Two staggered rows; dark rim, pale face, recessed center; rotate with arm |
| Support contacts | Fixed world positions on den shelf | Three contacts, released before escape and recovered at unequal times |

## Reference and rights ledger

All geometry, habitat and code are independently authored. References are
observational only; no photographs, diagrams, model meshes or font binaries are
included. Access date: 19 November 2026 UTC.

| Source | Observation | Access / rights |
| --- | --- | --- |
| https://marinvert.senckenberg.science/octopus-vulgaris/ | Mantle/head continuity, eight arms, shallow web, paired suckers and slit pupils | Indexed text; direct page access blocked in research session. No copied assets. |
| https://www.jneurosci.org/content/jneuro/16/22/7297.full.pdf | A reaching bend propagates along an arm | Indexed primary research; direct PDF unavailable in research session. No copied assets. |
| https://www.nature.com/articles/s41586-025-09379-z | A medial arm contact can remain fixed while the body moves | Indexed primary research. Tip pinning here is a simplified artistic constraint, not a measured gait. |
| https://www.cambridge.org/core/journals/journal-of-zoology/article/abs/apparent-movement-in-a-visual-display-the-passing-cloud-of-octopus-cyanea-mollusca-cephalopoda/11421B0AD71205AA437B0C14C3F5CA5F | Local dark bands travel mantle → head → web | Primary abstract; species-specific observation adapted as a restrained accent. |
| https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/giant-pacific-octopus | Rocky den/midden, pale undersides, mantle contraction/siphon jet and ink screen | Aquarium reference; no copied assets. |

## Behaviour direction

Timings are authored animation choices, not biological measurements.

1. **Examine and reach:** small eye/head anticipation, a travelling arm bend,
   one leading and one delayed searching arm, a short examination, then peeling
   and settling. Other arms retain world contacts. Pointer acquisition initiates
   the sequence; quiet automatic probes provide idle personality.
2. **Startle and departure:** the existing marine timing stays intact: notice
   `0–.34 s`, ink `.34–.94 s`, escape `.94–3.25 s`, return `3.25–8.8 s`.
   Arms release at different instants, stream with unequal lag, then replant in
   staggered order. Ink remains the shared bounded world-space effect.

The full den is gated to solo, independent, reactive hover/curious behaviour.
Shared director routes and traveling formations retain their body movement;
octopus anatomy, material and reaction articulation still apply. Habitat is a
Canvas underlay, excluded from animal geometry, bounds and hit ownership.

## Inputs, determinism and lifecycle

The public typed `createArtwork` contract remains unchanged. A scoped example
uses semantic Examine, Startle, Release and Pause controls with pointer/touch
equivalence and focus-scoped keyboard shortcuts; no shared shell edits.
Species callbacks use the host clock, no wall clocks, random calls, listeners,
timers or independent animation loop. Repeated rendering at the same time must
be idempotent. Guarantee: same engine/version, seed, viewport/options and ordered
fixed-step input sequence produce the same state and logical buffers. System
fonts and cross-engine pixels are not promised identical.

Existing host pause, system reduced motion, hidden/offscreen handling, bounded
resize, restart and disposal remain in charge. Manual `advance()` deliberately
ignores pause in the established API and is used only for labelled evidence.

## Fixed acceptance budgets

- Eight arms / forty fixed-length links; joint angle ≤ .087 radians.
- Fewer than 18,000 species samples at every geometry LOD.
- At most two investigating arms; no per-frame unbounded allocations or effects.
- Contact error < 1e-6 world units when a support contact is fully planted.
- All samples finite and inside declared species bounds.
- Native evidence: matched 1200 × 800 and 390 × 640, seed 17, 60 Hz fixed steps.
- Browser evidence reported independently. Chromium launch is currently blocked
  by the managed environment's socket restriction; no device FPS claim.

Results, exact commands, hashes and remaining acceptance are recorded separately
after implementation. The native captures must never be labelled browser tests.
