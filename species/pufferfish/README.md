# Pufferfish · A little reef, full of intentions

## Current director follow-up

The current integrated factory is `createPufferfishArtwork` from `ascii-animals-review/pufferfish`. The new opt-in director adds **Reef ramble**, **Returning tide** and **Passing shadow**, with one to three visitors, individual explorer/sentinel/drifter roles, exploratory routes, gaze and fin attention, localized staged inflation and coordinated recovery. Omitting `director` preserves the original solo encounter.

The authoritative current reference is [docs/PUFFERFISH-API.md](../../docs/PUFFERFISH-API.md). The [pre-code director brief](DIRECTOR-BRIEF.md) records the scene matrix and constraints. [Director evidence](evidence/director/README.md) contains actual canonical native-Canvas frames, a 20-second GIF, mobile before/after correction, exact source/runtime hashes and honest browser/performance limits. [Director verification](DIRECTOR-VERIFICATION.md) records the final gates and coordinator handoff.

To review the generated integrated demo from the repository root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:4173/pufferfish/`. Choose a scene, select an individual, then invite or approach it. Give space releases the whole group. Tap an actual fish to select it or empty water to invite the current selection. With the canvas focused, use `1`–`3`, `I`, `A`, `Escape`, `Space` and `R`. The native controls expose those actions without hover. Pause and system reduced motion retain deliberate still alternatives.

Current source is based on main `c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02`. The private canonical marine renderer, shared scheduler and package contract remain in place. Only Pufferfish paths and its specific facade/integration test change.

---

## Historical original handoff notes

The remaining notes describe the **pre-integration original handoff**, including its original base, captures and then-pending public API. They are retained for provenance. Use the current integrated reference and director verification above for this branch; the historical integration-status statements below are superseded.

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
