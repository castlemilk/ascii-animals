# Pufferfish uplift — review and central handoff

## Scope and result

Base: `b8f222dab868821f27bf2a64a98434f3483fc8e6`, verified against GitHub main on 2026-11-19. Working branch: `pufferfish/fine-spines-and-recovery`.

The resting animal is an oblong, spotted Arothron-inspired puffer with a pale abdomen, lateral eyes, blunt muzzle and small paddle fins. Inflation unfolds its abdomen and flanks more than its longitudinal axis; skin markings stretch with that surface, and fine spinules rise after the belly starts to round. Forty-two explicit spine identities remain, with a second layer of 84 fixed microrelief sites. A warm iris rim and fan tail retain direction at phone size. Original rocks, fronds, sponge cups, shell ribs and sparse grains occupy separate depths around clear central water.

The reference observations and rights are in [UPLIFT-BRIEF.md](UPLIFT-BRIEF.md). Geometry and timing are original stylization, including the two authored recovery hesitations. No reference photo, font or external geometry is bundled.

### Two directed encounters

| Encounter | Anticipation | Response | Recovery / input |
| --- | --- | --- | --- |
| Reef inspection | Invitation produces a 30-tick brake with attention toward the target | Cautious approach, personal space and a held inspection | Backs away into the reef route; empty-water tap, `I`, Invite button, or `invite(x,y)` |
| Startled inflation | Selected fish brakes and recoils during the existing notice interval | Disproportionate belly inflation, delayed spine erection, guarded hold with small fin/gill movement | Monotone deflation pauses twice, holds station and gradually regains drift; close pointer, `A`, Approach button, or `approach()`; Escape/Give space/`retreat()` releases pressure |

Native controls, visible-fish selection and focused-canvas shortcuts retain their existing semantics. No controller, scheduler, public types/defaults, facade, engine, other species, dependency, shared entry point or workflow changes are included. Generated package/demo/species builds are excluded. The mobile CSS change gives a 390px page enough canvas width for its existing animation threshold; visual order still follows DOM/tab order.

## What ran

Run from the repository root, on the exact final TypeScript source:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
node --test species/pufferfish/tests/*.test.mjs test/pufferfish-integration.test.mjs
node node_modules/typescript/bin/tsc -p species/pufferfish/tests/tsconfig.types.json
node node_modules/typescript/bin/tsc -p species/pufferfish/tests/tsconfig.server.json
node node_modules/typescript/bin/tsc -p species/pufferfish/tests/tsconfig.nodenext.json
npm run typecheck
npm run check:package -- --report ../pufferfish-review/package-check-final.json
node --check species/pufferfish/scripts/capture-uplift-native.mjs
node --check species/pufferfish/scripts/review-uplift.mjs
node --check species/pufferfish/scripts/capture-director.mjs
git diff --check
```

- **84/84** focused/integration tests passed, zero skipped. Coverage includes strict events/configuration, deterministic state and actual glyph cells across render grouping, bounded geometry, all views at the minimum grid, independent actors, selected-only responses, pointer/touch/keyboard mapping, pause/reduced motion, compact/zero-size/hidden/offscreen behavior, resize, borrowed scheduler and disposal. DOM/input/lifecycle tests use the existing accounting doubles; they are not real-browser interactions.
- Six focused uplift gates cover nonuniform expansion, two finite recovery pauses, partial/short/long recoveries, extreme diagonal gaze attachment, invitation anticipation/inspection/release, and local recoil/station keeping/return to drift. The earlier baseline probe failed the new shape and hesitation gates, as expected.
- All three Pufferfish typed import fixtures and the root typecheck passed. Public type/controller/facade files are byte-identical to the base.
- Package check exited zero: repeatable local tarball (495,875 bytes; 190 files), actual unpacked consumer imports/identity, public methods, blocked private subpaths and consumer type fixtures passed. Its exact status is `passed-with-unrun-optional-checks`: esbuild, Rollup resolver and webpack consumer checks were unavailable. It contains no browser, hydration, GPU, touch or accessibility acceptance.
- Independent source review found and prompted two fixes: removal of CSS-only mobile control reordering, and keeping the iris rim attached at extreme diagonal gaze. The latter has an explicit passing geometry gate.

No full-repository `npm test`, publication, deployment, merge or settings change is claimed.

## Render evidence and its limits

The handoff bundle contains matched `before-native/` and `after-native/` captures, their complete `native-capture.json` records, comparison sheets and motion GIFs. Both runs use the same harness, seed 23, right view, DPR 1, explicit simulation ticks and event logs. Raw source/runtime SHA-256, state/cell/PNG hashes, options and actor states are recorded for each run. Compiler/package parity and stable source hashes are checked before/after capture.

- Desktop: **1200×675**. Phone: **390×520**. Additional minimum-canvas cases: **360×270**, both fine and small, solo and trio, calm/inflated. Front and both three-quarter views are included.
- Defensive replay: `approach` at tick 121, `retreat` at 271; checkpoints include anticipation, belly growth, hold, both portions of recovery, cooldown and resumed drift.
- Inspection replay: `invite(.38,-.2)` at tick 61; checkpoints include brake, approach, held inspection, withdrawal and route recovery.
- Each motion excerpt samples ticks 0…720 every four ticks, encoded at 15 fps; the GIF returns to its start after the excerpt. This is simulation playback, not measured live frame throughput or a seamless loop.
- The renderer is the actual canonical glyph/depth pipeline in **@napi-rs/canvas native Skia**, not a browser. Only its atlas drawImage source is snapshotted to an immutable lossless native Image to avoid native-library retained copies; the camera, samples, glyph writer and rasterizer are unchanged.

Whole-scene sample ceiling remains **16,000**; the final three-actor case uses **15,622**. The small minimum canvas remains **72×40** cells. Fine minimum-canvas capture is **96×54**; responsive density is capped at 96 columns through 520 logical pixels, smoothly returning to the existing standard/fine maxima by 700. Existing 160×90, DPR≤2, 1200×675, bounded input and catch-up limits remain.

**Real-browser review is still open.** Local Chromium failed during process creation (`socket(): Operation not permitted`), before a page or test assertion. The supported cloud browser could not reach the local service and then hit a URL-policy block. No workaround was attempted. The supplied browser harness has only passed syntax validation. Native captures do not prove browser font rasterization, actual page layout/reflow, physical touch, assistive technology, cross-browser behavior, heap stability or device performance.

## Apply and regenerate centrally

Apply the independently delivered `pufferfish-uplift.patch` to the stated base with `git apply --check` then `git apply`. The patch contains only owned Pufferfish source, tests, review scripts and documentation, plus `docs/PUFFERFISH-API.md`.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
node --test species/pufferfish/tests/*.test.mjs test/pufferfish-integration.test.mjs
npm run typecheck
npm run check:package
```

`npm run build` is the central generation command for `species/pufferfish/build/`, `lib/` and `dist/pufferfish/`, together with the repository's normal shared generated outputs. Review and commit generated output centrally; none is included in this patch.

For native reproduction with an existing `@napi-rs/canvas`, FFmpeg and ffprobe installation:

```sh
node species/pufferfish/scripts/capture-uplift-native.mjs --root=/absolute/baseline --out=/absolute/review/before-native
node species/pufferfish/scripts/capture-uplift-native.mjs --root=/absolute/candidate --out=/absolute/review/after-native
```

Build each root first. `CODEX_PRIMARY_RUNTIME_NODE_MODULES` is an optional dependency lookup fallback; the script installs nothing. To run the pending browser gate in an environment with working Playwright/Chromium:

```sh
PUFFERFISH_CHROMIUM=/path/to/chromium node species/pufferfish/scripts/review-uplift.mjs --root=/absolute/candidate --out=/absolute/review/browser
```

The browser harness serves only its local review checkout, exercises the public factory and generates separate browser evidence. This handoff remains a review candidate until that gate and central review are complete.
