# Fox dusk validation

Base: `b8f222dab868821f27bf2a64a98434f3483fc8e6`. Verified 19 November 2026. Runtime: Node `v24.22.3`, npm `11.9.0`, TypeScript `5.9.3`.

**The final fox model/render/controller tests and built-package checks pass. Real-browser acceptance remains pending because Chromium aborted before opening a page.**

## Executed checks

| Check | Result | Evidence |
| --- | --- | --- |
| Canonical fox TypeScript compile | Exit 0 | Compiled before final native capture |
| Fox tests | **70/70 passed**, no skips | `fox-tests-final.log` |
| Full repository build in disposable copy | Exit 0 | `package/build.log` |
| Full repository typecheck after build | Exit 0 | `package/typecheck.log` |
| Built fox integration suites | **13/13 passed** | `package/fox-integration.log` |
| Local package creation | Exit 0, lifecycle scripts disabled, offline mode | `package/pack.log` |
| Installed local-tarball consumer | Passed offline install, strict NodeNext/Bundler usage and **14 negative assertions per mode**, plus SSR checks | `package/fox-package-consumer.json` |
| Demo and two new scripts: JavaScript syntax | Exit 0 | Root verification |
| Patch whitespace check | Exit 0 | Root `git diff --check` |

The 70 fox tests include numerical behavior, deterministic replay, geometry/cells, gait, and explicit DOM/Canvas/scheduler mocks. The 13 integration tests also use mocks. Their pause, input, resize and cleanup results establish contract/resource bookkeeping; they do not establish real-browser behavior or accessibility acceptance.

### Exact root commands

Working directory: `/workspace/scratch/b91a06885f33/ascii-animals`.

```sh
node node_modules/typescript/bin/tsc -p species/fox/tsconfig.json
node --test species/fox/tests/*.test.mjs > /workspace/scratch/b91a06885f33/fox-evidence/fox-tests-final.log 2>&1
node --check species/fox/demo/demo.js
node --check species/fox/scripts/capture-dusk-review.mjs
node --check species/fox/scripts/browser-dusk-smoke.mjs
git diff --check
```

### Exact package commands

These ran in `/workspace/scratch/b91a06885f33/fox-package-check`, a disposable copy of the working bytes excluding `.git` and `node_modules`, using the existing local TypeScript installation. npm was configured offline. Shared generated `lib/` and `dist/` outputs were produced in this copy only.

```sh
npm run build
npm run typecheck
node --test test/fox-integration.test.mjs test/fox-director-integration.test.mjs
npm pack --ignore-scripts --offline --json --pack-destination /workspace/scratch/b91a06885f33/fox-evidence/package
node species/fox/scripts/check-director-package.mjs /workspace/scratch/b91a06885f33/fox-evidence/package/ascii-animals-review-0.0.0-review.0.tgz
```

`package/verification.json` records each invocation, exit code and elapsed time. All nine `species/fox/src/*.ts` SHA-256 hashes agree before/after, between the working tree and copy; the four `package/*source-*.json` records preserve them. The resulting 495,158-byte tarball has SHA-256 `e9329151f290714becf832c25b4b9a764a1010dfc97de0cf517e2abf87128d53`.

**Initial typecheck failure retained:** the standalone `tsc -p species/fox/tsconfig.types.json` check returned exit 2 before the shared package build. Its package-consumer fixture imports `lib/index.js` and `lib/public/fox.js`, which were absent, producing TS2307 and consequent fixture diagnostics (`fox-types-final.log`). The subsequent full build generated those entry points in the disposable copy; the full typecheck and both installed-consumer resolution modes then passed. The initial failure is not represented as a passing standalone run.

## Native visual and motion evidence

The before/after PNGs, contact sheets, GIFs and MP4s render the actual compiled fox with **native Skia Canvas** (`@napi-rs/canvas 0.1.100`). They are not browser screenshots or illustrated mockups. Both sides use seed 17, `dusk-hunt`, two foxes, labels off, and the same ordered cue log: actor 0 receives `rustle` or `play` at tick 60 at x `-.04`, y `.69`.

| Surface | Pixels | Logical grid |
| --- | --- | --- |
| Desktop | 960 × 640 | 160 × 64 |
| Phone-sized canvas | 390 × 446 | 112 × 64 |

`before/native-before-manifest.json` and `after/native-after-manifest.json` pin source/compiled hashes, installed Liberation Mono font hash, states and event logs. Each motion excerpt samples five 60 Hz simulation ticks per frame and is encoded at a nominal 12 fps; that cadence is not measured rendering throughput. `native-timing.json` reports a separate bounded native timing observation, without a browser/device FPS pass claim. Physical-phone use, browser fonts and full-page layout were not established by these captures.

## Pending real-browser gate

The ordinary Playwright `1.62.1` call `chromium.launch({headless:true,executablePath:"/usr/bin/chromium"})` aborted with `SIGABRT`, `socket() failed: Operation not permitted`, and `ptrace: Operation not permitted` before page initialization. See `browser-launch-attempt.json`. No real-browser DOM, Canvas, pointer, touch, keyboard, resize, reduced-motion or disposal checks ran; the new browser harness was syntax checked only.

On an already supported browser host, after building the applied source, the pending gate is:

```sh
node species/fox/scripts/browser-dusk-smoke.mjs --out=/absolute/review-evidence/browser
```

Retain browser interaction, keyboard/focus/reflow, touch, live reduced-motion changes, actual cleanup, normal-speed browser playback, and physical-device performance as pending until separately evidenced.

## Central integration

After applying the fox patch, **`npm run build`** is the existing central regeneration command. Then run `npm run typecheck`, the fox tests and the two fox integration suites above. This verification did not publish, merge or deploy the package.
