## Why

Add an original reactive frog with a squat torso, paired raised eyes, folded hind legs and attached forelimbs. A pointer previews a reachable landing; deliberate keyboard/tap actions commit a crouch, bounded ballistic leap, landing compression, recovery and cooldown. Idle throat expansion stops with motion policy; static pose alternatives remain usable.

## What changes

All changes are under **`species/frog/`**: authoritative strict TypeScript source, emitted ESM/declarations, a local interactive demo, tests, pre-code authoring record, provenance/compatibility notes and reproducible captures. There are no shared engine, package export, registry, root README or workflow edits.

- Explicit config/options/input/state/result/sample/controller types; discriminated behavior states; immutable validated configuration and state; positive consumer fixtures plus 27 negative type assertions covering invalid calls.
- Explicit 60Hz next-tick/seed/event-sequence protocol, bounded target latching, eight-event cap, busy actions ignored without queue, reset/config/update/disposal semantics.
- Semantic controls, keyboard/tap routes, pause/reset, static reduced-motion poses, hidden/offscreen/zero/undersized suspension, bounded catch-up, pointer coalescing and per-instance cleanup.
- Original 17,918-point geometry; no copied ASCII art, model, raster frog or educational ray core.
- Small constructor-free **private legacy adapter** reuses actual `_put`, `_rasterize`, `_projectWorld`, `makeAtlas` from the pinned existing renderer. This is not a second shared engine or an accepted public species interface.

## Base and integration status

- Exact base main: `0e446c47b491b751d484e40db753ec725652b515` (includes supplied baseline/import and later Pages PR3).
- Authoring skill: reviewed `e721252075a30888198aafba0953a23fd07bd3c6`; supplied `23e078642157a273e2b886222470bd247e5737b5` has identical SKILL.md.
- PR2 read-only audit refreshed at `8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1`. Its strict typed facade still accepts only `cuttlefish`; its shared species/writer sketch is not exported. Exact differences, including update/reduced-motion/post-disposal semantics and atlas compatibility, are in [INTEGRATION.md](https://github.com/castlemilk/ascii-animals/blob/feat/animal-frog/species/frog/INTEGRATION.md).
- Incoming catalogue PR4 read at `5015dbcffb75b1036b21b4b8e3e65bf0697a46f1`: no frog-path overlap or renderer change; its Frog entry remains in development.
- **Integration acceptance pending.** Do not substitute PR2's regenerated renderer without porting/reviewing the local adapter. Central exports, registry, canonical seam and final package acceptance remain with the coordinator.

## Verification actually run

- **30/30** Node tests: pure state/input/config/replay, geometry/attachments/bounds, mocked lifecycle/keyboard/touch/resource ownership.
- **2/2** static demo checks: actual control choices/labels/markup and local asset references; these are not browser tests.
- **4/4** actual native Canvas tests: real legacy projection/glyph cells, 1/2/5 presentation grouping, cell export, viewport/DPR/bounds and adapter validation. Cases run in separate native processes after a combined stress run was SIGKILLed; no browser heap/performance claim.
- Strict **TypeScript 5.9.3** source and emitted-declaration consumers; **27 negative `@ts-expect-error`** cases are active.
- Original `scripts/check-engine.cjs` passes (60 geometry cases; zero nonfinite/clipped samples), dist syntax passes, standalone rebuild is byte-identical. Original dist hashes unchanged.
- Skill's bounded authoring-spec validator passes. Full commands/logs and limits are in [EVIDENCE.md](https://github.com/castlemilk/ascii-animals/blob/feat/animal-frog/species/frog/EVIDENCE.md).

## Actual visual evidence and critique

![Native Canvas frog replay](https://github.com/castlemilk/ascii-animals/blob/feat/animal-frog/species/frog/evidence/frog-leap.gif?raw=1)

[Contact sheet and minimum-grid silhouettes](https://github.com/castlemilk/ascii-animals/blob/feat/animal-frog/species/frog/evidence/frog-contact-sheet.png) · [Replay JSON](https://github.com/castlemilk/ascii-animals/blob/feat/animal-frog/species/frog/evidence/replay.json) · [Authoring record](https://github.com/castlemilk/ascii-animals/blob/feat/animal-frog/species/frog/AUTHORING.md)

These are **native Canvas captures of the actual geometry/legacy atlas, not browser screenshots**. GIF: 101 frames at720×540/20fps from explicit60Hz ticks. An independent reviewer who did not author the geometry supports full-size front recognition and attachments in sampled states.

One bounded visual revision lifted the belly and moved fore elbows/wrists outward after the first captures showed limbs merging. Before/after captures are retained; count/attachments/timing/tests were preserved. Independent review also identified and fixed boundary-leap, null-reset, static-pose, cancelled-touch, late-callback, pause-gaze and malformed Rest-option defects, with regression checks.

## Open acceptance (do not mark passed)

- Minimum72×40 all-anchor anatomical legibility is **partial**, especially forelimbs/rear-leg folds across turns. Profile remains diagnostic.
- Reviewers inspected PNG states, not normal-speed GIF playback; perceived motion weight/smoothness, glyph shimmer and throat quality remain open.
- Chromium launch was blocked before page load (`socket()/ptrace Operation not permitted`); real browser input/pixels, responsive/accessibility/screen-reader and physical touch acceptance are unrun. The smoke script and exact failed attempt are included.
- Desktop/mobile p95/p99 frame budgets and heap/long-session profiling are unmeasured. Source caps and test execution times are not FPS evidence.
- Shared public species integration and real package/tarball acceptance remain pending PR2/coordinator decisions.

## Reproduce

```sh
FROG_TSC=/absolute/path/to/typescript/lib/tsc.js node species/frog/scripts/build.mjs
node --test species/frog/tests/core.test.mjs species/frog/tests/geometry.test.mjs species/frog/tests/lifecycle.test.mjs
node --test species/frog/tests/demo.test.mjs
node --test species/frog/tests/native-preview.test.mjs
node scripts/check-engine.cjs
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/species/frog/demo/`. Native capture/tests require an existing `@napi-rs/canvas` installation; see the frog README for explicit tool paths. No dependency install is performed by the scripts.

Draft only. No merge, npm publication, deployment, settings/credentials changes, unrelated issue or communication. The existing Pages workflow serves only `dist`; this frog is not deployed.
