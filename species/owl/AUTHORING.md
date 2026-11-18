# Owl authoring record — authored before implementation

This is the pre-code brief, retained as a historical authoring snapshot. Its original base below was inspected before implementation. During final delivery the branch was rebased onto `074b90a94bd3a747a68feed554e33a3ab0720f41`, which merged the TypeScript foundation and catalogue. The pre-code commit is now `3e657f99b37f9faa400cffed37099bbbadebbc54` (formerly `f531cb726c01102673c34d38fee551e9137c2ef2`). Current source/contract acceptance is recorded in [COMPATIBILITY.md](COMPATIBILITY.md); the original design commitments below remain unchanged.

## Scope and custody

- Goal: an original, recognisable perched owl with restrained attention and a complete blink → feather ruffle → wing stretch → recovery loop. One independently reviewable species for Ben's ten-species exercise.
- Allowed work: local design, original TypeScript source, species-local demo/tests/evidence, review, push `feat/animal-owl`, and open its own **draft** PR. No merge, deployment, npm publication, shared contracts/registry/README changes or changes to another author's branch.
- Repository: <https://github.com/castlemilk/ascii-animals>. Independent checkout: `ascii-animals-owl`; branch: `feat/animal-owl`.
- Exact base: **`0e446c47b491b751d484e40db753ec725652b515`**. Inspected on 2026-11-18. This includes the user-specified import merge `60235c9f127c394b163fd8c02de408c8ac2e7aa5` and import `7e5984d34a139b8de4643f1ed0607897a42d88dc`, plus PR #3's manual Pages workflow. No `AGENTS.md`, package manifest or license file exists in this base tree. Initial independent worktree is clean.
- Inspected source SHA-256: `dist/artwork.js` = `381f4706bc07761e6d1e162c95ceee97c42dd687ea19469ecb4f79885bd34e91`; `dist/app.js` = `91b2677b43b51a3b6fc36c2c21c98f376ae83f9f70d78aaca3aceb30996a4669`; `dist/cuttlefish.html` = `edd0bc75c960c24e04d94864e750bf8ce5b254ae818d6af74b3a5f001062c5f2`; `scripts/check-engine.cjs` = `6b2ffa522510786d691be45c60214c25c074df5de30163fff011e8c1b1890db3`.
- Dirty/original files: none in this checkout; preserve all existing paths. All owl deliverables live under `species/owl/`.
- Saved microsite/live deployment: not inspected or changed. The source README links a public Pages demo and a separate saved Cuttlefish microsite; neither proves that this owl is deployed.
- Conversation: this task is the actual brief read. The separate Cuttlefish microsite conversation was not retrieved and is not used as evidence of its contents.
- Skill: `generate-reactive-ascii-animals` from `skunkworq/skunkworq-skills`, reviewed head **`e721252075a30888198aafba0953a23fd07bd3c6`**. The requested earlier link at `23e078642157a273e2b886222470bd247e5737b5` has the same `SKILL.md` blob `8ef04dec7f4031f7e69b1319e182a7d722b41fe4`. Read the linked authoring template, baseline, anatomy/glyphs, portable contract, accessibility/performance, validation, quickstart, examples and teaching reference. No teaching ray code is incorporated.
- Existing API: merged `window.CuttlefishArtwork` has no public species injection, projection or glyph writer. PR #2 (`feat/npm-library-review`, inspected head **`e7c16104a1e90c8650f7d3e09cdb1124d0321308`**) exposes cuttlefish plus a scheduler, not a species interface. Its `GeometryWriter`/`AnimalDefinition` are design sketches. Owl's local TypeScript interface and diagnostic preview are additive proposals; central integration acceptance remains pending.

## Animal and anatomy

- Name: **Owl / The night watch**, a stylised round-headed owl informed by barred-owl proportions. This is not a scientifically validated species model.
- Three silhouette anchors: (1) a broad, round facial disk, (2) two separated forward-facing eyes and a small central beak, (3) a rounded upright body with folded wings, two feet and a stable perch.
- Smallest accepted design target: **64 × 36 printable cells**, approximately 350 × 330 CSS px with the declared monospace metrics. Default 96 × 54; maximum 160 × 90. The below-minimum container still shows a scaled poster; it is not a readability claim.
- Views: front and modest left/right turns, maximum configured yaw 45° and pitch 20°; default yaw 34°, pitch 12°. Full profile/rear and 360° head rotation are deliberately unsupported. Both eye landmarks should remain visible throughout accepted views.
- Artistic exaggerations: large facial disk and eyes, compressed tail, individually visible feather bars, short paired wing stretch and ruffle. Timings are designed, not observed animal measurements. Eye attention is carried by the head/face transform; no independent human-like eyeball rolling.

| Part | Parent attachment | Neutral dimensions (local units) | Motion / limits | Occlusion / smallest footprint |
| --- | --- | --- | --- | --- |
| Body | Perch/root | centre (0, .27), half-width .43, half-height .59 | Root never translates; feather envelope ≤4% | Behind face; rounded connected mass |
| Facial disk | Neck at body top | centre (0, -.43), radii about .54 × .43 | Yaw ±34°, pitch ±12° defaults; finite legal caps ±45°/±20° | In front of chest; broad oval at all supported turns |
| Eyes | Facial disk | paired centres near ±.20, -.46; radius about .10 | Fixed in the disk; eyelids close during blink | Two distinct dark pupils with small stable highlights |
| Beak | Facial disk centre | narrow downward tapered form | Moves with face, not root | Ahead of face; at least one cell at minimum grid |
| Folded wings | Shoulders near ±.32, .01 | length .69, half-width .14 | Shoulder remains attached; outward stretch ≤48° beyond folded angle | Front/side of body; left/right slight lag |
| Feet | Body lower edge | two groups at ±.18, .87 | Planted through attention and response | In front of horizontal branch; no hopping |
| Tail / branch | Body / scene | short rear tail / branch y≈.99 | Fixed | Tail behind body; branch cannot be mistaken for an animal hit |

## Reference and rights ledger

| Source / original construction | Retrieved / pin | Observation learned | Permission / license | Copied material / notice |
| --- | --- | --- | --- | --- |
| [Smithsonian National Zoo: barred owl](https://www.nationalzoo.si.edu/animals/barred-owl) | 2026-11-18 | Large rounded head, well-defined face, no ear tufts, feathered legs | Reference text/photos remain their owners' material | No photograph, diagram, model or text passage copied |
| [Cornell Lab: barred owl identification](https://www.allaboutbirds.org/guide/Barred_Owl/id) | 2026-11-18 | Stocky body, rounded head, dark eyes, chest/belly barring | Reference only | Independently constructed ellipses, feather surfaces and attachment landmarks |
| [Cornell Lab: Barred Owl Nest FAQ](https://www.allaboutbirds.org/news/bird-cams-faq-barred-owl-nest/) | 2026-11-18 | Forward-facing eyes with limited socket movement; head compensates | Reference only | Limits here are conservative artistic limits, not quoted biological maxima |
| Geometry, equations, TypeScript, demo and tests in this directory | This branch | Original mathematical construction for this task | New contribution; repository licensing decision remains with owner | No online ASCII drawing, model, ray core or cuttlefish implementation copied |
| Host `monospace` with system fallbacks | Host-selected; no font file bundled | Fixed-width text presentation | Installed system font use; no redistribution claim | No external font request or font binary. Pixels may differ by platform |

## Representation

- Printable ASCII grid as an actual `pre.textContent` string, not a font atlas or terminal emulator. Browser screenshots are DOM text evidence, not native Canvas evidence.
- Original analytic geometry gives local surfaces and depth/tone/material information. A small owl-only diagnostic sampler converts these surfaces into cells. It is not a new generic scene engine, registry or package renderer.
- Ramp initially ` .,:;+=ox%#@`, with explicit eye/beak/feather/perch glyphs where needed. Final repertoire will be recorded in the executable source and spec. Reject non-ASCII glyph configuration and control/ANSI/bidi characters.
- Cell aspect target 0.55 width/height, centred orthographic view with fixed framing; no automatic zoom with pose. Monospace font, line-height 1.1. CSS size scales the text; DPR cannot change logical input or glyph output. No canvas backing allocation.
- Text export is exact equal-width rows separated by LF. Use `textContent`/textarea values exclusively. No decorative bitmap, glow, particles, generated illustration or imported model.
- Wait for document font readiness for captures; missing preferred font uses generic monospace. Do not promise identical pixels across hosts.

## Behavior script

| Phase | Entry | Body / head | Appendages | Exit / duration |
| --- | --- | --- | --- | --- |
| Idle | Initial state or no target | Root fixed; low-amplitude seeded attention/breathing envelope | Folded wings, periodic seeded blink | Until attention or deliberate reaction |
| Approach / interest | Normalized attention target | Ease bounded head yaw/pitch toward target; root fixed | Eyes remain attached to face | While attention remains; leave eases to rest |
| Response: blink | Accepted deliberate `react` | Head stops following new targets during sequence | Close/reopen lids | 18 ticks |
| Response: ruffle | Blink finished | Root and feet fixed | Feather envelope expands/contracts; no particles | 36 ticks |
| Response: stretch | Ruffle finished | Head remains controlled | Left/right attached wing stretch; one side lags six ticks | 60 ticks |
| Recovery | Stretch ends | Head returns smoothly toward rest | Smoothly settle remaining stretch/feather displacement | 48 ticks |
| Cooldown | Recovery ends | Normal attention may resume | Folded wings | Default 120 ticks, configurable 30–600; react ignored, not queued |

- Idle periodic motion is continuous; seed sets phase/blink timing without per-frame randomness. Every return curve ends at its neutral position and zero envelope slope. Independent wing lag never changes shoulder attachment.
- Inputs: `{tick, seq, type:'attention', x, y}`, `{tick, seq, type:'leave'}` or `{tick, seq, type:'react'}`. `x,y` are finite normalized values; document whether finite outside-range values clamp. The entire batch validates before any state changes.
- Events use next integer tick and globally increasing nonnegative safe integer `seq`. Core max 16 events/tick. Same-tick inputs apply in sequence; last attention/leave wins, at most one reaction starts. Extra reactions during response/recovery/cooldown are counted and ignored. No implicit reaction from pointer speed.
- Browser coalesces pointer traffic to one latest attention/leave plus one deliberate reaction. Scene button owns its sole owl; empty background cannot trigger a reaction. Semantic Guide select and React button give keyboard/touch equivalence. No global keyboard shortcuts or scroll blocking.
- Options update atomically and preserve seed, tick, sequence and current behavior; changed limits clamp pose. Reset may explicitly choose a new seed, clears tick/events/behavior, and preserves host pause. No population/formation API is proposed in the owl module.

## Reproducibility

- Schema/species version 1, seed 7, one owl, fixed **60 ticks/second**, initial tick 0 and last sequence -1. Determinism means identical state/logical cells for identical version/configuration/seed/normalized event log and explicit ticks in the same JS runtime.
- Canonical event log: tick 30 seq 0 attention (.8,-.35); tick 90 seq 1 react; tick 91 seq 2 react (ignored); tick 210 seq 3 leave; tick 330 seq 4 attention (-.8,.2); tick 390 seq 5 leave. Capture neutral, attention, blink, ruffle, stretch, recovery, cooldown and final rest. Render at 1/2/5-tick grouping without changing simulation.
- No wall-clock/DOM/random dependency in species logic. Browser owns presentation timestamps and converts to bounded fixed steps. No speed multiplier in initial API; a host may change render cadence without changing simulation semantics.
- Maximum five catch-up ticks/frame; report dropped wall milliseconds. Hidden/offscreen/zero-size/pause/preference suspension clears presentation accumulator and pending transient input. Resume does not catch up a hidden interval.
- Reset resets simulation and input sequence; it does not clear explicit user pause or reduced-motion preference. Dispose is idempotent; mutations and snapshots after disposal reject consistently; status may still report disposal.
- Pixel reproducibility is only asserted for the recorded local browser/font. JSON event-log replay is supported; arbitrary serialized state restore/cross-version migration is unsupported.

## TypeScript and proposed adapter

- Explicit exports will include `OwlOptions`, validated `OwlConfig`, `OwlInput`, discriminated `OwlBehavior`, immutable `OwlState`, `OwlStepResult`, geometry/sample types and `OwlInstance`.
- Local factory provides typed `advance(tick, inputs)`, `update(patch)`, `reset(seed?)`, `getState()`, `getOptions()`, sampling and `dispose()`. Update cannot secretly reseed. Strict positive/negative compiler fixtures verify the actual generated declarations.
- Optional browser `frameSource.subscribe(callback): unsubscribe` matches PR2's implemented scheduler shape. The owl unsubscribes itself and never disposes a shared scheduler.
- Geometry adapter proposal maps original Owl surfaces/samples to PR2's **non-exported** `GeometryWriter` sketch with explicit coordinate/material mappings and capacity failure. It will not import an imaginary package entry or claim acceptance.

## Accessibility and lifecycle

- Interactive artwork described as a perched round-faced owl with two eyes, folded wings and feet on a branch. The glyph block is an image with a concise label; no glyph/frame live region.
- Meaningful static poster from initial seed. Reduced motion starts static and responds to deliberate Guide/React via one complete static pose, never a short burst of frames. Live pointer is ignored while paused/reduced; changing one suspension cause cannot override the others.
- Native Pause/Play, React, Reset and Guide controls, visible focus and ≥44px touch targets. Announce only deliberate control actions/policy changes, not animation ticks.
- Hidden/offscreen/zero-size causes cancel work independently. Pointer leave/cancel/lost capture clears pending and persistent target without a surprise restart. Sub-minimum space uses a static/scaled poster.
- Per-instance listener/RAF/observer ownership, setup rollback, idempotent disposal, late callback guards, multiple-instance isolation. No timers or global singleton. Pure imports safe without DOM. No framework adapter claim.
- Text renderer works without Canvas; unavailable optional APIs receive documented fallback behavior. Browser failure leaves descriptive content. Real screen-reader narration and real-phone testing are separate acceptance.

## Budgets and acceptance — targets pinned before execution

One owl/preview; ≤96 analytic primitives; ≤14,400 diagnostic cells; ≤16 inputs/core tick, ≤2 queued browser actions; no particles; no Canvas backing store; ≤5 simulation steps/frame. Sample-writer proposal capacity is explicit, with no silent truncation. Demo accepts grids 64–160 columns and 36–90 rows; anatomy aspect must remain bounded. Normal-size workload target: 96×54 at 60Hz, p95 simulation + sampling/text-write work ≤8ms and p99 ≤16ms after 2s warmup / 30s run. This excludes browser paint and is not an FPS guarantee. Real phone target remains unmeasured.

| Gate | Fixed scenario | Pass condition | Initial status | Evidence destination |
| --- | --- | --- | --- | --- |
| Silhouette | 64×36 neutral, ±34° turn, stretch; no color/effects | Three anchors recognisable; eyes separated; no clipping | Untested | `evidence/` and independent review |
| Motion | Seed 7 canonical log at normal speed | Blink/ruffle/stretch/recovery order; stable perch/attachments | Untested | Actual frame sequence/GIF if runtime permits |
| Replay | Same log, 1/2/5 render groups | Deep equal state and final cells | Untested | Node test output |
| Input | NaN, infinities, bad ticks/seq, flooding, repeat react | Atomic rejection, bounded queue, cooldown honored | Untested | Node/browser tests |
| Types | Strict examples and intentional invalid usage | Positive pass and all expected errors observed | Untested | Compiler output |
| Lifecycle | Repeated/two mounts, throw during setup, late callbacks | No owned pending work; other instance survives | Untested | Stub evidence and browser evidence kept separate |
| Accessibility | Keyboard controls, touch emulation, reduced motion | No unexpected animation or scrolling trap | Untested | Browser checks; real screen reader/phone still pending |
| Performance | Declared host, Chromium, 96×54, 30s after warmup | Report p50/p95/p99; compare against targets above | Untested | Measurement JSON; no post-hoc relaxed threshold |
| Baseline | Unchanged Cuttlefish source and standalone | Existing numerical suite/syntax pass, byte hashes unchanged | Untested | Regression output |

## Handoff

Implementation, exact source/skill provenance, local reproduction, default/validation table, compatibility proposal, tests, screenshots and critique will be in this directory. `VALIDATION.md` will record actual commands/runtime versions/exits, inspected visual states, independent review and one evidence-led correction. Unknown gates remain unknown. Current release state: **local additive species work, integration acceptance pending, intended draft PR only**.
