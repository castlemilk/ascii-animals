# Seahorse artwork

Newly authored in this integration. The earlier Pro chat's implementation could
not be exported; this is not presented as recovered source. The procedural study
is a stylized upright seahorse with a tubular snout, coronet, segmented trunk,
independently fluttering fins and tapering spiral tail. No external art or fonts.

```ts
import {createSeahorseArtwork} from 'ascii-animals-review/seahorse';
const artwork=createSeahorseArtwork(canvas,{behavior:'holdfast',palette:'brass'});
artwork.update({facing:'right',speed:.8});
artwork.guide(.5,-.2); // normalized; does not start playback
artwork.pulse();       // inspect → curl → settle; static curl when paused
artwork.pause(); artwork.restart(); // preserves user pause
const text=artwork.getFrame().text;
artwork.dispose(); // idempotent; later mutators no-op
```

The package is private/unpublished. This is a typed subpath in the local packed
package, not an npm registry availability claim. `createSeahorseArtwork` is also
exported at the root. It does not falsely accept cuttlefish formations or ink.

## Configuration

All patches are validated atomically, unknown options rejected, undefined omitted.
Snapshots and defaults are frozen. Runtime values are checked for finite bounds.

| Option | Values/default |
|---|---|
| columns / rows | integers64–160 /36–100; defaults100/60 |
| seed | integer0–2147483647; default7 |
| behavior | hover / curious / holdfast; defaulthover |
| facing | left / right; defaultleft |
| palette | brass / lagoon / rose; defaultbrass |
| speed | .25–2; default1 |
| scale | .6–1.3; default1 |
| sway | 0–.4 worldunits; default.18 |
| paused | boolean; defaultfalse before system policy |
| reducedMotion | system / ignore; defaultsystem |

Browser-only `frameSource` accepts the existing Scheduler interface; borrowed
schedulers are not disposed. The default scheduler is shared per owning window.
`play()` clears user pause, not system reduced-motion or visibility blockers.
Pointer input, options, restart and Greet never override those blockers. A live
reduce preference stops scheduling. Offscreen/hidden/zero-size views also rest.

`createSeahorseModel(options)` is pure, SSR-safe and DOM-free. `advanceTicks(0..600)`
uses integer60Hz steps. `guide(x,y)` clamps finite normalized input. `greet()` is
ignored during an active response; `greet(true)` selects the static curl poster.
Same version, seed, ordered events and integer ticks produce identical logical
cells; identical pixels across system fonts are not promised. `frame()` returns
printable ASCII and typed cells. The browser caps catch-up at6ticks and records
dropped wall time. No measured FPS/battery performance claim is made.

Browser controller methods: update, play, pause, restart, pulse, guide, resize,
dispose, getOptions, getStatus, getFrame. `getStatus()` distinguishes reduced
motion, viewport, hidden, disposed and effective paused state. Canvas ownership
stays with the host; listeners/observers/subscriptions are removed on dispose.

## Verification scope

Automated tests cover invalid/partial configuration, seeded integer replay,
response phase order, bounded ASCII grids, static greeting, pause and visibility
composition, live reduced motion, multi-instance cleanup, rollback, resize caps
and generated-demo consistency. Actual browser visual acceptance is a separate
gate. Existing code tests do not prove WCAG conformance, device FPS, or anatomy.

Validation in this branch: 76 aggregate tests, strict TypeScript and actual offline
packed-consumer/SSR/type checks passed. Author Chrome inspection confirmed the
snout, coronet, fin, curled tail and holdfast frond, and paused static Greet.
Independent browser acceptance remains pending; no mobile/performance claim.
