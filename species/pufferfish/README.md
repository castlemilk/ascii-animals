# Pufferfish · A little reef, full of intentions

## Current uplift — fine skin and controlled recovery

This source-only revision starts from main `b8f222dab868821f27bf2a64a98434f3483fc8e6`, verified on **2026-11-19 UTC**. It preserves the public typed API, option defaults, seeded event protocol and lifecycle contract. The authoritative API is [docs/PUFFERFISH-API.md](../../docs/PUFFERFISH-API.md); the anatomy, choreography and scope are recorded in [UPLIFT-BRIEF.md](UPLIFT-BRIEF.md).

The animal now has an oblong, Arothron-inspired resting body, a pale belly, stable dark spots, fine skin spinules, lateral irises and a small muzzle. Inflation expands the belly and flanks disproportionately, stretching the surface pattern and raising the short spines while the face and small fins remain comparatively stable. A short, clear fan tail keeps the resting silhouette legible. Sparse reef relief, sponges and suspended grains provide depth around the animal.

Two directed encounters use the existing controls:

- **Reef inspection:** Invite starts with a 30-tick brake, then a cautious approach, inspection and backing away into drift. Distant pointer attention remains distinct from a close defensive approach.
- **Startle and recovery:** Approach produces a short recoil, belly expansion, spine erection, guarded hold and hesitant deflation. The established default timings remain 30 / 42 / 36 / 180 / 150 / 180 ticks for notice, belly, spines, hold, recovery and cooldown. The two recovery shelves are authored animation pauses, not a physiological timing claim.

Tap a fish to select it; tap empty water to invite the selected fish. With the canvas focused, `I` invites, `A` approaches, `Escape` gives space, `1`–`3` select, `Space` pauses/resumes and `R` resets. Native buttons expose the same actions to touch and keyboard. Pause, reduced motion and compact sizes retain deliberate still alternatives.

For readability, `small` retains a 72-column ceiling. `standard` and `fine` use a 96-column ceiling through 520 logical pixels wide, interpolating to their 120- and 160-column ceilings at 700 pixels. The 90-row ceiling can reduce the effective column count further. The existing three-visitor size multiplier is unchanged. The scene budget remains 16,000 samples; the latest reviewed trio used 15,622. These are allocation/work bounds, not an FPS result.

### Build and review this revision

Central integration must regenerate outputs from the applied source:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
node --test test/pufferfish-integration.test.mjs species/pufferfish/tests/*.test.mjs
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:4173/pufferfish/`. `npm run build` regenerates package modules, species builds and demo outputs; generated files are intentionally excluded from this patch.

[UPLIFT-REVIEW.md](UPLIFT-REVIEW.md) records the exact commands, source hashes, matched desktop/phone captures, motion excerpts and remaining acceptance. [capture-uplift-native.mjs](scripts/capture-uplift-native.mjs) renders freshly built source through the canonical painter in native Skia Canvas. [review-uplift.mjs](scripts/review-uplift.mjs) supplies a separate real-Chromium review harness.

**Evidence boundary:** the new captures are native Canvas output, not browser screenshots. Local Chromium was blocked before a page loaded; the cloud-browser route could not reach the local service and encountered a policy block. There is no new real-browser acceptance. A successful script syntax check does not establish that the browser harness or its interaction assertions passed. Historical browser and native captures below are provenance for earlier revisions only.

## Historical director follow-up

The earlier integrated factory was `createPufferfishArtwork` from `ascii-animals-review/pufferfish`, still the public factory today. That director revision added **Reef ramble**, **Returning tide** and **Passing shadow**, with one to three visitors, individual explorer/sentinel/drifter roles, exploratory routes, gaze and fin attention, localized staged inflation and coordinated recovery. Omitting `director` retained the solo encounter.

The [pre-code director brief](DIRECTOR-BRIEF.md) records that revision's scene matrix and constraints. [Director evidence](evidence/director/README.md) contains its canonical native-Canvas frames, a 20-second GIF, mobile before/after correction, exact source/runtime hashes and browser/performance limits. [Director verification](DIRECTOR-VERIFICATION.md) records that historical handoff; it does not certify the current uplift.

To review the generated integrated demo from the repository root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:4173/pufferfish/`. Choose a scene, select an individual, then invite or approach it. Give space releases the whole group. Tap an actual fish to select it or empty water to invite the current selection. With the canvas focused, use `1`–`3`, `I`, `A`, `Escape`, `Space` and `R`. The native controls expose those actions without hover. Pause and system reduced motion retain deliberate still alternatives.

That director revision was based on main `c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02`. Its scope included Pufferfish paths and its specific facade/integration test. Those scope and base statements are historical; the current source-only uplift uses the later base and narrower scope stated above.

---

## Historical original handoff notes

The remaining notes describe the **pre-integration original handoff**, including its original base, captures and then-pending public API. They are retained for provenance. Use the integrated API and uplift review linked at the top for this revision; the historical integration-status statements below are superseded.

An original reactive pufferfish with a small round body, raised eyes, paddle fins and a short tail. A deliberate nearby approach leads through **notice → belly inflation → spine extension → buoyant hold → deflation → cooldown**. Retreat begins recovery, and staying nearby cannot accumulate repeated reactions.

**Draft integration:** all work is local to `species/pufferfish/`. The TypeScript species and browser controller run with a pinned adapter to the existing renderer. This is not yet an accepted public npm species API or a deployed feature.

**Tested base:** `0e446c47b491b751d484e40db753ec725652b515`. During delivery, main advanced to `074b90a94bd3a747a68feed554e33a3ab0720f41`, merging PR2 and the catalogue. The new main has a different generated renderer; these captures and tests remain evidence for the recorded base. Apply the supplied source/bundle to that base for reproduction. Migration and fresh renderer parity against the new main remain pending; see [provenance](PROVENANCE.md).

![Native Canvas capture of the deterministic pufferfish encounter](evidence/pufferfish-native.gif)

The GIF is an **actual native Skia Canvas capture of the existing glyph renderer** with the new geometry. It is assembled at the simulation's intended 15-frame capture cadence; it is not a browser recording, real-time throughput benchmark, or seamless looping video. Full PNGs and exact state/cell/pixel hashes are included.

## Original source demo

From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [http://127.0.0.1:8000/species/pufferfish/](http://127.0.0.1:8000/species/pufferfish/). The checked-in JavaScript build needs no package installation. Serve the repository root so the page can load the unchanged `dist/artwork.js` dependency. A `file:` URL is not an accepted module-loading route.

Move near the fish and linger, or use **Approach gently**. **Give some space** releases it into smooth recovery. Native buttons support touch, Tab, Enter and Space; no page-wide keyboard shortcuts are installed. Pause and Reset preserve the user's playback choice. A system reduced-motion preference shows static poses, including deliberate inflated/calm alternatives. Small viewports also retain static alternatives.

## What is here

| Path | Responsibility |
| --- | --- |
| `src/types.ts`, `src/model.ts` | Explicit options, normalized event types, discriminated states, validation and integer-tick behavior |
| `src/geometry.ts` | Original ellipsoid, eyes, mouth, attached fin/tail fans and fixed radial spines |
| `src/index.ts` | DOM-free, species-local definition and typed exports |
| `src/legacy-painter.ts` | Small private bridge to the real projection, cell/depth buffer, glyph atlas and Canvas methods |
| `src/controller.ts` | Browser input, fixed stepping, composed suspension, static alternatives and disposal |
| `src/demo.ts`, `index.html`, `style.css` | Accessible demo controls and text frame capture |
| `build/` | TypeScript-emitted ESM JavaScript and declarations; source remains authoritative |
| `tests/` | Model, geometry, real legacy-cell and mocked lifecycle tests; positive/negative type consumers |
| `evidence/` | Native frames/GIF, before/after critique, minimum-grid views, replay and exact hashes |

## TypeScript-first API

The complete [API reference](API.md) documents defaults, ranges, events, results, reset/update/disposal rules, examples and the exact compatibility boundary with PR2. All shown imports are **relative species-local imports**, not published package names.

```ts
import { pufferfish } from './species/pufferfish/build/index.js';

const initial = pufferfish.create({ seed: 23, cooldownTicks: 180 });
const result = pufferfish.step(initial, {
  tick: 1,
  events: [{ type: 'approach', tick: 1, seq: 0 }],
});

if (result.state.phase.kind === 'inflating') {
  console.log(result.state.phase.stage); // 'belly' | 'spines'
}

// Geometry emits typed samples; it owns no browser/renderer/clock.
pufferfish.sample(result.state, sample => {
  // Connect sample to an accepted host writer when the coordinator settles it.
  console.log(sample.x, sample.y, sample.z, sample.material);
}, { quality: 'small' });
```

The demo's local painter uses `dist/artwork.js` directly; it does not copy the educational ray core or introduce another rasterizer. The newly merged TypeScript facade still accepts only `species: 'cuttlefish'` and supplies no public pufferfish geometry contract. Canonical integration and package exports remain with the central library owner.

## Reproduce checks

Core/runtime tests run with Node, with no third-party runtime dependency:

```sh
node --test species/pufferfish/tests/*.test.mjs
node scripts/check-engine.cjs
node --check dist/artwork.js
```

With an existing TypeScript 5.9.3 compiler:

```sh
tsc -p species/pufferfish/tsconfig.json
tsc -p species/pufferfish/tests/tsconfig.types.json
tsc -p species/pufferfish/tests/tsconfig.server.json
tsc -p species/pufferfish/tests/tsconfig.nodenext.json
```

Alternatively set `PUFFERFISH_TSC` to the absolute path of an existing `typescript/lib/tsc.js` and run `node species/pufferfish/scripts/build.mjs`. The helper installs nothing and changes only the species build. Strict declaration fixtures include intentional errors with `@ts-expect-error`; unused directives fail compilation.

To regenerate native evidence with existing `@napi-rs/canvas` and Python/Pillow:

```sh
node species/pufferfish/scripts/capture.mjs
```

This makes temporary rendered frames, assembles them into a bounded GIF/contact sheet, then removes the temporary frames. It records the exact unmodified legacy renderer hash, species source hashes, seed, events, ticks, runtime, native timings and output hashes. It does not launch or certify a browser.

`scripts/browser-smoke.mjs` provides a **locally unrun** real-browser keyboard/reduced-motion scenario. With the demo server and an existing Playwright browser, set `PUFFERFISH_DEMO_URL` and, if necessary, `PUFFERFISH_CHROMIUM`, then run it. Physical touch, screen readers, zoom/reflow, browser heap and target-device performance still require separate acceptance.

## Evidence and status

![Six phases rendered through the original glyph pipeline](evidence/native-contact-sheet.png)

- [Completed pre-code authoring record](AUTHORING.md)
- [Verification, critique and remaining acceptance](VERIFICATION.md)
- [Source provenance and compatibility map](PROVENANCE.md)
- [Exact deterministic event log](evidence/replay-seed23.json)
- [Native capture manifest](evidence/native-capture.json)
- [Minimum-grid views](evidence/minimum-grid-contact-sheet.png)
- [Neutral-tone view review](evidence/monochrome-contact-sheet.png)

No shared engine/package/registry/README files are changed. No browser pixel, physical mobile, screen-reader, memory-leak, deployed or performance acceptance is inferred from numerical tests or native Canvas captures. License choice remains with the repository owner; no third-party art, font binary or geometry is bundled.
