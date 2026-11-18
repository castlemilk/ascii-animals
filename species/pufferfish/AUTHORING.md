# Pufferfish authoring record

Written before implementation on 18 November 2026. This is a stylized pufferfish study, with original geometry and timing rather than a biological simulation.

## Scope and custody

- Goal and audience: a small, recognizable round fish that notices a deliberate nearby approach, inflates in stages with short radial spines, wobbles buoyantly, then deflates and rests. Browser artwork and typed species implementation for the ASCII Animals coordinator.
- Authority: create/review/test only this species, push `feat/animal-pufferfish`, open its own draft PR to `main`. Integration/release remain with the coordinator.
- Exact base: `castlemilk/ascii-animals` main `0e446c47b491b751d484e40db753ec725652b515`, inspected 18 November 2026. Parent `60235c9f127c394b163fd8c02de408c8ac2e7aa5` includes import `7e5984d34a139b8de4643f1ed0607897a42d88dc`; latest main also contains merged manual Pages PR3. No repository AGENTS.md, package.json, or LICENSE exists in this base. Checkout was clean.
- Relevant SHA-256: `dist/artwork.js` = `381f4706bc07761e6d1e162c95ceee97c42dd687ea19469ecb4f79885bd34e91`; `dist/app.js` = `91b2677b43b51a3b6fc36c2c21c98f376ae83f9f70d78aaca3aceb30996a4669`; `scripts/check-engine.cjs` = `6b2ffa522510786d691be45c60214c25c074df5de30163fff011e8c1b1890db3`.
- Preserve every existing path. All changes live under `species/pufferfish/` in this independent checkout.
- Saved microsite/live deployments: not used as evidence for this implementation. No deployment authorized. README links exist, but neither saved microsite version nor live runtime was inspected in this task.
- Conversation access: this current instruction was read; the historical microsite conversation was not retrieved. Its contents are not reconstructed from memory.
- Actual API: browser IIFE `window.CuttlefishArtwork`, no accepted species interface. PR2 at `e7c16104a1e90c8650f7d3e09cdb1124d0321308` is separately owned, unmerged and explicitly lacks a universal species API. Its proposed types cover Cuttlefish options/stats and injected RAF scheduling only.
- Plan: TypeScript-first pure species state and geometry; a species-local compatibility bridge borrows the actual legacy `_put`, `_rasterize`, `makeAtlas`, and `render` methods. It does not call the legacy constructor or duplicate its renderer. A separate local controller owns normalized input, fixed stepping and lifecycle. Private-method integration is explicitly pending acceptance. No educational ray core is copied.

## Animal and anatomy

- Name: Pufferfish / A little breathing room; stylized, no named real species or scientific accuracy claim.
- Three silhouette anchors: round compact body; two clear raised eyes beside a small mouth; small paired paddle fins plus a short fan tail. Inflation adds short radial spines while keeping the face and fins readable.
- Minimum intended grid: 72 columns × 40 rows, displayed at 360 × 270 CSS pixels (cell aspect 1:1.35). Below that display, retain a labelled static poster/description. Default 120 × 68 cells. Maximum 160 × 90.
- Supported views: front three-quarter default, left/right three-quarter, front poster. Full rear and arbitrary camera orbit are unsupported.
- Exaggerations: enlarged eyes, visible side fins, short even spines, and simplified circular abdomen support recognition. Inflation timings are artistic.

| Part | Parent attachment | Neutral dimensions (local units) | Motion / limits | Occlusion / smallest footprint |
| --- | --- | --- | --- | --- |
| Body | Scene root | Ellipsoid radii roughly 0.92 × 0.78 × 0.72 | Smooth radius factor 1→1.65; slow vertical drift and roll ≤0.055 rad | Continuous closed surface; 20+ cells across at minimum grid |
| Eyes | Upper-front body surface | Two raised balls radius about 0.16, separated by 0.60 | Stay attached as body grows; pupils face forward | At least two cells per eye; depth front of body |
| Mouth | Front body surface below eyes | Small puckered ring radius about 0.10 | Slight closed/open change through noticing | Face contrast, never a detached floating glyph |
| Pectoral fins | Left and right sides of body | 0.35–0.46 span | Independent phase and amplitude; no shared mirrored flapping | Broad fan samples, attached roots, behind eyes |
| Tail | Rear body | Short stalk plus 0.38 fan | Small continuous side sway, attached at inflated radius | Visible in three-quarter views; naturally occluded front-on |
| Spines | Body radial normals | Short 0.04 resting / ≤0.24 inflated | Grow only with inflation, no particles or pulse objects | Bounded 42 spines; suppress face-facing spines for clear eyes |

## Reference and rights ledger

| Source / original construction | Retrieved date / hash | Observation learned | Permission / license | Copied material / notice |
| --- | --- | --- | --- | --- |
| User's pufferfish brief | 18 November 2026 | Round body, eyes/fins, staged inflation, retreat/cooldown | User-directed original work | No external art |
| Original ellipsoid, fin fans, eye shells and radial spine formulas | To be authored in this branch | Independent geometric construction | Repository owner retains license decision | No online ASCII drawings, images or models |
| Reactive animal skill | `e721252075a30888198aafba0953a23fd07bd3c6`; SKILL blob `8ef04dec7f4031f7e69b1319e182a7d722b41fe4` matches requested `23e078…` version | Template, deterministic/lifecycle/visual review requirements | Read as workflow | No ray code copied |
| Existing `dist/artwork.js` | Hash above | Reuse actual atlas/projection/depth seams | Same repository, unchanged in place | Runtime dependency; no duplicate renderer |
| Host system font stack | SFMono-Regular, Consolas, Liberation Mono, monospace | Legacy atlas metrics | Use installed fonts only; names grant no redistribution rights | No font binary bundled |

## Representation

- Canvas glyph atlas using existing renderer; logical cell export uses printable ASCII plus newline. Not an interactive terminal application.
- Existing glyph repertoire `.,:;!i1l+txzvcofnae0&%8B@`, plus spaces for empty export cells. Existing tone mapping and atlas are reused. No Unicode plankton; optional decoration disabled.
- Cell aspect 1:1.35, centered glyph baseline through legacy atlas. Projection respects that aspect; maximum backing canvas 1200×675 CSS units at DPR≤2 (3.24M backing pixels).
- ASCII output rejects non-ASCII/control injection; export uses textContent. Color and the fixed ambient background are raster presentation, not ASCII text.
- No bundled fonts or downloads. Await browser fonts.ready when available; rebuild atlas on resize/DPR changes. State and cell determinism are separate from environment-specific raster pixels.

## Behavior script

| State | Entry | Body and appendages | Exit / fixed default duration |
| --- | --- | --- | --- |
| Idle | Reset or completed cooldown | Small round body, slow bob, independent fins | Nearby pointer within 0.30 normalized radius or deliberate Approach control |
| Approach | Sustained nearby target | Eyes orient, small anticipation, no inflation burst | 30 ticks (0.50 s) dwell; retreat cancels |
| Inflate | Dwell complete | 42 ticks to first 55% inflation; 36 more ticks to full size; short spines lengthen smoothly | 78 ticks; retreat begins recovery immediately |
| Hold | Full inflation | Bounded buoyant wobble, stable spines, attached fins | At most 180 ticks (3 s), or earlier on retreat |
| Recover | Retreat or hold timeout | Smooth 150-tick deflation from current inflation; no restart on repeated approach | 150 ticks (2.5 s) |
| Cooldown | Deflation complete | Calm original silhouette; fin/bob phases continuous | 180 ticks (3 s); also requires pointer outside retreat radius before rearming |

- Paired fins have different phase offsets and modestly different amplitude; whole-body drift is independent of fin motion. No per-frame random noise, strobing or particle spawning.
- Idle oscillations use continuous seeded phases; no artificial loop jump. Recovery uses a smooth interpolation captured at entry so retreat during either inflation stage remains continuous.
- Input coordinates normalized from current CSS bounding rectangle to [-1,1], independent of DPR; zero/nonfinite rect is rejected. Proximity uses aspect-corrected coordinates. Pointer hover near center must dwell; distant actions leave idle. Touch buttons provide explicit Approach / Give space without hover. Pointer down does not globally startle.
- Keyboard: native buttons with Enter/Space; native view selector. No page-wide shortcuts or intercepted form keys. Pause/Resume and Reset are distinct.
- Events: explicit next integer tick and globally increasing seq; at most 16 events/tick. Entire batch validated before state change. DOM pointer moves coalesce to one slot; actions coalesce to one slot. Leave/cancel clears target. Retreat takes precedence over approach within the same tick. No unbounded event queues.
- Cooldown ignores repeated approach; holding the pointer nearby cannot retrigger until it retreats beyond 0.42 normalized radius. One animal only; no population/formation options in this slice.

## Reproducibility and typed API

- Species/schema version `pufferfish-v1` / 1; seed default 23; 60 integer ticks/s; tick 0 idle; no ambient random, time, DOM or font reads in species logic.
- Explicit `PufferfishOptions`, resolved config, normalized input union, event, discriminated behavior union, readonly state and result types. TypeScript source is authoritative; checked generated ESM and declarations serve buildless demo/consumers.
- Durations expressed in ticks with documented bounded integer ranges. Geometry scale/approach radius validated finite before allocation. Unknown keys and malformed event batches reject atomically.
- `configure(patch)` validates whole patch, then starts a new deterministic run with merged config and cleared input; preserves explicit pause. `reset()` keeps current config/seed; optional seed reset is explicit. Rendering options are separately typed and updated without simulation mutation.
- Pure advance consumes exactly the next tick. Browser clock only supplies fixed ticks; max 5 catch-up ticks/frame, excess wall time counted and dropped. Suspension clears accumulator and transient target; no catch-up after resume.
- Recorded scenario: tick 1 pointer far; tick 61 pointer near center; tick 220 leave; tick 610 deliberate approach; tick 780 retreat; tick 1110 idle. Same seed/config/ordered normalized log gives same state and logical cells for 1/2/5-tick render grouping in the same JS runtime. Live mouse recordings are not assumed equivalent across browsers. Cross-font pixel identity unsupported.
- Save/restore of arbitrary snapshots unsupported; replay starts from seed/config and bounded supplied events. Generated event fixture is part of evidence.

## Accessibility and lifecycle

- Interactive artwork with concise text alternative and semantic adjacent controls; glyphs are not a live region. Sparse user-action status only, no frame announcements.
- Reduced motion starts with neutral poster; Approach / Give space deliberately swap static inflated/calm poses without advancing a continuous loop. Pointer motion cannot override reduced motion. Live preference changes cancel RAF and show static pose.
- Pause persists through reset/configure, reduced-motion and visibility transitions. Hidden OR offscreen OR zero-sized OR reduced OR user-paused OR destroyed suspends scheduling. Below minimum viewport shows a static fallback with description.
- Pointer leave/cancel/lost capture/blur releases transient target. Events received while suspended do not queue a delayed surprise.
- Own all listeners, RAF and observers per controller; failure rollback removes acquired resources. No global mutable animal singleton. Idempotent destroy; post-destroy mutation throws a documented error; inspection remains available. Two instances independent.
- Canvas unavailable: keep static text description visible and controls nonmisleading. Native Canvas capture is distinct from actual browser acceptance.

## Budgets and acceptance pinned before tests

One animal; ≤16000 geometry samples/frame; 42 short spines; 0 particles; ≤160×90 cells; at most 16 core events/tick and 2 pending DOM input slots; maximum 1200×675 CSS draw area, DPR≤2; ≤5 ticks/frame. Default 120×68 grid, 900×506 CSS viewport. Browser profiling target (if launch succeeds): 5 s warmup +30 s, p95 step+draw ≤12 ms / p99 ≤20 ms at default grid. Native timing is recorded separately and cannot pass browser target-device gates.

| Gate | Fixed scenario | Pass condition | Pre-code status | Remaining work |
| --- | --- | --- | --- | --- |
| Silhouette | Minimum and default grids; front/left/right; no glow | Eyes, body, fins/tail identifiable before inflation | Untested | Capture and independent review |
| Motion | Seed 23 event log above | Ordered stages, continuous attachments/radius, no pulse accumulation | Untested | Numeric tests and rendered sequence |
| Replay | Same log, 1/2/5-tick render groups | Identical state/cells | Untested | Property tests |
| Input | Invalid batch, rapid pointer, leave/retreat, repeat trigger | Atomic rejection, bounds, no stale/unlimited reaction | Untested | Unit and controller tests |
| Types | Positive consumer + intentional errors | Strict typecheck; expected errors consumed | Untested | Run available TS compiler |
| Accessibility | Keyboard/touch equivalents, reduced preference | Controls usable; static policy preserved | Untested | Browser if possible, mocks separately |
| Cleanup | Repeated mounts, two instances, failure setup | No owned scheduled resources/listeners after destroy | Untested | Mock bookkeeping; browser heap still separate |
| Legacy regression | Original numerical harness | No regression; shared files unchanged | Untested | Run after implementation |
| Performance | Declared browser/device workload | Above target if measurable | Browser launch blocked | Chromium failed before page with socket/ptrace Operation not permitted; no security-setting workaround |

## Handoff

Final commands, runtime versions, images, independent findings/fixes and unrun acceptance will be recorded in `VERIFICATION.md`. Exact source hashes and skill/PR2 compatibility will be in `PROVENANCE.md` and `API.md`. Draft-only status and integration acceptance pending remain explicit.

### Post-implementation reconciliation

The initial record above is retained as the pre-code plan. Actual default evidence is 900×506 / 120×50 cells; rows follow viewport aspect. The 4:3 UI at 900×675 yields 120×67, and the intended minimum 360×270 is exactly 72×40. These dimensions were corrected in the API/evidence rather than relabelling the captures as 120×68. Actual maximum sample counts are 4,572 / 7,994 / 12,922. The legacy atlas is a separate bounded allocation: at maximum small-quality cell size and DPR2 its 72px sprites occupy 9,331,200 pixels; this is distinct from the main canvas's 3.24M-pixel cap and is not a measured heap claim.

Native review found the original neutral fins too small and the turned eye pair weak. One bounded geometry pass enlarged/rounded the fins and slightly enlarged/raised the eyes. Body, spines and response timing remained unchanged; before/after captures are retained. Compact viewports now keep deliberate static pose controls.

Before delivery, incoming PR2 was re-read at `8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1`. It now offers a TypeScript facade for literal species `'cuttlefish'` only and a changed generated atlas/render dependency. The pufferfish's original main pin and pending integration status remain explicit. PR4 catalogue was also read without modification. See `PROVENANCE.md` for the exact compatibility implications.
