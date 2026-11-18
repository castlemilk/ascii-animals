# Frog director evidence and acceptance

This feature was authored on an isolated `feat/director-frog` checkout from exact main **c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02**. The initial requested release was c06114404900884814bef879a02f1a49a3e7d590; the mandatory pre-edit recheck found the newer README-only integration reconciliation, which became the actual base. Main was rechecked during final review and still pointed to that exact base. The pre-code authoring commit is a66c30f. Final base/head/tree and file hashes are in the downloadable handoff manifest, created after the final commit to avoid a self-referential commit hash.

## Evidence categories

| Evidence | What actually ran | What it establishes |
| --- | --- | --- |
| Live baseline browser | Cuttlefish scenes/presets, solo encounter reaction, six-actor procession/labels, particle mode; existing Frog landing menu/Leap | The actual expressive gap, before this feature |
| Pure model tests | Director options/events, ownership, all27 scene/count/layout combinations for1,200 ticks each, replay grouping, cues, safe hunts and reset | Deterministic bounded logical behavior |
| Mounted public API tests | Real `createFrogArtwork` and real shared scheduler with injected window/document/observer/preview doubles | Scheduling, input, pause/reduced/hidden/resize/disposal semantics; not browser pixels |
| Demo checks | Static HTML/asset checks plus explicitly labelled DOM doubles | Native control wiring, sparse announcements, cleanup, role/scene state, slider drag and BFCache handling; not visual layout or accessibility certification |
| Type checks | TypeScript5.9.3 strict public consumers with24 negative assertions and positive examples | Actual emitted declarations and discriminated types |
| Native Canvas | Real frog geometry/atlas/rasterizer through installed `@napi-rs/canvas`, with installed Liberation Mono | Actual rendered pixels/cells, owner picking, budgets, replay comparisons and visual critique |
| New demo browser | Local URL attempted in the cloud browser, connection refused | No new-demo browser pass |
| Deployment/performance | No deployment or target-device benchmark run | No deployed, browser-FPS, GPU, heap or mobile-performance claim |

Final results:340/340 repository tests,28 director runtime tests,7 demo checks,4 original native cases and3 director native cases pass. Strict project/director types pass, including24 new negative assertions. Actual tarball/SSR/declaration checks and the legacy regression pass; optional esbuild/Rollup/Webpack execution remains unrun. Executed command outcomes are in `validation.json` and the accompanying logs. Failed review iterations remain separately labelled; they are not final pass evidence.

## Visible changes and bounded critique

The first contact sheet is retained under `evidence/critique-before/`. Desktop frogs were recognizable by their raised eyes and squat silhouettes; foreground limb folds partly blended into pads, and calling was too similar to quiet rest. The mobile image retained all three actors but did not resolve enough fine limb detail to pass the all-anchor minimum-grid gate.

One bounded implementation/review loop addressed the observed issues:

1. **Calling clarity:** compare rest to the real peak of the84-tick call envelope (age42), then add a call-specific throat brightness envelope and60 glyph samples of outside-cheek arcs per caller. The geometry is still the original throat, not a substituted sprite. Final `call-comparison.png` shows a brighter, expanded central sac and visible surrounding marks.
2. **Hunting continuity:** an arbitrary input point could leave the firefly away from the eventual landing. Invitations now choose a reachable perch or the current perch. A blocked chase may miss, and a capture is claimed only within bounded strike reach. The firefly body/halo is larger without increasing sample count; final tracking and flight frames show a distinct light.
3. **Depth and labels:** review found that rear pads received larger z despite the rasterizer's larger-z-wins convention. The sign is corrected; names follow each actor's head, including during a hop, instead of appearing over a foreground neighbor's body.
4. **Static composition retention:** the unchanged expanded regression caught a paused Ripple still changing gaze and target after hide/show. Suspension now drops pending input while retaining the committed paused/still target. The actual before-fix failure is retained, and the final regression passes.
5. **Lifecycle and controls:** independent review found undersized-still restoration, callbacks after disposal, in-progress pace changes overwritten by snapshots, unavailable pad choices, stale static-pose labels and persisted pagehide handling. Each has a concrete correction and targeted regression.

The final visual judgment is limited to native stills and the ordered captured frames: the ensemble and distinct activities are visible, all actors remain in frame, the call is clearer, and the target/landing relationship is coherent. A GIF is supplied for human motion review; normal-speed human motion acceptance is not claimed merely because an encoded animation exists. Fine mobile limb readability remains partial.

## Capture and reproduction

```sh
npm ci --ignore-scripts
npm run build
npm test
npm run typecheck
node node_modules/typescript/bin/tsc -p species/frog/tests/tsconfig.director.json
npm run check:package
node --test species/frog/tests/native-preview.test.mjs
node --test species/frog/tests/native-director.test.mjs
node --expose-gc species/frog/scripts/render-director-evidence.mjs
ffmpeg -y -framerate 10 -i species/frog/director/evidence/frames/%04d.png \
  -filter_complex '[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3' \
  -loop 0 species/frog/director/evidence/frog-director.gif
```

The native module path can be supplied through `FROG_CANVAS_MODULE`; `FROG_FONT_FILE` selects an installed font. Capture metadata records exact font SHA-256, runtime, viewport, scene, seed, tick and sample/cell counts. No font binary is bundled. Native capture uses720×440 DPR1, a180×100 maximum grid and three explicit six-second scene segments at10 captured frames/second (183 frames including segment endpoints). The model remains60Hz. A separate390×520 image tests narrow composition; a reduced-motion sheet shows deliberate Call/Hunt/Ripple stills.

An initial uncollected900×560 run was killed with exit137 after one saved frame. A repeated native-cell test without pixel flushing was also killed with SIGKILL. The capture harness now uses a smaller actual viewport, explicit native pixel flushes and garbage collection; native cases run in separate processes to bound their retained caches. These are capture/test harness measures, not runtime changes or browser memory results. The native harness still consumes substantial memory; no native efficiency claim is made.

The capture is procedural original geometry and ordinary glyphs. Animal silhouettes, lily pads, reeds, rings, moon and insect are sampled geometry. Names, selection outlines, trajectory guides and capture captions are disclosed non-glyph UI. No online ASCII art, raster animal, licensed model or generated illustration was used.

## Unrun or incomplete acceptance

- New `dist/frog/` execution in a reachable browser, including console errors, pointer/touch coordinate accuracy, keyboard traversal, actual CSS layout and BFCache navigation.
- Physical mobile touch/scroll behavior and device performance.
- Screen-reader and magnification review; labelled native controls and sparse live regions have source/DOM-double coverage only.
- Browser warmup/p95/p99 frame costs, GPU behavior and long-session heap/atlas behavior. Source caps and captured GIF cadence are not performance passes.
- Minimum-grid recognition of every limb/fold in a three-frog scene, and profile-view anatomical readability. The original profile view remains diagnostic.
- Human normal-speed motion review of calling, flight, landing and social timing.
- GitHub CI and review of the eventual draft PR; publication state is recorded separately in the handoff.
- Production deployment, npm publication and broader shared-contract consolidation. None is part of this patch.

## Scope and provenance

Canonical source remains `species/frog/src/*.mts`. The public facade and declaration bridges are the already merged integration; the new director uses their existing export path. Shared scheduler, package exports, core, registry, catalogue, marine source and all other species remain unchanged. `test/frog-director-integration.test.mjs` is a frog-only discovery bridge under the existing root test wildcard; no package test script change is needed.

The actual skill, linked authoring template and references were read at23e078642157a273e2b886222470bd247e5737b5 (reviewed parent e721252075a30888198aafba0953a23fd07bd3c6). `AUTHORING.md` records the pre-code anatomy/anchors, representation/font rights, stages, deterministic protocol, input normalization, budgets and reduced-motion alternatives. This extends the self-contained frog renderer already integrated at the base; it does not copy the teaching ray or introduce a competing shared renderer.
