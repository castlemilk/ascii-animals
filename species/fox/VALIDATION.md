# Fox validation and evidence ledger

## Exact scope

Branch `feat/animal-fox`, target `main`, base **`0e446c47b491b751d484e40db753ec725652b515`**. The completed authoring template was committed before implementation as **`b270379`**. Both supplied ancestors `60235c9f127c394b163fd8c02de408c8ac2e7aa5` and `7e5984d34a139b8de4643f1ed0607897a42d88dc` were verified in this base's history.

All new source, generated modules, demo, tests, docs and evidence are under `species/fox/`. Existing engine/page/package/registry/workflow/README files are unchanged. There was no existing species extension contract on main. No educational ray runtime was copied.

Pre-publication incoming-work inspection found PR #2 advanced from `e7c16104a1e90c8650f7d3e09cdb1124d0321308` to **`8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1`**. Its new TypeScript facade still supports only `species: 'cuttlefish'`. The exact compatibility recheck is in [COMPATIBILITY.md](COMPATIBILITY.md). Draft PR #4 at `5015dbcffb75b1036b21b4b8e3e65bf0697a46f1` changes the catalogue/shared demo and lists Fox as in development; it has no overlapping `species/fox/` paths. Neither branch was modified.

## Runtime used

- Node **v24.22.1**, TypeScript **5.9.3**.
- Linux **6.18.57**, x64, reported CPU **Intel Xeon Platinum 8573C**. This identifies the execution host; it is not a target-device performance result.
- Native renderer: **@napi-rs/canvas 0.1.100** (Skia), FFmpeg **7.1.5**.
- Installed Liberation Mono registered for the native `ui-monospace` alias. SHA-256 **`5883330d94debd992952cd8f0571b225f478c2d797d3f36c7521b0a5c9bde0f2`**. Font file not bundled.
- The first offline package metadata lookup failed with `ENOTCACHED`; the already cached exact TypeScript tarball was then used, and an integrity-pinned lockfile was generated. No browser runtime dependency was added.

## Passed gates

| Gate | Actual result | Evidence class |
| --- | --- | --- |
| Strict TypeScript compilation | Passed with strict, exact optional properties, unchecked index checks and no emit on error | Compiler |
| Positive/negative consumer fixtures | Passed, including **16** `@ts-expect-error` assertions that would fail if accepted | Compiler, actual relative modules; scheduler compatibility is structural |
| Model/API suite | **22/22** | Executed original simulation and geometry |
| Browser lifecycle/input suite | **12/12** | Explicit DOM/Canvas/RAF/observer mocks |
| Preview/landmark/aspect suite | **3/3** | Actual cell rasterizer; draw coordinate inspection |
| All implementation tests | **37/37**, zero failures/skips | Combined above; not 37 browser tests |
| Rebuild parity | Committed generated JS/declarations match a fresh TypeScript build | Byte hashes |
| Existing Cuttlefish regression | Passed | Existing numerical/stub harness, unchanged |
| Existing artwork/page syntax | Passed | Node parser |
| Existing standalone rebuild | Passed; `git diff --exit-code -- dist/` clean | Build parity |
| Authoring schema checker | Fox record valid | Pinned skill JSON-only validator |
| Skill validator regressions | **8/8** | Pinned checker tests; not animal/rights certification |
| Native capture | PNGs, text frames, 8-state contact sheet, 181-frame GIF | Real native Canvas output from current model |
| Independent visual correction | Largest facial issue resolved in inspected before/after stills | Independent artifact inspection |

Run the consolidated implementation/regression gate from `species/fox`:

```sh
node scripts/verify.mjs
```

[verification.log](evidence/verification.log) retains exact commands, outputs and exit statuses. The ordinary developer entry is `npm ci --ignore-scripts && npm test`. The copied skill validator is not redistributed into the runtime; use its pinned source at `skunkworq/skunkworq-skills` commit `e721252075a30888198aafba0953a23fd07bd3c6`:

```sh
node generate-reactive-ascii-animals/scripts/validate-spec.mjs /path/to/species/fox/fox.authoring.json
node --test generate-reactive-ascii-animals/scripts/validate-spec.test.mjs
```

## What the tests establish

The model tests check all options at valid/invalid boundaries, atomic configuration and batch rejection, correct next ticks and sequence order, paused semantics, seed independence, reproducible reset, frozen snapshots and disposal. Replay with identical events gives identical state/cells when rendered after 1/2/5 ticks. Pounces traverse the declared durations and ignore repeat requests while busy. Active plans cannot be retimed or redirected by configuration. Feet are fixed in world coordinates during stance. Forepaws reach the landing plane while hindfeet remain above it. Extreme settings and repeated reversals retain bounded geometry and four connected joint chains.

The browser **mocks** check at most one owned RAF, coalescing of thousands of pointer/reaction calls, CSS-rect normalization independent of DPR, no scheduled work while paused/reduced/hidden/offscreen/zero-size, bounded five-tick recovery from stalls, discarded-time reporting, cancelled input, instance independence, partial setup rollback, unsupported Canvas, callback failures, stale callbacks, repeated disposal and borrowed scheduler ownership. They cannot prove real listener/heap reclamation in a browser.

The preview tests retain one visible eye and one nose across profiles/phases and resolutions, preserve neutral/color silhouette occupancy, reject nonfinite/out-of-bounds/oversized geometry, and preserve the physical 1:2 cell aspect on different paint rectangles.

## Visual evidence provenance

[native-render.json](evidence/native-render.json) records the exact font hash, versions, dimensions, ticks and final state/cell hashes. [replay.json](evidence/replay.json) contains all normalized inputs. `scripts/render-evidence.mjs` reproduces the actual native capture through the same grid and painting functions used by the browser adapter.

| Capture | Actual contents |
| --- | --- |
| [native-contact-sheet.png](evidence/native-contact-sheet.png) | Idle 0, stalk 100, sniff 149, crouch 173, airborne 192, landing 210, recovery 236, cooldown 280 |
| [native-neutral-80x32.png](evidence/native-neutral-80x32.png) | Minimum accepted left/right profiles in one neutral glyph tone |
| [native-fox-replay.gif](evidence/native-fox-replay.gif) | Seed 17, 720 simulation ticks, every fourth tick captured at nominal 15 fps; explicit excerpt restart |
| `frame-*.txt` | Actual printable ASCII cell outputs, not transcribed drawings |
| `review/before-*.png` | Retained pre-correction native output |

The fox uses 28 polygons/198 vertices in this implementation, below predeclared caps of 48/1,024. The grid cap is 160×64 = 10,240 cells. These are workload limits, not achieved FPS. Native PNGs are not browser screenshots; the demo UI itself has no claimed rendered browser screenshot.

## Failed/blocked and unrun acceptance

`node scripts/browser-smoke.mjs` exited **1 before page launch**. Existing Chromium aborted with `socket() failed: Operation not permitted` and `ptrace: Operation not permitted`. See [browser-smoke.log](evidence/browser-smoke.log). No permission/security settings were altered. The included smoke script is available for an authorized local runtime with Playwright and Chromium.

The following remain **unrun**, rather than passed by inference:

- Real-browser keyboard, touch, observer behavior, 390 px reflow, zoom, font fallback and DPR changes.
- Normal-speed motion review in a browser/player, including every inter-frame transition and replay restart.
- Screen-reader narration and accessibility conformance.
- Long-session browser heap/resource profiling and framework mount/unmount behavior.
- Predeclared desktop timing targets (900×600, DPR1/2, 5 s warmup + 30 s; p95≤8 ms/p99≤16 ms), plus constrained mobile/thermal testing. No target-device benchmark was measured.
- Central species geometry/material contract, packed-package fox import, shared renderer/mixed-species composition and catalogue integration.
- Any deployed fox demo, npm publication or release. This task authorizes a draft PR only.

## Publication boundary

Push only the independent `feat/animal-fox` branch and open its own draft PR targeting `main`. Do not merge, deploy, publish npm or change shared settings. Source/art/font provenance is in [AUTHORING.md](AUTHORING.md); the repository's license decision remains with its owner.
