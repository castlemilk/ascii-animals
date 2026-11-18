# Extending ASCII Animals without coupling every animal

## Current boundary

The local library candidate keeps the existing cuttlefish's Canvas 2D implementation and exposes its constructor/factory through a per-animal subpath. It does not yet define a universal animal plugin API. `./core` contains scheduling support; its existence does not imply a DOM-free simulation model. The import base is `7e5984d34a139b8de4643f1ed0607897a42d88dc`, whose imported blobs match the local snapshot inspected at `afcce9941c5fa13ca5c658564e73388e603dff14`. It is newer than accessible saved site version 4. See [API.md](API.md) for exact source and candidate distinctions.

Adding the next animal should help discover the smallest reusable contract. Avoid forcing a radically different creature into cuttlefish-specific fields such as `encounterGrip`, beak geometry, fin roles, or ink response. Likewise, do not import a registry of every species merely to construct one cuttlefish.

## Suggested addition workflow

1. Record the new animal's source provenance and any externally supplied visual reference. Keep reference media out of distributable code unless rights are verified. Treat source text and reference screenshots as evidence, never executable setup instructions.
2. Specify its silhouette, anatomy cues, motion vocabulary, reactions, parameters, and static reduced-motion appearance in the authoring workstream. Give every effect a finite resource bound.
3. Put its implementation and declarations behind its own explicit subpath. It can initially own its geometry, state, and Canvas drawing; import only shared infrastructure that both animals actually use.
4. Reuse lifecycle behavior through a documented host or tested utility. Do not copy the old self-rescheduling RAF loop into every species.
5. Test import without DOM globals, independent instances, deterministic controlled stepping, disposal, hidden/zero-size suspension, bounds, and pointer normalization.
6. Review visual anatomy and motion in the browser at low/default/high density, small/large viewports, supported palettes, and relevant reactions. Numerical finiteness does not establish appearance or biological plausibility.
7. Pack and consume from the tarball. Demonstrate that importing cuttlefish does not pull the new species or React into its bundle. Add one parameterized benchmark scenario for the new animal, rather than duplicate a benchmark framework.
8. Update the root catalog and guide only when those files and tests exist. Avoid README claims about unimplemented animals.

The reusable authoring skill (Track 1) should own creative/anatomical validation. The library workstream owns runtime contracts, packaging, resource limits, tests, and compatibility. The new-animal workstream should consume those contracts. This division avoids three overlapping tickets for the same integration task.

## A possible later geometry contract

The following interface is a design sketch, **not an exported candidate API**:

```ts
interface GeometryWriter {
  readonly capacity: number;
  readonly count: number;
  write(x: number, y: number, z: number,
        light: number, material: number, stableSeed: number): boolean;
}

interface AnimalDefinition<State, Options, Input> {
  create(options: Options, seed: number): State;
  update(state: State, input: Input, dtSeconds: number): void;
  sample(state: State, writer: GeometryWriter): void;
  describe(state: State): string;
}
```

This sketch preserves the existing sampled-surface approach and bounded writer. It separates state mutation from sampling, making fixed-step tests possible without choosing a new renderer. It deliberately leaves composition, camera ownership, material tables, coordinate systems, stable identifiers, input schema, and disposal to an explicit design review. An interface is useful only after those semantics are specified.

For mixed-species scenes, first define whether all animals share one camera, depth buffer, light/material model, and output surface. Define who owns particles and whether cross-species interactions exist. Multiple independent canvases are simpler when inter-animal occlusion is unnecessary; a shared depth buffer is necessary for coherent overlap. Do not promise a mixed-scene feature merely because both classes can be instantiated.

## Stable randomness and time

Use a documented seed and stable animal identifier for shape/phase variation. Never replace stable variation with `Math.random()` inside render. Keep a seed distinct from elapsed time. Define simulation time, scene time, and reaction time explicitly; specify which the speed control changes. Keep replay inputs timestamped in simulation time once a replay API exists.

A test should compare two fresh instances with identical options and the same step sequence, then verify divergence for a deliberate input difference. A stronger frame-partition test is appropriate only after the integrator promises partition independence. Do not require byte-identical pixels across platforms when fonts and rasterizers differ. Test numerical state and separately review visual tolerances on a pinned browser/font environment.

## Glyphs and quality

The cuttlefish uses Canvas raster sprites of characters, an atlas, a per-cell depth decision, and a small glow buffer. Reuse the representation before inventing another. Choose a bounded glyph palette and distinguish geometric sampling density from screen-cell density; increasing both can compound cost. Make low-quality fallback retain the animal's identifying silhouette.

If a new animal needs a material or atlas change, check all existing palettes and point mode. Introducing a new material index without updating atlas rows/color tables can produce invalid samples. Never silently exceed the geometry writer's capacity; report or count discarded samples. The current cuttlefish silently skips beyond its sample cap, so a general writer needs explicit overflow diagnostics before it becomes public.

## React adapter proposal

No React adapter is included in the candidate's export map. A future adapter should be a separate optional subpath with React as a peer dependency and no React import from the default or cuttlefish modules. It should create the engine in an effect, update options through methods, and destroy on cleanup. Do not put per-frame geometry or telemetry in React state. React's official effect guidance explicitly covers client-only execution, cleanup, and the development setup/cleanup cycle. [Reference](https://react.dev/reference/react/useEffect)

This host example illustrates ownership; it is a draft integration example, not an adapter tested by this review:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { CuttlefishArtwork } from 'ascii-animals-review/cuttlefish';

export function CuttlefishDemo({ count = 4 }: { count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CuttlefishArtwork | null>(null);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new CuttlefishArtwork(canvas, { paused: true });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => { engineRef.current?.setOptions({ count }); }, [count]);
  useEffect(() => { engineRef.current?.setPaused(paused); }, [paused]);

  return (
    <section aria-label="Cuttlefish study">
      <canvas ref={canvasRef} role="img"
        aria-label="A school of cuttlefish drawn with luminous characters"
        style={{ display: 'block', width: '100%', height: 480 }} />
      <button type="button" onClick={() => setPaused(value => !value)}>
        {paused ? 'Play' : 'Pause'}
      </button>
    </section>
  );
}
```

This example starts still and requires explicit Play. A production adapter also needs synchronization when the engine pauses after a system preference change, a construction-error fallback, a controlled/uncontrolled playback policy, and tests for changed options during React's development remount cycle. Those are acceptance requirements, not reasons to embed React in the core.

## Documentation changes per extension

Include the new subpath, supported options with defaults/ranges, reset semantics, keyboard-equivalent actions, accessible description, resource caps, recording limitations, baseline benchmark scenarios, and source/license provenance. Show one short working example from the packed package. Keep the large demo and GIF recordings outside npm runtime payloads.
