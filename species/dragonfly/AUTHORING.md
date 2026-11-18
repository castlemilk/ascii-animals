# Dragonfly authoring record

Written before implementation on 18 November 2026. Acceptance results are initially untested; the evidence report records the completed critique and executed checks.

## Scope and custody

- Goal: one original interactive ASCII dragonfly for an isolated species PR; intended for local browser review and future typed library integration.
- Authorized publication: push only `feat/animal-dragonfly` and open its own draft PR against `castlemilk/ascii-animals:main`. No merge, release, deployment, settings changes, or other branches.
- Exact implementation base: `0e446c47b491b751d484e40db753ec725652b515`. This includes import `7e5984d34a139b8de4643f1ed0607897a42d88dc`, merge `60235c9f127c394b163fd8c02de408c8ac2e7aa5`, and manual Pages PR #3.
- Isolated checkout: `dragonfly-work`; initially clean. All changes belong under `species/dragonfly/`. Existing artwork, scripts, README, package work, other species and shared working copies are preserved.
- Inspected files and SHA-256: `dist/artwork.js`: `381f4706bc07761e6d1e162c95ceee97c42dd687ea19469ecb4f79885bd34e91`; `dist/app.js`: `91b2677b43b51a3b6fc36c2c21c98f376ae83f9f70d78aaca3aceb30996a4669`; `scripts/check-engine.cjs`: `6b2ffa522510786d691be45c60214c25c074df5de30163fff011e8c1b1890db3`.
- Skill: [reviewed head](https://github.com/skunkworq/skunkworq-skills/tree/e721252075a30888198aafba0953a23fd07bd3c6/generate-reactive-ascii-animals), including authoring template, all linked references, teaching core/browser/declarations and bounded spec validator. Requested `23e078642157a273e2b886222470bd247e5737b5` and reviewed-head SKILL.md contents match. SKILL.md SHA-256: `fdaf582ce7d2154a96c328521d53e9791d9898fe1038b52764ff925d77ddb453`.
- Current supported API: only `window.CuttlefishArtwork` on this base. Its private geometry/projection methods are coupled to cuttlefish fields; no public species or renderer seam exists. Do not subclass or copy its engine.
- Incoming PR #2 inspected read-only at `e7c16104a1e90c8650f7d3e09cdb1124d0321308`: `docs/EXTENDING.md`, typed scheduler and cuttlefish declarations. `AnimalDefinition`/`GeometryWriter` is only a documentation sketch. A small species-local writer adapter will be explicitly provisional. No invented package imports/exports.
- Saved microsite and deployed Pages version were not inspected or changed. This is new local species work, not evidence of a deployed animal. The original conversation transcript was not accessed; no contents are inferred from it.

## Animal and anatomy

- Stylized adult dragonfly (Anisoptera), not a reconstruction of a named biological species.
- Three silhouette anchors: a long tapered visibly segmented abdomen; a short thorax with two large near-touching eyes; four separate narrow wings in fore/hind pairs attached to the thorax.
- Smallest supported logical grid: 72 columns × 44 rows, displayed at least 360 × 286 CSS pixels. Below this size show the text description and retain a scaled poster; fine anatomy acceptance is not claimed. Default preview approximately 120 × 64; hard maximum 160 × 88.
- Supported views: dorsal, oblique dorsal, bounded left/right heading turns. A true edge-on profile or head-on front view would hide the four-wing anchor and is deliberately outside this specimen's view contract.
- Artistic exaggerations: wing beat is slowed for glyph readability; eyes and segment bands are enlarged; wing venation is simplified. Dart timings and tracking are interaction design, not biological measurements.

| Part | Parent attachment | Neutral dimensions (local units) | Motion/limits | Occlusion and smallest footprint |
| --- | --- | --- | --- | --- |
| Thorax | Scene root | Ellipsoid, about 0.34 × 0.48 | Root tracking; limited heading | In front of wing roots; at least 4 cells wide |
| Abdomen | Thorax rear | 10 tapered segments, total length about 1.45 | Gentle attached curvature; bounded tip displacement | About 16+ rows, visible contrasting segment bands |
| Head and eyes | Thorax front | Head/eye envelope about 0.60; paired eye domes | Same rigid body pose | Two bright domes with a medial valley, each at least 2 cells wide |
| Forewings | Thorax, left/right at y=-0.18 | Span per wing about 1.5; narrow chord | Independent root rotations, amplitude <=0.4 rad | Fine veins; never disconnect from root |
| Hindwings | Thorax, left/right at y=0.04 | Span per wing about 1.4; slightly wider base | Independent phase; no instantaneous rephasing | Four blade silhouettes stay separable |
| Six legs | Three thorax attachment pairs | Short jointed polylines | Attached, folded forward | Below thorax; subordinate at small grid |

## Reference and rights ledger

| Source or original construction | Retrieved date/hash | Observation learned | Permission/license | Copied material and notice |
| --- | --- | --- | --- | --- |
| [Australian Museum, David Britton, Order Odonata](https://australian.museum/learn/animals/insects/dragonflies-and-damselflies-order-odonata/) (updated 3 July 2023) | Read 18 November 2026 | Long abdomen, two wing pairs, three leg pairs, large eyes and hover behavior | Reference prose only; museum images retain their rights | No images, diagrams or prose copied |
| [CSIRO, Odonata identification](https://www.ento.csiro.au/education/insects/odonata.html) | Read 18 November 2026 | Narrow membranous veined wings; hindwing bases slightly broader | Reference prose only; no asset permission inferred | No image or geometry copied |
| Dragonfly parametric surfaces | Original TypeScript authored for this task | Separate tapered blades, ellipsoids, segmented abdomen and jointed legs | Original contribution; repository license decision stays with owner | No external ASCII drawings, meshes or ray implementation |
| System monospace fonts | No font files bundled | Browser chooses installed face | Family names confer no redistribution rights | No font download or redistribution |

Font stack: `ui-monospace, SFMono-Regular, Consolas, Liberation Mono, monospace`. Font loading and resize trigger metric redraw. Pixel identity across platforms is not promised. No generated concept art is used as evidence.

## Representation

- Printable ASCII cell grid rendered as actual Canvas glyphs, with a text export of the same logical cells. This is a local species preview, not a generic renderer or terminal application.
- Planned glyph repertoire: space plus `.,:;-=+x*oO#@`. Stable material-aware choice; eyes/segment bands use denser glyphs, wing membranes lighter ones. No frame-random noise.
- Projection and Canvas both use a 0.68 cell width/height ratio with centered letterboxing, preserving anatomy even when the CSS rectangle has a different aspect. Canvas uses centered glyph baselines and measures its chosen font. World projection is orthographic, finite and bounded. No near plane exists in this preview.
- Non-ASCII/control/bidi output is disallowed. Exported rows have exactly the chosen column count. Text appears through `textContent`/textareas, not HTML.
- No glow, particles, photographic background or non-glyph animal graphics. UI borders and typography are not animal geometry. A neutral-tone view is available for silhouette critique.

## Behavior script

| State | Entry trigger | Body path/heading | Appendages | Exit/duration/cooldown |
| --- | --- | --- | --- | --- |
| Idle | Creation or completed cooldown with no target | Small seeded closed hover orbit; bounded acceleration | Four independent continuous wing phases | Pointer enters → approach; deliberate action → dart |
| Approach | Normalized pointer or Guide target | Damped acceleration toward a bounded target; speed capped | Same wing clock; no root slip | Leave → idle; deliberate action → dart |
| Dart | Button/keyboard action, when eligible | Short continuous Hermite translation; ends at zero velocity | Slight raised energy, same phases | Default 20 ticks, then recover |
| Recover | Dart ends | Hold the new anchor with decaying hover amplitude | Wing energy relaxes | Default 48 ticks, then cooldown |
| Cooldown | Recovery ends | Stable hover at anchor; target tracking deferred | Normal beat | Default 90 ticks; repeated darts ignored, then idle/approach |

- Independent phase: stable seed-derived offsets for each wing; phase clock never resets on a dart, input or view change. All local motion is computed about explicit thorax attachment points.
- Loop seam: seeded sinusoidal hover is continuous; tracking changes acceleration, not position. Dart starts at current position/velocity and ends stationary. Recovery does not snap back to the original center.
- Input: coordinates from current CSS bounding rectangle normalize to [-1,1], independent of DPR; zero-size returns no target. Pointer movement guides but never triggers a dart. Canvas taps guide only. The clearly labelled Dart button intentionally acts on this single specimen; there is no false visible-cell click-ownership claim.
- Keyboard: native Dart/Pause/Reset buttons, native motion/view/guide selectors. Arrow keys on the focused canvas move Guide; Space pauses only there. Touch: tap to guide plus large native buttons; scrolling remains enabled.
- Ordered events: explicit next integer tick and globally increasing seq; pointer/leave/dart union; <=16 events per tick. Entire batch validates before state mutation. Browser coalesces pointer traffic to one pending target and at most one deliberate dart; repeated button activations cannot build an unbounded queue.
- Pause/static policy has priority. Within a validated tick, events follow seq order; first eligible dart wins, later darts are ignored during the response/cooldown. Leave clears targeting.
- One animal only. Configuration is validated atomically; seed changes use reset. View/motion/parameter updates preserve identity, tick and user pause. Static mode cancels transient motion into a centered poster. Reset returns to tick 0 and the specified seed; it preserves configured options and pause.

## Reproducibility

- Species version `dragonfly-v1`, schema 1, default seed 17, fixed 60 Hz integer ticks. Initial pose is centered with zero velocity, no target, idle phase, last seq -1.
- Species code has no DOM, ambient randomness, wall clock or font access. Step accepts exactly tick+1; render sampling never advances simulation.
- Motion mode `slow` reduces appendage frequency, tracking speed and dart pace deliberately; `static` suppresses simulation movement. No pointer event can change the chosen policy.
- Replay fixture: guide at tick 45, dart at 100, leave at 180, alternate guide at 280 and a second dart at 330; seq strictly increases. Compare the same run rendered every 1, 2 or 5 ticks.
- Browser catches up at most 5 ticks per frame, accounts for dropped elapsed milliseconds, and discards accumulated wall time on any suspension/resume. It never replays hidden time.
- Same version/runtime, fixed initial options/seed and explicit tick/event sequence produce identical states/samples/logical cells. Configuration/reset/host-suspension changes delimit replay segments; the fixture does not record them. Cross-engine transcendental results and system-font pixels are not guaranteed identical.
- JSON event replay is supported. Arbitrary saved-state restoration and cross-version migrations are unsupported.

## Accessibility and lifecycle

- Interactive informative artwork: concise text alternative describes eyes, abdomen and four wings. Static poster and deliberate alternate pose remain usable without animation.
- Live OS reduced-motion preference forces a static poster. Explicit Slow is also available for users who prefer gentler motion. Returning the OS preference to normal does not clear a user pause. Pointer, reset and options never opt into motion.
- Native labelled controls; visible focus; Tab exits normally. Sparse user-action status only, no per-frame live-region chatter.
- User pause OR static preference OR hidden document OR offscreen OR zero dimensions OR disposed stops all self-rescheduling work. Resume clears time accumulation and transient pointer input.
- Pointer leave/cancel/lost capture clears target. Touch never sets `touch-action:none` or prevents page scrolling.
- Each host owns its listeners, ResizeObserver, IntersectionObserver, media-query subscription and at most one RAF. Partial setup rolls back. Disposal is idempotent and zeroes owned canvas backing storage; mutating calls after disposal throw a documented error. Read-only status remains available. Other instances are unaffected.
- Canvas unsupported: preserve the static text description and show a clear local fallback; no successful-render claim.

## Budgets and acceptance (targets set before measurement)

One specimen; <=6,144 samples; <=160×88 cells; 0 particles; <=16 events/tick; <=2 pending browser actions; <=1,200×700 logical backing area and DPR<=2 (3.36M pixels); 5 ticks/frame; no autonomous work at rest. Max replay tick is 2^31-1 and event seq is a safe integer.

| Gate | Fixed scenario | Pass condition | Initial result | Remaining work |
| --- | --- | --- | --- | --- |
| Silhouette | Neutral 72×44 and normal desktop/mobile | Eyes, long segmented abdomen, four narrow blades identifiable | Untested | Actual frame review and independent critique |
| Motion | Seed 17, full event fixture | Continuous attachments; ordered dart/recover/cooldown; no root snap | Untested | Sample checks and animation capture |
| Replay | Same 360 ticks, 1/2/5 render groups | Identical state/sample/cell hashes | Untested | Numerical tests |
| Input/config | Invalid events/options, rapid pointers, repeated darts | Atomic rejection or documented ignore; bounded queues | Untested | Runtime and positive/negative type tests |
| Accessibility | Keyboard/touch emulation, reduced preference, pause | Controls usable, no surprise motion | Untested | Browser checks; real phone/screen reader remains separate |
| Lifecycle | Multi-instance, hidden/offscreen/zero, failed mount | No owned pending callbacks after dispose; no catch-up | Untested | Bookkeeping and browser tests; long heap audit separate |
| Performance | 900×600, DPR1/2, 3s warmup +30s run, 1 specimen | Local browser target p95 simulation+draw <=8ms, p99<=16ms | Untested | Measure actual host if launch possible; no phone claim |

## Handoff

All implementation, example, types, tests, source provenance and evidence stay under this directory. The final validation report will name commands, exact runtimes, actual visual captures, independent findings, fixes and unrun acceptance. Draft-only release state; shared typed API/renderer consolidation remains the library coordinator's decision.

## Review clarifications

The independent preimplementation review requested explicit option ranges/defaults, replay scope, paused-tick semantics, cell aspect and ownership. The full normative option table is now in API.md. Paused/static steps validate but consume no state/tick/seq; returned states/options are frozen recursively, while geometry/grid buffers are caller-owned. Letterboxing and fixed-configuration replay resolve the corresponding ambiguity.
