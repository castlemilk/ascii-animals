# Browser integration and lifecycle

This guide describes the source at
`f63b20e2045b1070b10bde2efc4eb3a8536e606b` and its private package,
`ascii-animals-review@0.0.0-review.0`. Build and install it using
[Getting started](GETTING-STARTED.md), which includes runnable browser examples.
The helper below uses the strict marine `createArtwork` facade;
[Animal APIs](ANIMAL-APIS.md) records the other controllers' differences.

## Mount after layout exists

Importing the ESM modules is safe without `window` or `document`; creating an
artwork requires a browser-owned host. Marine construction checks the canvas's
`ownerDocument.defaultView`, requires Canvas 2D for the main and auxiliary
canvases, attaches listeners, allocates buffers and renders an initial frame.
It does not create the visible canvas or its surrounding controls for you.
See [`createArtwork`](../src/public/index.ts) and
[`CuttlefishArtwork` construction](../src/animals/cuttlefish.js).

Give the canvas an explicit CSS display size before mounting. The renderer sets
the canvas's bitmap `width`/`height` and transform; do not use those attributes as
your responsive layout mechanism or repeatedly overwrite them during animation.

```html
<figure>
  <div class="animal-stage">
    <canvas id="animal" role="img" aria-label="An animated ASCII cuttlefish">
      An ASCII cuttlefish swimming in a dark lagoon.
    </canvas>
  </div>
  <figcaption>Move gently to attract it; while playing, try Startle.</figcaption>
</figure>
<div aria-label="Artwork controls" role="group">
  <button id="play" type="button">Play</button>
  <button id="pause" type="button">Pause</button>
  <button id="action" type="button">Startle</button>
</div>
```

```css
.animal-stage {
  width: 100%;
  max-width: 48rem;
  aspect-ratio: 4 / 3;
}

.animal-stage > canvas {
  display: block;
  width: 100%;
  height: 100%;
}
```

A nonzero CSS box is required even when the canvas is inside a flex/grid layout.
If it is initially `display: none` or otherwise zero-sized, the marine renderer
sets its bitmap to zero, releases its grids and schedules no animation. It can
recover when the host is sized and `resize()` runs. Construction can throw if
Canvas 2D is unavailable; catch that at your UI boundary and keep a visible text
or image fallback rather than leaving an empty panel.

## Controls and teardown

This helper receives already-resolved DOM elements and returns the owner's cleanup
function. Call it once per mounted canvas, then call the returned function when
the view is removed or replaced. Native buttons provide keyboard and touch
activation through their normal `click` behavior.

```ts
import { createArtwork } from 'ascii-animals-review';

export function mountMarine(
  canvas: HTMLCanvasElement,
  controls: {
    play: HTMLButtonElement;
    pause: HTMLButtonElement;
    action: HTMLButtonElement;
  },
): () => void {
  const artwork = createArtwork(canvas, {
    species: 'cuttlefish',
    count: 1,
    scene: 'reactive',
    followPointer: true,
    // Omit paused: construction will respect system reduced motion.
  });
  const events = new AbortController();
  const listenerOptions = { signal: events.signal };

  controls.play.addEventListener('click', () => artwork.play(), listenerOptions);
  controls.pause.addEventListener('click', () => artwork.pause(), listenerOptions);
  controls.action.addEventListener('click', () => artwork.pulse(), listenerOptions);

  return () => {
    events.abort();
    artwork.dispose();
  };
}
```

For this marine helper, Startle does nothing while paused; Play is an explicit
choice to enable motion. A host can disable the action while paused or explain
that behavior beside it. If the host polls `getStats()` to update labels, keep the
polling modest and clear its timer during the same cleanup. Do not announce every
frame or continuously changing telemetry in an ARIA live region.

`dispose()` removes the marine instance's scheduler subscription, pointer,
document/window and motion-query listeners; disconnects resize/intersection
observers; and releases owned grids and auxiliary buffers. It keeps the caller's
canvas and last painted frame. It does not remove your controls, abort your
listeners or cancel your timers. Those remain the host's responsibility.
Calling this marine cleanup twice is safe. Other species can reject most methods
after disposal; do not build a generic "call everything after unmount" pattern.

## Pointer, touch and keyboard are separate contracts

The marine renderer listens for `pointermove`, `pointerdown`, `pointerleave` and
`pointercancel`. A tap can startle a hit animal, with an encounter-specific target
fallback. Gentle pointer motion can attract animals when configured; repeated
fast sweeps can trigger scene-specific disturbance. Touch movement is explicitly
excluded from the fast-sweep detector, so a touch drag is not equivalent to a
mouse startle gesture. These rules are implemented in
[`_touch`, `_pointerMove` and `pulse`](../src/animals/cuttlefish.js).

The marine canvas has **no built-in keyboard bindings**. Adding `tabindex="0"`
alone does not provide keyboard control. Use the native buttons above. The marine
pointer listeners are passive and do not call `preventDefault`; no global
`touch-action: none` is required by this example. Preserve page scrolling unless
your application deliberately supplies a different gesture interaction.

Some species adapters do bind keys on their host, while others expect external
controls. Check their specific focus, shortcut and pointer contracts in
[Animal APIs](ANIMAL-APIS.md) instead of adding blanket Space/Enter listeners that
might duplicate a built-in action. An Owl receives an `HTMLElement` and owns a
text-rendering subtree; it must not be passed a canvas as if all hosts were
interchangeable. Its generated text has its own accessibility attributes; see
[Owl](OWL-API.md).

Canvas ASCII glyphs are painted pixels, not selectable terminal text. Provide a
meaningful accessible name and surrounding explanation. If artwork is entirely
decorative, hide it from assistive technology and keep it out of the focus order;
do not hide controls that still perform meaningful user actions.

## Motion preferences and hidden work

For `createArtwork`, the default `reducedMotion: 'system'` honors the current
system preference **when `paused` is omitted**. Explicit `paused: false` or a
later `play()` overrides the initial pause. Entering reduced motion subsequently
pauses the instance; leaving it does not auto-resume. Do not call `play()` as a
routine mount step, because that defeats the default motion policy.

This is not the rule for every animal: Fox, Dragonfly, Gecko and Owl continue to
block automatic motion while the system preference requests reduced motion, even
after `play()`. Several adapters offer a still reaction as an accessible response
to an explicit action. The per-animal pages describe those alternatives.

The marine automatic scheduler suspends for document hiding, zero size and
offscreen state when visibility observation is enabled. If `IntersectionObserver`
is unavailable, it cannot determine offscreen state; `observeVisibility: false`
also opts out of that suspension. CSS occlusion or an application-specific hidden
state is not a universal visibility signal. Pause or dispose the instance when
your application knows a view is inactive.

`autoStart: false` transfers scheduling ownership to the host. Manual
`advance(seconds)` calls bypass pause, system preference and automatic visibility
gates; the host must decide when to step, keep each interval within `0`–`0.1`
seconds and cancel its loop on cleanup. Calling `pause()` alone will not stop
your own manual loop. See [Manual timing](TYPESCRIPT-API.md#manual-timing).

## Resizing and resource limits

The marine engine observes the canvas with `ResizeObserver` when available and
also listens for window resize. `resize()` can be called explicitly after a
layout change; it does not accept width/height arguments. Without
`ResizeObserver`, a container-only change may require that explicit call. A
resize reads `getBoundingClientRect()` and paints without advancing simulation
time. Layout ownership stays with the host.

`maxDpr`, `maxPixels` and `maxCells` cap different resources. A very large CSS box
can produce an effective DPR below `maxDpr` to satisfy the pixel/per-axis limits.
The body and ink grids each have a cell limit; those limits do not describe total
process or GPU memory. Reducing DPR or density changes rendered quality, so test
the actual viewport and font environment you intend to support.

Other adapters have their own sizing rules and limits. Consult their controller
types before calling `resize()` or assuming every species reports the same
dimensions and resource statistics.

## Frameworks, SSR and route transitions

The package supplies ESM factories, not official React/Vue/Svelte components. It
does not ship a hydration protocol or automatically discover your framework's
mount/unmount events. The package export map has `import`/`default` and declaration
targets; it does not supply a separate CommonJS build.

In React or a Next.js client component, hold the DOM node in a ref, construct the
artwork inside an effect after the node exists, and return its cleanup. Never
construct during render, a state initializer, or server component execution.
Update a stable instance through its public configuration method when possible;
recreating it for every render restarts the performance and allocates buffers.
React development lifecycle replays require every setup to create a fresh
instance and every cleanup to dispose only the instance it created. Do not retain
and reuse a disposed controller in a module singleton.

The same ownership applies to Vue's mounted/unmounted hooks and Svelte's mount
cleanup. Dynamic import can defer downloading a species until needed, but
import-safety does not make construction server-safe. Render the host, controls
and fallback on the server; mount the renderer in the browser. Avoid drawing or
changing the host's bitmap during hydration itself. An Owl needs a dedicated
empty host element so its owned subtree does not conflict with children managed
by the framework.

When a route or selected animal changes, detach host-owned listeners and dispose
the old controller before mounting the replacement. Do not use a global
`beforeunload` listener as the only cleanup in a client-side application. If a
page-cache lifecycle disposes an instance on `pagehide`, make its `pageshow`
policy create a new instance rather than reusing the disposed one.

## Source and verification boundary

The behavior above is grounded in the
[strict facade](../src/public/index.ts),
[marine implementation](../src/animals/cuttlefish.js),
[scheduler](../src/core/scheduler.js),
[Fox adapter](../src/public/fox.ts),
[Dragonfly browser host](../species/dragonfly/src/browser.ts),
[Gecko browser host](../species/gecko/src/browser.ts), and
[Owl browser host](../species/owl/src/browser.ts).
These are source contracts for the pinned candidate. Browser/device acceptance,
current Pages content and npm publication are separate checks; a local variant or
unmerged character experiment is not established by these docs. See the
[validation record](VALIDATION-2026-11-21.md) for checks actually performed.
