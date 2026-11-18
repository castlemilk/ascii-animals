# Architecture and package boundary

## What is implemented in the inspected site

`dist/artwork.js` is a browser IIFE exposing one constructor on `window`. It contains geometry generation, per-animal state, routes, reactions, pointer interpretation, a scheduler, Canvas 2D drawing, and resource ownership. `dist/app.js` owns page controls, keyboard handling, reduced-motion policy, telemetry polling, fullscreen, PNG/source/HTML downloads, and readable scene descriptions. `dist/record.html` is a second consumer with browser WebM recording. The page has no framework and the engine loads no JavaScript dependencies. These statements describe import base `7e5984d34a139b8de4643f1ed0607897a42d88dc`, blob-equivalent to the inspected local site snapshot `afcce9941c5fa13ca5c658564e73388e603dff14`. This is newer than accessible saved site version 4 and distinct from initial main.

The rendering pipeline already contains valuable optimizations:

1. Sample procedural geometry for each animal into one reused `Float32Array` with room for 36,000 six-value samples. The buffer is reused between animals.
2. Transform/project samples, shade them, and retain the nearest sample in each screen-space character cell. Typed arrays store depth, tone, glyph, material, owner, and visibility.
3. Composite glow from small character-grid buffers, rather than blur the full DPR-scaled canvas.
4. Draw occupied cells from a cached glyph atlas. This avoids rendering body text with `fillText` each frame; each occupied cell still incurs a Canvas sprite draw.
5. Accumulate projected ink density on a second grid, then draw black glyph sprites.

Fish own independent state and stable variation. They share the camera, output canvas, lookup tables, depth buffer, and atlas within an engine instance. Rendering temporarily activates each fish's state on the engine object, then saves it back. This arrangement is workable but makes a broad renderer rewrite or speculative mixed-species plugin API risky before explicit state boundaries and equivalent visual tests exist.

## Recommended first package boundary

Keep Canvas 2D, geometry, appearance, and legacy control semantics recognizable. Extract one framework-neutral ES module and its declaration file. Put compatibility code and page code outside that module. `scripts/build-demo.mjs` now generates the browser-global compatibility artifact from the canonical modules. Its bounded transform rejects unrecognized module declarations. A source digest and generated-artifact parity tests verify the global and standalone outputs.

| Layer | Responsibility | Must not own |
| --- | --- | --- |
| Animal module | Existing cuttlefish geometry, state, bounds, reactions, drawing | Page selectors, downloads, React, global keyboard shortcuts |
| Lifecycle host inside candidate | Canvas resources, per-window shared scheduling, resize, visibility, pointer listener ownership | App-wide preferences, document-level shortcuts, telemetry UI |
| Future pure simulation core | Typed state, time/input updates, geometry writers | DOM, Canvas APIs, React, network |
| Optional React adapter | Component mount/unmount, refs, prop-to-option updates | New animation clock, per-frame React state, geometry logic |
| Microsite | Controls, labels, keyboard actions, export UI, presentation | A second independent renderer fork |
| Benchmark tools | Fixed scenarios, controlled stepping, timing, raw results | Production imports or live deployment changes |

The first animal module is framework-neutral but still browser-dependent at construction. That is a useful distinction: it can be safe to **import during SSR** without being a **headless simulation core**. A DOM-free simulation extraction is a later bounded change, justified by replay/export or a second renderer requirement. Avoid claiming that an ESM wrapper alone produces that separation.

## Public exports and isolation

Use explicit export-map entries for the root and implemented per-animal entry points, with a declaration target for each. The root can re-export the cuttlefish constructor for convenience; examples should prefer the animal subpath. The current marine entry intentionally bundles cuttlefish, manta and octopus to support a shared depth-buffer school. Its measured size tradeoff is recorded in SPECIES.md; future unrelated animals should use isolated adapters rather than expanding this bundle indefinitely. Do not export internal source folders or every file through a wildcard. Add a React subpath only when a real adapter and consumer tests exist.

An ESM-only first release avoids maintaining duplicate CommonJS code paths. This is a deliberate compatibility choice, not universal support. Document dynamic `import()` for Node CommonJS callers if that path is tested. Do not advertise synchronous `require()` as portable merely because a recent Node version can load a particular ESM graph. No runtime transpiler, bundler, UI framework, or canvas polyfill belongs in the default dependency graph.

Set `sideEffects: false` only for side-effect-free module entry points. A browser-global compatibility file does have an import side effect and must be listed as such or kept outside the package's public module graph. Any future imported CSS must be covered too. Production bundler output, not metadata alone, is the acceptance evidence for tree-shaking. Explicit subpaths keep unrelated animals out even when a consumer bundler's dead-code elimination is limited. [Platform details](SOURCE-REFERENCES.md)

## Lifecycle and motion policy

The original renderer skips simulation while hidden/paused but keeps a self-rescheduling callback chain. It has no element-intersection observation, and the app's reduced-motion policy does not reach direct engine consumers. Fix these before tuning geometry microseconds.

The desired running condition is a conjunction of explicit playback intent, visible document, drawable positive size, visible element when offscreen observation is supported, and an undisposed instance. Transition into suspension cancels the outstanding animation request and clears the prior wall-clock timestamp. Resumption starts with a zero elapsed delta; tab sleep must not produce a large catch-up burst. Keep the user pause state separate from temporary hidden/offscreen state so a returning tab cannot override Pause.

Do not subscribe every host component to every frame. The microsite's existing 200 ms telemetry cadence is sufficient for labels; stop its timer on disposal or while no refresh is useful. The engine's stats snapshots allocate by design, so a future low-allocation metrics API should be introduced only for a measured profiler need.

Disposal must cover successful mount, partial constructor failure, options changes that rebuild observers, repeated disposal, and React development setup/cleanup/setup. A constructor that throws after installing resources must release those resources. Tests must count pending callbacks, listeners, and observer instances rather than merely check a Boolean flag.

## Time and input

The original has multiple clock domains: `time` and fish scene clocks scale with `speed`, reaction ages and particle integration use elapsed seconds, and pointer agitation reads wall time directly. Preserve that distinction in the first compatibility release. Changing `speed` to scale reactions uniformly would change the recognizable react → spray → escape timing and should require explicit visual acceptance.

A manual driver is useful for numerical tests and recording. The candidate's `advance(dtSeconds)` accepts a bounded finite interval from 0 to 0.1 seconds and uses the same update function as RAF. It requires `autoStart: false`; stepping ignores pause as an explicitly documented manual action and creates no animation request. The automatic cadence is clamped to 10–120 fps so a normal cadence interval fits the 0.1-second step ceiling; unexpected stalls still discard excess time and report it. A later replay layer can supply input events in simulation time, validate sequence/version/limits, run fixed substeps, and compare checkpoints. A monotonic clock and deterministic inputs are necessary but insufficient for cross-platform pixel determinism.

The present pointer code reads the element's bounding box for every event and mutates nearest-fish state. First normalize coordinates against a positive CSS box; reject invalid/zero-sized events. Preserve passive listeners and do not capture a pointer or block scrolling unless an actual gesture requires it. A later coalescing change must preserve travel, turn count, and duration evidence across the whole event batch. Keeping only the final pointer position could erase the repeated-sweep behavior that triggers agitation.

## Resize, DPR, and resource limits

The source caps DPR at 2 but does not cap CSS size, bitmap area, or cell count. For `W × H` CSS pixels and effective DPR `d`, a single RGBA canvas surface has a calculated pixel-storage floor of `4 × round(Wd) × round(Hd)` bytes. At 1920×1080 and DPR 2 that is 33,177,600 bytes (31.64 MiB) for the main surface alone. Browser implementation, copies, GPU allocation, atlases, and auxiliary canvases add to this. This is a calculation, not measured process memory.

An effective DPR policy should be bounded by both a DPR ceiling and a backing-pixel budget: `min(deviceDPR, maxDPR, sqrt(maxPixels / (cssWidth × cssHeight)))`, then account for rounding and hard dimension limits. Do not force a minimum DPR of 1 if doing so defeats the pixel budget for a huge canvas. Cell count needs its own cap because cells follow CSS dimensions, not DPR. A bounded candidate may reject or scale oversized layout dimensions with a documented coordinate transform; simply shrinking the bitmap does not reduce geometry/grid loops.

The source's main per-cell typed arrays total 13 bytes per cell (4 depth + 1 tone + 1 glyph + 1 kind + 2 owner + 4 visibility). Glow image data adds 4 bytes per cell; the canvas grid surfaces and ink grid are additional. The six-value 36,000-sample float buffer is 864,000 bytes. These are exact typed-array capacity calculations for this source, not peak-memory measurements.

The candidate adds a separate atlas limit because coarsening a cell grid can otherwise enlarge each glyph sprite enough to allocate a huge atlas. Its 64-pixel body-sprite ceiling bounds the 25-glyph by 72-tone/material atlas to 1,600×4,608 pixels. Logical destination size is retained separately. That atlas has a calculated RGBA storage floor of 28.125 MiB at its extreme ceiling, in addition to the main canvas and grids. The default body/ink cell limit applies to each grid separately. Do not describe `maxPixels` as a bound on all graphics memory.

Resize should skip work when effective dimensions/density/DPR are unchanged. Rebuilding atlas and buffers on every observer callback causes avoidable work. Zero-size elements should remain suspended until they become drawable. Density changes need one coherent resize, not a redundant full atlas build followed by another resize.

## Performance strategy

Prioritize verified work in this order:

1. Eliminate unnecessary paused/hidden scheduling and repeated no-op resize work.
2. Bound bitmap and cell allocations; expose diagnostics for the effective quality actually used.
3. Profile representative scenes with real Canvas 2D and browser tracing. Separate geometry, rasterization, glyph commands, glow, ink, and host UI.
4. Reduce a demonstrated hot allocation or loop with a before/after benchmark and semantic/visual regression checks.
5. Introduce optional quality tiers based on measured density/population cost and explicit user settings. Avoid nondeterministic automatic adaptation in reproducible recordings.

Candidate examples of later work include in-place ink compaction instead of `filter`, scalar flow arithmetic, caching stable plankton colors, and avoiding transient route vectors. A particle pool or typed-array structure can follow if allocation traces justify it. The existing 1,150-ink-particle cap is valuable; preserve its behavior or document the new fairness policy when many animals react.

A glyph atlas is already present. Calling this a proposed optimization would duplicate existing work. It does not batch the whole frame into one draw call. A WebGL/WebGPU rewrite, worker transfer, atlas packing system, generalized multi-backend scheduler, or scene graph should wait for a demonstrated bottleneck and compatibility tests. Each adds an execution path and visual risk.

## Candidate budgets versus measurements

60 Hz allows about 16.67 ms per display interval; 30 Hz allows about 33.33 ms. Those totals include browser work and other application work. A provisional desktop acceptance target could reserve ≤6 ms p95 for this effect at four animals, 960×640 CSS, DPR 1, density 1.1, with a documented device/browser; a lower-power profile could target ≤12 ms p95 at two animals and 30 fps. These are proposed budgets, not measured guarantees or automatic release gates across all hardware. Adopt actual thresholds only after baseline data is collected on representative devices.

The Node harness exercises CPU computation with stubbed drawing. It can compare algorithmic regressions under controlled inputs but cannot measure font rasterization, Canvas compositing, GPU upload, presentation, thermal throttling, browser GC behavior, accessibility, or visual quality. Publish its raw samples and label its scope. A lower Node duration is not evidence of a higher browser frame rate.

## Source references

All implementation observations come from `dist/artwork.js`, `dist/app.js`, `dist/index.html`, `dist/record.html`, and `scripts/check-engine.cjs` at import commit `7e5984d34a139b8de4643f1ed0607897a42d88dc`, matching inspected local snapshot `afcce9941c5fa13ca5c658564e73388e603dff14`. Official package, timing, and framework references: [SOURCE-REFERENCES.md](SOURCE-REFERENCES.md).
