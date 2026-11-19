# Crab · a ledge on the tidal flat

## Scope and pinned source

This is a crab-only revision of `castlemilk/ascii-animals`, based on
`b8f222dab868821f27bf2a64a98434f3483fc8e6` (verified against remote main on
19 November 2026). Work belongs on `feat/crab-tidal-flat-choreography`; integration
belongs to Bear. Only a working branch and PR are authorized. No merge or deployment.
No shared engine, generated entry point, workflow, or other animal is changed.

The requested `generate-reactive-ascii-animals` skill, the actual crab source,
`docs/ANIMAL-APIS.md`, `docs/CRAB-API.md`, shipped director, and existing crab tests
were read. The baseline already provides planted feet, three theatre scenes,
300-tick cues, visible-cell ownership, keyboard input, and reduced-motion stills.
This revision must improve the animal and those sequences rather than relabel them.

## Animal brief (written before implementation)

- **Animal:** authored shore crab informed by *Carcinus maenas*, not a species-identification model.
- **Anchors:** broad low shield; two substantial gaping chelae; eight separately articulated walking legs.
- **Shell:** one continuous carapace with shallow regional grooves, a serrated rim,
  domed dorsal regions and a dark underside. The regions are not separate armor plates.
- **View:** dorsal/front three-quarter projection, mirrored left/right. No free camera.
- **Minimum:** 80 × 32 printable cells; inspect at a 390 CSS-pixel phone width.
- **Composition:** a quiet band of cool tidal water, warm wet sediment, one low rock
  ledge per resident and sparse algae. The nearby ledge must visibly cover the crab
  during shelter. Texture remains quieter than anatomy.
- **Artistic choices:** warm brass/olive, lagoon and rose palettes; enlarged eyes
  and tips for character-cell readability; authored timing and call-and-response,
  not claimed biological measurements.

| Part | Attachment and construction | Motion / depth |
| --- | --- | --- |
| Carapace | Broad continuous shield at scene root | Stable volume; shallow grooves and uneven highlights |
| Walking legs | Four pairs below lateral shell margins | World-fixed stance; low recovery arcs; articulated proximal/distal segments |
| Chelae | Two shoulders on anterior body | Separate elbow, wrist, palm and fingers; modest asymmetry |
| Eyes | Two short anterior stalks | Attend to guide; retract slightly in cover |
| Shelter | Fixed world-space low rock ledge | Back contour before crab, front lip after crab; hidden cells lose crab ownership |

## Reference and rights ledger

All geometry, marks and timing are original code. No reference photographs,
diagrams, font files, textures, model assets, or outside ASCII drawings are copied.

| Source | Observation | Rights / use |
| --- | --- | --- |
| [Museums Victoria](https://collections.museumsvictoria.com.au/species/8652) | Broad green-brown mottled shield, lateral spines, pointed legs; dorsal/front photographs | Reference only; Rodney Start / Museums Victoria photographs are CC BY 4.0; not bundled |
| [Vidal-Gadea et al. 2008](https://bpb-us-e2.wpmucdn.com/about.illinoisstate.edu/dist/d/46/files/2019/10/Vidal_Gadea_2008.pdf) | Lateral leading/trailing legs, ground-contact stance vs airborne swing, carapace grooves | Research reference only; no reproduced figure |
| [MarLIN shore crab](https://www.marlin.ac.uk/species/detail/1497) | Intertidal habitat, concealment, defensive posture | Reference only |
| [Australian Government diagnostic manual](https://www.marinepests.gov.au/sites/default/files/Documents/empplan-rapid-response-manual-carcinus-maenas.pdf) | Granular shell, unequal chelipeds and four pairs of walking legs | Reference only |

## Directed movement and input

The existing public types, options, scene defaults, activity union and methods stay
unchanged. Commands still last 300 logical ticks. The detailed timing below is an
authored target, separate from species facts.

| Sequence | Anticipation | Response | Recovery |
| --- | --- | --- | --- |
| Sand approach / forage | Hold origin briefly; lower body and tuck claws | Planted lateral steps to bounded lure; lower working claw to sift | Finish airborne feet before resting; return toward patch |
| Deliberate display | Hold body; prepare lowered chelae | Lead claw rises, other follows, open fingers hold a legible silhouette | Claws close and lower with different timing; return to quiet pose |
| Shelter / emerge | Brief brace at origin | Sideways retreat, fixed rock lip hides shell; pause, then eyes peek | Extend out of cover, cautious return, settle all feet |

Pointer guides attention. Visible crab taps retain role-based actions; visible
rock taps request shelter. Open-ground taps request forage. Existing keyboard:
arrows guide; 1–5 select; F forage, S display, H shelter, N next beat, Space pause,
Escape clear guide. Equivalent semantic buttons remain in the demo. Touch release,
cancel and leave clear transient guidance. No new global keyboard handler.

## Determinism, accessibility and budgets

60 integer ticks per second. Equal source version, seed, normalized ordered inputs
and tick sequence must produce equal state and printable ASCII cells regardless
of 1/2/5-tick batching. No ambient randomness or wall clock in species logic.
Pixels are font/backend-specific. The demo uses system monospace fonts; no font
binary is redistributed. Native evidence will state its installed test font.

Preserve bounds: 5 actors, 8 feet each, 180 × 90 cells, one cue and one delayed
reply per actor, 6 catch-up ticks, DPR ≤2, canvas CSS dimensions ≤2048 per axis.
Scenery is grid-bounded; there is no particle queue. These are work/allocation
bounds, not measured device performance.

Explicit pause, reduced motion, hidden/offscreen and zero-size remain independent
suspension causes. Static controls compose poses without starting a clock.
Resize preserves state; disposal removes owned resources and is idempotent.
No claim of a framework adapter or screen-reader certification is made.

## Acceptance and handoff

Capture exact before/after with the same source options, seed, tick and inputs at
desktop and phone sizes. Include study, display, retreat, shelter, emerging and
three/five-resident boundaries. Review raw frames and normal-speed motion.
Native Canvas evidence must be explicitly distinguished from real browser tests.
Local Chromium launch is currently blocked by a socket permission error; browser
acceptance is pending unless the dedicated browser can reach the local preview.

Record actual commands, source SHA-256, logs, reviewer findings, remaining gates
and integration generation commands in the final compact review manifest.

### Final review

The [review manifest](evidence/tidal-flat/review-manifest.json) pins the final
source and reports 42 passing crab checks, 628 passing aggregate checks with
bounded concurrency, identical public declarations and the package-check result.
Native evidence contains 64 matched fixtures and an 18-second motion export.
Review corrected stopping-foot continuity, eye duplication, shelter depth,
signed-current motion and reachable shelter anchors. Fine articulation simplifies
at the five-actor minimum grid. Real browser acceptance remains unverified;
the exact failed attempts and remaining checks are recorded in the manifest.
