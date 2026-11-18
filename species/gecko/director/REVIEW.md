# Gecko director: implementation and evidence review

## Review outcome

The Gecko now has an opt-in, typed director and a new example page built through
the existing public facade. Three authored scores and three independently seeded
residents add real wall travel, watchful pauses, cautious hunting, contextual
shadow reactions and physical return. The original single-Gecko mount remains
the default. This is a reviewed local candidate; new browser, motion-quality and
performance acceptance remain pending.

The inspected implementation base was
`c06114404900884814bef879a02f1a49a3e7d590`. Main subsequently advanced to
`c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02` through PR21's shared README status
reconciliation only. The isolated `feat/director-gecko` branch was fast-forwarded
before final validation. The runtime, package contract and geometry at those two
bases are identical; the shared README is not part of this diff.

## What is actually implemented

| Experience | Actual implementation |
| --- | --- |
| Moonlit wall | Stable homes and five-point lanes, contact-gated climbing, staggered role-specific watch intervals, an inspect beat that holds the preceding climb destination, return/perch intentions |
| Lantern hunt | A procedural moth under a lantern, hunter ownership, stalking toward the actual cue, planted poise, distance/alignment-gated catch, 24-tick attached mouth stroke, physical return |
| Passing shadow | A bounded moving dark band with visible sparse edges, nearby delayed alarm propagation, original attached-tail curl and short retreat, independent cooldown, shelter and return |
| Individual personality | Mica/Pip/Slate retain different seeds, scale, heading and routes; scout/hunter/sentry roles have distinct pause schedules; emotion modulates an attached tail; eyes blink deterministically |
| Interaction | Selected or nearest ownership, pointer/touch through the actual viewport, stage-local arrow/Space keys, moth/shadow/inspect/return cues, per-resident roles, population, tempo, courage, autonomy, reverse and route controls |
| Composition | Wide wall view plus selected-only close portraits, procedural original masonry/moon/cracks/lantern, scene and individual status, PNG/text/settings export handlers |
| Library API | Explicit director/config/options/input/state/receipt/recipe/reset types, discriminated scores and results, documented defaults/ranges, strict atomic validation, defensive snapshots and terminal disposal |

The director does not move a rendered animal as a rigid scene sprite. Each
resident advances its existing contact model once per director tick, with a
constant scale and real world-space feet. The reusable Gecko sample/depth/glyph
path is shared by solo and ensemble views. No marine renderer or shared public
species contract was copied or replaced.

## Comparison with the actual live baseline

The independent cloud-browser review operated the deployed Cuttlefish and solo
Gecko pages. Cuttlefish's scene, population, formation, role and choreography
controls were observed; its PNG and standalone HTML exports were downloaded.
The Gecko baseline responded to guidance, surprise, pause/reset and text export,
but its Startle button stayed enabled during recovery and its help stayed generic.

The report and six representative browser screenshots are in
[`evidence/live-baseline`](evidence/live-baseline/LIVE-COMPARISON.md). Its inventory
records hashes of all 17 original image/download evidence files and identifies
which are included here. These are baseline observations, not screenshots of the
new page. The new page's contextual busy feedback is exercised by actual demo
handlers in the DOM/Canvas stub tests.

## Bounded critique and repair

| Evidence-led issue | Correction | Verification |
| --- | --- | --- |
| A moving moth's offset approach point could rotate the hunter away; default replay missed the strike | Guide toward the cue itself, stop when the actual head is near and aligned, use bounded slow moth travel | Default seed37 now catches at tick810; tests require poise, a real catch, strike and return, and reject distant fake catches |
| The inspect beat changed destination before the animal could investigate it | Keep the preceding climb waypoint during inspection | Real arrival and inspect motives occur in the authored replay |
| Failed manual moth expired visually but remained a hunt target | Replace the expired hunt with a bounded home return; explicit inspect/shadow/return cues suppress automatic catching | Regression reproduces the old invisible chase at tick482 and requires visible-cue release and return |
| Close portraits contained cut-off neighbouring torsos and tails | Sample and label only the focused animal while all members continue simulating | Before/after sheets; exact focused-neutral comparison against a single-member state; model tick/contact invariants |
| The wall and passing disturbance were too faint | Brighter sparse masonry, restrained sweep edges, larger moth wings | Independent before/after inspection of actual native frames |
| The 360px capture did not establish the declared 320px minimum | Add an actual 320×320 native render | Head, four separate pad-ended feet and attached taper are distinguishable; individual five-pad resolution is not claimed |
| Strict API review found sparse roles and recipe/reset gaps | Reject sparse roles; preserve common heading in recipes; reset shadow position; keep the legacy action result union separate | Runtime and positive/negative type regressions |

The independent native reviewer compared the retained before sheets with current
outputs and closed this bounded still-image critique loop. The focused view has
no partial neighbours or stray actor ornaments. Sparse shadow boundaries are
observable while animal contrast remains dominant. The Pip detail sequence shows
a moth at tick720, its absence and an attached short mouth stroke at820, and a
changed body/heading/foot pose during return at1060. The poised and strike
checkpoints have identical root, heading and four stance-contact positions.

Two limitations remain visible: the strike is understated at wide scale, and
Canvas names are tiny diagnostic marks. These images do not establish the
readability/accessibility of the real HTML cast controls or the rhythm and charm
of normal-speed playback.

## Validation actually executed

All commands and exit codes are retained in
[`evidence/test-runs.json`](evidence/test-runs.json), with full logs beside it.

- **343/343 repository runtime tests passed**, no failures or skips. The suite
  includes 66 Gecko species tests and five Gecko integration tests.
- **Strict TypeScript passed** for the root and all configured species fixtures,
  including the existing Gecko consumers and 38 new director negative type cases.
- **Existing local package checks passed with optional checks unrun:** repeatable
  tarball, offline consumer install, SSR imports, exported identity, private
  subpath restrictions, NodeNext/Bundler TypeScript consumers and DOM-free core
  declarations. The package remains private/UNLICENSED with no added runtime
  dependency or package export.
- **Existing legacy renderer regression passed.** No shared engine/package/core,
  registry, catalogue, marine source or other species changed.
- **Whitespace check passed.** Generated Gecko demo is reproducible and imports
  the real public factory through the existing builder rewrite.
- The new director and a Fox share one scheduler in the integration harness;
  stopping or disposing the director preserves the Fox subscription. Hidden,
  offscreen, zero-size, bfcache, pause, reset, live reduced motion, partial setup
  failure, reentrant callbacks and terminal cleanup are tested as bookkeeping
  behavior, not native-browser assertions.

Runtime used: Node v24.22.1, TypeScript5.9.3, native Canvas0.1.100, FFmpeg7.1.5.
The package check did not run esbuild, Rollup or Webpack bundling because usable
optional toolchains were absent. Its report labels those checks unrun.

## Rendered evidence and reproduction

The actual compiled sampler, scene rasterizer and painter produced:

- [Six-frame scene overview](evidence/contact-sheet.png), with 11 full-size
  PNG/text checkpoints under `evidence/frames`.
- [Selected portraits and neutral silhouette](evidence/minimum-contact-sheet.png),
  [actual320px frame](evidence/minimum-native-320.png), and
  [wide neutral scene](evidence/neutral-wide.png).
- [Poise / strike / return detail](evidence/hunt-close-contact-sheet.png).
- [333-frame native GIF](evidence/gecko-director-native.gif): 840×560,15fps,
  22.2seconds, three labeled chronological excerpts with explicit cuts and a
  loop reset. It is an offline native render, not a screen recording or a
  browser performance/playback pass.
- [Native metadata](evidence/native-capture.json), with seed37, exact tick ranges,
  state summaries, sample/cell counts and source/generated hashes; separate
  [hunt detail metadata](evidence/hunt-close-capture.json).

After the normal root build, use the already installed native Canvas module:

```sh
node species/gecko/scripts/director-capture.mjs --gif
node species/gecko/scripts/director-capture.mjs --hunt-detail
```

`GECKO_CANVAS_MODULE` may name an existing module path. The capture script also
recognizes `CODEX_PRIMARY_RUNTIME_NODE_MODULES`; it never installs a dependency.
FFmpeg must already be available for GIF creation. Source regeneration and model
tests are deterministic; native font pixels can vary with the host's font stack.

## Remaining acceptance

The local Chromium launch failed before a page opened. The cloud browser could
inspect public baselines, but no supported preview URL for this local checkout
was exposed. That path was stopped without a Work/Sites/deployment workaround.

The following remain pending for the coordinator's authorized browser workflow:

1. New-page desktop and mobile layout, native keyboard/touch, screen reader,
   focus/zoom and reduced-motion interaction.
2. Actual browser visibility, size, bfcache, disposal and downloaded-export
   behavior. Stub ownership tests do not replace these checks.
3. Normal-speed hunt/shadow/route playback and the owner's creative acceptance,
   especially the small strike and restrained shadow.
4. Browser/device fonts and DPR, measured frame time/CPU/heap. The predeclared
   p95≤16.7ms target after2s warmup/30s collection is unmeasured.
5. Optional bundler compatibility, coordinator integration acceptance and any
   later deployment. No npm publication, merge or deployment is part of this work.

The handoff contains exact base/head/tree identities and a binary-inclusive
patch. The species-local API is a candidate addition to the real merged facade;
it does not claim to consolidate a common director contract for the collection.
