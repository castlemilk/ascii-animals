# Spring Pea R2 — private comparison review

This directory contains a new, additive R2 review interface and evidence. It does not recover the missing original patch or editable sources. Original is unchanged. The R2 factory opts into a private renderer through the existing controller's `previewFactory` seam.

## Open the comparison

From the repository root, run the existing build if `lib/` has not yet been generated, then serve the checkout:

```sh
npm run build
python -m http.server 8771 --bind 127.0.0.1
```

Open `/species/frog/variants/spring-pea-r2/review/` on that local server. Append `?paused=1` for an initially paused scene or `?renderer=original&paused=1` for the Original baseline. The page uses only local module/CSS imports and system fonts.

The Original/R2 control disposes the active controller before constructing its replacement on the same canvas. Both use seed 23, one frog, Stillwater, Shelter and no autonomous actions. Switching resets to that same initial scene and preserves explicit pause. It does not run two controllers or a second animation loop.

**Startled leap:** choose a free reachable pad, then activate Startle & leap. The exact pad point goes to the canonical `target()`/`leap()` methods; the input changes the actual destination.

**Firefly snap:** choose an aim, then activate Lure a firefly. The canonical `hunt(point)` treats the point as an aim preference and chooses a reachable perch. The three review choices are `(.36,-.4)`, `(-.76,-.7)` and `(.36,.7)`. This is not arbitrary free-space insect placement.

Native controls support keyboard activation, and the existing canvas keyboard/touch behavior stays with the canonical controller. Pause, system reduced motion, hidden/offscreen/zero-size suspension and disposal remain authoritative. A review-only bounded visibility helper scrolls an offscreen scene into view and waits for the controller's own visibility gate before dispatching a deliberate action. It never changes pause/reduced-motion flags or bypasses suspension. A replacement action, selection change, pause, reset, still-pose selection or disposal cancels a pending request. It owns at most one temporary observer, one frame retry and a 1.2-second expiry; no repeating timer.

The review details include still poses, diagnostic views, silhouette, exported ASCII cells and a state snapshot. The downloadable action log records review-control requests and observed phase/notice changes. It is an observational log, **not a complete canonical replay event log for every canvas pointer/keyboard input**. The native capture timelines contain exact replay inputs and ticks.

## Evidence boundaries

- `evidence/browser/` contains **actual public-site browser screenshots**, observed 21 November 2026: filtered gallery, paused/restarted Frog study, and paused/reset classic Stillwater with autonomy disabled. The deployed commit is not exposed by those pages; do not equate those screenshots with a verified exact Git commit. The classic screenshot is the returned 643×936 viewport, not a qualified 390px phone test.
- `evidence/native/` contains **actual native Canvas renderer output** from exact local base `3b5ffcce7bea56e1402fc16d0edc2c14c3cd5779` and the frozen R2 renderer. Desktop-sized canvas is 900×520; phone-sized canvas is 356×300; both use DPR1. These are matched renderer compositions, not screenshots of the private HTML page or proof of responsive CSS.
- `concepts/` contains newly authored editable SVG reconstruction references and vector-render proofs. They are neither browser evidence nor old recovered source. The original generation prompts were not recovered; the included briefs are newly reconstructed.
- `BROWSER-STATUS.md` records the exact local-preview connection error and subsequent policy rejection. **The private R2 page has not been executed in a permitted browser in this session.** Real keyboard/touch/focus/scroll behavior, responsive layout, live browser reduced-motion/offscreen transitions, browser cleanup and device performance remain open acceptance gates.

No faux browser frame is placed around native captures. The comparison plates explicitly identify native evidence. Character crops preserve source pixel scale; full uncropped captures are retained. Contact sheets show sampled poses and do not prove motion timing.

## Normal-speed recordings

Four matched clips compare Original/R2 at the same explicit canonical event ticks:

| Moment | Input | Model / encoding | Frames / clip length | Observed model outcome |
| --- | --- | --- | --- | --- |
| Leap | At tick 24, hop frog 0 to pad ID 4 | 60 Hz model, every second tick at 30 fps | 106 frames / 3.533 seconds | Crouch → flight → landing → recovery → cooldown; settled on pad 4 |
| Hunt | At tick 24, hunt frog 0 toward `(.36,-.4)` | 60 Hz model, every second tick at 30 fps | 151 frames / 5.033 seconds | Track → approach hop → strike → settle → rest; caught state, settled on pad 1 |

The last sampled model frame is held for one encoded frame interval. There is no time acceleration. The FPS is an encoding rate, not a browser/device performance measurement. Each renderer/viewport has a timeline with the exact event log, every sampled tick/phase, source hashes, font identity and frame count. `composed-manifest.json` records hashes and FFprobe frame-rate/count checks for the final clips.

The clips were encoded and probed, and their sampled contact sheets were visually inspected. They were **not reviewed through normal-speed playback in a video player or browser** in this session. Do not turn encoding/provenance checks into a claim of observed live playback quality.

## Verification and reproduction

```sh
node --experimental-vm-modules --test species/frog/variants/spring-pea-r2/review/scripts/visible-action.test.mjs species/frog/variants/spring-pea-r2/review/scripts/review-lifecycle.test.mjs
node species/frog/variants/spring-pea-r2/review/scripts/capture-native.mjs
node species/frog/variants/spring-pea-r2/review/scripts/compose-native.mjs
```

The eight page/helper tests verify immediate visible dispatch; waiting for the canonical visibility gate; cancellation/replacement; hidden/timeout/disposal behavior; retaining pause/reduced motion; bounded retry; one controller during Original/R2 switches with pause preserved; and cleanup on real page exit while retaining a BFcache entry. They use event/DOM/controller doubles and do not establish browser layout or interaction acceptance. Canonical runtime and variant numerical/lifecycle tests are recorded separately by the source audit.

Native reproduction uses Node, an available `@napi-rs/canvas` installation and FFmpeg/FFprobe for encoding. The host resolves `FROG_CANVAS_MODULE` first (an optional absolute module path), then the provided primary-runtime dependency directory, then normal Node resolution. No dependency or package configuration is changed by this directory. The capture font is Liberation Mono when installed at the recorded path; its hash appears in each manifest. Concept proofs were rendered with the available Sharp installation; the SVG authoring script requires only Python's standard library.

Original uses an atlas; R2 draws text directly. The native capture host awaits a lossless PNG/Image snapshot of Original's atlas to avoid native Skia retaining a mutable Canvas display list. This affects only the capture host, not Original code. An initial provisional capture failed to await image decode and was blank. It was discarded and regenerated after correction. Every final saved frame is checked for actual non-background and bright pixels; logical glyph counts alone are not accepted as proof of a visible render. This native path does not promise browser font/raster parity.

The review source is separate from evidence, logs and generated media. Raw frame directories can be regenerated and omitted from a review ZIP; named stills, clips, contact sheets, source hashes and timelines retain the reviewable evidence.

## Final base verification

The final patch is based on `26ee6ffc623e0adb2256e66d5b7cefc9ff36c7dd`, fetched while completing this work. The original brief and native captures were made on `3b5ffcce7bea56e1402fc16d0edc2c14c3cd5779`. Every Frog path, public Frog facade, scheduler, root package file and build script is byte-identical between them; `BASE-COMPATIBILITY.json` records the check. Captured labels and fingerprints remain historical; final test receipts identify the final base.
