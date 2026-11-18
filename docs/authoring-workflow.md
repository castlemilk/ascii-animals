# Reactive ASCII animal authoring: bridge to the existing cuttlefish

**Review draft; additive files only.** The implementation baseline is draft PR [#1](https://github.com/castlemilk/ascii-animals/pull/1), branch `feat/cuttlefish-microsite-import`, exact commit `7e5984d34a139b8de4643f1ed0607897a42d88dc`. The existing renderer and microsite remain the originals. This example is a small consumer of their real public browser API, not a species-module refactor or npm release.

The companion reusable skill has the proposed destination `generate-reactive-ascii-animals/SKILL.md` in `skunkworq/skunkworq-skills`, whose inspected `main` base is `d2d1a548a8230a69331c53f6ed61f478e412704c`. That skill package is a separate review deliverable. It is not installed or added to either remote repository by this work.

## What exists and what this adds

The imported `dist/artwork.js` is a browser IIFE exporting `window.CuttlefishArtwork`. It creates its own Canvas2D renderer, animation scheduling, input listeners and resize observer. The imported `dist/app.js` is the separate full microsite controller. There is no package manifest, species registry, portable core or framework adapter in this baseline.

This patch proposes four new paths:

| Path | Purpose |
| --- | --- |
| `examples/authoring/legacy-controller.mjs` | Compose explicit playback intent with motion preference, page visibility, viewport intersection and display-size policy using the real renderer API. |
| `examples/authoring/cuttlefish-embed.html` | A local, semantic-controls example with no remote fonts, status polling or new animation loop. |
| `scripts/check-authoring-bridge.mjs` | Dependency-free tests against the actual imported renderer inside a stub Canvas/DOM VM. |
| `docs/authoring-workflow.md` | This integration guide, scope and remaining acceptance. |

All adapter and example code is newly authored. No geometry, original renderer code, reference artwork, font binaries or third-party library implementations are copied into these new files. Source/license review remains necessary before distribution; the imported repository has no LICENSE file.

## From checkout to a working example

Use an isolated checkout containing the exact imported baseline and apply the review patch there. Do not overwrite a coordinator's active checkout. The patch adds these files; it does not require a package installation.

1. Confirm the implementation base with `git rev-parse HEAD`. The review base is `7e5984d34a139b8de4643f1ed0607897a42d88dc`; reconcile any newer commit before applying changes.
2. Review and apply the additive patch locally. Keep `dist/artwork.js`, the existing standalone HTML and all original source/assets unchanged.
3. From the repository root, run the numerical checks:

   ```sh
   node scripts/check-engine.cjs
   node scripts/check-authoring-bridge.mjs
   ```

4. Start a local server from the **repository root**, so the example's relative renderer path resolves:

   ```sh
   python3 -m http.server 8000
   ```

5. Open `http://localhost:8000/examples/authoring/cuttlefish-embed.html`. The canvas should show a still cuttlefish. Select Play to request animation. The controller waits for the canvas to intersect the viewport and keeps it still whenever a policy blocker is active.
6. Try Startle while running, then Pause. Change Movement and restart while paused. Inspect current status reads one renderer snapshot on demand; it is not a live telemetry loop.
7. Enable reduced motion in the OS/browser, hide the tab, scroll the canvas outside the viewport, and temporarily set its CSS height to zero. Each condition should pause the simulation. Clearing the last blocker resumes only if Play is still requested. Select Pause to cancel the remembered request.

The supplied browser example uses ES modules, so serve it over local HTTP rather than opening the `.html` file directly. This example has not yet been exercised in a real browser in this investigation; the steps above are the manual acceptance journey, not a claim that it was visually verified.

## Use the actual browser API through the bridge

Load the unchanged classic script before creating the adapter. The example's source URL is exactly `../../dist/artwork.js`; its module URL is `./legacy-controller.mjs`.

```js
import {createLegacyCuttlefishController} from './legacy-controller.mjs';

const controller = createLegacyCuttlefishController(canvas, {
  Artwork: window.CuttlefishArtwork,
  options: {scene: 'reactive', count: 1, palette: 'lagoon'},
  onStateChange(state) {
    status.textContent = state.running ? 'Running' : state.blockedBy.join(', ');
  },
});

controller.play();
controller.setOptions({formation: 'vertical'});
controller.pulse();
controller.pause();
controller.restart();
const statusSnapshot = controller.getStats();
controller.destroy();
```

The bridge only calls the existing constructor and `setPaused`, `setOptions`, `getStats`, `restart`, `pulse` and `destroy`. It does not call private renderer methods, replace its clock, intercept its prototype or add properties to `window`.

| Bridge method | Contract |
| --- | --- |
| `play()` | Remember a request to animate. Return whether policy currently permits running. A blocked request remains remembered. |
| `pause()` | Cancel the request and pause. Later visibility or preference changes do not restart a manually paused controller. |
| `setOptions(patch)` | Forward supported renderer options through the current API. Reject a `paused` property so callers cannot bypass the policy; use Play/Pause instead. |
| `getState()` | Return an immutable policy snapshot, including `requestedPlay`, `running`, `disposed`, flags and reasons. Remains available after destruction. |
| `getStats()` | Read the real renderer statistics on demand; add no timer. |
| `restart()` | Recheck synchronous policies, then restart the existing scene while preserving the playback decision. |
| `pulse()` | Recheck synchronous policies and return false without calling the renderer if blocked. Return true if dispatch was permitted; this does not promise a reaction occurred. Existing swim-by pulse behavior is replay, and active reactions can refuse a new startle. |
| `destroy()` | Idempotently remove the bridge's listeners/observers, then destroy the renderer. Subsequent action calls throw. |

The dependency injection option `environment` provides `document`, `matchMedia`, `ResizeObserver` and `IntersectionObserver` for test harnesses. Production callers normally omit it. `Artwork` is explicit constructor injection; the real browser IIFE is still required. This is not an SSR or non-browser runtime promise.

## Playback policy and failure boundaries

Actual running requires all of:

```text
requestedPlay AND NOT reducedMotion AND NOT document.hidden
AND positive viewport intersection AND positive finite display dimensions
```

Initial `requestedPlay` is false. Even an incoming renderer option `{paused: false}` is overridden at construction. An intersection must be observed before the first run. The adapter deliberately enforces reduced motion as a blocker while the preference remains active; that is stricter than the existing microsite's explicit Play override, and is confined to this separate example.

Visibility, motion preference and dimensions are also reread synchronously before actions, including `pulse()` and `restart()`, rather than relying solely on queued events. This prevents the legacy `pulse()` implementation from unpausing the renderer when those policies have just changed. Viewport intersection remains observer-driven; intersection is not proof that no other element visually occludes the canvas.

The bridge requires modern MediaQueryList change events, ResizeObserver and IntersectionObserver. Missing capabilities produce an error before constructing the renderer. The demo shows that failure in its status text. No unsupported-browser fallback is claimed.

The bridge owns one document visibility listener, one media-query listener, one resize observer and one intersection observer. It adds no `requestAnimationFrame`, interval or telemetry timer. The **existing engine still schedules RAF while paused or hidden**, even though its simulation does not advance. The wrapper cannot remove that internal scheduling without changing the source; do not advertise zero idle callbacks or measured energy savings.

The existing renderer has its own listeners, observer, buffers and RAF. Its public `destroy()` handles its normal cleanup. The bridge removes its own resources before calling that method, and separate mounted instances retain independent ownership. If a consumer `onStateChange` callback throws after mounting, the bridge disposes resources and rethrows that original exception. Late observer callbacks are ignored after disposal.

Partial **adapter** construction after the renderer returns is covered by cleanup tests. If the legacy renderer constructor itself throws after acquiring internal resources but before returning an instance, the bridge has no instance on which to call `destroy()` and cannot guarantee rollback. That boundary needs a future renderer change if constructor exception safety is required. Neither arbitrary failures inside Canvas/observer cleanup nor every browser allocation-failure path were tested.

## What the tests establish

The tests run the exact imported `dist/artwork.js` in a VM and wrap only its public methods for observation. Canvas painting and browser events are stubbed; no copied renderer implementation is substituted. The script prints the source path and its SHA-256 to make the executed renderer identifiable. Test results and the actual Node version are recorded in the review evidence.

Covered behaviors:

- Initial pause despite `{paused: false}`, waiting for intersection, allowed pulse with actual reaction state.
- Logical combination of reduced motion, hidden tab, offscreen canvas and zero display size; one cleared blocker does not clear others.
- Queued-event races: direct policy changes before pulse and restart are handled synchronously.
- Rejection of playback-bypassing or malformed option patches; valid options and restart reach the actual API.
- Independent mounting/disposal, repeated destruction, late callbacks and no remaining tracked listeners/observers/RAF after both instances are destroyed.
- Missing capability checks, cleanup after a wrapper-observer constructor fails, and cleanup when a consumer status callback throws after mount.

These are correctness checks, not benchmark results. The reported test-run milliseconds do not measure browser frame cost. No real-browser accessibility, visual quality, pixel comparison, screen-reader behavior, memory profiling, mobile touch behavior, bfcache restoration or hardware performance acceptance has been completed for the bridge.

## Portable core versus adapters: the next integration step

This small bridge demonstrates a safe consumer boundary for the existing code. It does **not** make the existing cuttlefish a reusable species module. The imported renderer combines species geometry (`_body`, `_arms`, `_beak`), per-animal state copied through `FISH_STATE`, projection and rasterization, pointer handling, time integration and browser lifecycle.

Use the companion skill to author a species brief and original geometry, document glyph/font provenance, propose a bounded deterministic core and test it independently. Treat its sample species contract as a proposal until it is reconciled with an implemented library contract. Preserve the cuttlefish's existing silhouette, arm independence, shared owner/depth-buffer hit testing, formation precedence and reaction stages during extraction.

The portable portion should eventually own species-local state, explicit seeds, normalized timestamped input, fixed simulation steps and bounded geometry samples. Browser scheduling, motion preferences, viewport/size observation, Canvas atlases and accessible controls belong in adapters. A future React adapter can mount, update and dispose that boundary; no React wrapper or terminal renderer is implemented or tested here. Do not infer npm exports from the existence of this `.mjs` example.

## Remaining acceptance before adopting this example

Rebase or regenerate the additive patch if the coordinator's branch moves. Review the four files and run both numerical scripts on the intended commit. Then complete the browser journey above at desktop and narrow viewport sizes; use keyboard and touch, exercise reduced-motion and visibility transitions, inspect error states and verify repeated mounting/unmounting in the intended host. Check screen-reader labels and status announcements, especially the remembered Play request. Confirm the actual deployment's module MIME types and relative asset paths. Capture performance evidence only on named devices with explicit viewport, population and density settings.

Any remote integration, issue/PR creation, publication, license choice, npm release or deployment remains with the coordinator. The delivered patch and this document make no claim that those actions occurred.
