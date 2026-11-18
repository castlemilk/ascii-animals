# Frog authoring record — before implementation

Status: authored 18 November 2026 before species code. Results are recorded separately in `EVIDENCE.md`; all gates below begin untested. This is an original stylized frog study, with central library integration pending.

## Scope and custody

- Goal: a recognizable squat frog with large raised eyes, folded hind legs and attached forelimbs; pointer landing preview, deliberate crouch → leap → compression → recovery, and a quiet throat-sac idle.
- Authorized scope: independent `feat/animal-frog` branch and a draft PR to main. All new code, demo, tests, documentation and evidence live in `species/frog/`. No shared engine, package, registry, README, deployment or license edits.
- Repository: https://github.com/castlemilk/ascii-animals . Actual base: `0e446c47b491b751d484e40db753ec725652b515`, clean isolated checkout `/workspace/scratch/ff8d8c7dc988/ascii-animals-frog`. This is newer than supplied baseline `60235c9f127c394b163fd8c02de408c8ac2e7aa5`: manual Pages PR3 has merged. Import `7e5984d34a139b8de4643f1ed0607897a42d88dc` is preserved.
- `dist/artwork.js` SHA-256 `381f4706bc07761e6d1e162c95ceee97c42dd687ea19469ecb4f79885bd34e91`; `dist/app.js` `91b2677b43b51a3b6fc36c2c21c98f376ae83f9f70d78aaca3aceb30996a4669`; `scripts/check-engine.cjs` `6b2ffa522510786d691be45c60214c25c074df5de30163fff011e8c1b1890db3`.
- No AGENTS.md, package.json, public species registry or LICENSE exists at this base. No original/dirty paths edited. Existing Cuttlefish browser constructor remains unchanged.
- Skill: requested `23e078642157a273e2b886222470bd247e5737b5`; reviewed head `e721252075a30888198aafba0953a23fd07bd3c6`, identical SKILL.md blob `8ef04dec7f4031f7e69b1319e182a7d722b41fe4`. Read the template, all eight linked references, and teaching contracts/core/browser; none of the teaching ray implementation is copied.
- Saved microsite/live deployment: not inspected or modified for this frog. Named prior microsite conversation was not accessible/read here; no transcript claim. Repository source is the implementation evidence.
- PR2 inspected read-only at `e7c16104a1e90c8650f7d3e09cdb1124d0321308`: candidate Cuttlefish package and scheduler, no accepted species interface. Detailed mapping goes in `INTEGRATION.md`.
- Existing API vs proposal: pure frog TypeScript APIs are species-local. Preview reuses the version-pinned private `_put`, `_rasterize`, `_projectWorld`, `makeAtlas` methods on an isolated host object; `_world` was inspected but its inline transform is already included in `_put`. It never constructs the legacy class or registers its RAF/listeners. This is a temporary internal adapter, not a public species API or canonical renderer migration.

## Animal and anatomy

- Name: Frog / landing study. Stylized tree-frog-like character, not a biological reconstruction or a named-species accuracy claim.
- Three silhouette anchors: broad low oval torso; two large separate eye domes above the head; paired folded rear legs framing the torso, with two shorter attached forelimbs.
- Minimum intended display: 72 columns × 40 rows, 320 CSS px wide × 240 px high. Below that, use the explanatory static fallback. Full detail default 144×80 cells; cap 180×100. Smallest-grid acceptance is a separate visual gate.
- Views: front and left/right three-quarter turns; profile inspectable as a static diagnostic view. Rotational geometry is real; recognizability limits must be reported. No dorsal/underside claim.
- Artistic exaggerations: eye size, broad cheeks, throat amplitude and landing squash are deliberate. Toe hints simplify digit count; timing/ballistics are designed, not measured animal biomechanics.

| Part | Parent attachment | Neutral dimensions (model units) | Motion/limits | Occlusion and minimum footprint |
| --- | --- | --- | --- | --- |
| Torso | Scene root | approx 1.5 wide × .75 high × .8 deep | crouch/compress around planted feet, ≤25% squash | solid volume, ≥14×8 cells |
| Head | Upper torso | approx 1.6 wide × .52 high | small attached tilt, never a separate floating head | overlaps body, ≥15×5 cells |
| Eyes, pair | Head shoulders | dome radius .24; centers approx ±.5 | bounded gaze; fixed eye spacing | raised outline, each ≥3×2 cells |
| Throat sac | Head underside/front | .35 wide × .20 high | idle smooth expansion ≤.08 units; only when motion enabled | overlaps chin, no separate balloon |
| Rear legs, pair | Hip ±.5, .1, -.1 | hip → outward knee → inward ankle → outward foot | unfold for flight and refold before contact; asymmetry ≤.03 | behind torso except outer knees/feet |
| Forelimbs, pair | Shoulder ±.5, -.2, .35 | shoulder → elbow → wrist/toe tips | keep attachment; tuck and reach during flight | in front of torso, ≥1-cell link continuity |
| Feet/toe hints | Ankles/wrists | rounded end pads, short splayed tips | ground contact at crouch/landing; no frame jitter | omit subcell wrinkles before limbs |

## Reference and rights ledger

| Source/construction | Date/hash | Observation learned | Rights | Copied material |
| --- | --- | --- | --- | --- |
| Original ellipsoid/capsule geometry and landmark rig for this task | 18 Nov 2026, hashes in manifest | invented proportions/poses | new code; repository owner retains license decision | no ASCII drawing, model or image copied |
| https://museum.wa.gov.au/explore/frogwatch/frogs/green-tree-frog/ | accessed 18 Nov 2026 | broad body, short limbs, enlarged toe discs; tucked-limb silhouette | reference page copyright WA Government; observation only | none; no photographs downloaded or traced |
| Existing `dist/artwork.js` at pinned base | SHA-256 above | actual projection/depth/glyph seams | existing project code, reused in place | no source duplication; loaded by demo |
| Reviewed authoring skill | revision above | design and verification process | reference only | template headings adapted; teaching core not copied |
| Host system font | runtime-dependent | existing atlas metrics | installed font used by host; no font file redistributed | none |

Font stack inherited from the real atlas: SFMono-Regular, Consolas, Liberation Mono, monospace. Record actual capture font/runtime. No external font request/binary. Await host fonts in demo; recreate atlas on size/DPR change. Missing named fonts use installed monospace. No cross-font pixel identity promise.

## Representation

- Canvas character atlas, using the existing printable glyph repertoire `.,:;!i1l+txzvcofnae0&%8B@` plus spaces/newline in logical cell export. The animal is glyph-only; landing target and floor markers are disclosed non-glyph UI overlays.
- Tone and material are mapped by existing `_rasterize`/`makeAtlas`; new geometry supplies stable local sample IDs and light values. No per-frame random shading.
- Cell aspect: 1 : 1.35, matching the existing engine; geometry projection preserves aspect. Width is capped before allocation. DPR cap 2, backing canvas at most 1200×700 CSS × DPR².
- Text export reads the actual depth/glyph cells, emits equal-width printable ASCII lines with spaces for empty cells, and uses textContent. It is a cell snapshot, not an interactive terminal renderer.
- Background/plain floor/landing ring are preview composition, not exported art cells; no blur/glow or raster frog silhouette required.

## Behavior script

| Phase | Entry | Root path/heading | Local pose | Exit/default timing |
| --- | --- | --- | --- | --- |
| Idle | initial/reset/recovered | planted at last landing | gentle periodic throat expansion; subtle independent forefoot offsets | indefinitely; no autonomous leap |
| Approach/interest | normalized pointer or keyboard target | position stays planted; aim preview clamped to reachable destination | small gaze/turn toward target | target leave or deliberate Leap |
| Crouch | deliberate Leap while ready | launch/landing endpoints latched | squash with planted forefeet, hind legs coil | 14 ticks |
| Flight | end of crouch | linear planar travel; height 4H·u·(1−u), endpoints exactly grounded | hind legs extend then fold; forelegs reach | 42 ticks, height .85 default |
| Landing | flight completes | root exactly at latched destination | compression then restitution; feet remain joined | 12 ticks |
| Recovery | landing completes | planted, no drift | posture relaxes continuously | 24 ticks |
| Cooldown | recovery completes | planted; next target preview allowed | neutral pose; no queued repeat jump | 18 ticks, then idle/interest |

- Root motion and limb deformation have separate pure samplers. Asymmetry is seeded once (phase offset and tiny toe offset), never random per frame. Attachments are derived from the same posed landmarks as torso.
- Idle throat waveform is periodic with matching position/velocity at wrap. Ballistic launch/contact intentionally change velocity through crouch and landing; no wrap teleport. Flight pose endpoints match neighboring poses.
- Inputs: pointer coordinates use the canvas CSS bounding rect into [-1,1] on both axes; device pixels never enter input math. Clamp normalized targets to legal pad bounds (x ±.9, y ±.75), then to configured maximum jump distance from current position. Pointer preview shows the *reachable* destination; leave/cancel removes uncommitted preview. In-flight endpoints are immutable.
- Keyboard/touch: native Leap, Pause, Reset, target preset select, static pose select; focused canvas arrow keys adjust target, Enter/Space leap, Escape clears target. No global shortcuts or interception of form keys. Touch: tap release previews and leaps; cancelled/dragged gestures do not leap; scrolling preserved via touch-action: pan-y.
- Event protocol: explicit next integer tick, monotonically increasing seq, at most 8 events/tick. Validate complete batch before change; reject unknown/stale/duplicate/nonfinite/out-of-range values atomically. Same-tick events run in sequence order. First eligible leap latches the target; later leap events are rejected as busy (no queue), leave cannot change an active leap. Browser keeps one pending target and one action, coalesces pointer bursts.
- One frog only; no formation/count façade. Options changes are validated atomically; seed is creation/reset-only. Accepted config change resets the performance to tick 0 with the same seed, preserving user pause and motion preferences. Reset resets tick/event order/target/pose/position. It never resumes a paused scene.

## Reproducibility

- Schema/species version 1; default seed 23, unsigned 32-bit; tick rate 60 Hz. Initial position (-.55,.5), idle, tick 0, last seq -1.
- No Date, performance, Math.random, DOM, fonts or renderer in species state/geometry. Replay requires same version/config/seed and exact tick-stamped event log, regardless of render grouping 1/2/5.
- Core tick is explicit: exactly next integer tick; motion-disabled static actions do not run autonomous ticks. Browser clock is presentation-only, at most 5 catch-up ticks/frame; record dropped milliseconds, clear accumulator on suspend/resume.
- Default fixture: tick1 target (.65,.05), tick12 leap, additional busy trigger tick16, leave tick24, target(-.6,.5) tick150, leap tick162; capture rest/interest/crouch/takeoff/apex/landing/recovery/cooldown.
- Replay guarantees state and logical cells in the tested JS runtime. Trig math across engines and glyph pixels across browser/font/platform are not promised identical.
- JSON event log + initial seed/config supported for pure replay. Arbitrary serialized-state restore/version migration unsupported; no implicit session persistence.

## Accessibility and lifecycle

- Informative, interactive study. Canvas accessible name describes frog and landing controls; glyphs are not a live region. Semantic controls with visible focus, ≥44px tap targets; sparse action announcements only.
- Reduced motion at mount/live change: no scheduled motion and no throat pulsation. Intentional Leap cycles static crouch/airborne/landed pose alternatives without travel/RAF; explicit pose selector offers each. Pointer cannot enable motion. Pause freezes current pose; reset preserves pause; other suspension causes compose independently.
- Hidden/offscreen/zero-size: cancel RAF, clear pending transient input, retain explicit pause and last committed state. Resume starts a fresh wall-time origin. Below minimum display offers static fallback and no polling animation.
- Pointercancel/leave/lost capture clear pending target/gesture; no ghost leap. Multiple instances keep independent queues/listeners/observers.
- Controller owns its RAF, listeners, ResizeObserver, IntersectionObserver and media-query listener. No timer. All setup rolls back if initialization fails. Idempotent dispose releases resources/backing storage; mutation after disposal throws, status remains readable.
- Canvas unsupported: meaningful text and static ASCII specimen remain visible; no invented visual pass. Framework support is not claimed; no framework adapter.

## Budgets and acceptance (fixed before running)

- One animal, maximum 32,000 geometry samples (below legacy 36,000), 18,000 cells (180×100), zero particles, 8 events/tick, 5 catch-up ticks/frame, DPR ≤2, at most 3.36M main backing pixels plus bounded glyph atlas.
- Geometry must emit finite positions/lights and stay inside declared bounds through every phase/config extremum. Overflow is an error, not silent truncation. CSS input normalization handles zero size safely.
- Desktop target for this preview: 900×600 DPR1/2, 60Hz presentation; 3s warmup + 30s run; measured JS simulation+geometry+raster+draw p95 ≤8ms, p99 ≤16ms. Record failures; do not relax after measurement. Real mobile target p95 ≤20ms is unrun unless an actual device is available. No fps claim from a stub/native renderer/GIF.

| Gate | Scenario | Required result | Initial state |
| --- | --- | --- | --- |
| Silhouette | 72×40 monochrome front/turns, 320px browser | all three anchors legible, attachments intact | untested |
| Motion | fixed log through all phases | correct sequence, fixed target, finite attached limbs, no seam pop | untested |
| Replay | 1/2/5 tick render grouping | identical state and logical cells | untested |
| Input/config | invalid/flooded/busy/stale events | atomic rejection, bounded queue/destination | untested |
| Type contract | strict TS consumer + @ts-expect-error cases | positive types compile, invalid API calls fail | untested |
| Accessibility/lifecycle | real keyboard/touch emulation + mocked ownership | controls work; pause/reduced/hidden/zero/dispose compose | untested |
| Performance | fixed browser scenario above | measured targets; report hardware and unrun device gates | untested |

## Handoff

`EVIDENCE.md` will record actual commands/versions, results and limitations, raw captures and independent critique. `INTEGRATION.md` will map exact PR2 compatibility. Final source manifest, replay fixture, screenshots/contact sheet and GIF are planned, not evidence yet. Draft PR targets main with integration acceptance pending; no merge/deploy/npm release authority.
