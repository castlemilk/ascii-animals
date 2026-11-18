# Pufferfish director — verification and handoff

## Outcome and exact source boundary

This follow-up adds an opt-in species director to the integrated Pufferfish. It starts from current main **`c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02`**, on the new independent branch **`feat/director-pufferfish`**. Main was rechecked before editing and again after validation; it still resolved to that base. Release `c06114404900884814bef879a02f1a49a3e7d590` is its ancestor. The intervening PR21 changed only the shared README. The old original handoff branch was not replayed.

The final commit, tree, complete changed-file hashes and binary-patch/ZIP hashes are recorded in the downloadable handoff manifest generated after committing this source. They are deliberately external to the committed tree to avoid a self-referential commit hash.

Authoritative source remains `species/pufferfish/src`. The existing build produces checked-in species JavaScript/declarations and `dist/pufferfish`. The only additional integration changes are the Pufferfish public facade, its integration test and its API documentation. The canonical marine renderer, shared scheduler, package/exports, root registry, catalogue and other species are unchanged.

## Implemented behavior and API

| Experience | Observable behavior | Configuration / interaction |
| --- | --- | --- |
| Reef ramble | Distinct routes, reef inspection, a quiet gathering, rest | One to three individuals; explorer/sentinel/drifter roles; curiosity and spacing |
| Returning tide | Rising current, paddling effort and lean, shelter, emergence into slack water | Signed current and scene tempo; current ribbons and stable reef landmarks |
| Passing shadow | Watchful approach, one local staged defensive response, companions sheltering, de-escalation | Selected approach, whole-group retreat, finite automatic cue per cycle |
| Individual attention | Gaze and fins respond; invitations move one visitor with configurable personal space | Visible-cell selection; pointer proximity; empty-water tap; native buttons and canvas-scoped keys |

Omitting `director` preserves the existing centered solo API and pure model. Director options/types/results are additive through the current species export. A director has explicit next-tick events, a seed-derived cast, discriminated scene beats, motives, immutable actor states and validated options. Scene tempo affects choreography; original inflation/recovery/cooldown durations retain their fixed 60 Hz timing.

`configureDirector` starts a new scene, as do species configuration/reset changes. Render configuration preserves simulation values. User pause survives all configuration/reset paths. `getOptions()` returns the stable base species configuration; selection does not leak an actor's derived seed. Raw snapshots remain simulation state; status summaries describe deliberate static posters too.

There is one controller subscription to the existing borrowed scheduler, regardless of population. No per-actor RAF, renderer constructor or additional scheduler is created. Hidden/offscreen/zero-size/compact/reduced-motion/pause causes compose, catch-up is capped at five ticks, pending input occupies at most two slots, disposal is idempotent and stale callbacks cannot revive work.

## Completed checks

| Gate | Actual result | Evidence |
| --- | --- | --- |
| Root build | Passed; generated Pufferfish demo/runtime and declarations | `evidence/director/logs/build.txt`, package-check build result |
| Complete repository test script file set | **342 passed, 0 failed, 0 skipped**, 40 files; Node test concurrency bounded to 2 | `evidence/director/logs/repository-tests.txt` |
| Focused Pufferfish tests | **77 passed, 0 failed, 0 skipped**: 73 species + 4 public integration | `evidence/director/logs/pufferfish-tests.txt` |
| Repository TypeScript gate | Passed | `evidence/director/logs/repository-types.txt` |
| Strict/Bundler, NodeNext and ES2022-only Pufferfish fixtures | All passed, including positive and intentional-error public-subpath consumers | `evidence/director/logs/pufferfish-types.txt` |
| Canonical renderer regression | Passed; original geometry, encounter, targeted reaction and formation checks | `evidence/director/logs/canonical-regression.txt` |
| Historical authoring bridge | 7/7 passed against the frozen oracle | `evidence/director/logs/authoring-bridge.txt` |
| Local package gate | Passed with explicitly unrun optional bundlers; repeatable tarball, offline install, stub-free server imports, NodeNext/Bundler/server types | `evidence/director/package-check.json` |
| Native visual capture | 28 PNGs, four contact sheets, one 100-frame/20-second GIF; actual canonical native Canvas | `evidence/director/final/capture.json` |
| Source/runtime capture provenance | All 15 authored/imported file hashes stable during final capture and matched afterward | Same capture manifest |

The full repository gate executes exactly the file globs in `package.json`'s `test` script after a successful build, adding only `--test-concurrency=2`. Its exact expanded command is the first line of the log. The package harness performs local `npm pack` and an offline consumer install; it does not publish.

Pure tests cover deterministic replay at different presentation groupings, finite invitations, bounded velocities and geometry, scene transitions, normalized actor-relative input, strict ordering/atomic rejection, individual reactions, retreat priority, cooldown, configuration and immutable state. Controller/integration tests use resource-accounting DOM/Canvas doubles and actual canonical rendering methods. They verify ownership-grid selection, tap cancellation/dragging, scoped keys, static actions, lifecycle cleanup, independent disposal, callback reconfiguration and shared scheduling. They are not browser input or pixel acceptance.

An earlier full-suite run recorded 340/342 with two overly strict new test expectations. Those assertions were corrected with review: render configuration preserves complete state values rather than promised object identity, and invitation personal space is measured after capped travel settles, before expiry. The old broken curiosity implementation still fails that regression. The earlier log and rationale are retained in `repository-tests-before-test-corrections.txt` and `pufferfish-test-review.txt`; the final full run is clean.

## Evidence-led critique loop

### Rendering correction

Actual 360×420 and 390×520 native frames exposed two related problems: an inflated fish crowded its neighbor, and long name/role label backgrounds crossed neighboring anatomy. A bounded director-only correction scales trio geometry to 0.72 on narrow canvases, smoothly restoring normal size by 700 logical pixels, and uses short name labels. Actor centers stay unchanged and actual visible owner cells continue to determine selection.

The [before/after comparison](evidence/director/mobile-before-after.png) uses the same exact simulation-state hash. The corrected raw mobile images were inspected. Bodies and labels separate more clearly; small eye detail remains limited at mobile size. The [front still](evidence/director/final/reef-front.png) shows both eyes and paired fins clearly. The [sampled motion strip](evidence/director/final/current-inflation-strip.png) shows Moss inflating while neighboring fish stay small. This is sampled motion review, not continuous browser playback acceptance.

All captured trio frames used **14,793 combined samples**, below the 16,000 budget. All three actors retained visible selectable owner cells in each still. No sampled actor cell touched the outer grid edge, which does not prove every arbitrary configuration is clipping-free. The grid/pixel/DPR caps remain 160×90, 1200×675 and 2. The GIF has some palette banding; PNGs preserve the native raster.

### Interaction corrections

Independent review reproduced and corrected these substantive issues, now protected by regression tests:

- A manual approach after retreat was mistakenly suppressed by the automatic-threat quiet period. New deliberate input now works while the existing species cooldown still governs repeat reactions.
- An invitation could survive pause → deliberate still action → resume. Suspension now clears raw transient director intent immediately.
- Curiosity did not change keyboard/touch invitations. It now affects exploration and the personal space used by explicit invitations, as well as pointer attraction.
- Passive pointer leave could swallow a subsequent button invitation. Passive target clearing and explicit Give space now have distinct coalescing priority; explicit retreat remains dominant within a tick.
- Selecting a different actor changed the facade's apparent base seed. `getOptions()` now consistently returns the scene's base species configuration.

The independent source review found no further high-impact blocker within its bounded review of director/controller/facade code. No reviewer claimed browser acceptance.

## Browser and performance boundary

The deployed **baseline** Cuttlefish and Pufferfish pages were directly inspected before implementation. Cuttlefish's scene cards, diagonal/solo ensembles, cursor follow, roles and scene actions informed the gap matrix. That observation is about the released baseline, not this new branch.

New-demo browser inspection was attempted without publication. The cloud browser could not reach `http://127.0.0.1:4173/pufferfish/` and reported `ERR_CONNECTION_REFUSED`. A bounded native desktop attempt could inspect the Chromium window, but keyboard input failed because its AT-SPI provider was unavailable. No browser acceptance is inferred from those attempts, and no settings, network permissions or credentials were changed to work around them.

Native rendering used `@napi-rs/canvas` and the current canonical module directly. Its initial mutable-atlas capture hit a native resource problem (exit 137); the documented capture-only immutable Image cache has byte-identical output for the checked comparison frame. This does not change production rendering or establish production memory behavior. Native timings are recorded with their exact scope; they do not establish FPS, phone performance or smoothness.

Still unrun or awaiting coordinator acceptance:

- New-demo browser layout, pointer/touch/keyboard flow, accessibility tree and screen-reader review.
- Real-device mobile behavior, continuous animation smoothness, memory, battery/thermal behavior and performance targets.
- Cross-browser and cross-platform font/raster behavior; exact native fallback font identity.
- Optional esbuild/Rollup/Webpack package checks; available tooling did not cover these.
- Every extreme configuration/pose and all possible multi-actor overlaps.
- Coordinator integration/review and deployed director acceptance. No deployment or npm publication was performed.

## Reproduction and handoff

Use the exact recorded base and apply the binary-inclusive patch in a fresh checkout, or review the exact species overlay in the ZIP. The ZIP includes authoritative source, emitted JavaScript/declarations, a generated self-contained Pufferfish demo, tests, brief, API docs, native evidence and provenance. It is an overlay for the existing repository, not a new independent engine or npm contract.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm test
npm run typecheck
node node_modules/typescript/bin/tsc -p species/pufferfish/tests/tsconfig.types.json
node node_modules/typescript/bin/tsc -p species/pufferfish/tests/tsconfig.nodenext.json
node node_modules/typescript/bin/tsc -p species/pufferfish/tests/tsconfig.server.json
npm run test:legacy
node scripts/check-authoring-bridge.mjs
npm run check:package -- --report species/pufferfish/evidence/director/package-check.json
```

Native capture commands and their optional tool dependencies are in [the evidence README](evidence/director/README.md). The actual authoring skill/template was read at `skunkworq/skunkworq-skills@23e078642157a273e2b886222470bd247e5737b5`, with reviewed parent `e721252075a30888198aafba0953a23fd07bd3c6`. No copied ASCII drawing, ray renderer, font binary or third-party geometry is introduced.

The downloadable artifacts must be saved and linked in chat before any GitHub publication attempt. Only a new branch and draft PR are authorized; approval/failure stops that publication path. Merging, force pushing, deploying, npm publication, settings/credential changes and unrelated communications remain outside this task.
