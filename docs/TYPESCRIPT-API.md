# Typed public API

`src/public/index.ts` is the authoritative strict TypeScript facade. The build
emits JavaScript, declarations, and source maps with embedded source; it does not hand-copy facade
types. The canonical renderer remains private JavaScript with its existing legacy
export declarations. TypeScript is a pinned development dependency, never runtime.

## Configuration

`ArtworkOptions` covers every implemented cuttlefish option in `docs/API.md`, plus
`species: 'cuttlefish'`. `DEFAULT_OPTIONS` is an immutable default snapshot.
`normalizeOptions(options)` validates and copies without reading a DOM.
`getOptions()` returns a fresh immutable snapshot with the actual pause state.

The facade rejects unknown keys, unsupported enums, wrong Boolean types, nonfinite
numbers, out-of-range numbers, fractional population/resource limits, and more than
12 or unsupported behavior entries. It does not silently coerce or clamp. An
undefined optional value means omitted. All validation happens before an update
reaches the renderer. Behavior arrays are copied and frozen. See the emitted
`ArtworkOptions` type and `DEFAULT_OPTIONS` for discoverable defaults.

Scene and formation changes reset choreography and ink; changed roles reset their
animal. Size, shading and performance changes preserve existing simulation time.
The full normalized snapshot is provided by `getOptions`; do not mutate legacy
renderer internals. Palette names, font stack, glyph repertoire and background are
currently renderer-defined: arbitrary fonts/colors/species are not claimed.

## Ownership and lifecycle

`createArtwork(canvas, options)` owns listeners and scheduling, not the supplied
canvas DOM node. Module import is SSR-safe; construction requires Canvas 2D.
`pause`, `play`, `restart`, `pulse`, `resize`, `render`, `getStats`, `advance`, and
`dispose` delegate to the canonical engine. `disposed` reports teardown.

Omitting pause honors system reduced motion. Explicit `paused:false` or `play()`
is an intentional override. `pulse()` never starts playback. Changing back to
`reducedMotion:'system'` rechecks the preference. `restart()` preserves pause.
`advance(seconds)` requires `autoStart:false`, accepts 0–0.1 seconds, and is explicit
manual work even when paused. It is not a seek/replay file-format API.

`dispose()` is idempotent; later mutators do nothing and snapshots remain readable.
Separate instances retain independent state. No per-frame reactive UI callback is
promised; read stats at a modest host-chosen rate and clear that timer on unmount.

## Verification boundaries

Runtime tests cover immutable configuration, strict rejection/atomicity, OS pause,
manual time and teardown. Actual tarball fixtures compile under strict NodeNext and
Bundler resolution with exact optional properties, including negative type cases.
Numerical mocks do not certify pixels, accessibility, or device performance.
