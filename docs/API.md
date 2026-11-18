# Cuttlefish API: inspected contract and candidate boundary

**Current canonical integration:** browser and package builds derive from `src/`. Supported marine species/configuration are documented in [SPECIES.md](SPECIES.md); the import provenance below describes the historical baseline, not a separate maintained renderer.

This guide separates the **imported microsite engine** from the **local library candidate**. The patch base is GitHub import commit `7e5984d34a139b8de4643f1ed0607897a42d88dc`, branch `feat/cuttlefish-microsite-import`, draft PR #1. Its imported files match the inspected local snapshot `afcce9941c5fa13ca5c658564e73388e603dff14`; hosting metadata is excluded. The engine is `dist/artwork.js`, consumed by `dist/app.js` and `dist/record.html`. This source is newer than accessible saved site version 4 (`6214a09171fa328beec984edd6533c33e83ce9f1`). Site metadata links the project to the supplied conversation, but the full conversation and live runtime were not accessible. Initial main `84bd1f84fab0f5f5dec053c0d10562c10be8c188` held only `.gitignore`. Do not attribute the import's API to main or the saved site version.

## Inspected constructor

```js
const artwork = new window.CuttlefishArtwork(canvas, options);
```

The source expects a browser `HTMLCanvasElement`, Canvas 2D, `document`, `window`, `ResizeObserver`, `performance`, and animation-frame APIs. It creates auxiliary canvases, attaches pointer and visibility listeners, observes size, renders an initial frame, and queues animation. Loading its original script writes `window.CuttlefishArtwork` immediately. It is not an SSR-safe module.

The owning application must set the canvas's CSS display size. This is independent of its bitmap dimensions. The engine sets its backing-store dimensions and transformation itself. The original constructor has no validation for an absent canvas before calling `getContext`; the candidate must report a helpful construction error instead.

## Options retained from the microsite

The ranges below come from `_normalizeOptions()`, not only UI slider limits. Numeric values are converted with `Number`, non-finite values use the listed defaults, and finite values are clamped. `count` is rounded after clamping. The candidate should retain these names and limits unless a change is explicitly recorded.

| Option | Default | Accepted values / range | Meaning |
| --- | --- | --- | --- |
| `scene` | `'swimby'` | `'swimby'`, `'encounter'`, `'reactive'` | Scene direction. An invalid value becomes `'swimby'`. |
| `palette` | `'lagoon'` | `'lagoon'`, `'ultraviolet'`, `'ember'` | Built-in colors; original unknown strings render with Lagoon but remain in `options.palette`. |
| `mode` | `'ascii'` | `'ascii'`, `'points'` | Only exact `'points'` selects point rendering in the original. Other values take the glyph path. |
| `count` | `4` | Integer `1`–`12` | Population; visibility may be lower because routes leave the frame. |
| `formation` | `'independent'` | `'independent'`, `'horizontal'`, `'vertical'`, `'diagonal'`, `'random'` | Shared direction; invalid value becomes `'independent'`. |
| `behaviors` | `[]` → 12 `'auto'` values | Array of `'auto'`, `'cruise'`, `'hover'`, `'orbit'`, `'curious'`, `'encounter'` | Zero-based per-animal roles. Invalid/missing entries become `'auto'`. Array is copied and normalized to 12 slots. |
| `size` | `0.7` | `0.35`–`1.4` | Global body scale. |
| `sizeVariation` | `0.45` | `0`–`1` | Stable size differences derived from animal identity. |
| `spacing` | `1` | `0.65`–`1.6` | School spread. |
| `reverse` | `false` | Boolean coercion | Reverse the selected shared route. |
| `showLabels` | `false` | Boolean coercion | Number visible animals. |
| `speed` | `1.05` | `0.3`–`2` | Scene and local animation time multiplier. Reaction and particle ages use elapsed time, so this does not uniformly scale the whole simulation. |
| `ripple` | `1.3` | `0.3`–`2` | Fin wave strength. |
| `density` | `1.1` | `0.6`–`1.5` | Character-cell density; changing it reallocates the grid and rebuilds atlases. |
| `motion` | `1.2` | `0`–`2` | Travel strength. Zero does not freeze arm/fin animation or all scene state. Use pause for a still frame. |
| `depthStrength` | `1.2` | `0`–`2` | Perspective and dimensional treatment; affects geometry normal caching. |
| `followPointer` | `false` | Intended Boolean | Optional curiosity; reactive scene has its own pointer behavior. Original accepts truthy non-Booleans. |
| `glow` | `true` | Intended Boolean | Grid-sized bloom composite. Original accepts truthy non-Booleans. |
| `paused` | `false` | Boolean coercion at constructor/setter | User playback state. The original engine does not independently honor reduced motion. |

The original object's `options` and internal fields are accessible JavaScript properties, but they are implementation details. Mutating them directly bypasses normalization and reset semantics. A public declaration file should describe the supported methods, not make the 1,200-line class's internal fields a compatibility promise.

### Direction precedence

1. A coordinated formation controls the school route.
2. In independent formation, an explicit role controls that animal.
3. `'auto'` derives a role from the scene and animal index.
4. The original single-animal performance is selected only by `count: 1`, `formation: 'independent'`, and `behaviors[0]: 'auto'`.

For that single-animal case, Swim-by loops its arrival/linger/departure route. Encounter reaches an approach hold while local fin and arm time continues. Reactive supports disturbance and ink. Assigning a different role or a formation intentionally exits those original solo sequences.

## Inspected methods

| Method | Return | Inspected behavior / integration concern |
| --- | --- | --- |
| `setOptions(patch)` | `undefined` | Merge and normalize. A scene or formation change resets fish state and clears ink. A changed role resets that animal. Palette rebuilds atlas; density rebuilds size-dependent buffers. It renders synchronously. |
| `setPaused(value)` | `undefined` | Update `paused`, reset RAF timestamp, zero displayed FPS on pause, and render one frame. The original keeps RAF callbacks queued and does not synchronize `options.paused`. |
| `restart()` | `undefined` | Reset clocks, pointer, ink, and fish state; preserve playback pause. Render one frame. |
| `pulse()` | `undefined` | In Swim-by, restart. In other scenes, resume a paused engine and emit `artwork:resume`, then startle a chosen eligible animal. This implicit resume is an accessibility compatibility risk. |
| `getStats()` | Fresh object | Copy aggregate and per-animal telemetry. Original allocates arrays and objects per call; suitable for a modest UI poll rate, not a render-loop subscription. |
| `resize()` | `undefined` | Read the CSS box, choose DPR ≤2, rebuild buffers/atlases, render. Original substitutes 900×620 when a dimension is zero and has no pixel-area limit. |
| `render()` | `undefined` | Draw current state without advancing time; uses browser Canvas 2D. The original still updates pose/visibility caches while drawing. |
| `destroy()` | `undefined` | Set destroyed flag, cancel the saved RAF, disconnect resize observer, remove pointer/visibility listeners. Original retains canvas/buffer references and has no general post-destroy method contract. |

Except for `getStats()`, do not depend on chaining. A future fluent API would be a new contract.

## Statistics

```ts
interface LegacyStats {
  fps: number;
  glyphs: number;
  time: number;
  phase: string;
  progress: number;
  agitation: number;
  reactionStage: 'idle' | 'react' | 'spray' | 'escape' | 'recover';
  inkGlyphs: number;
  count: number;
  visibleCount: number;
  formation: 'independent' | 'horizontal' | 'vertical' | 'diagonal' | 'random';
  fish: Array<{
    id: number; // 1-based display identity, unlike behaviors array indices.
    behavior: 'cruise' | 'hover' | 'orbit' | 'curious' | 'encounter';
    phase: string;
    reactionStage: 'idle' | 'react' | 'spray' | 'escape' | 'recover';
    visible: boolean;
    size: number;
  }>;
}
```

`glyphs` counts occupied body cells, not total geometry samples, total Canvas draw calls, or ink. `inkGlyphs` is separate. `fps` is an engine estimate from processed frames; it is not GPU presentation time, dropped-frame accounting, or a browser performance score. `phase` is explanatory copy, not a stable state-machine enum. Use `reactionStage` for stage logic. A single aggregate stage cannot fully represent differently reacting school members; use `fish` when that matters.

## Candidate hardening contract

The local candidate is `ascii-animals-review@0.0.0-review.0`, marked private and `UNLICENSED` pending an owner decision. This is a local tarball identity, not a package-availability claim. The declaration file and recorded tests are authoritative for implemented additions; full browser acceptance remains separate.

```js
import { CuttlefishArtwork, createCuttlefish } from 'ascii-animals-review/cuttlefish';

// These return the same kind of engine instance.
const artwork = createCuttlefish(canvas, { count: 4 });
// const artwork = new CuttlefishArtwork(canvas, { count: 4 });
```

| New option | Default | Candidate contract |
| --- | --- | --- |
| `autoStart` | `true` | Permit automatic scheduling. Set `false` for a manually driven instance. |
| `reducedMotion` | `'system'` | `'system'` or `'ignore'`; follow system motion preference by default. An explicitly supplied constructor `paused: false` opts into playback. A transition to reduced motion pauses; leaving reduced motion does not auto-resume. |
| `maxDpr` | `2` | Clamped to `0.5`–`2`; ceiling for effective DPR, which may fall below 0.5 to satisfy backing-pixel or dimension limits. |
| `maxPixels` | `8,294,400` | Integer main-canvas backing-store pixel ceiling, clamped to `65,536`–`16,777,216`. This does not bound complete process or GPU memory. |
| `maxCells` | `65,536` | Integer per-grid cell ceiling, clamped to `1,024`–`262,144`. The body grid and ink grid each have this ceiling; it is not their combined cell count. Effective cell size may be coarser than requested density. |
| `maxFps` | `60` | Automatic-render cadence ceiling, clamped to `10`–`120`; not a guaranteed frame rate. The 10 fps floor fits the maximum 0.1-second update interval. |
| `observeVisibility` | `true` | Suspend automatic work outside the viewport when supported by the host. |

The candidate adds `advance(dtSeconds)` for a finite interval in `[0, 0.1]`. It requires `autoStart: false`, advances regardless of `paused` because the call is explicit manual work, and does not mean arbitrary-time seek or frame-rate-independent replay. For a repeatable run, call `restart()`, use the same viewport/options, and feed the same input and duration sequence. Do not mix manual driving with automatic scheduling.

`getStats()` additionally reports `paused`, `running`, `destroyed`, `droppedSeconds`, `width`, `height`, `dpr`, and `cells`. `running` describes automatic scheduling eligibility; it should not be confused with a manual step or a guarantee that a rendered frame met its deadline. `droppedSeconds` records elapsed time deliberately discarded by the engine's catch-up limit, not a count of GPU-dropped frames.

The main backing store and each grid also have a per-axis 8,192-pixel/cell ceiling. Glyph atlas sprite resolution is capped separately at 64 pixels, giving the 25-glyph, 72-row body atlas a maximum 1,600×4,608-pixel canvas. The destination glyph size follows the logical cell size; bounding atlas resolution does not force every large cell to contain a tiny glyph. Main-canvas pixel limits, per-grid cell limits, and atlas limits cover different allocations and must not be presented as a single total-memory cap.

Candidate lifecycle invariants:

- Importing the ESM entry must not read browser globals, create canvases, install listeners, mutate globals, or schedule animation.
- Construction is browser-only, takes a sized canvas, and owns exactly one set of listeners and scheduling resources.
- A paused, hidden, offscreen, zero-sized, or disposed instance contributes no automatic work. Eligible instances share a per-window scheduler. Explicit user playback state stays distinct from automatic suspension reasons.
- Explicit Play is the only action that overrides an initial reduced-motion pause. An action such as startle must not silently start motion.
- `destroy()` is safe to repeat; it cancels work, disconnects observers, removes listeners, and releases large owned buffers. It retains the caller's canvas/last frame and enough state for `getStats()` to remain readable. Later mutators are no-ops; this is not a promise to clear every object reference.
- Manual time advancement uses `advance(dtSeconds)` as documented above. Private `_tick()` is not an export API.
- Independent instances must not share mutable fish, particle, pointer, or pause state. Shared immutable lookup tables are possible later.

### Explicit behavior changes

`pulse()` no longer resumes a paused instance, and the candidate does not emit the legacy `artwork:resume` event. Call `setPaused(false)` from a deliberate Play action first. `setPaused` and `setOptions({ paused })` keep `options.paused` consistent. A zero-size element stays suspended; it no longer allocates a 900×620 fallback. Importing the ESM candidate does not create `window.CuttlefishArtwork`. These differences need migration acceptance, even though they improve resource and motion behavior.

### Determinism has a specific scope

Stable hash-derived animal variation already exists, but the original engine is not a deterministic recording API. Pointer disturbance uses `performance.now()`, ink seeds include elapsed time, particle integration depends on frame partition, and `_tick()` clamps a long frame to 0.1 seconds. For the candidate, reproducibility means the same initial options, viewport, ordered inputs, and identical step sequence give the same simulation state within one supported runtime. It does not promise identical pixels across browser fonts, platforms, DPRs, or floating-point implementations. A future fixed-step input log needs a versioned replay schema and checkpoints before it can be a supported file format.

## Host accessibility responsibilities

Give meaningful artwork a concise accessible name and accompanying explanation, e.g. `role="img"` plus `aria-label`. Decorative artwork should be hidden from assistive technology and must not take focus. Provide native HTML Play/Pause and action buttons outside the canvas. Explain what startle does. Keep a static frame or description available while paused or when Canvas 2D is unavailable. Do not announce per-frame telemetry in a live region.

Canvas cells are pictures of characters, not selectable text. This renderer is not terminal output or an accessible text representation. Its content must be described through ordinary DOM text.

## Source references

- Imported engine: `dist/artwork.js`, import base `7e5984d34a139b8de4643f1ed0607897a42d88dc` (blob-equivalent local snapshot `afcce9941c5fa13ca5c658564e73388e603dff14`).
- Microsite integration: `dist/app.js` and `dist/index.html`, same snapshot.
- Recorder: `dist/record.html`, same snapshot; uses the engine global and browser recording APIs.
- Package and adapter design references are collected in [SOURCE-REFERENCES.md](SOURCE-REFERENCES.md).
