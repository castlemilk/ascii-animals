# Prioritized backlog drafts

These are local drafts, not published issues. Deduplication is thematic within this review and against the accessible import context. Initial repository issue search returned no issues; draft PR #1 owns the microsite import at `7e5984d34a139b8de4643f1ed0607897a42d88dc`. A later coordinator should re-query before filing, because another workstream is active. Use the titles and acceptance criteria below to update an existing matching item instead of creating parallel ones.

## P0 — Required before an npm prerelease can be evaluated

### T2-01 — Reconcile import source, license, and candidate baseline

**Problem:** Main initially held only `.gitignore`; the import branch, saved site version 4, and local newer source are different provenance layers. The import has no LICENSE.

**Scope:** Attach exact source and target hashes, verify import equivalence, retain origin notices, select the package identity/license through the owner, and reconcile overlapping track work. Do not recreate PR #1's import.

**Acceptance:** The reviewer can reproduce the diff from import commit `7e5984d34a139b8de4643f1ed0607897a42d88dc`; no confidential hosting metadata is packed; license grants are explicit; package remains private until the release owner authorizes a later publication. Full conversation access is recorded as a gap, not invented evidence.

**Dependencies / owner:** Repository coordinator. Blocks release, not local testing.

### T2-02 — Make imports and lifecycle safe for reusable consumers

**Problem:** The imported IIFE writes `window`, schedules callbacks while paused, and leaves reduced-motion policy in the page. Direct consumers inherit inconsistent behavior.

**Scope:** Adopt or revise the local ESM/lifecycle candidate. Review per-window scheduling, paused/hidden/offscreen/zero-size suspension, idempotent disposal, explicit Play semantics, and failure cleanup. Keep geometry recognizable.

**Acceptance:** Every public import works without DOM globals; construction remains browser-only; two instances do not share mutable state; destroying one leaves the other running; repeated disposal and constructor failure leave no owned callbacks/listeners/observers; paused or suspended instances do not accumulate elapsed catch-up; pointer/action cannot silently override reduced motion.

**Candidate status:** Bounded implementation provided; exact tests in review verification log. Browser lifecycle acceptance still required where not run.

### T2-03 — Validate the packed package and public declarations

**Problem:** An extracted module is not a reusable npm library until package resolution, types, and actual tarball contents work.

**Scope:** Explicit root, cuttlefish, and core exports; `types` conditions; restrictive files; zero runtime dependencies; clean reproducible build; local package consumer fixtures. No React or CJS export until implemented and tested.

**Acceptance:** Dry-run and actual pack manifests agree with allowlist; local offline consumer imports all public entries and rejects private paths; NodeNext and Bundler type checks pass with meaningful negative cases; SSR import passes; production tree-shaking fixture excludes unused animal code and page globals; output and dependency versions are recorded. No registry availability or publication claim.

**Candidate status:** Package and fixtures provided for review. Expand compatibility matrix only for concrete supported targets.

### T2-04 — Migrate the demo through a single canonical engine

**Problem:** The microsite, recorder, source viewer, and standalone builder consume the old browser-global script. A new `src/` package can otherwise become a second renderer fork.

**Scope:** Choose a generated global compatibility artifact or a module-based app plus standalone bundling. Preserve controls, per-fish roles, pointer targeting, scene behavior, keyboard actions, PNG/source/HTML export, and recording. Dispose telemetry/DOM listeners on teardown. Keep generated output clearly marked.

**Acceptance:** The demo and package derive from the same canonical engine hash; offline standalone works; recorder starts/stops and releases media tracks; dynamic source viewer shows the actual executing engine; visual comparison covers the imported school behavior and solo sequences; no old/new duplicate RAF loop. Existing GIFs are labeled historical until recaptured from the accepted build.

**Implementation update:** Canonical browser-global and standalone generation now shares `src/` with the ESM package, with source-hash and module/global tests. Browser visual/export/recorder acceptance still requires independent review.

**Dependencies:** T2-02 and T2-03.

## P1 — Performance, input, and compatibility acceptance

### T2-05 — Bound resize and drawing resources with observable quality

**Problem:** The old DPR cap does not bound CSS-size cell arrays or total backing pixels; hidden zero-size canvases allocate a fallback size and repeated resize callbacks rebuild resources.

**Scope:** Review candidate DPR/pixel/cell ceilings, positive-size suspension, duplicate-size bailout, DPR change handling, and diagnostics. Define low/default/high quality profiles using actual representative devices.

**Acceptance:** Extremely wide/tall/large layouts cannot exceed documented dimension/area/cell limits after rounding; requested and effective quality are distinguishable; pointer coordinates remain correct under downscaling; size/density/palette changes rebuild only necessary resources; 50 resize/dispose cycles show no retained growth in the selected measurement method.

**Candidate status:** Initial limits provided. Measured memory and browser behavior remain separate acceptance.

### T2-06 — Establish reproducible CPU and browser performance baselines

**Problem:** A GIF and displayed FPS do not establish portable performance, and the numerical harness stubs Canvas drawing.

**Scope:** Retain the supplied bounded CPU harness; add visible-browser measurements for 1/4/12 animals, default/large viewport, density variants, glow, encounter, and ink. Capture source/hash/tool/device/scenario metadata and raw distributions.

**Acceptance:** Warmup/repetition policy is recorded; p50/p95/p99 and stage costs are available; browser draw/composite costs are measured separately from Node computation; before/after comparisons use identical settings and controlled run order. Proposed 60/30 Hz budgets are identified as targets, not reported improvements. No quantified battery claim without device measurements.

**Dependencies:** T2-02 through T2-05. The baseline is one shared artifact, not separate benchmarks per track.

### T2-07 — Normalize input without losing reactive behavior

**Problem:** Pointer handling reads layout per event and mixes wall time with simulation state; an overeager coalescing optimization could erase travel/reversal evidence.

**Scope:** Positive-box validation, normalized coordinates, consistent input time, pointer-type handling, passive interactions, and bounded event processing. Add coalescing only if a profile shows a material cost; retain intermediate travel and direction changes.

**Acceptance:** Zero-size/non-finite events are safe; empty-water clicks remain quiet; overlap targets the visible owner; repeated sweeps still trigger after similar effort; touch scrolling is not blocked; event replay can be compared under an explicitly defined input-time contract.

### T2-08 — Complete accessibility and motion-policy integration

**Problem:** The page has useful accessible controls, but core extraction can separate motion state from those controls. Canvas glyphs provide no accessible text by themselves.

**Scope:** Verify keyboard actions, concise descriptions, static fallback, system preference changes, host control synchronization, contrast/focus of controls, and no live per-frame announcements.

**Acceptance:** Keyboard users can Play/Pause/restart/startle; pointer interaction has an equivalent control; startle does not silently resume; system changes update host UI accurately; decorative usage is documented; screen-reader review is recorded with named platform/version. No blanket accessibility certification from code inspection.

### T2-09 — Optimize only measured CPU/allocation hotspots

**Problem:** There are plausible transient allocations in routes, arms, particle flow, ink `filter`, and telemetry, but their real contribution is not established by source inspection alone.

**Scope:** Select the highest measured hotspot. Candidate options include in-place ink compaction, reusable scalar/vector scratch, stable color caching, and adaptive geometry only after visual review. Preserve existing atlas/grid glow optimizations.

**Acceptance:** A before/after profile identifies the affected stage; all behavior tests pass; visual quality is reviewed on matching settings; tail time and allocation trend improve or the change is rejected. Do not bundle a renderer rewrite with these changes.

**Dependencies:** T2-06. This replaces a generic “optimize everything” ticket.

## P2 — Extensions once the first contract is stable

### T2-10 — Offer a small optional React adapter

**Scope:** Separate React subpath/peer dependency, client effect lifecycle, controlled/uncontrolled option policy, error fallback, stable refs, explicit playback synchronization. No per-frame React state.

**Acceptance:** Core/animal imports do not load React; typed packed consumer works; SSR import and React development setup/cleanup/remount pass; option updates do not reconstruct unnecessarily; preference-driven pauses are reflected in controls. The guide's draft example is not an implementation claim.

### T2-11 — Extract the shared animal contract while adding the next species

**Scope:** Coordinate with Tracks 1 and 3. Let real anatomy/motion needs define the minimal shared state/geometry/input contract, then add explicit per-animal exports and type tests. Preserve independent imports.

**Acceptance:** New species meet creative authoring criteria and runtime bounds; cuttlefish visual regressions pass; importing one animal excludes another; generic core has no cuttlefish-only fields; licensing/provenance is recorded per species. Do not create duplicate “add two animals” tickets from this Track 2 review.

### T2-12 — Define a versioned replay/export contract

**Problem:** Controlled stepping is repeatable only for the same step sequence; pointer timing and ink integration do not yet promise frame-partition independence or portable pixels.

**Scope:** Simulation-time inputs, fixed-step policy, seed semantics, schema version, resource limits, checkpoints, and bounded offline export. Reuse existing recording where adequate.

**Acceptance:** Same version/options/viewport/input log reproduces numerical checkpoints; invalid logs fail safely; replay is bounded; browser/font/pixel limits are explicit; exports do not depend on wall-clock input. Do not advertise arbitrary seek or cross-browser pixel determinism prematurely.

## Explicitly deferred

WebGL/WebGPU renderer rewrite, worker/offscreen transfer, generalized scene graph, universal plugin ABI, particle-pool framework, automatic adaptive quality, and multiple package formats without consumer demand. Reconsider each only after T2-06 identifies a bottleneck or a concrete supported user journey requires it.
