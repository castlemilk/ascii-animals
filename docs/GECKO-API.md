# Gecko: typed solo adapter and optional scene director

The reviewed base is `c06114404900884814bef879a02f1a49a3e7d590`. Its real package facade is [`src/public/gecko.ts`](../src/public/gecko.ts); canonical animal source is [`species/gecko/src`](../species/gecko/src). The original Gecko came from PR #9 (`848ae9af63466b95edc6e31fc9290266492c3b49`). Its broad head, four pad-toed stance/swing feet, planted toes, long attached tail, ordered inputs, and startle → retreat → recovery → cooldown remain the foundation.

The optional director adds Gecko-specific scenes through that existing facade. Omit `director` to retain the solo host. It does not add a universal species contract or another shared renderer. The package is still the private, UNLICENSED `ascii-animals-review` review candidate; this documentation is not a claim of an npm release.

## Existing solo use

```ts
import { createGeckoArtwork } from 'ascii-animals-review/gecko';

declare const canvas: HTMLCanvasElement;
const art = createGeckoArtwork(canvas, {
  config: { seed: 7, options: { creepSpeed: .1, curlStrength: .8 } },
  view: { grid: 'auto', neutral: false, maxDpr: 2 },
});
art.guide(.4, -.2);
art.pulse(); // startle in motion; deliberate static curl while suspended
art.pause();
art.restart(); // preserves explicit pause and resolved options
art.play();
art.dispose(); // idempotent; releases only this host's resources
```

The root named `createGeckoArtwork` and `ascii-animals-review/gecko` refer to the same factory. The subpath also exports `createGecko`, `resolveGeckoOptions`, `DEFAULT_GECKO_OPTIONS`, `DEFAULT_GECKO_HABITAT`, `GECKO_LIMITS`, and their TypeScript contracts. All original controller methods remain available: `update`, `setView`, `setPaused`, `guide`, `clearGuide`, `startle`, `reset`, `exportText`, `redraw`, `getSnapshot`, `getStatus`, and `dispose`. The facade supplies `play`, `pause`, `restart`, `pulse`, and `canvas` / `species` / `disposed` metadata.

`GeckoActionResult` retains its original union: `queued`, `static`, or `ignored` with reason `resting`. `guide` accepts finite coordinates and clamps them to `[-1, 1]`. The headless model instead validates exact normalized event coordinates, the next integer tick, and strictly increasing sequence numbers. A returned `queued` result describes accepted browser input, not a completed physical movement.

### Configuration and lifecycle

The source [`GeckoConfig` and `GeckoOptions`](../species/gecko/src/types.ts), [option validation](../species/gecko/src/gecko.ts), and [solo options table](../species/gecko/README.md#types-defaults-and-validation) define all artistic ranges. Seed is uint32, default `37`; solo heading defaults to `-.24` radians. Seed, heading and habitat are creation/reset settings. `update` patches artistic options after validation, preserving time, contacts, seed and behavior.

The additive solo `habitat` has defaults `{ extentX: .26, extentY: .13, origin: { x: .18, y: 0 } }`. Extents are finite in `[.26, 3]` and `[.13, 2]`; a supplied origin has both finite coordinates inside the resolved extents. A reset can patch the current habitat and recreates contacts at its origin. Omission preserves the original travel domain. Director mode owns each member's habitat, so it rejects `config.habitat` and a habitat reset.

The model advances one integer 60 Hz tick per `step`. The browser host accepts at most five catch-up ticks per callback and reports discarded elapsed time in `droppedMilliseconds`. The public factory borrows the package scheduler unless `frameSource` is supplied; a host owns only its subscription. A custom source implements `subscribe(callback): () => void`. Neither reset nor disposal stops a peer or a borrowed scheduler.

Explicit pause, live reduced-motion preference, hidden document, bfcache suspension, offscreen intersection, zero size and too-small width independently stop animation. User pause survives reset, configuration, hide/show and persisted page restoration. A nonpersisted `pagehide` disposes the demo. Getters return defensive model snapshots; `getStatus` remains available after disposal, while other controller operations reject. See the actual [host implementation](../species/gecko/src/browser.ts).

| Rendering policy | Solo | Opt-in director |
| --- | --- | --- |
| Minimum canvas CSS width | 360 px | 320 px |
| Automatic grid | 176×78; 112×50 below 560 px | 224×144; selected close view at 112×72 below 640 px or with one visitor |
| Explicit `view.grid` accepted by the host | Integer 112–192 columns, 50–86 rows | Same explicit bounds; automatic mode selects the larger director grids |
| View defaults | `grid: 'auto'`, `neutral: false`, `maxDpr: 2` | Same |

The host caps logical draw dimensions at 1000×780 and DPR at 2. The backing canvas can therefore reach 2000×1560 pixels. These are allocation limits, not performance measurements or a cross-device pixel guarantee.

## Opt into the Gecko director

```ts
import { createGeckoArtwork } from 'ascii-animals-review/gecko';

declare const canvas: HTMLCanvasElement;
const wall = createGeckoArtwork(canvas, {
  config: { seed: 37 },
  director: {
    scene: 'moonlit-wall', population: 3, tempo: 1, boldness: .55,
    roles: ['scout', 'hunter', 'sentry'],
    autonomy: true, reverse: false, showRoutes: false,
  },
});
wall.selectGecko('pip');
const result = wall.direct({ type: 'moth', id: 'pip', x: .25, y: -.2 });
if (result.outcome === 'ignored' && result.reason === 'busy') {
  // A shadow may be ignored while its target recovers.
}
wall.configureDirector({ scene: 'lantern-hunt', showRoutes: true });
const state = wall.getDirectorSnapshot();
const recipe = wall.exportScene();
wall.pause();
wall.direct({ type: 'shadow', id: 'mica' }); // composes a still; advances no tick
wall.dispose();
```

The additional methods are `configureDirector`, `getDirectorSnapshot`, `direct`, `selectGecko`, and `exportScene`. `getDirectorSnapshot` and `exportScene` return `null` on a solo mount; director commands require an opted-in mount. `direct` returns `GeckoDirectorActionResult`, which adds the explicit `busy` reason without widening legacy `GeckoActionResult`. Prefer `direct` for contextual encounters. In director mode `startle` / `pulse` remain compatibility aliases for a shadow cue, with a busy rejection mapped to legacy `ignored/resting`.

`getSnapshot()` and the legacy `getStatus().phase` continue to describe the first member in director mode. Read `getDirectorSnapshot().individuals` for the selected visitor or complete cast. `getStatus().director` is a small scene summary; `directorPoster` identifies the deliberate static cue (`none`, `moth`, `shadow`, `return`, `inspect`). Sparse status notifications are suitable for scene labels, not a per-frame animation feed or continuous live-region announcements.

The subpath exports `createGeckoDirector`, its option resolver/defaults/limits, `GECKO_SCENES`, and the explicit director options, scene, state, event, cue, receipt, reset and recipe types. Complete defaults, validation, deterministic replay, scene semantics and evidence limits are in the [director guide](../species/gecko/director/README.md).

## Build and evidence

From the repository root, with the existing locked dependencies:

```sh
npm run build
node node_modules/typescript/bin/tsc -p species/gecko/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p species/gecko/test/tsconfig.json
node --test species/gecko/test/*.test.mjs test/gecko-integration.test.mjs
node --test test/generated-demo.test.mjs test/demo-module-dependencies.test.mjs
```

The [existing builder](../scripts/build-gecko.mjs) compiles Gecko TypeScript, the public facade and `dist/gecko/`. It rewrites the source demo's `mountGecko` import to the actual package factory. The generated demo has no remote runtime dependencies. No package name, shared export map, scheduler, registry or marine renderer is redefined by the director.

On 18 November 2026, real cloud-browser interaction verified the deployed Cuttlefish baseline and the previous solo Gecko page. Those captures do not validate this new director page. Its fresh Chromium launch failed during startup; new-page browser/mobile interaction, real reduced-motion behavior, screen-reader behavior and measured performance/heap remain pending. Source/type checks, stub lifecycle tests and native Canvas captures must be reported under their own evidence categories. No browser or performance pass is implied by a generated file, a screenshot from the old page, or the limits above.

### Final base refresh

The implementation was inspected and authored on `c06114404900884814bef879a02f1a49a3e7d590`. Before final validation, current main advanced to `c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02` through a shared README status reconciliation only. The isolated director branch was fast-forwarded to that exact base; no runtime contract changed, and the shared README is outside this species diff.
