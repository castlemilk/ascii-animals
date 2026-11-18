# Owl director — pre-implementation brief

## Exact scope and evidence

Authoring began from main `c06114404900884814bef879a02f1a49a3e7d590` on the isolated new branch `feat/director-owl`. Existing Owl integration is retained: `createOwlArtwork(HTMLElement)`, DOM text, fixed ticks, and the owning window's shared scheduler. No root package, registry, catalogue, marine renderer or other species edits are planned. Open PR search returned no open PRs at inspection.

Read the actual current `generate-reactive-ascii-animals/SKILL.md` (blob `8ef04dec7f4031f7e69b1319e182a7d722b41fe4`, matching reviewed skill head `e721252075a30888198aafba0953a23fd07bd3c6`), its authoring template and linked anatomy/glyph, portable-contract, accessibility/budget and validation references. The original geometry is the integrated Owl's own geometry. No ray/reference implementation is copied.

Live inspection used the actual public Cuttlefish and Owl pages. Cuttlefish exposed scenes, 1–12 population, compositional presets, individual roles, formation and size controls, targeted staged reactions, and export. Selecting Solo encounter changed count/scene and the live intent label; Startle changed it to gathering arms and disabled repeated triggers. The existing Owl showed one perch, one response cycle and no scene/role controls. Browser UI inspection is separate from source tests and is not a performance measurement. Web search retrieval of these pages failed; live browser inspection succeeded.

## Gap / behavior / scene matrix

| Existing gap | Authored addition | Visible acceptance |
| --- | --- | --- |
| Tiny autonomous idle | Twilight lookout: survey → listen → alert → settle | Head scans with holds, attentive lock, feather release |
| One fixed specimen | Call & answer: lead → reply → shared watch → settle | Two stable individuals respond at different times |
| Same reaction in every context | Last light: survey → stretch → rest → wake | Sleepy lids/posture, partial waking and gentle recovery |
| No spatial direction | Bough / split / close perch composition, responsive stacked duet | Both faces, wings, feet and perches remain readable |
| Untargeted response | Spatial gaze, rustle, call and stretch directed to Ash or Ember | Target responds first; partner answers according to sociability |

## Anatomy and representation

Species: stylized perched owl, retaining the integrated broad facial disk, separated forward eyes, rounded body/folded wings as three silhouette anchors. Feet/shoulders/neck stay attached to original geometry; no flight or unbounded head rotation is added. Current yaw/pitch configuration limits remain authoritative. Head-oriented attention, lids, feather envelope and wing extension supply the pose vocabulary.

Representation: printable ASCII, one semantic DOM text surface. Reuse `renderOwlGrid` for each actor; composition places its exact cells, including intentional pupil spaces, onto a bounded scene grid. Background moon, fixed star field, branch joins and sound marks are original procedural marks. No font, art, external model, texture or audio is bundled. Font fallbacks remain system monospace; recorded raster provenance identifies the installed font separately. No license or npm-release decision changes.

Minimum individual specimen is still 64×36. A duet must reserve that resolution for EACH owl. Wide composition accepts 128–160 columns with at least48 rows; stacked composition accepts64–112 columns with at least80 rows. Maximum is160×90 /14,400 cells. Auto layout uses144×60 in wide hosts and80×90 stacked in narrow hosts. Solo retains96×54 default. An invalid explicit duet grid rejects; count is never silently reduced. Narrow demo stage reserves adequate height and allows ordinary page scrolling.

## Director and behavior commitments

Optional director configuration preserves current single-Owl semantics when omitted. Scene names are `lookout`, `duet`, `roost`; count1 or2; perch layout `bough`, `split`, `close`; actor roles `sentinel`, `curious`, `dreamer`. Actors retain names/identities Ash and Ember. Sentinel scans more broadly and attends sharply; curious tracks invitations; dreamer has longer drowsy holds and softer waking. Motive labels report actual directed states, separately from core reaction behavior.

Lookout has survey/listen/alert/settle beats. Duet has call/answer/shared-watch/settle beats with staggered local gestures. Roost has survey/stretch/rest/wake beats. Autonomous phase pose and spatial focus vary smoothly; purposeful reaction and response/recovery cooldown are bounded. `autonomous:false` stops spontaneous scene progression but explicit cues and gaze still work. `tempo` changes narrative beat accumulation, never the number/order of core ticks or fixed cue response duration.

User cues: `rustle` causes orient → listen/alert → recover; `call` causes lead attention/feather gesture then partner reply; `stretch` uses the existing blink/ruffle/stretch cycle and a delayed companion response. During a cue/cooldown, repeat cues are ignored and counted rather than queued indefinitely. Normalized attention updates are last-wins; one cue is accepted per event batch. Pointer leave/cancel clears transient attention. After a cue, scene direction resumes through bounded smoothing.

## Inputs, types and reproducibility

Explicit species-local director options/config/state/input/result interfaces; frozen copied role tuple and snapshots; strict unknown/undefined/nonfinite/out-of-range rejection before mutation. Count/roles/layout changes preserve stable actor identity. Scene changes reset narrative beat/cue state while retaining core tick and pose continuity. Reset returns both actors and narrative clock to their seeded start, preserving configuration and browser pause/blockers. Disposal stays idempotent; only documented status/disposed inspection remains available afterward.

Determinism: same runtime/version, seed, options, integer tick and ordered normalized input log yields identical director state and ASCII cells. Initial seed7, tick0, sequence−1;60 ticks/s; max16 events/tick. Planned replay: tick60 attention to Ash left/up;120 rustle;121 repeated cue ignored;360 leave;480 call to Ember;840 stretch Ash. Test1/2/5-tick rendering groups. Different OS pointer event delivery is not equivalent; cross-engine trigonometric pixels and serialized state restore are not promised.

Two core actors stay allocated and stepped within the bounded director even in solo display, preserving identity when a companion is added. No extra RAF is introduced. Existing per-host catch-up cap5 ticks/frame and dropped-time reporting remain. Hidden time is discarded on resume.

## Accessibility and lifecycle

Semantic scene buttons, count/layout/role controls and target selection; native buttons give pointer/touch/keyboard equivalents for rustle/call/stretch. Directional keyboard input is scoped to the focused scene; Tab and page scrolling remain normal. Sparse phase/motive status, no glyph/frame-counter live announcements. Pause freezes the entire composite, not merely the first actor.

Reduced motion and other suspension causes compose with explicit pause. Deliberate cues or scene changes display useful static poses without advancing director or actor clocks. Pointer movement cannot restart playback. Hidden/offscreen/zero-size and missing APIs follow the integrated host policy. One instance releases only its own shared-scheduler subscription; setup rollback, delayed callbacks, multi-instance teardown and disposal are tested.

## Budgets and fixed acceptance gates

At most2 core actors /114 existing surfaces,14,400 scene cells,24 background stars,one finite cue indicator,16 core inputs/tick,2 coalesced host actions and5 catch-up ticks/frame. No particles, audio, Canvas backing store, external asset/network runtime or new timers. These are source budgets, not measured browser performance.

| Gate | Fixed check | Required outcome |
| --- | --- | --- |
| Compatibility | Existing Owl40 tests, public factory and relevant repository checks | No lost original API/lifecycle behavior |
| Typed API | Strict build; positive/negative director consumers | No any-cast contract, unknown options reject |
| Replay | Explicit seeded event fixture at1/2/5 grouping | Same states/cells |
| Inputs | Repeats, malformed batches, cue targeting, floods | Atomic rejection; bounded work; correct target |
| Bounds | Solo/wide/stacked layouts, maximum stretch/head pose | Both actors/feet readable, no clipping or hidden count |
| Lifecycle | Pause/reduced/hidden/zero-size/config/reset/shared source/disposal | Stable policy and owned cleanup |
| Visual | Actual scene phase contact sheets + real browser when available | Distinct scene arcs, distinct actors, recognizable small faces |
| Critique | Independent reviewer sees raw source/artifacts | Fix at least one evidence-led issue in a bounded loop |
| Performance | Browser30s workload after2s warmup, if available | Record measured results honestly; no inferred pass |

## Handoff boundary

Export exact source/generated files/demo/tests/evidence/provenance, binary-inclusive patch, PR body, base/head/tree hashes and validation manifest to this chat BEFORE any publication attempt. The existing approval rejection is not bypassed. Any attempted supported publication path must stop at an approval requirement/failure. No merge, deploy, npm publication, settings/credentials change or paid services.
