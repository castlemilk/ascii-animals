## Why

Add the commissioned gecko as an original typed species: a broad head, four
splayed pad-toed limbs with planted contacts, and a long continuous tapered tail.
Pointer guidance produces alternating creeping steps; a deliberate startle curls
the tail, gives a short retreat, then recovers through a bounded cooldown.

## Scope and base

- New branch `feat/animal-gecko`, exact final main base `074b90a94bd3a747a68feed554e33a3ab0720f41`.
  Original authoring base was `0e446c47b491b751d484e40db753ec725652b515`; this isolated
  branch was rebased after the coordinator merged PRs #2 and #4 during publication.
- Every changed file is under `species/gecko/`. Existing renderer, shared package,
  exports, registry, root README and other species are untouched.
- Reviewed skill `e721252075a30888198aafba0953a23fd07bd3c6`; authoring template completed
  before code. Original mathematical geometry; no copied ASCII art/sprites/ray core/fonts.
- PR #2 was read at `e7c16104a1e90c8650f7d3e09cdb1124d0321308` and rechecked at
  `8c530b10e8665e5b7d5cc528c8bd451cbbeef8e1`, now merged via
  `246dc33875d1270c11f6f3612614744e6f97562d`. Its TS createArtwork facade remains
  cuttlefish-only. The proposed GeometryWriter sketch is unchanged. Exact lifecycle,
  clock, configuration and material differences are in COMPATIBILITY.md.
- Incoming catalogue PR #4 was read at `5015dbcffb75b1036b21b4b8e3e65bf0697a46f1`,
  and its merged reconciliation was inspected at the final main base above.

## Implemented

- TypeScript-first `GeckoSpecies` facade, explicit config/input/state/result types,
  discriminated six-phase behavior, source-generated declarations, documented
  defaults/ranges and atomic invalid-input rejection.
- 60Hz integer-tick replay, uint32 seed and strictly ordered normalized input log.
- Three planted feet while one swings in FL→RR→FR→RL order; actual pad positions
  and toe fan angles stay world-fixed during stance. Continuous taper/curl.
- Local browser demo with semantic keyboard/touch controls, pause/reset, static
  reduced-motion curl, hidden/offscreen/zero-size/page suspension and disposal.
- Small explicitly proposed writer adapter; no accepted shared API is invented.
- Offline `gecko.html`, editable TS sources, reproduction scripts, authoring and
  provenance, raw test logs, real native Canvas frames/contact sheets and a GIF
  reproduction script. The generated GIF is supplied separately as noted below.

## Verification

- **32 tests pass:** 13 core/geometry/replay, 2 proposal-adapter fixtures, 17 DOM/Canvas
  stub lifecycle/actual-demo-host cases. Zero failures/skips.
- Strict TypeScript 5.9.3 source build and **30 expected negative type cases** pass.
- After rebasing onto merged main: **25 canonical/library tests** and **7 legacy
  authoring-bridge tests** pass; root strict TS/build, generated-demo freshness,
  catalogue and syntax checks pass. Raw commands/results are in
  `evidence/main-verification.json`. The final tracked non-gecko diff is empty.
- Existing Cuttlefish numerical suite passes; syntax passes; standalone rebuild
  leaves `dist/` byte-unchanged.
- **201 actual native Canvas frames**, 720×550, 10.05-second GIF, explicit seed/log.
  These are native renders, not browser screenshots or performance measurements.
- Independent bounded critique fixed merged mitten-like pads (same 112×50 minimum)
  and persisted-pagehide restoration. Before/after artifacts are preserved. The
  minimum-grid recognition gate was accepted; not all five pads resolve separately
  in every minimum-grid orientation.

![Native Canvas behavior checkpoints](https://github.com/castlemilk/ascii-animals/raw/refs/heads/feat/animal-gecko/species/gecko/evidence/contact-sheet.png)

The connected GitHub app rejected the GIF blob upload with `user rejected MCP
tool call`, without a further reason. That upload was not retried. The generated
GIF is provided separately in the task response and omitted from this branch;
`scripts/capture.mjs` reproduces it. All PNG checkpoints/contact sheets are included.

## Explicit pending acceptance — keep draft

Chromium is blocked before page launch (`socket() failed: Operation not permitted`);
the cloud browser local preview returned connection refused. No actual browser
checks or browser performance pass are claimed. Normal-speed perceptual playback,
real touch/device/keyboard/accessibility/bfcache review and heap profiling remain
unrun. Shared contract/renderer/package integration remains pending the coordinator.

This PR does not merge, publish npm, activate catalogue availability, deploy, or
change settings/permissions/credentials.

## Reproduce

```sh
# Existing TypeScript compiler on PATH, or GECKO_TSC_JS=.../typescript/lib/tsc.js
node species/gecko/scripts/build.mjs
node species/gecko/scripts/build.mjs --types
node --test species/gecko/test/*.test.mjs
node scripts/check-engine.cjs
# Newly applicable merged-main gates, with its declared TypeScript installed:
node scripts/build.mjs
node --test test/*.test.mjs
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
node scripts/build-demo.mjs --check
python3 scripts/check-catalogue.py
node scripts/check-authoring-bridge.mjs
```

Open `species/gecko/gecko.html` offline, or serve the repository root and open
`/species/gecko/`. See species README for native capture/optional browser commands.

Full evidence:
[review](https://github.com/castlemilk/ascii-animals/blob/feat/animal-gecko/species/gecko/evidence/REVIEW.md),
[API and reproduction](https://github.com/castlemilk/ascii-animals/blob/feat/animal-gecko/species/gecko/README.md),
[compatibility](https://github.com/castlemilk/ascii-animals/blob/feat/animal-gecko/species/gecko/COMPATIBILITY.md),
[provenance](https://github.com/castlemilk/ascii-animals/blob/feat/animal-gecko/species/gecko/provenance.json).
