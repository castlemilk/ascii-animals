# Pufferfish director: native rendering evidence

This folder records actual procedural geometry rendered through the repository's canonical Canvas glyph renderer. It is **native Canvas evidence**, separate from browser interaction, accessibility, deployment and real-device performance acceptance.

## Review the result

- [`mobile-before-after.png`](./mobile-before-after.png): the bounded visual critique and correction at actual 360×420 output size.
- [`final/current-native.gif`](./final/current-native.gif): one coherent 20-second current scene, 100 frames sampled every 12 model ticks and encoded at 200 ms per frame.
- [`final/current-inflation-strip.png`](./final/current-inflation-strip.png): eight consecutive GIF frames around the selected fish's local reaction.
- [`final/reef-contact-sheet.png`](./final/reef-contact-sheet.png), [`final/current-contact-sheet.png`](./final/current-contact-sheet.png), [`final/shadow-contact-sheet.png`](./final/shadow-contact-sheet.png): six recorded checkpoints for each scene.
- [`final/reef-front.png`](./final/reef-front.png): front-view still comparison, including both raised eyes and paired fins.
- [`final/capture.json`](./final/capture.json): exact inputs, state/frame hashes, counts, owner probes, timings, imported runtime hashes and limitations.

## Bounded critique and correction

The original mobile captures used three actors at maximum configured size, spacing and inflation. The inflated Pip body overlapped Moss appreciably, while the 164 px name/role label rectangles crossed neighboring anatomy. These are visible in `before/reef-mobile-360.png` and `before/reef-mobile-390.png`.

The correction is restricted to director rendering. A three-actor composition uses a geometry multiplier of **0.72 at widths through 520 px**, smoothly returning to 1 at 700 px. Actor centers remain at the same normalized coordinates. Multi-actor labels below 700 px use 72 px name-only cards; roles remain available in the demo's textual actor roster. Label height accounts for the configured inflation scale. `PufferfishRenderResult.sceneScale` exposes the applied geometry multiplier. Solo rendering and pair geometry scale remain unchanged.

The final 360 px and 390 px raw captures were visually inspected. They show separated round bodies, readable compact names and fins around the neutral fish. Labels no longer cross the neighboring bodies in these recorded compositions. The mobile before and after captures use **identical scene state**, SHA-256 `b7efaa6a4992dcc6baa5e0aa3256e4a1bc861654c84a0693391ca9180306d411`; only their renderer output differs. Exact PNG hashes are in `review-artifacts.json`.

At the actual mobile size, eye features are small; the front-view wide still shows both eyes more clearly. Wide scene checkpoints show distinct grouping, individual local inflation and subsequent calm arrangements. Consecutive sampled GIF frames from ticks 348–432 show Moss growing while the other two fish stay small. This is sampled motion review, not a claim of continuous browser playback quality. The GIF's reduced palette introduces visible dark-background banding; the PNGs retain the native raster output.

The review stops after this bounded correction. It does not claim that every possible configuration or pose is free of overlap.

## Measured scope

| Observation | Actual result |
| --- | --- |
| Native runtime | Node v24.22.1, Linux, `@napi-rs/canvas` 0.1.100 |
| Final still captures | 28 PNGs: 18 scene checkpoints, 6 maximum-size mobile posters, 3 points-mode stills, 1 front-view still |
| Final contact sheets | 4 |
| Animation | 100 frames, 20,000 ms, 600×450 encoded output |
| Combined samples in captured trio scenes | 14,793 each: 3×4,572 animal samples plus 1,077 environment samples |
| Per-frame allocation limits checked | At most 16,000 samples, 160 columns and 90 rows |
| Selectable actors | All three have visible owner cells in all 28 still captures |
| Mobile360 visible owner cells | Pip 434, Moss 161, Miso 164 after adaptive scaling |
| Outer grid edge actor cells | Zero in these still captures; not a proof for arbitrary poses |
| Native draw timing | 128 draws; median 6.64 ms, p95 17.16 ms, p99 41.91 ms, max 65.19 ms |

The timing sample excludes PNG encoding and has no warmup or controlled-device protocol. It does **not** establish browser frame rate, phone performance or memory/thermal acceptance. The reduced capture animation frame rate is an editorial sampling choice, not a measured renderer frame rate.

Picking was probed through `hitActor` on actual visible grid-cell centers. It uses the shared renderer's dense owner buffer and filters the environment owner. Adaptive scaling changes geometry around the same actor center; the logical director proximity radius remains its documented interaction threshold rather than a pixel silhouette test.

## Rendering provenance and native capture workaround

The script imports `lib/animals/cuttlefish.js` and the compiled Pufferfish modules directly. The species bridge borrows the existing `render`, `makeAtlas`, `_put` and `_rasterize` methods in place. It invokes no renderer constructor, RAF, browser stub, generated image service or replacement renderer. Source and built canonical renderer hashes match: `579a97f5152e0d94b70c559e22d8b8aa4016de4ad440b3f3b3bf327e167ea6a8`.

An initial native run was killed with exit 137 after one mutable Canvas-atlas frame. A bounded probe measured roughly 2.13 GB RSS after that frame with only about 10 MB JavaScript heap. The capture now converts the actual atlas losslessly to one immutable native Image and substitutes it only as the source of the same `drawImage` calls. This is a capture-only cache; runtime/browser code is unchanged. A bounded cached probe stayed around 72–98 MB RSS. [`native-atlas-parity.json`](./native-atlas-parity.json) records byte-identical PNG output for the checked raw-Canvas and cached-Image frame, SHA-256 `08a44aeec166d6079cb46478891b2209092fccfde11001906ac8b5cd31257990`. This validates that comparison frame, not an undocumented native-library memory fix.

Only one wide and one temporary mobile painter are retained at a time. Each painter/atlas is disposed when its scenario ends. Raw GIF frame PNGs are streamed to temporary files and removed after assembly. Pillow only assembles existing native output; it does not generate replacement fish imagery.

The final manifest hashes both the authored TypeScript and the **actual imported compiled JavaScript**, then asserts that all those files remain unchanged through the capture. The earlier `before` manifest predates that additional compiled-module hash inventory; it is retained as the visual critique baseline and is not used to claim final source parity. No font is bundled or downloaded; the available native monospace families are recorded, while exact fallback selection is uninstrumented.

## Reproduce

From the repository root, with dependencies installed and Python Pillow available:

```sh
npm run build
npm install --no-save --package-lock=false @napi-rs/canvas@0.1.100
node species/pufferfish/scripts/capture-director.mjs --tag=final
python3 species/pufferfish/scripts/review-director-captures.py
```

The optional native capture dependency is local tooling; it is not added to package exports or runtime dependencies. Use `--quick` to omit GIF frames. `--tag=before` is intended only when deliberately recording a new critique baseline; it would replace the preserved before images. The review assembly script requires the recorded baseline and asserts identical before/after scene state.

The exact seed is 23. The manifest materializes every event, including the selected actor's current position at pointer tick 721. Scene checkpoints occur at ticks 1, 240, 420, 660, 900 and 1199. A build is required before capture; do not edit source or compiled modules during it.

## Acceptance not established here

- Live browser pointer, touch, keyboard and DOM layout/accessibility behavior.
- Real phone/browser performance, continuous animation smoothness, memory, battery and thermal behavior.
- Cross-platform fonts, exact fallback font identity and raster parity.
- Every extreme configuration/scene pose and all possible multi-actor overlaps.
- Deployed director behavior. These files are local evidence from the reviewed branch.
