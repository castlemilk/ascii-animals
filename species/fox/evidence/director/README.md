# Native Fox director evidence

These are actual frames from the Fox director, existing Fox geometry and Fox scene painter, rendered with installed `@napi-rs/canvas` (Skia). They establish what the compiled renderer produced for the recorded inputs. They are **not browser screenshots, a deployed-site check, accessibility certification or measured device performance**.

## Reproduction

From the repository root, with the repository dependencies and an already installed `@napi-rs/canvas`, FFmpeg and Fontconfig:

```sh
npm run build
node species/fox/scripts/render-director-evidence.mjs
```

The capture script also accepts an installed Canvas package under `CODEX_PRIMARY_RUNTIME_NODE_MODULES`. It does not install or download dependencies. `FOX_EVIDENCE_FONT=/absolute/path/to/font.ttf` overrides the installed font selected by `fc-match Liberation Mono`. The font itself is not distributed here.

`--record-before` creates a new `before/` directory containing two representative PNGs and a compact manifest. It refuses to replace an existing before directory. Omit this flag when recapturing after a correction.

The script hashes the compiled modules before and after capture and rejects a capture if they change. `native-render.json` records those JavaScript module hashes under `sourceHashes`, along with the base commit, checkout commit, uncommitted-source flag, Node/Canvas/FFmpeg versions and installed font SHA-256. This identifies the runtime that generated the pixels even when implementation has not yet been committed.

## Contents

| File | Evidence |
| --- | --- |
| `native-scenes-contact.png` | Three actual authored scenes and listening, crouching and resting tableaux. |
| `native-replay-contact.png` | Six frames selected from the ordered input replay. |
| `native-grounding-before-after.png` | A direct Canvas composite of the preserved first desktop PNG and the corrected PNG at the same seed, scene and tick. |
| `native-director-replay.gif` | 193 rendered frames, sampled every five ticks from tick 0 through 960 and encoded at a nominal 12 frames per second. |
| `native-portrait-112x64.png` | Three foxes on the narrow 112 × 64 character grid, rendered at 390 × 446 pixels. |
| `native-neutral-desktop.png` | The same native renderer in its neutral monochrome representation. |
| `replay.json` | Exact initial director configuration, seed 17, 60 Hz simulation tick contract and seven ordered guide/cue/leave events. |
| `native-render.json` | Runtime/font provenance, per-frame actor state, occupied-cell counts and grid hashes. |
| `before/` | Preserved first native desktop and portrait compositions plus their original runtime hashes. |

Individual PNGs have corresponding literal `.txt` character grids. The metadata footer sits outside the renderer's scene area. The desktop scene is 800 × 640 pixels using 160 × 64 cells. PNG and GIF dimensions include the separate 44-pixel footer. The GIF is a finite excerpt that restarts; it does not promise a seamless scene loop. Its encoding rate is not a throughput measurement.

## Bounded visual critique

The first native desktop frame and 390-pixel portrait frame showed a clear composition problem: the far fox stood above the meadow horizon, surrounded by empty sky. This weakened the shared ground plane, especially with three foxes stacked in the narrow composition. Those images are preserved in `before/`; they must not be substituted with corrected output.

After one correction, the inspected desktop comparison and portrait frame show a higher horizon behind the cast, sparse grass in the far lane and fixed ground accents below the actors. The far fox now belongs to the meadow. The apex at tick 306 and forepaw landing at tick 328 show the body separating from, and returning toward, its ground marks. These sample times were selected from the actual recorded behavior states; the first capture's tick-290 sample was only two ticks into the leap.

The inspected scene and replay contact sheets show separated fox silhouettes, long muzzles and full tails. The resting composition is visibly different from the upright poses. Ear/head changes, separate paws and Canvas labels remain small at the maximum three-fox portrait density; the demo's DOM cast rail supplies the readable names and roles. The hunt and play scenes are easier to distinguish across their action sequences than from a single isolated still. A contact sheet can expose pose changes and overlap, but does not establish smooth normal-speed playback.

## Remaining acceptance

Real browser rendering and font fallback, normal-speed playback, mobile touch, keyboard navigation and screen-reader announcements, reduced-motion preference switching, tab visibility/resize behavior, and device performance need their own browser/device evidence. Controller/DOM-double tests elsewhere in the species test suite exercise logic; they do not turn these native captures into browser evidence.
