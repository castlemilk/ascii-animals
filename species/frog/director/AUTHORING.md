# Frog pond director — pre-code authoring record

## Scope and custody

This is a bounded creative follow-on to the integrated Frog, not a replay of the original animal branch. Target: `castlemilk/ascii-animals`, isolated `feat/director-frog`, exact base **c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02**. Initial inspection found release c06114404900884814bef879a02f1a49a3e7d590; the mandatory pre-edit recheck found the newer README-only reconciliation commit and the clean checkout was fast-forwarded before authoring. No AGENTS.md exists in the inspected repository or parent paths. Existing source is clean. No shared package/core/registry/catalogue, marine or other-species changes are planned.

The actual `generate-reactive-ascii-animals` skill at main 23e078642157a273e2b886222470bd247e5737b5 (reviewed parent e721252075a30888198aafba0953a23fd07bd3c6), authoring template and linked references were read. Its teaching contract remains illustrative. Actual canonical Frog source is `species/frog/src/*.mts`; `src/public/frog.ts` is the integrated facade; `scripts/build-frog.mjs` generates `dist/frog/` from it. Source hashes accompany this record. The package remains private/UNLICENSED. No license grant, publication, deployment or broader API consolidation is implied.

Live baseline pages were opened in the cloud browser: https://castlemilk.github.io/ascii-animals/cuttlefish-demo.html and https://castlemilk.github.io/ascii-animals/frog/ . Observed Cuttlefish scene choices, four presets, 1–12 population, five formations, size/spacing/reverse, individual roles/labels, contextual lens reaction, controls for palette/particle/ASCII/pointer/current, and exports. Exercised solo close encounter and its arm-gather reaction, horizontal procession with six animals and labels, and particle presentation. Observed Frog's single waiting animal, landing menu, deliberate leap, pause/reset and still choices. UI observations are not performance or accessibility certification. Current code establishes the arrival/linger/depart and per-animal behavior details. No inaccessible earlier conversation transcript is claimed as read.

## Gap / behavior / scene matrix

| Current gap | Coherent addition | Scene and visible change |
| --- | --- | --- |
| One waiting frog, blank ground | 1–3 named frogs, original lily pads/reeds, staggered depth and contact ripples | All scenes acquire a readable pond composition |
| Nearly identical idle states | Independent gaze/listening/breath phases and occasional short pad changes | Stillwater: long rests, deliberate attention, restrained movement |
| One reaction path | Notice a luminous insect, track, commit to a free pad, strike, settle | Firefly supper: focused hunt with a clear target and recovery |
| No social direction | One caller leads, bounded delayed answers, then a listening interval | Moonlit chorus: distinct inflated throat envelopes and call ripples |
| Pointer only aims | Select visible owner; preview unoccupied pad; water tap ripples; deliberate insect/call actions | Selected actor acts while neighbors keep their own motives |
| Few director choices | Scene, 1–3 population, layout, tempo, autonomy, individual roles; labels/trajectory presentation | Controls change behavior or composition rather than merely labels |

## Anatomy and representation

Stylized frog, retaining the current original anatomical model and its three anchors: squat torso; two raised large eyes; folded rear legs with short attached forelimbs. Existing hip/knee/ankle/toe and shoulder/elbow/wrist/toe attachments remain authoritative. Eyes overlap the head and pupils remain attached. A posed sampling seam may expose the same model to the director; no duplicate mesh or rendering core.

| Part | Parent / dimensions retained | Added motion or limit | Occlusion policy |
| --- | --- | --- | --- |
| Torso / head | Existing torso radii .72/.40/.43 and head .78/.31/.47 | Existing compression/extension, scene-root placement | Front or modest three-quarter, profile diagnostic only |
| Eyes | Existing paired domes at x±.49, y−.61 | Bounded gaze and occasional blink/attention if supported by same rig | Do not hide behind reeds or strong foreground pad rims |
| Legs | Existing continuous joint chains, planted ground .62 | Existing 14/42/12/24/18 default phase ticks | Pad lies behind planted feet; flight preserves attachments |
| Throat | Existing head/torso-overlapping ellipsoid | Explicit calling envelope, distinct from quiet breath; no ticking when reduced | Deliberate expanded still allowed |
| Environment | New analytic pad disks with wedge, reeds, rings, one firefly | ≤6 pads, ≤6 ripple effects, ≤1 insect; no external assets | Low contrast behind animals; eye/limb silhouette takes priority |

Canvas glyph atlas, the existing printable ASCII ramp `.,:;!i1l+txzvcofnae0&%8B@` plus space/newline in export. Existing 1:1.35 cell aspect and system font stack SFMono-Regular/Consolas/Liberation Mono/monospace. No font file ships. Native evidence will record installed font hash. All frog/environment geometry is procedural; selection labels and trajectory guides are explicitly non-glyph UI overlays. Text export is a cell snapshot, not an interactive terminal or screen-reader representation. User-facing text uses textContent.

Normal review targets: 900×600 and 390×520, 180×100 maximum cell grid; single frog retains original limits. Three-frog minimum-grid legibility is a new open gate: inspect ≥32 cells of horizontal body footprint per visible frog where practical, retain all chosen actors, and disclose mobile detail loss rather than silently dropping population. Previous 72×40 all-anchor recognition was partial and is not retroactively passed. Supported front/left/right; diagnostic profile remains available only as a study.

## Behavior / choreography

| Phase | Trigger / path | Local expression and environment | Exit / bounds |
| --- | --- | --- | --- |
| Rest / listen | Seeded per-actor phase; no autonomous travel if autonomy=false | Quiet throat, gaze; long readable still intervals | Director cues on explicit integer ticks |
| Track | Firefly invitation or authored hunting cue | Visible insect; selected hunter watches before committing | Bounded anticipation, then one reachable unreserved pad or stationary strike |
| Hop | Deliberate Hop or scene cue while actor is ready | Existing crouch→ballistic flight→landing→recovery→cooldown | Latched endpoint; ≤1 crouching/flying actor globally; busy requests are dropped |
| Call / answer | Deliberate Call or chorus cue | Distinct smooth throat envelope and call ring; neighbors answer after a delay | ≤2 pending replies; chain depth ≤1; no recursive chorus explosion |
| Water disturbance | Deliberate empty-water tap / Ripple button | One expanding ring; nearest available actor listens | Effect TTL and count cap; repeated actions do not create an unbounded queue |
| Settle | Landing or strike/call completion | Foot compression and one touchdown ripple, then rest | No instant teleport or automatic flight redirection |

Three roles: `caller`, `hunter`, `dreamer`, on stable IDs 0–2 named Moss/Pip/Fern. Six deterministic pads, occupancy and destination reservations. A destination must be free, reachable within the existing model maxDistance, and remain reserved through touchdown. Source/target occupancy prevents two frogs sharing a pad. Maximum one simultaneous crouch/flight makes crossing timing comprehensible without pretending to implement general collision physics. Two layouts plus sheltered composition may move the pads, not anatomical coordinates.

Scene arcs have an opening, activity, settling and quiet/listening interval. State persists between loops; repeated cues do not reset positions. `tempo` changes cue spacing, not the fixed 60Hz clock or configured ballistic duration. Scenes are stylized choreography, not biological timing claims.

## Typed contract and compatibility

Keep `createFrogArtwork(canvas, options)` and all existing aliases/default single-frog behavior intact. Add a separate `director?: FrogDirectorOptions` option; the new demo opts in. `FrogConfig` remains body/leap configuration. Add explicit director config/state/actor/input/result types and pure `createFrogPond`, `stepFrogPond`, `resetFrogPond`, configuration, selection and pose helpers through the existing frog export path. No package export or root registry change.

Director options: scene (`stillwater`/`firefly-supper`/`moonlit-chorus`), count integer1–3, layout (`arc`/`stepping-stones`/`shelter`), tempo .5–1.5, autonomy boolean, and exactly three validated role values. Defaults: moonlit-chorus,3,arc,1,true,[caller,hunter,dreamer]. Unknown fields, explicit undefined nested fields, invalid IDs/roles and nonfinite/out-of-range values reject before mutation/allocation. Snapshots/config are immutable. Existing seed/default ranges remain unchanged.

Add controller `getPondState()` (null in original mode), `updateDirector()`, `selectFrog()`, `setRole()`, `call()`, `hunt()` and `ripple()`. Original `getState()` remains one FrogState, selected actor in director mode. `target/leap` address the selected actor; `pulse` still aliases leap. Config/director updates deterministically reset the ensemble and preserve pause. Selecting/assigning a role preserves positions and active leaps; roles apply at later eligible cues. Presentation updates preserve simulation. Reset preserves current director config and explicit pause, clears cues/effects and resets seed/time/sequences. No arbitrary serialized-state restore or cross-version migration; exported scene snapshot is labelled accordingly.

## Determinism and input

One director tick at60Hz, all actor model clocks advance once each tick. Seed23 by default; actor seed derived deterministically from scene seed + stable ID. At most8 scene events/tick; next integer tick required; strictly increasing global seq; validate the entire batch first. Each model receives its own next tick and monotonically increasing local sequence. Same runtime/version/config/seed/normalized log gives same state and cell grid under1/2/5-tick presentation grouping. No cross-font pixel guarantee.

CSS-rect pointer normalization, independent of DPR. Owner-cell picking selects a visible frog; pad picking previews/commits a free landing; empty-water taps create ripples. Pointer motion alone never hops. Native selects/buttons provide all actions without hover. Focused canvas:1/2/3 select actor; arrows aim; Enter/Space hops; C calls, H invites a hunt, R ripples, Escape clears. Modified keys/form targets are not intercepted. Touch drag excursion/cancel/leave/lost capture cancels the tap. Clear transient targets/gesture when suspended.

Host coalesces latest pointer target and at most one deliberate scene action (two pending inputs total); repeated busy actions are ignored with feedback. Manual actions take precedence over same-tick autonomous cues. Explicit selection/role changes are atomic presentation/director edits; a live input recorder is not claimed. A fixed authored replay fixture will exercise calling, hunting, hopping, water ripples and recovery.

## Lifecycle, accessibility and budgets

One Canvas/atlas/scene owner and one borrowed shared-scheduler subscription, not one per frog. Existing pause, OS reduced motion, hidden, offscreen, zero size, undersized and disposed causes compose. Suspend unsubscribes and discards wall time; no social timer runs separately. Resume starts a fresh clock; ≤5 catch-up ticks. No changes to shared scheduler ownership. Error during callback/setup/draw releases this controller's resources. Idempotent dispose; existing post-dispose rejection/status contract remains.

Reduced motion and explicit still poses freeze the whole pond; deliberate Call/Hunt/Ripple choose non-animated representative stills without advancing ticks/travel or scheduling. Pause freezes exact committed pose; reset/config changes preserve pause. Semantic labelled native controls, visible focus, ≥44px touch targets, pan-y scrolling, canvas description, sparse live announcements on deliberate actions. Dynamic role/phase indicators are not live regions. A static fallback image and descriptive text remain when Canvas fails.

Budgets fixed before implementation:1–3 frogs;17,918 samples/frog;32,000 reusable sample workspace;≤60,000 emitted scene samples per frame;≤180×100 cells;≤6 pads,6 ripples,1 insect,2 social replies;8 scene events/tick;2 coalesced host inputs;≤5 catch-up ticks;DPR≤2;≤1200×700 logical backing;zero intervals/per-frog RAF. Pond presentation cadence20Hz by elapsed timestamps while simulation remains60Hz; original mode retains its cadence. Performance goals remain desktop p95≤8ms/p99≤16ms at900×600 DPR1/2 after3s warmup/30s and physical mobile p95≤20ms. These may remain unmeasured or unmet; source caps/GIF cadence are not passes.

## Validation / critique plan (unrun at authoring)

| Gate | Fixed scenario | Acceptance and evidence |
| --- | --- | --- |
| Existing consumers | Existing frog, shared scheduler, types and package tests | Preserve default factory semantics; no shared-file diff |
| Replay / social bounds | Seed23 plus alternative seed, all scenes/counts,1/2/5 grouping | Same state/cells, capped replies/effects, no duplicate pad occupancy or midflight redirection |
| Inputs / validation | Invalid config/batches/IDs, rapid targets, busy actions | Atomic reject and bounded coalescing; deliberate ownership |
| Lifecycle | Two ponds + original frog; pause/reduced/hidden/zero/dispose | One shared frame source and isolated cleanup; doubles labelled |
| Visual | Three scenes: opening/track/call/flight/landing/rest; desktop/narrow | Real native or browser captures, independent critique, fix a concrete evidence-led issue |
| Browser | Packaged dist/frog factory, semantic controls and keyboard/touch routes | Record only actual executed checks; cloud/local access gap explicit |
| Performance / accessibility | Declared target workload/device and screen-reader checks | Unrun unless measured; no inference from native test duration |

## Handoff boundary

Before any GitHub publication attempt: save source ZIP, binary patch, PR body, exact base/head/tree, validation/provenance manifest and new real visual evidence, and return their actual download links. Only then consider the explicitly authorized draft PR. On approval requirement or publication failure, stop that path. No merge, deploy, npm publication, force push, settings/credentials changes or paid service.
