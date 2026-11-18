# Fox authoring record

Prepared before implementation on 18 November 2026. This is an original stylized fox, not a biological motion model. The result is an additive species-local implementation; central species/renderer acceptance remains pending.

## Scope and custody

- Goal: an original, legible side-profile fox for the ASCII Animals collection, with cautious guidance, sniffing and a deliberate crouch → short leap → forepaw landing → recovery sequence.
- Authority: Ben authorizes only this species on new branch `feat/animal-fox`, a reviewed/tested push and a draft PR to `main`. No merge, release, deployment, shared engine/registry/package changes or edits to another author's work.
- Target: `https://github.com/castlemilk/ascii-animals`, isolated checkout `ascii-animals-fox`, branch `feat/animal-fox`, exact base `0e446c47b491b751d484e40db753ec725652b515`.
- Main is newer than supplied baseline `60235c9f127c394b163fd8c02de408c8ac2e7aa5`: PR #3 merged the manual Pages workflow. Import ancestor is `7e5984d34a139b8de4643f1ed0607897a42d88dc`.
- Read current tree, README, renderer, page controls, numerical harness and Pages workflow. No AGENTS.md, package manifest, LICENSE or species hook exists on this base. Initial isolated worktree was clean. Preserve every existing file.
- Source SHA-256: `dist/artwork.js` = `381f4706bc07761e6d1e162c95ceee97c42dd687ea19469ecb4f79885bd34e91`; `dist/app.js` = `91b2677b43b51a3b6fc36c2c21c98f376ae83f9f70d78aaca3aceb30996a4669`; `scripts/check-engine.cjs` = `6b2ffa522510786d691be45c60214c25c074df5de30163fff011e8c1b1890db3`.
- Skill: requested commit `23e078642157a273e2b886222470bd247e5737b5`, reviewed head `e721252075a30888198aafba0953a23fd07bd3c6`; SKILL.md blob `8ef04dec7f4031f7e69b1319e182a7d722b41fe4` and authoring-template blob `c21bdb67d2348cfd24339d96edafd6084bddd721` match at reviewed head. Read all linked guidance and teaching contracts; do not copy the ray core.
- PR #2 inspected read-only at `e7c16104a1e90c8650f7d3e09cdb1124d0321308`. It exports CuttlefishArtwork/createCuttlefish and a scheduler; its species contract is only a design sketch. See COMPATIBILITY.md for exact mapping.
- Saved microsite/live deployment: README links inspected as source claims only; no fox is deployed. The old microsite transcript was not requested or accessed here. Historical skill evidence is not current deployment proof.
- Existing API: browser global CuttlefishArtwork. New fox types/model/preview are species-local. A structurally compatible scheduler input is the only current candidate reuse; geometry integration is pending centrally owned extraction.

## Animal and anatomy

- Name: Fox / Quiet in the Bracken, a stylized red-fox-like character specified by the user's brief.
- Three silhouette anchors: two pointed ears above a long wedge muzzle; four separately articulated narrow legs with visible feet; a broad, tapering bushy tail with a light tip.
- Minimum accepted grid: **80 × 32 cells**. Default 112 × 44, maximum 160 × 64. Below 80 × 32 use a descriptive fallback, not a claimed recognizable animation.
- Views: right and left side profiles. Deliberate configuration mirrors the profile. Front views, 3D yaw and automated turns are unsupported. Guiding behind the animal makes a cautious backstep while preserving the readable profile.
- Artistic exaggerations: ear spacing, wedge muzzle and tail width are enlarged for glyph clarity. Timings and the compact pounce are authored motion, not measured animal biomechanics.

| Part | Parent attachment | Neutral dimensions in local units | Motion/limits | Occlusion / minimum footprint |
| --- | --- | --- | --- | --- |
| Torso | Scene root above ground | roughly 0.72 × 0.32 | subtle breathing; crouch and landing compression | solid outline before texture |
| Neck/head | Fore shoulder | head about 0.28 × 0.25 | bounded sniff dip; attached to shoulder | overlap closes the neck seam |
| Ears | Skull | two 0.12 × 0.23 triangles | small asymmetric tilt; no detach | two separate peaks, at least 2 rows each |
| Muzzle/nose | Skull front | wedge about 0.28 long | follows sniff/head pose | pointed nose remains visible |
| Near/far forelegs | Distinct shoulder offsets | 2 segments and a paw | planted feet during stance; swing clearance; forepaw landing first | far side drawn first; offset feet |
| Near/far hindlegs | Distinct hip offsets | bent thigh, hock and paw | independent gait phases; tuck in flight | four anatomical chains, intentional overlap |
| Tail | Rear of rump | about 0.65 long, maximum 0.28 thick | traveling tip lag independent of breathing/gait; counterbalance in pounce | broad silhouette with tapered tip |

## Reference and rights ledger

| Source/construction | Date/hash | What it informs | Rights | Copied material |
| --- | --- | --- | --- | --- |
| Ben's fox brief in this task | 2026-11-18 | anchors, stalk/sniff, pounce | task-provided requirements | no artwork |
| Original local TypeScript coordinates, analytic polygons and articulated leg chains | this branch | all animal geometry and motion | newly authored for this project; repository license remains owner's decision | none |
| Actual Cuttlefish source and draft PR #2 | hashes above / COMPATIBILITY.md | architecture and honest integration boundary | inspected; existing files retained unchanged | no renderer or animal geometry copied |
| Skill and authoring template | pinned commits above | workflow, requirements, evidence structure | followed as authoring instructions | no educational ray runtime copied |
| Host monospace font | system selection at render time | glyph metrics | uses installed fonts; ships no font binary | none |

Font stack: ui-monospace, SFMono-Regular, Consolas, Liberation Mono, monospace. Native evidence will record the actually selected installed face. No proprietary font or font file is bundled. Font readiness triggers one redraw; fallback metrics affect pixels, not logical cells.

## Representation

- Printable ASCII cell grid. Browser preview paints those exact cells, with a plain text export. No copied ASCII sprites.
- Repertoire: space plus `.:-=+*#%@` for body tone, with `o` for the eye if needed; a neutral `#` silhouette mode disables material/eye distinctions. Reject arbitrary Unicode/control glyph configuration.
- Preview cells have nominal width 8 and height 16 CSS pixels (1:2 aspect); aspect-correct model coordinates are mapped consistently. System fonts are centered within cells. No claim of identical cross-font pixels.
- Geometry is original filled polygons/capsules sampled into a species-local preview grid. This intentionally small demonstrator is not a replacement shared renderer or public package contract.
- Canvas backing store bounded to 1,280 × 768 CSS pixels with DPR ≤2; cell count is separately bounded. Text is inserted only with textContent.
- No particles, glow, external images, external font requests or raster decorative effects are needed for recognition. Page panels/labels are ordinary CSS, not glyph geometry evidence.

## Behavior script

| State | Trigger | Root path | Local motion | Exit |
| --- | --- | --- | --- | --- |
| idle | creation / no target | still | independent breathing and tail lag | guide or pounce |
| stalk | active guide beyond threshold | bounded, eased cautious steps toward target x | four gait phases; stance feet stay planted | near guide → sniff; leave → settle |
| sniff | guide reached | hold | muzzle dips with small oscillation | guide moves / leave / pounce |
| crouch | deliberate pounce when ready | hold start position | body compresses, forelegs flex, tail lifts | 24 ticks default |
| airborne | crouch ends | short eased x travel, parabolic vertical arc | paws tuck then reach; tail balances body | 36 ticks default |
| landing | arc ends | hold end position | forepaws contact before hindfeet, absorb impact | 12 ticks default |
| recover | landing ends | hold | return body and tail smoothly to rest | 36 ticks default |
| cooldown | recovery ends | hold / quiet breathing | no repeated pounce | 72 ticks default, then idle/stalk |

- Local breathing/tail phases advance independently of root locomotion; no ambient random jitter. Per-leg offsets distinguish four legs.
- Root leap starts/ends at the stored positions; no teleport on reset except the explicitly requested seeded restart. Response plans capture current settings, so configuration cannot alter an in-progress leap's endpoint or timing.
- Guide x/y normalize from the content's CSS rectangle into [-1,1], clamp finite out-of-range positions; zero rectangles produce null. DPR never enters input math. x guides ground travel, y changes bounded sniff interest. One fox per instance; tapping sets a guide, it does not pretend to perform visible-cell targeting.
- Keyboard/touch: semantic Guide left/center/right controls and a Pounce button; Pause, Reset and static pose controls; no global key hijacking, no touch scroll suppression.
- Inputs are tick-stamped `guide`, `leave`, `pounce`, ordered by strictly increasing seq. Validate the whole next-tick batch before applying. Max 16/tick. Browser coalesces movement to one latest guide plus one deliberate pounce; leave/cancel clears stale interest. Sequence order wins for guide/leave. At most one pounce begins per tick; later pounces during response/cooldown are explicitly ignored, never queued.
- No count/formation changes: one model per instance. Independent instances have independent identity/state/resources.

## Reproducibility and API contract

- Schema/species version 1, default seed 17, 60 integer ticks/s. Initial tick=0, lastSequence=-1, root centered, idle. Seed changes breathing/tail phase without changing anatomy.
- Explicit next-tick `step(tick, events)` is the deterministic authority; presentation can render after 1/2/5 ticks without changing state/cells.
- Demonstration replay: tick 45 seq0 guide(0.8,0.15); tick 150 seq1 pounce; tick 160 seq2 pounce (ignored during response); tick 340 seq3 leave; tick 400 seq4 guide(-0.7,0.2); tick 530 seq5 pounce. Record exact settings/seed and sample ticks in evidence.
- Automatic host: at most 5 fixed ticks/frame; excess wall time counted as dropped milliseconds. On suspension/resume clear accumulator/previous timestamp, avoiding hidden-tab catch-up. No speed option alters explicit-tick semantics.
- Core methods: createFox, configure, step, getState/getOptions/getPose, setPaused, reset(seed?), dispose. Public types explicitly cover species/options/input/state/result/pose. Valid configuration commits atomically; invalid updates leave state/options unchanged. Seed is only creation/reset input. Configure retains tick, sequence, pause and active response plan. Reset retains configuration and pause, clears guide/reaction/sequence and restarts seeded phase. Dispose is idempotent; other calls after disposal throw consistently.
- Browser controller composes user pause, reduced-motion policy, hidden/offscreen, zero size and disposal. Reset/options never resume a paused instance.
- Guarantee: same implementation/runtime, seed, options and ordered tick log → identical state and logical cells. Cross-engine transcendental/pixel identity is not promised. Snapshot read supported; arbitrary serialized-state restore/cross-version migration unsupported.

## Accessibility and lifecycle

- Interactive artwork with a concise fox description; decorative glyph surface hidden from screen-reader per-cell reading. Export text is deliberate. No per-frame live announcements.
- Reduced motion always uses a meaningful still pose. Guide/Pounce controls may choose a single static sniff/crouch pose without scheduling simulation. Leaving reduced motion cannot override user Pause. Pointer movement never reactivates reduced motion.
- Native buttons/selects with visible focus, large touch targets, labelled options; Tab leaves normally. Sparse action announcements only.
- Hidden/offscreen/zero-size: unsubscribe/cancel automatic frame source, clear transient inputs, retain simulation; resume with a fresh timestamp and no catch-up. Unsupported Canvas preserves meaningful text/description.
- Owned listeners/RAF/observers and partial-setup rollback are tested separately from real browser cleanup. Dispose twice is safe, late callbacks become no-ops. Multiple instances must remain independent. Externally supplied scheduler is not disposed.

## Budgets and acceptance (declared before implementation)

One fox; ≤48 polygon parts; ≤1,024 authored vertices; ≤10,240 output cells; ≤16 core events/tick, ≤2 coalesced pending host actions; zero particles; ≤5 catch-up ticks/frame; DPR≤2; ≤3,932,160 backing pixels. No timing gate is passed from source limits.

| Gate | Fixed scenario | Pass condition | Initial result | Remaining work |
| --- | --- | --- | --- | --- |
| Silhouette | 80×32 neutral right/left, seed17 | ears, muzzle, four legs, bushy tail recognizable | untested before code | render/independent critique |
| Motion | replay above + all phase boundaries | attachments finite; phase order; forepaw landing; no root teleport | untested before code | numeric tests + actual frames/GIF |
| Replay | 1/2/5-tick render grouping | identical state and cells | untested before code | tests |
| Inputs | invalid/stale/duplicate/flood/repeated response | atomic rejection/bounded queue; no surprise replay | untested before code | tests |
| Type API | strict positive and expected-error fixtures | compile; negative fixtures actually rejected | untested before code | TypeScript toolchain |
| Lifecycle | suspension, multiple mounts, failed setup, late callbacks | no owned work after disposal | untested before code | mocks and browser separately |
| Browser accessibility | keyboard/touch/reflow/reduced motion | usable controls and static policy | local Chromium probe blocked before page launch by socket permission | keep raw gap; do not evade sandbox |
| Performance | 900×600 desktop, DPR1/2, 5s warmup +30s | target p95≤8ms, p99≤16ms | unmeasured | actual device/browser needed |

## Handoff

Implementation, tests, compatibility map, README, replay log, raw verification output, native rendered contact sheets/GIF and a review ledger will stay under species/fox. VALIDATION.md will record actual commands, versions, failures, evidence provenance, independent findings/fixes and unrun acceptance. A draft PR does not imply shared integration, npm release or deployment.
