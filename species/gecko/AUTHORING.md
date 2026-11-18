# Gecko / A small act of courage

Authoring record completed before implementation, 18 November 2026. This copies
the sections of the reviewed `generate-reactive-ascii-animals` template. Initial
acceptance is untested; executed results belong in `evidence/REVIEW.md`.

## Scope and custody

- Goal: an original, interactive, stylized dorsal gecko with a readable broad
  head, four splayed feet, planted toes, and a continuous tapered tail.
- Authorized scope: `species/gecko/**` only; new branch `feat/animal-gecko` and
  its own draft PR. Integration owner retains shared engine/package decisions.
- Repository: https://github.com/castlemilk/ascii-animals . Exact implementation
  authoring base: `0e446c47b491b751d484e40db753ec725652b515` (main inspected at authoring).
  Previous main `60235c9f127c394b163fd8c02de408c8ac2e7aa5` and import
  `7e5984d34a139b8de4643f1ed0607897a42d88dc` are ancestors, not the new base.
- Clean isolated clone before authoring; no existing dirty files touched. No
  AGENTS.md, package manifest, or license file existed in that authoring-base tree.
- Inspected source SHA-256: `dist/artwork.js`
  `381f4706bc07761e6d1e162c95ceee97c42dd687ea19469ecb4f79885bd34e91`;
  `dist/app.js` `91b2677b43b51a3b6fc36c2c21c98f376ae83f9f70d78aaca3aceb30996a4669`;
  `scripts/check-engine.cjs` `6b2ffa522510786d691be45c60214c25c074df5de30163fff011e8c1b1890db3`.
- Main exposes `window.CuttlefishArtwork`; geometry/projection/atlas are private
  methods inside that class. There is no safe public species seam to consume.
- Incoming draft PR #2 inspected read-only at
  `e7c16104a1e90c8650f7d3e09cdb1124d0321308`. Its exported core is a scheduler;
  `docs/EXTENDING.md` contains a proposed AnimalDefinition/GeometryWriter, not an
  accepted runtime. This species will provide a small proposal adapter, without
  patching that branch or copying its implementation. Integration pending.
  Rechecked at `8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1` before handoff:
  a new strict TypeScript createArtwork facade is cuttlefish-only; the general
  writer/species sketch is unchanged. Exact policy differences are recorded in
  COMPATIBILITY.md. Incoming catalogue PR #4 was read at
  `5015dbcffb75b1036b21b4b8e3e65bf0697a46f1`; no shared species seam was added.
- Original saved microsite and named conversation were not accessed in this
  task. The repo import is inspected directly. No live deployment, former
  transcript contents, npm release, or hosted gecko is claimed.

Publication-time reconciliation: main advanced to
`074b90a94bd3a747a68feed554e33a3ab0720f41`, merging PR #2's canonical ESM/TS
foundation and PR #4's reconciled catalogue. This isolated branch was rebased
onto that exact final integration base. The merged facade and extension sketch
are unchanged from the inspected PR #2 head: cuttlefish is the only public
species, and the generic writer remains a proposal. New main regressions and
the species checks are recorded separately in `evidence/`. The original
authoring decisions above retain their original source custody.

## Animal and anatomy

- Name: stylized pad-toed gecko; no claim of a scientifically exact species.
- Three anchors: broad wedge-shaped head; exactly four separate splayed limbs
  ending in five rounded pads per foot; long attached tail tapering to a tip.
- Minimum supported grid: 112 columns × 50 rows; minimum demonstration width
  360 CSS pixels. Default desktop 176 × 78. Smaller hosts display a description.
- Views: dorsal right/left/up/down and in-plane turns. No profile or frontal 3D
  view is claimed. The apparent body volume comes from surface tone/depth.
- Exaggerations: enlarged head and toe pads, leg separation, and a deliberate
  curl/retreat response are artistic choices, not measured biology.

| Part | Parent attachment | Neutral dimensions (world units) | Motion/limits | Occlusion / small footprint |
| --- | --- | --- | --- | --- |
| Body | Scene root | Half-length .25; half-width .115 | Root x ±.26, y ±.13; bounded turn | Filled oval, about 16×5 minimum cells |
| Neck/head | Front body | Neck x .22; head center .35, half-size .20×.155 | Follows body heading | Wedge broader than neck, two raised eyes |
| Forelimbs | Shoulders x .13, y ±.075 | Upper/lower reach .19/.25 | Two-bone bend; no disconnected joints | Two visible bent segments per limb |
| Hindlimbs | Hips x -.14, y ±.08 | Upper/lower reach .19/.25 | Sequential diagonal-order swings | Separated from tail and front limbs |
| Feet/digits | Wrist/ankle anchors | Fan radius .16–.182; pads radii .026/.023 after critique | Stance palm AND fan heading remain fixed | Five pads per foot, separated at low grid |
| Tail | Pelvis x -.23, y 0 | Centerline .85; radius .078→.004 | Continuous integrated curve; curl < one turn | About half total length, taper retained |

## Reference and rights ledger

| Source / construction | Retrieval | Observation | Rights | Copied material |
| --- | --- | --- | --- | --- |
| User's gecko brief | This conversation, 18 Nov 2026 | Required anchors and response | Authorized original implementation | Requirements only |
| Original analytic geometry authored here | This branch | Elliptic body, wedge head, jointed limbs, fan digits, integrated tail | Repository owner chooses project license | No third-party drawings/sprites/models |
| Reviewed authoring skill and linked template/reference docs | `e721252075a30888198aafba0953a23fd07bd3c6`; supplied `23e078642157a273e2b886222470bd247e5737b5` | Method, validation, separation | Used as requested guidance | No ray runtime copied |
| Main renderer and PR #2 proposal | Exact refs above | Existing boundaries and future writer shape | Existing repository custody | No renderer copied into species |
| Host monospace font | Runtime-selected | Readable fixed-width ASCII glyphs | Uses installed fonts, no redistribution | No font binaries bundled |

No external anatomy image, ASCII drawing, texture, model, raster concept, or
generated image is used. CSS requests `ui-monospace`, `SFMono-Regular`,
`Consolas`, `Liberation Mono`, `monospace`. Native evidence will record the actual
font/browser if available; fallback pixel identity is not promised.

Bounded revision after the first actual capture: the initial .12–.138 toe fan,
.51-radian digit spacing and .032/.026 pads read as mittens at 112×50. The fan
now uses .16–.182 reach, .66-radian spacing and .026/.023 pads; the declared
minimum grid stays unchanged. Before/after evidence is retained.

## Representation

- Printable ASCII cell grid plus a Canvas presentation of those exact cells.
  Glyph union: space, `.:-=+*#%@oO`. No Unicode/ANSI/control/bidi characters.
- Stable skin tone ramp `.:-=+*#%@`; pads/eyes use explicit `o`/`O` landmarks.
  Neutral review replaces occupied cells with one glyph and one tone.
- Species emits finite world x/y/z, tone, material, stable sample ID. Species
  owns no projection, fonts, DOM, clock, or rendering. Preview uses a fixed
  orthographic 3.4×2.6 world window and a bounded grid. It is a local diagnostic
  painter, not a second shared renderer or proposed package engine.
- Nominal glyph aspect .6; rendering letterboxes the fixed world aspect to avoid
  stretching anatomy. Font baseline centered; canvas DPR capped at 2. No font
  download or asynchronous font dependency. Resizes rebuild bounded backing size.
- Text export contains fixed-width rows via `textContent`, never innerHTML.
- Page framing and guide marker are decorative UI, not part of exported art.
  No particles, glow, shadows, or background noise obscure the silhouette.

## Behavior script

| Phase | Entry | Body path / heading | Local motion | Duration / exit |
| --- | --- | --- | --- | --- |
| Idle | Initial state, target reached/cleared | Root settles; no autonomous travel | Small breathing and continuous tail phase | Until normalized guide or deliberate startle |
| Approach | Guide outside stopping radius | Slow bounded movement and turn toward guide | One foot swings at a time, FL→RR→FR→RL order; other toes stay planted | Until target reached/cleared |
| Startle | Explicit startle while idle/approaching | Hold root, remember retreat heading | Tail smoothly curls; any active swing finishes | Default 18 ticks |
| Retreat | Startle ends | Short backward motion, total target .14 units | Same contact-aware stepping, curled attached tail | Default 48 ticks |
| Recover | Retreat ends | Curious slower return toward current target | Curl gradually relaxes, toe contacts preserved | Default 120 ticks |
| Cooldown | Recovery ends | Normal guidance may resume | Breathing and stepping continue | Default 120 ticks; repeat startles ignored |

- Independent phases: four named feet; at most one swing, a minimum of three
  planted feet. The movement gate limits root/heading changes before limb reach
  is exceeded. Swing paths lift and land smoothly, including stop/start reversals.
- No time-modulo root teleport. Tail phase is continuous; default breathing
  returns with continuous position/velocity. Reset is an explicitly requested cut.
- Pointer: CSS rect only, finite coordinates normalized to [-1,1], clamped.
  Preview guides the sole animal. Empty space is guidance, never startle.
  A Startle button deliberately targets the sole gecko; no hit-test claim.
- Keyboard/touch: native directional Guide buttons plus Pause, Reset, Startle;
  arrows when the stage is focused; Space toggles pause there only. Page scroll
  remains available on touch. Pointer leave/cancel/lost capture clears intent.
- Inputs: explicit next integer tick, strictly increasing sequence, maximum 32
  per batch. Validate all before mutation. Last guide/leave wins; startle has
  behavior priority independent of its position in a same-tick batch. Repeat
  startles during response/recovery/cooldown are ignored with a typed reason.
- Browser coalesces to one pending guide/leave plus one startle. The queue is
  constant-sized. Clear transient input on suspension; no latent resume action.
- One gecko per instance. No formation/population API. Options update preserves
  identity/tick/behavior; seed changes require explicit reset. Invalid updates
  are atomic. Distinct instances share no mutable state.

## Reproducibility

- Species/schema version 1; default uint32 seed 37; 60 integer ticks/second.
  Initial root (.18,0), heading -.24 rad, four planted feet, relaxed tail.
- Same runtime/version, initial seed/resolved options and ordered normalized
  events yield identical state and cells regardless of 1/2/5 tick render groups.
  Cross-engine Math results and font-dependent raster pixels are not guaranteed.
- Core never reads Date, performance, Math.random, DOM, font metrics or RAF.
- Demo timing: ≤5 catch-up ticks per frame. Excess wall time is dropped and
  counted. Resume starts a fresh accumulator; no hidden-tab catch-up.
- Reference event log: guide at tick 1, startle at 181, guide reversal at 320,
  leave at 570; explicit sequence IDs 1–4. Capture idle, approach, curl, retreat,
  recovery, cooldown and neutral orientations under identical seed/options.
- Reset clears tick, queue, sequence, gait, target, reaction; preserves options
  unless explicitly replaced, and always preserves user pause and motion policy.
- Snapshot is a defensive read-only value. Replay from initial config/events is
  supported; arbitrary serialized-state restore and cross-version migration are
  explicitly unsupported.

## Accessibility and lifecycle

- Interactive specimen; canvas has concise gecko description, not live glyphs.
  Meaningful neutral poster at startup with reduced motion. Deliberate Startle
  may select a static curled-tail poster without starting the simulation.
- Rest causes compose: user pause OR reduced motion OR hidden OR offscreen OR
  page suspension OR zero/insufficient size OR disposed. No pointer/option/reset
  action clears them. Persisted pagehide retains controls; pageshow refreshes
  state without changing pause. Nonpersisted pagehide disposes the demo.
- Native buttons, labels, fieldset, visible focus, 44px targets. Status is sparse
  user-action feedback, not per-frame announcements. Arrow keys are stage-local.
- No rescheduling RAF while resting. Zero-size does not allocate backing/grid
  storage. Hidden/offscreen cancels work and clears transient intent.
- Mount owns all listeners, observers and RAF; partial setup rolls back. Canvas
  failure leaves a visible text description/static ASCII alternative.
- Idempotent dispose. After disposal, read status remains available; mutating
  calls reject consistently. Late callbacks do nothing. Multiple mounts tested.

## Budgets and acceptance (declared before measurement)

- One animal, ≤12,288 surface samples, ≤192×86 cells, no effects/particles,
  ≤32 core events/tick, 2 pending browser intents, 5 catch-up ticks/frame.
- Backing canvas ≤1,000×780 CSS work pixels at DPR ≤2 (≤3.12M pixels).
- Desktop target: p95 simulation + sampling + glyph drawing ≤16ms for default
  176×78 grid, after 2s warmup and 30s collection on declared browser/host.
  This is a predeclared target, not a result. No mobile FPS or heap claim.
- 360px mobile layout target: controls usable without horizontal document scroll;
  minimum 112×50 glyph poster retains head, four feet and long tail.

| Gate | Fixed scenario | Pass condition | Initial result |
| --- | --- | --- | --- |
| Recognition | 112×50 neutral right/left/up/down/turn | Three anchors readable, four separate feet | Untested |
| Motion | Seed 37 reference log, normal speed | Planted toes, continuous tail, ordered phases | Untested |
| Geometry | Full turns and option extremes | Finite bounded samples, attached tail/limbs, ≤capacity | Untested |
| Replay | Same log, render every 1/2/5 ticks | Identical state/cells | Untested |
| Inputs | NaN/Inf/unknown/duplicate/flood/invalid update | Atomic explicit rejection, bounded pending intents | Untested |
| Types | Positive examples + expected TS failures | Real .ts source compiles strictly | Untested |
| Lifecycle | Pause/reduced/hidden/offscreen/zero-size/dispose/failure | No own queued work while resting; independent mounts | Untested |
| Browser | Keyboard/touch emulation/resize/live reduced motion | Equivalent controls, no surprise motion | Untested |
| Performance | Predeclared desktop scenario | Actual recorded work-time quantiles | Untested |

## Handoff

All code, demo, compiled JS/declarations, tests, provenance and rendered evidence
remain in this directory. `evidence/REVIEW.md` will record commands, versions,
exit results, actual frames, bounded independent critique and exact remaining
acceptance. Shared engine integration, package export/consolidation, real phone,
screen reader, prolonged heap profiling, npm publication and deployment remain
with the coordinator and are not implied by local passes.
